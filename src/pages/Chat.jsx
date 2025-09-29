import { useEffect, useState, useRef, useCallback } from "react";
import {
  Card,
  Typography,
  Button,
  Progress,
  Input,
  Spin,
  Alert,
  Space,
} from "antd";
import { useNavigate } from "react-router-dom";
import {
  fetchQuestion,
  generateQuestions,
  evaluateAnswers,
} from "../utils/geminiClient";
import { store } from "../store";
import { broadcastMessage } from "../utils/broadcast";
import { useSelector, useDispatch } from "react-redux";
import {
  startSession,
  startQuestion,
  submitAnswer,
  updateCurrentSession,
} from "../store/sessionSlice";
import { updateQuestion } from "../store/sessionSlice";
import QuestionDisplay from "../components/Chat/QuestionDisplay";
import TimerProgress from "../components/Chat/TimerProgress";
import AnswerBox from "../components/Chat/AnswerBox";
import Controls from "../components/Chat/Controls";

const { Title, Paragraph } = Typography;

const DEFAULT_QUESTIONS = [
  { id: 1, text: "Introduce yourself briefly.", difficulty: "Easy" },
  {
    id: 2,
    text: "Tell me about a challenging bug you fixed and how you approached it.",
    difficulty: "Easy",
  },
  {
    id: 3,
    text: "Explain the difference between var, let and const.",
    difficulty: "Medium",
  },
  {
    id: 4,
    text: "Describe how you would design a REST API for a blog platform.",
    difficulty: "Medium",
  },
  {
    id: 5,
    text: "Design a URL shortener and discuss scaling considerations.",
    difficulty: "Hard",
  },
  {
    id: 6,
    text: "Explain how you would design an eventually-consistent distributed counter and trade-offs.",
    difficulty: "Hard",
  },
];

const DIFFICULTY_SECONDS = { Easy: 20, Medium: 60, Hard: 120 };

export default function Chat() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentSession = useSelector(
    (s) => s.session && s.session.currentSession
  );
  const candidates = useSelector((s) => s.session && s.session.candidates);
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [input, setInput] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState(null);
  const [qErrors, setQErrors] = useState({});
  const [completed, setCompleted] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [submittedThisQuestion, setSubmittedThisQuestion] = useState(false);
  const timerRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const isEvaluatingRef = useRef(false);
  const questionsFetchedRef = useRef(false);
  const INCOMPLETE_KEY = "incompleteSession";

  function buildSnapshotFromState() {
    const state =
      store.getState().session && store.getState().session.currentSession;
    if (!state) return null;
    return {
      ...state,
      savedAt: Date.now(),
    };
  }

  useEffect(() => {
    // If a session is restored into the store, make sure our local index
    // follows the authoritative `currentSession.questionIndex`. Without
    // this the UI can remain on question 0 while the store says a later
    // question is active which leads to skipped/disabled inputs after
    // resuming from an incomplete snapshot.
    if (!currentSession) return;
    const target = typeof currentSession.questionIndex === 'number' ? currentSession.questionIndex : 0;
    // Update the authoritative index immediately
    setIndex((prev) => (prev === target ? prev : target));

    // Also synchronously reconcile local UI state with the restored session
    // to avoid a render-order race where the UI shows the wrong question
    // (commonly observed as starting from question 1 and disabling input).
    try {
      const qs = Array.isArray(currentSession.questions) ? currentSession.questions : [];
      const q = qs[target] || null;
      const newQuestionText = q ? q.text || DEFAULT_QUESTIONS[target]?.text || '' : DEFAULT_QUESTIONS[0].text;
      const defaultTime = q && q.difficulty ? DIFFICULTY_SECONDS[q.difficulty] : DIFFICULTY_SECONDS.Easy;
      let rem = q ? (typeof q.remainingTime === 'number' ? q.remainingTime : q.timeLimit || defaultTime) : defaultTime;
      if (q && q.startedAt) {
        const elapsed = Math.floor((Date.now() - q.startedAt) / 1000);
        rem = Math.max(0, rem - elapsed);
      }
      const newInput = q && q.answer ? (q.answer.text || '') : '';
      const newSubmitted = Boolean(q && q.answer && q.answer.submittedAt);
      setQuestionText((prev) => (prev === newQuestionText ? prev : newQuestionText));
      setTimeLeft((prev) => (prev === rem ? prev : rem));
      setInput((prev) => (prev === newInput ? prev : newInput));
      setSubmittedThisQuestion((prev) => (prev === newSubmitted ? prev : newSubmitted));
    } catch (e) {
      void e;
    }
  }, [currentSession]);

  useEffect(() => {
    const lsCandidate = localStorage.getItem("candidateInfo");
    const hasCandidates = Array.isArray(candidates) && candidates.length > 0;
    if (!currentSession && !hasCandidates && !lsCandidate)
      navigate("/interviewee");
  }, [navigate, currentSession, candidates]);

  useEffect(() => {
    if (!currentSession) {
      try {
        // If there's an incomplete snapshot in localStorage, do not auto-start
        // a fresh session here — the resume flow should restore that snapshot
        // instead. This avoids clobbering restored state with a new session.
        const INCOMPLETE_KEY = "incompleteSession";
        const snapRaw = localStorage.getItem(INCOMPLETE_KEY);
        if (snapRaw) return;
        const candRaw = localStorage.getItem("candidateInfo");
        const cand = candRaw ? JSON.parse(candRaw) : null;
        const cid = cand && cand.id ? cand.id : (cand && cand.email) || null;
        dispatch(startSession(cid));
      } catch (e) {
        console.warn("Failed to start session", e);
      }
    }
  }, [currentSession, dispatch, navigate]);

  useEffect(() => {
    // persist current session snapshot when key pieces change
    const save = () => {
      try {
        const snap = buildSnapshotFromState();
        if (snap) localStorage.setItem(INCOMPLETE_KEY, JSON.stringify(snap));
      } catch (e) {
        void e;
      }
    };
    save();
    const iv = setInterval(save, 5000);
    const onVis = () => {
      if (document.visibilityState === "hidden") save();
    };
    const onUnload = () => {
      save();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [currentSession, index, timeLeft]);

  useEffect(() => {
    let mounted = true;
    const ensureQuestions = async () => {
      if (!currentSession) return;
      if (questionsFetchedRef.current) return;
      if (currentSession.generatingQuestions) return;
      if (
        Array.isArray(currentSession.questions) &&
        currentSession.questions.length >= 6
      )
        return;
      console.log("ensureQuestions start currentSession:", currentSession);
      setQLoading(true);
      try {
        questionsFetchedRef.current = true;
        try {
          dispatch(updateCurrentSession({ generatingQuestions: true }));
        } catch (e) {
          void e;
        }
        const candRaw = localStorage.getItem("candidateInfo");
        const cand = candRaw ? JSON.parse(candRaw) : null;
        const topic = cand && cand.topic ? cand.topic : undefined;
        const generated = await generateQuestions(
          ["Easy", "Easy", "Medium", "Medium", "Hard", "Hard"],
          { topic }
        );
        if (
          !generated ||
          !Array.isArray(generated) ||
          generated.length === 0 ||
          generated.every((it) => !it || !String(it.text || "").trim())
        ) {
          const msg = "AI is not responding";
          setQError(msg);
          setQErrors((prev) => ({ ...prev, batch: msg }));
          setQLoading(false);
          return;
        }
        try {
          const ss = store.getState().session || {};
          const cur = ss.currentSession || null;
          const cand = (ss.candidates && cur && ss.candidates.find((c) => c.id === cur.candidateId)) || (localStorage.getItem('candidateInfo') ? JSON.parse(localStorage.getItem('candidateInfo')) : null);
          const payload = cur ? { ...cur, candidate: cand || null } : null;
          if (payload) broadcastMessage('session:updated', payload);
        } catch (e) { void e }
        const DIFFICULTY_SECONDS = { Easy: 20, Medium: 60, Hard: 120 };
        const qs = generated.map((it, i) => ({
          id: it.id || i + 1,
          text: it.text || `Question ${i + 1}`,
          difficulty:
            it.difficulty || (i < 2 ? "Easy" : i < 4 ? "Medium" : "Hard"),
          timeLimit:
            it.timeLimit ||
            DIFFICULTY_SECONDS[
              it.difficulty || (i < 2 ? "Easy" : i < 4 ? "Medium" : "Hard")
            ],
        }));
        try {
          dispatch({ type: "session/setSessionQuestions", payload: qs });
        } catch (e) {
          console.warn("dispatch setSessionQuestions failed", e);
        }
        try {
          dispatch({
            type: "session/startQuestion",
            payload: {
              index: 0,
              startedAt: Date.now(),
              remainingTime: qs[0].timeLimit,
            },
          });
        } catch (e) {
          console.warn("dispatch startQuestion failed", e);
        }
        try {
          console.log(
            "questions persisted to store:",
            store.getState().session && store.getState().session.currentSession
          );
        } catch (e) {
          console.warn(e);
        }
      } catch {
        const msg =
          "Could not generate interview questions. Redirecting to main page.";
        if (mounted) {
          setQError(msg);
          setQErrors((prev) => ({ ...prev, batch: msg }));
          setTimeout(() => {
            try {
              navigate("/interviewee", { replace: true });
            } catch (navErr) {
              console.warn("Redirect to main page failed", navErr);
            }
          }, 1500);
        }
        return;
      } finally {
        try {
          dispatch(updateCurrentSession({ generatingQuestions: false }));
        } catch (e) {
          void e;
        }
        setQLoading(false);
      }
    };
    ensureQuestions();
    return () => {
      mounted = false;
    };
  }, [currentSession, dispatch, navigate]);

  useEffect(() => {
    if (!currentSession || !Array.isArray(currentSession.questions)) return;
    const q = currentSession.questions[index];
    if (!q) return;
    const newQuestionText = q.text || DEFAULT_QUESTIONS[index].text;
    const defaultTime = DIFFICULTY_SECONDS[q.difficulty] || 30;
    let rem =
      typeof q.remainingTime === "number"
        ? q.remainingTime
        : q.timeLimit || defaultTime;
    if (q.startedAt) {
      const elapsed = Math.floor((Date.now() - q.startedAt) / 1000);
      rem = Math.max(0, rem - elapsed);
    }
    const newInput = (q.answer && q.answer.text) || "";
    const newSubmitted = Boolean(q.answer && q.answer.submittedAt);
    // Use functional updaters so we don't need to reference local state in the
    // dependency array. This prevents the effect from clobbering the user's
    // in-progress typing (which would occur if we read `input` directly here
    // and reset it to the store value on each render).
    setQuestionText((prev) => (prev === newQuestionText ? prev : newQuestionText));
    setTimeLeft((prev) => (prev === rem ? prev : rem));
    setInput((prev) => (prev === newInput ? prev : newInput));
    setSubmittedThisQuestion((prev) => (prev === newSubmitted ? prev : newSubmitted));
    // Only dispatch startQuestion if the question hasn't already been started.
    try {
      if (!q.startedAt) {
        dispatch(startQuestion({ index, startedAt: Date.now(), remainingTime: rem }));
      }
    } catch (e) {
      console.warn(e);
    }
    // Intentionally only depend on the authoritative store and index. We do
    // not include local state like `input` to avoid clobbering the user's
    // in-progress edits.
  }, [currentSession, index, dispatch]);

  useEffect(() => {
    if (qLoading) return;
    if (typeof timeLeft !== "number") return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(
      () => setTimeLeft((t) => Math.max(0, t - 1)),
      1000
    );
    return () => clearInterval(timerRef.current);
  }, [index, qLoading, timeLeft]);

  const handleSubmit = useCallback(async () => {
    if (!currentSession || !Array.isArray(currentSession.questions)) return;
    const q = currentSession.questions[index];
    if (!q) return;
    // Prevent re-entrancy: if already submitting, evaluating, or session is completed, bail out
    if (isSubmittingRef.current || isEvaluatingRef.current || completed) return;
    isSubmittingRef.current = true;
    setSubmittedThisQuestion(true);
  clearInterval(timerRef.current);
    try {
      dispatch(
        submitAnswer({
          questionIndex: index,
          text: input,
          score: null,
          feedback: null,
        })
      );
      try {
        const ss = store.getState().session || {};
        const cur = ss.currentSession || null;
        const cand = (ss.candidates && cur && ss.candidates.find((c) => c.id === cur.candidateId)) || (localStorage.getItem('candidateInfo') ? JSON.parse(localStorage.getItem('candidateInfo')) : null);
        const payload = cur ? { ...cur, candidate: cand || null } : null;
        if (payload) broadcastMessage('session:updated', payload);
      } catch (e) { void e }
    } catch (e) {
      console.warn("submitAnswer dispatch failed", e);
    }
    try {
      const latest =
        store.getState().session && store.getState().session.currentSession;
      const questions =
        latest && Array.isArray(latest.questions)
          ? latest.questions
          : currentSession.questions || [];
      console.log(
        "handleSubmit: questions count",
        questions.length,
        "current index",
        index
      );
      console.log(
        "handleSubmit: answers state",
        questions.map((qq, i) => ({
          i,
          answered: Boolean(qq && qq.answer && qq.answer.submittedAt),
        }))
      );
      const allAnswered =
        questions.length > 0 &&
        questions.every((qq) => qq && qq.answer && qq.answer.submittedAt);
      if (!allAnswered) {
        // find next unanswered question after current index, fallback to first unanswered
        let next = questions.findIndex(
          (qq, i) => (!qq.answer || !qq.answer.submittedAt) && i > index
        );
        if (next === -1)
          next = questions.findIndex(
            (qq) => !qq.answer || !qq.answer.submittedAt
          );
        if (next === -1) {
          // fallback to sequential next if nothing else
          next = Math.min(index + 1, Math.max(0, (questions.length || 1) - 1));
        }
        const nextQ = questions[next];
        const nextTime = nextQ
          ? nextQ.timeLimit || DIFFICULTY_SECONDS[nextQ.difficulty]
          : DIFFICULTY_SECONDS.Easy;
        try {
          dispatch(
            startQuestion({
              index: next,
              startedAt: Date.now(),
              remainingTime: nextTime,
            })
          );
        } catch (e) {
          console.warn(e);
        }
        setIndex(next);
        isSubmittingRef.current = false;
        setSubmittedThisQuestion(false);
      } else {
        console.log("handleSubmit: all questions answered, running evaluation");
        // Double-check authoritative store flag to avoid a race where two callers
        // start evaluation almost simultaneously (e.g., click + timer).
        try {
          const latestCheck = store.getState().session && store.getState().session.currentSession;
          if (latestCheck && latestCheck.evaluating) {
            console.log("handleSubmit: authoritative store says evaluation in progress, skipping");
            return;
          }
        } catch (e) {
          void e;
        }
        try {
          // mark evaluating in the store first (synchronous with Redux) to make it authoritative
          dispatch(updateCurrentSession({ evaluating: true }));
        } catch (e) {
          void e;
        }
        try {
          isEvaluatingRef.current = true;
        } catch (e) {
          void e;
        }
        setCompleted(true);
        try {
          dispatch(
            updateCurrentSession({ remainingTime: 0, questionStartAt: null })
          );
        } catch (e) {
          console.warn(e);
        }
        setSummaryLoading(true);
        try {
          const qs = (currentSession.questions || []).map((q) => q.text || "");
          const answers = (currentSession.questions || []).map(
            (q) => (q.answer && q.answer.text) || ""
          );
          let evaluation = null;
          try {
            evaluation = await evaluateAnswers(qs, answers);
          } catch (evalErr) {
            console.warn("Evaluation failed", evalErr);
            // If the AI failed with a retryable/server error, surface a friendly message
            // and abort completion so the candidate can retry later.
            if (evalErr && evalErr.isGeminiError && evalErr.isRetryable) {
              const msg = evalErr.message || "AI is not responding right now. Please try again in a moment.";
              setSummaryError(msg);
              setSummary(null);
              try {
                dispatch(updateCurrentSession({ evaluating: false }));
              } catch (e) {
                void e;
              }
              try {
                isEvaluatingRef.current = false;
              } catch (e) {
                void e;
              }
              isSubmittingRef.current = false;
              setSummaryLoading(false);
              // Do not complete the session; allow retry
              return;
            }
            evaluation = { error: (evalErr && evalErr.message) || String(evalErr) };
          }
          setSummary(evaluation);
          try {
            // persist per-question scores and feedback into the session questions
            const latest = store.getState().session && store.getState().session.currentSession;
            const questionsArr = (latest && Array.isArray(latest.questions)) ? latest.questions : (currentSession.questions || []);
            const evals = (evaluation && Array.isArray(evaluation.evaluations)) ? evaluation.evaluations : [];
            for (let i = 0; i < questionsArr.length; i += 1) {
              const ev = evals[i] || {};
              try {
                dispatch(updateQuestion({ index: i, patch: { answer: { ...(questionsArr[i].answer || {}), score: typeof ev.score === 'number' ? ev.score : null, feedback: ev.feedback || null } } }));
              } catch (uqErr) {
                console.warn('updateQuestion failed for index', i, uqErr);
              }
            }
          } catch (writeErr) {
            console.warn('Failed to persist per-question evaluation results', writeErr);
          }
          const candRaw = localStorage.getItem("candidateInfo");
          const cand = candRaw ? JSON.parse(candRaw) : null;
          try {
            dispatch({
              type: "session/completeSession",
              payload: { summary: evaluation, candidate: cand },
            });
          } catch (e) {
            console.warn("completeSession dispatch failed", e);
          }
          try {
            broadcastMessage("session:completed", {
              ...currentSession,
              summary: evaluation,
              candidate: cand,
            });
          } catch (err) {
            console.warn("broadcast failed", err);
          }
          try {
            dispatch(updateCurrentSession({ evaluating: false }));
          } catch (e) {
            void e;
          }
          try {
            isEvaluatingRef.current = false;
          } catch (e) {
            void e;
          }
          try {
            localStorage.removeItem(INCOMPLETE_KEY);
          } catch (e) {
            void e;
          }
        } catch (err) {
          console.warn("Summary/evaluation generation failed", err);
          const msg =
            (err && err.message) || String(err) || "Summary generation failed";
          setSummaryError(msg);
          try {
            const candRaw = localStorage.getItem("candidateInfo");
            const cand = candRaw ? JSON.parse(candRaw) : null;
            try {
              dispatch({
                type: "session/completeSession",
                payload: { summary: { error: msg }, candidate: cand },
              });
            } catch (e) {
              console.warn("completeSession dispatch failed", e);
            }
            try {
              broadcastMessage("session:completed", {
                ...currentSession,
                summary: { error: msg },
                candidate: cand,
              });
            } catch (err) {
              console.warn("broadcast failed", err);
            }
            try {
              dispatch(updateCurrentSession({ evaluating: false }));
            } catch (e) {
              void e;
            }
            try {
              isEvaluatingRef.current = false;
            } catch (e) {
              void e;
            }
          } catch (e) {
            console.warn("completeSession dispatch failed", e);
          }
        } finally {
          setSummaryLoading(false);
          isSubmittingRef.current = false;
          try {
            navigate("/feedback", { replace: true });
          } catch (navErr) {
            console.warn("Navigation to feedback failed", navErr);
          }
        }
      }
    } catch (outerErr) {
      console.warn("handleSubmit top-level failure", outerErr);
      isSubmittingRef.current = false;
      setSubmittedThisQuestion(false);
    }
  }, [currentSession, index, input, dispatch, navigate, completed]);

  useEffect(() => {
    if (
      typeof timeLeft === "number" &&
      timeLeft <= 0 &&
      currentSession &&
      Array.isArray(currentSession.questions)
    ) {
      if (isSubmittingRef.current || isEvaluatingRef.current) return;
      handleSubmit();
    }
  }, [timeLeft, handleSubmit, currentSession]);

  const q =
    (currentSession &&
      currentSession.questions &&
      currentSession.questions[index]) ||
    DEFAULT_QUESTIONS[index];
  const perQError = qErrors && qErrors[index];
  return (
    <Card style={{ minHeight: 300 }}>
      <Title level={3}>Chat / Interview</Title>
      {!currentSession || qLoading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Spin /> Preparing interview...
        </div>
      ) : (
        <>
          {completed && (
            <div style={{ marginBottom: 12 }}>
              {summaryLoading ? (
                <div>
                  <Spin /> Generating summary...
                </div>
              ) : summary ? (
                <div>
                  <Alert
                    type="success"
                    message="Interview complete — summary available below."
                  />
                  <pre
                    style={{ background: "#fafafa", padding: 12, marginTop: 8 }}
                  >
                    {JSON.stringify(summary, null, 2)}
                  </pre>
                </div>
              ) : (
                <div>
                  <Alert
                    type="info"
                    message="Interview complete. Waiting for summary..."
                  />
                </div>
              )}
            </div>
          )}
          {summaryError && (
            <div style={{ marginBottom: 12 }}>
              <Alert
                type="error"
                message={`Summary generation failed: ${summaryError}`}
              />
            </div>
          )}
          <Paragraph>
            Question {index + 1} of{" "}
            {(currentSession &&
              currentSession.questions &&
              currentSession.questions.length) ||
              DEFAULT_QUESTIONS.length}{" "}
            — <strong>{q.difficulty}</strong>
          </Paragraph>
          <TimerProgress timeLeft={timeLeft} />
          <div style={{ marginBottom: 12 }}>
            <QuestionDisplay
              qLoading={qLoading}
              qError={qError}
              perQError={perQError}
              questionText={questionText}
              q={q}
              index={index}
              fetchQuestion={fetchQuestion}
              dispatch={dispatch}
              updateQuestion={updateQuestion}
              setQLoading={setQLoading}
              setQError={setQError}
              setQErrors={setQErrors}
            />
            <AnswerBox
              input={input}
              setInput={setInput}
              submittedThisQuestion={submittedThisQuestion}
            />
          </div>
          <Controls
            onSkip={() => setTimeLeft(0)}
            onSubmit={handleSubmit}
            submittedThisQuestion={submittedThisQuestion}
          />
        </>
      )}
    </Card>
  );
}

import { useEffect, useState, useRef, useCallback } from "react";
import { Spin, Alert } from "antd";
import { useNavigate } from "react-router-dom";
import { generateQuestions, evaluateAnswers } from "../utils/geminiClient";
import { store } from "../store";
import { broadcastMessage } from "../utils/broadcast";
import { useSelector, useDispatch } from "react-redux";
import { showToast } from "../utils/toast";
import {
  startSession,
  startQuestion,
  submitAnswer,
  restoreSession,
  resumeSession,
  updateQuestion,
  tickQuestion,
  updateCurrentSession,
} from "../store/sessionSlice";
import TimerProgress from "../components/Chat/TimerProgress";

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
  const hasEditedRef = useRef(false);
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
  const messagesRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const isEvaluatingRef = useRef(false);
  const isUnloadingRef = useRef(false);
  const questionsFetchedRef = useRef(false);
  const INCOMPLETE_KEY = "incompleteSession";
  const sessionInitRef = useRef(null);

  const questionsArray = currentSession && Array.isArray(currentSession.questions) ? currentSession.questions : DEFAULT_QUESTIONS;

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
    if (!currentSession) return;
    const sid = currentSession.id || null;
    if (sessionInitRef.current === sid) return;
    sessionInitRef.current = sid;

    const target = typeof currentSession.questionIndex === 'number' ? currentSession.questionIndex : 0;
    setIndex((prev) => (prev === target ? prev : target));

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
      
      let newInput = '';
      try {
        const sidKey = sessionInitRef.current || sid || (currentSession && currentSession.id) || null;
        if (sidKey) {
          const persisted = localStorage.getItem(`incompleteInput:${sidKey}:${target}`);
          if (persisted != null) {
            newInput = String(persisted || '');
          }
        }
      } catch (e) { void e }
      if (!newInput) newInput = q && q.answer ? (q.answer.text || '') : '';
      const newSubmitted = Boolean(q && q.answer && q.answer.submittedAt);
      setQuestionText((prev) => (prev === newQuestionText ? prev : newQuestionText));
      setTimeLeft((prev) => (prev === rem ? prev : rem));
      if (!hasEditedRef.current) {
        setInput((prev) => (prev === newInput ? prev : newInput));
      }
      setSubmittedThisQuestion((prev) => (prev === newSubmitted ? prev : newSubmitted));
    } catch (e) {
      void e;
    }
  }, [currentSession]);

  
  useEffect(() => {
    let t = null;
    try {
      const sid = currentSession && currentSession.id ? currentSession.id : null;
      if (!sid || typeof index !== 'number') return;
      const key = `incompleteInput:${sid}:${index}`;

      t = setTimeout(() => {
        try { localStorage.setItem(key, String(input || '')); } catch (e) { void e }
      }, 250);
    } catch (e) { void e }
    return () => {
      try { if (t) clearTimeout(t); } catch (e) { void e }
    };
  }, [input, index, currentSession]);

  
  useEffect(() => {
    hasEditedRef.current = false;
  }, [index]);

  useEffect(() => {
    const lsCandidate = localStorage.getItem("candidateInfo");
    const hasCandidates = Array.isArray(candidates) && candidates.length > 0;
    if (!currentSession && !hasCandidates && !lsCandidate)
      navigate("/interviewee");
  }, [navigate, currentSession, candidates]);
  const [incompleteSnap, setIncompleteSnap] = useState(null);
  useEffect(() => {
    try {
      if (currentSession) { setIncompleteSnap(null); return; }
      const raw = localStorage.getItem('incompleteSession');
      if (!raw) return;
      const snap = JSON.parse(raw);
      if (snap && snap.id) setIncompleteSnap(snap);
    } catch (e) { void e }
  }, [currentSession]);

  useEffect(() => {
    if (!currentSession) {
      try {
        
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
    
    const save = () => {
      try {
        const snap = buildSnapshotFromState();
        if (!snap) return;
            
        try {
          if (typeof index === 'number') snap.questionIndex = index;
          if (Array.isArray(snap.questions) && snap.questions[index]) {
            
            let finalRem = null;
            if (typeof timeLeft === 'number') {
              finalRem = timeLeft;
            } else {
              try {
                const qq = snap.questions[index];
                const baseRem = typeof qq.remainingTime === 'number' ? qq.remainingTime : (typeof qq.timeLimit === 'number' ? qq.timeLimit : null);
                if (qq && typeof qq.startedAt === 'number' && typeof baseRem === 'number') {
                  const elapsed = Math.floor((Date.now() - qq.startedAt) / 1000);
                  finalRem = Math.max(0, baseRem - elapsed);
                } else {
                  finalRem = baseRem;
                }
              } catch {
                finalRem = typeof snap.questions[index].remainingTime === 'number' ? snap.questions[index].remainingTime : snap.questions[index].timeLimit;
              }
            }
            snap.questions[index].remainingTime = finalRem;
            
            snap.questions[index].startedAt = null;
            
            try {
              const existing = snap.questions[index].answer || null;
              if (!existing || !existing.submittedAt) {
                snap.questions[index].answer = { text: typeof input === 'string' ? input : (existing && existing.text) || '' };
              }
            } catch (e) { void e }
          }
        } catch (e) { void e }
        localStorage.setItem(INCOMPLETE_KEY, JSON.stringify(snap));
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
      try { isUnloadingRef.current = true } catch(e) { void e }
      save();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [currentSession, index, timeLeft, input]);

  useEffect(() => {
    let mounted = true;
    const ensureQuestions = async () => {
      if (!currentSession) return;
    
      if (currentSession._restored) {
        questionsFetchedRef.current = true;
        return;
      }
      if (questionsFetchedRef.current) return;
      if (currentSession.generatingQuestions) return;
      if (
        Array.isArray(currentSession.questions) &&
        currentSession.questions.length >= 6
      )
        return;
      
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
    let rem = typeof q.remainingTime === 'number' ? q.remainingTime : q.timeLimit || defaultTime;
    if (q.startedAt) {
      const elapsed = Math.floor((Date.now() - q.startedAt) / 1000);
      rem = Math.max(0, rem - elapsed);
    }
    const newInput = (q.answer && q.answer.text) || "";
    const newSubmitted = Boolean(q.answer && q.answer.submittedAt);
    
    setQuestionText((prev) => (prev === newQuestionText ? prev : newQuestionText));
  
  setTimeLeft((prev) => (prev === rem ? prev : rem));
    
    if (!hasEditedRef.current) {
      setInput((prev) => (prev === newInput ? prev : newInput));
    }
    setSubmittedThisQuestion((prev) => (prev === newSubmitted ? prev : newSubmitted));
    
    try {
  if (!q.startedAt && (currentSession && currentSession.status === 'in-progress')) {
        
        let savedRemaining = undefined;
        try {
          const raw = localStorage.getItem(INCOMPLETE_KEY);
          if (raw) {
            const snap = JSON.parse(raw);
            if (snap && Array.isArray(snap.questions) && snap.questions[index] && typeof snap.questions[index].remainingTime === 'number') {
              savedRemaining = snap.questions[index].remainingTime;
            }
          }
        } catch (e) {
          void e;
        }
        const useRemaining = typeof savedRemaining === 'number' ? savedRemaining : (typeof q.remainingTime === 'number' ? q.remainingTime : rem);
        dispatch(startQuestion({ index, startedAt: Date.now(), remainingTime: useRemaining }));
      }
    } catch (e) {
      console.warn(e);
    }
    
  }, [currentSession, index, dispatch]);

  
  useEffect(() => {
    if (qLoading || (currentSession && currentSession.status === 'paused')) {
      clearInterval(timerRef.current);
      return;
    }
    
    clearInterval(timerRef.current);
    
    if (!currentSession || !Array.isArray(currentSession.questions)) return;
    const q = currentSession.questions[index];
    if (!q || typeof q.remainingTime !== 'number') return;
    if (q.remainingTime <= 0) {
      setTimeLeft(0);
      return;
    }

    
    setTimeLeft(q.remainingTime);

    
    timerRef.current = setInterval(() => {
      try {
        dispatch(tickQuestion({ index }));
      } catch (e) { void e }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [index, qLoading, currentSession, dispatch]);

  useEffect(() => {
    try {
      const el = messagesRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    } catch (e) { void e }
  }, [index, questionsArray]);

  const handleSubmit = useCallback(async () => {
    if (!currentSession || !Array.isArray(currentSession.questions)) return;
    const q = currentSession.questions[index];
    if (!q) return;
    
    if (isSubmittingRef.current || isEvaluatingRef.current || completed) return;
    isSubmittingRef.current = true;
    setSubmittedThisQuestion(true);
  clearInterval(timerRef.current);
    try {
      dispatch(
        submitAnswer({
          questionIndex: index,
            text: typeof input === 'string' ? input : String(input || ''),
          score: null,
          feedback: null,
        })
      );
  try { setInput(''); } catch (e) { void e }
      try {
        const sid = currentSession && currentSession.id ? currentSession.id : null;
        if (sid) {
          try { localStorage.removeItem(`incompleteInput:${sid}:${index}`); } catch (e) { void e }
        }
      } catch (e) { void e }
      try {
        const ss = store.getState().session || {};
        const cur = ss.currentSession || null;
        const cand = (ss.candidates && cur && cur.candidates.find((c) => c.id === cur.candidateId)) || (localStorage.getItem('candidateInfo') ? JSON.parse(localStorage.getItem('candidateInfo')) : null);
        const payload = cur ? { ...cur, candidate: cand || null } : null;
        if (payload) broadcastMessage('session:updated', payload);
      } catch (e) { void e }
    } catch (e) {
      console.warn("submitAnswer dispatch failed", e);
  try { showToast('error', 'Failed to submit answer. Please try again.') } catch (e) { void e }
    }
    try {
      const latest =
        store.getState().session && store.getState().session.currentSession;
      const questions =
        latest && Array.isArray(latest.questions)
          ? latest.questions
          : currentSession.questions || [];
      
      const allAnswered =
        questions.length > 0 &&
        questions.every((qq) => qq && qq.answer && qq.answer.submittedAt);
      if (!allAnswered) {
        
        let next = questions.findIndex(
          (qq, i) => (!qq.answer || !qq.answer.submittedAt) && i > index
        );
        if (next === -1)
          next = questions.findIndex(
            (qq) => !qq.answer || !qq.answer.submittedAt
          );
        if (next === -1) {
          
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
  hasEditedRef.current = false;
      } else {
        
        
        try {
          const latestCheck = store.getState().session && store.getState().session.currentSession;
          if (latestCheck && latestCheck.evaluating) {
            
            return;
          }
        } catch (e) {
          void e;
        }
        try {
          
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
            
            if (evalErr && evalErr.isGeminiError && evalErr.isRetryable) {
              const msg = evalErr.message || "AI is not responding right now. Please try again in a moment.";
              setSummaryError(msg);
              try { showToast('error', msg) } catch (e) { void e }
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
              
              return;
            }
            evaluation = { error: (evalErr && evalErr.message) || String(evalErr) };
          }
          setSummary(evaluation);
          try {
            
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
            hasEditedRef.current = false;
          } catch (e) {
            void e;
          }
        } catch (err) {
          console.warn("Summary/evaluation generation failed", err);
          const msg =
            (err && err.message) || String(err) || "Summary generation failed";
          setSummaryError(msg);
            try { showToast('error', msg) } catch (e) { void e }
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

  
  
  const handleInputChange = useCallback((val) => {
    try {
      hasEditedRef.current = true;
      setInput(val);
      if (!currentSession || !Array.isArray(currentSession.questions)) return;
      const q = currentSession.questions[index] || null;
      const existing = (q && q.answer) || {};
      
      try {
        dispatch(updateQuestion({ index, patch: { answer: { ...existing, text: String(val || '') } } }));
      } catch (e) {
        
        console.warn('dispatch updateQuestion failed in handleInputChange', e);
      }
    } catch (e) {
      console.warn('handleInputChange failed', e);
    }
  }, [currentSession, index, dispatch]);

  useEffect(() => {
    const storeRem = (currentSession && Array.isArray(currentSession.questions) && currentSession.questions[index] && typeof currentSession.questions[index].remainingTime === 'number') ? currentSession.questions[index].remainingTime : null;
    const effectiveRem = typeof storeRem === 'number' ? storeRem : timeLeft;
    if (
      typeof effectiveRem === "number" &&
      effectiveRem <= 0 &&
      currentSession &&
      Array.isArray(currentSession.questions)
    ) {
      
      if (isUnloadingRef.current) return;
      if (isSubmittingRef.current || isEvaluatingRef.current) return;
      handleSubmit();
    }
  }, [timeLeft, handleSubmit, currentSession, index]);

  const q =
    (currentSession &&
      currentSession.questions &&
      currentSession.questions[index]) ||
    DEFAULT_QUESTIONS[index];
  const isSessionCompleted = (currentSession && currentSession.status === 'completed') || completed;
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="card-surface">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">AI Interview Chat</h3>
          <div className="chat-meta">Question {index + 1} of {(currentSession && currentSession.questions && currentSession.questions.length) || DEFAULT_QUESTIONS.length} — <span className="font-medium">{q.difficulty}</span></div>
        </div>

        {!currentSession || qLoading ? (
          
          (!currentSession && incompleteSnap) ? (
            <div className="mb-4">
              <div className="alert alert-warning">No active interview found. We detected a previous incomplete session.</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button className="btn" onClick={() => { try { localStorage.removeItem('incompleteSession') } catch(e) { void e } navigate('/interviewee') }}>Go to Home</button>
                <button className="btn btn-primary" onClick={() => { try { dispatch(restoreSession(incompleteSnap)); dispatch(resumeSession()); navigate('/chat'); } catch(e) { console.warn(e) } }}>Restore session</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2"><Spin /> Preparing interview...</div>
          )
        ) : (
          <>
            {completed && (
              <div className="mb-4">
                {summaryLoading ? (
                  <div className="flex items-center gap-2"><Spin /> Generating summary...</div>
                ) : summary ? (
                  <div>
                    <div className="alert alert-success">Interview complete — summary available below.</div>
                    <div className="bg-base-200 p-4 rounded mt-2">
                      <div><strong>Total:</strong> {typeof summary.totalScore === 'number' ? `${summary.totalScore}/60` : (typeof summary.totalScore === 'string' ? summary.totalScore : '—')}</div>
                      {Array.isArray(summary.evaluations) && summary.evaluations.length ? (
                        <div className="mt-2">
                          <strong>Per-question evaluations:</strong>
                          <ol className="list-decimal list-inside mt-2 space-y-2">
                            {summary.evaluations.map((ev, i) => (
                              <li key={i} className="space-y-1">
                                <div><strong>Q{i + 1}:</strong> {typeof ev.score === 'number' ? `${ev.score}/10` : (ev.score == null ? '—' : String(ev.score))}</div>
                                <div className="text-sm text-neutral">{ev.feedback || 'No feedback'}</div>
                              </li>
                            ))}
                          </ol>
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap">{JSON.stringify(summary, null, 2)}</pre>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-info">Interview complete. Waiting for summary...</div>
                )}
              </div>
            )}

            {summaryError && (
              <div className="mb-4">
                <div className="alert alert-error">Summary generation failed: {summaryError}</div>
              </div>
            )}

            <TimerProgress timeLeft={timeLeft} />
            {isSessionCompleted && (
              <div className="mb-4">
                <div className="alert alert-success">Interview completed — read-only view. You can review answers below.</div>
              </div>
            )}

            <div className="chat-container">
              <div className="messages" id="messages" ref={messagesRef}>
                {(currentSession && Array.isArray(currentSession.questions) ? currentSession.questions : DEFAULT_QUESTIONS)
                  .map((qq, i) => ({ qq, i }))
                  .filter(({ i }) => i <= index)
                  .map(({ qq, i }) => {
                    
                    const hasAnswer = qq && qq.answer && qq.answer.submittedAt;
                    const rawText = qq && qq.answer && typeof qq.answer.text === 'string' ? qq.answer.text : null;
                    const isCurrent = i === index;
                    const displayText = hasAnswer ? (rawText && String(rawText).trim() ? rawText : '(not answered)') : null;
                    return (
                      <div key={i}>
                        <div className="message-row ai">
                          <div className={`bubble ai`}> 
                            <div className="text-sm font-medium">Q{i + 1}: {qq.text}</div>
                            <div className="meta">{qq.difficulty}</div>
                          </div>
                        </div>
                        {hasAnswer && (
                          <div className="message-row user">
                            <div className="bubble user">
                              <div>{displayText}</div>
                            </div>
                          </div>
                        )}
                        
                        {isCurrent && !hasAnswer && (
                          <div className="message-row ai">
                            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Answer the question below</div>
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>

              <div className="chat-input-area">
                <textarea
                  className="chat-input"
                  rows={3}
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder={isSessionCompleted ? 'Interview completed — read-only' : 'Type your answer here'}
                  disabled={submittedThisQuestion || isSessionCompleted}
                />
                <button className="send-btn" onClick={handleSubmit} disabled={submittedThisQuestion || isSessionCompleted}>{isSessionCompleted ? 'Completed' : (submittedThisQuestion ? 'Submitted' : 'Send')}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

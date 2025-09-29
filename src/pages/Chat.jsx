import { useEffect, useState, useRef, useCallback } from 'react';
import { Card, Typography, Button, Progress, Input, Spin, Alert, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { fetchQuestion, generateQuestions, evaluateAnswers } from '../utils/geminiClient';
import { store } from '../store';
import { broadcastMessage } from '../utils/broadcast';
import { useSelector, useDispatch } from 'react-redux';
import { startSession, startQuestion, submitAnswer, updateCurrentSession } from '../store/sessionSlice';
import { updateQuestion } from '../store/sessionSlice';
import QuestionDisplay from '../components/Chat/QuestionDisplay';
import TimerProgress from '../components/Chat/TimerProgress';
import AnswerBox from '../components/Chat/AnswerBox';
import Controls from '../components/Chat/Controls';

const { Title, Paragraph } = Typography;

const DEFAULT_QUESTIONS = [
  { id: 1, text: 'Introduce yourself briefly.', difficulty: 'Easy' },
  { id: 2, text: 'Tell me about a challenging bug you fixed and how you approached it.', difficulty: 'Easy' },
  { id: 3, text: 'Explain the difference between var, let and const.', difficulty: 'Medium' },
  { id: 4, text: 'Describe how you would design a REST API for a blog platform.', difficulty: 'Medium' },
  { id: 5, text: 'Design a URL shortener and discuss scaling considerations.', difficulty: 'Hard' },
  { id: 6, text: 'Explain how you would design an eventually-consistent distributed counter and trade-offs.', difficulty: 'Hard' }
];

const DIFFICULTY_SECONDS = { Easy: 20, Medium: 60, Hard: 120 };

export default function Chat() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentSession = useSelector((s) => s.session && s.session.currentSession);
  const candidates = useSelector((s) => s.session && s.session.candidates);
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [input, setInput] = useState('');
  const [questionText, setQuestionText] = useState('');
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
  const INCOMPLETE_KEY = 'incompleteSession'

  function buildSnapshotFromState() {
    const state = store.getState().session && store.getState().session.currentSession;
    if (!state) return null;
    return {
      ...state,
      savedAt: Date.now(),
    };
  }

  useEffect(() => {
    const lsCandidate = localStorage.getItem('candidateInfo');
    const hasCandidates = Array.isArray(candidates) && candidates.length > 0;
    if (!currentSession && !hasCandidates && !lsCandidate) navigate('/interviewee');
  }, [navigate, currentSession, candidates]);

  useEffect(() => {
    if (!currentSession) {
      try {
        const candRaw = localStorage.getItem('candidateInfo');
        const cand = candRaw ? JSON.parse(candRaw) : null;
        const cid = cand && cand.id ? cand.id : (cand && cand.email) || null;
        dispatch(startSession(cid));
      } catch (e) {
        console.warn('Failed to start session', e);
      }
    }
  }, [currentSession, dispatch, navigate]);

  useEffect(() => {
    // persist current session snapshot when key pieces change
    const save = () => {
      try {
        const snap = buildSnapshotFromState();
        if (snap) localStorage.setItem(INCOMPLETE_KEY, JSON.stringify(snap));
      } catch (e) { void e; }
    };
    save();
    const iv = setInterval(save, 5000);
    const onVis = () => { if (document.visibilityState === 'hidden') save(); };
    const onUnload = () => { save(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', onUnload);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('beforeunload', onUnload); };
  }, [currentSession, index, timeLeft]);

  useEffect(() => {
    let mounted = true;
    const ensureQuestions = async () => {
      if (!currentSession) return;
      if (Array.isArray(currentSession.questions) && currentSession.questions.length >= 6) return;
      console.log('ensureQuestions start currentSession:', currentSession);
      setQLoading(true);
      try {
        const candRaw = localStorage.getItem('candidateInfo');
        const cand = candRaw ? JSON.parse(candRaw) : null;
        const topic = cand && cand.topic ? cand.topic : undefined;
        const generated = await generateQuestions(['Easy', 'Easy', 'Medium', 'Medium', 'Hard', 'Hard'], { topic });
        if (!generated || !Array.isArray(generated) || generated.length === 0 || generated.every((it) => !it || !String(it.text || '').trim())) {
          const msg = 'AI is not responding';
          setQError(msg);
          setQErrors((prev) => ({ ...prev, batch: msg }));
          setQLoading(false);
          return;
        }
        const DIFFICULTY_SECONDS = { Easy: 20, Medium: 60, Hard: 120 };
        const qs = generated.map((it, i) => ({ id: it.id || i + 1, text: it.text || `Question ${i + 1}`, difficulty: it.difficulty || (i < 2 ? 'Easy' : i < 4 ? 'Medium' : 'Hard'), timeLimit: it.timeLimit || DIFFICULTY_SECONDS[it.difficulty || (i < 2 ? 'Easy' : i < 4 ? 'Medium' : 'Hard')] }));
        try { dispatch({ type: 'session/setSessionQuestions', payload: qs }); } catch (e) { console.warn('dispatch setSessionQuestions failed', e); }
        try { dispatch({ type: 'session/startQuestion', payload: { index: 0, startedAt: Date.now(), remainingTime: qs[0].timeLimit } }); } catch (e) { console.warn('dispatch startQuestion failed', e); }
        try { console.log('questions persisted to store:', store.getState().session && store.getState().session.currentSession); } catch (e) { console.warn(e); }
      } catch {
        const msg = 'Could not generate interview questions. Redirecting to main page.';
        if (mounted) {
          setQError(msg);
          setQErrors((prev) => ({ ...prev, batch: msg }));
          setTimeout(() => {
            try { navigate('/interviewee', { replace: true }); } catch (navErr) { console.warn('Redirect to main page failed', navErr); }
          }, 1500);
        }
        return;
      } finally {
        setQLoading(false);
      }
    };
    ensureQuestions();
    return () => { mounted = false; };
  }, [currentSession, dispatch, navigate]);

  useEffect(() => {
    if (!currentSession || !Array.isArray(currentSession.questions)) return;
    const q = currentSession.questions[index];
    if (!q) return;
    setQuestionText(q.text || DEFAULT_QUESTIONS[index].text);
    const defaultTime = DIFFICULTY_SECONDS[q.difficulty] || 30;
    let rem = typeof q.remainingTime === 'number' ? q.remainingTime : q.timeLimit || defaultTime;
    if (q.startedAt) {
      const elapsed = Math.floor((Date.now() - q.startedAt) / 1000);
      rem = Math.max(0, rem - elapsed);
    }
    setTimeLeft(rem);
    setInput((q.answer && q.answer.text) || '');
    setSubmittedThisQuestion(Boolean(q.answer && q.answer.submittedAt));
    try { dispatch(startQuestion({ index, startedAt: q.startedAt || Date.now(), remainingTime: rem })); } catch (e) { console.warn(e); }
  }, [currentSession, index, dispatch]);

  useEffect(() => {
    if (qLoading) return;
    if (typeof timeLeft !== 'number') return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timerRef.current);
  }, [index, qLoading, timeLeft]);

  const handleSubmit = useCallback(async () => {
    if (!currentSession || !Array.isArray(currentSession.questions)) return;
    const q = currentSession.questions[index];
    if (!q) return;
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmittedThisQuestion(true);
    clearInterval(timerRef.current);
    setTimeLeft(0);
    try { dispatch(submitAnswer({ questionIndex: index, text: input, score: null, feedback: null })); } catch (e) { console.warn('submitAnswer dispatch failed', e); }
    try {
      const evalResp = await evaluateAnswers([q.text], [input]);
      let score = null;
      let feedback = null;
      if (evalResp && Array.isArray(evalResp.evaluations) && evalResp.evaluations[0]) {
        score = Math.round((evalResp.evaluations[0].score || 0) * 10);
        feedback = evalResp.evaluations[0].feedback || null;
      }
      try { dispatch(submitAnswer({ questionIndex: index, text: input, score, feedback })); } catch (e) { console.warn('submitAnswer dispatch failed', e); }
    } catch (scoreErr) {
      console.warn('Scoring failed', scoreErr);
      try { dispatch(submitAnswer({ questionIndex: index, text: input, score: null, feedback: `Scoring unavailable: ${(scoreErr && scoreErr.message) || String(scoreErr)}` })); } catch (e) { console.warn('submitAnswer dispatch failed', e); }
    }
    const qcount = currentSession.questions.length;
    if (index < qcount - 1) {
      const next = index + 1;
      setIndex(next);
      const nextQ = currentSession.questions[next];
      const nextTime = nextQ ? nextQ.timeLimit || DIFFICULTY_SECONDS[nextQ.difficulty] : DIFFICULTY_SECONDS.Easy;
      try { dispatch(startQuestion({ index: next, startedAt: Date.now(), remainingTime: nextTime })); } catch (e) { console.warn(e); }
      isSubmittingRef.current = false;
      setSubmittedThisQuestion(false);
    } else {
      setCompleted(true);
      try { dispatch(updateCurrentSession({ remainingTime: 0, questionStartAt: null })); } catch (e) { console.warn(e); }
      setSummaryLoading(true);
      try {
        const qs = (currentSession.questions || []).map((q) => q.text || '');
        const answers = (currentSession.questions || []).map((q) => (q.answer && q.answer.text) || '');
        const evaluation = await evaluateAnswers(qs, answers);
        setSummary(evaluation);
        const candRaw = localStorage.getItem('candidateInfo');
        const cand = candRaw ? JSON.parse(candRaw) : null;
        try { dispatch({ type: 'session/completeSession', payload: { summary: evaluation, candidate: cand } }); } catch (e) { console.warn('completeSession dispatch failed', e); }
        try { broadcastMessage('session:completed', { ...currentSession, summary: evaluation, candidate: cand }); } catch (err) { console.warn('broadcast failed', err); }
      } catch (err) {
        console.warn('Summary/evaluation generation failed', err);
        const msg = (err && err.message) || String(err) || 'Summary generation failed';
        setSummaryError(msg);
        try {
          const candRaw = localStorage.getItem('candidateInfo');
          const cand = candRaw ? JSON.parse(candRaw) : null;
          try { dispatch({ type: 'session/completeSession', payload: { summary: { error: msg }, candidate: cand } }); } catch (e) { console.warn('completeSession dispatch failed', e); }
          try { broadcastMessage('session:completed', { ...currentSession, summary: { error: msg }, candidate: cand }); } catch (err) { console.warn('broadcast failed', err); }
        } catch (e) { console.warn('completeSession dispatch failed', e); }
      } finally {
        setSummaryLoading(false);
        isSubmittingRef.current = false;
        try { navigate('/feedback', { replace: true }); } catch (navErr) { console.warn('Navigation to feedback failed', navErr); }
      }
    }
  }, [currentSession, index, input, dispatch, navigate]);

  useEffect(() => {
    if (typeof timeLeft === 'number' && timeLeft <= 0 && currentSession && Array.isArray(currentSession.questions)) handleSubmit();
  }, [timeLeft, handleSubmit, currentSession]);

  const q = (currentSession && currentSession.questions && currentSession.questions[index]) || DEFAULT_QUESTIONS[index];
  const perQError = qErrors && qErrors[index];
  return (
    <Card style={{ minHeight: 300 }}>
      <Title level={3}>Chat / Interview</Title>
      {!currentSession || qLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                  <Alert type="success" message="Interview complete — summary available below." />
                  <pre style={{ background: '#fafafa', padding: 12, marginTop: 8 }}>{JSON.stringify(summary, null, 2)}</pre>
                </div>
              ) : (
                <div>
                  <Alert type="info" message="Interview complete. Waiting for summary..." />
                </div>
              )}
            </div>
          )}
          {summaryError && (
            <div style={{ marginBottom: 12 }}>
              <Alert type="error" message={`Summary generation failed: ${summaryError}`} />
            </div>
          )}
          <Paragraph>
            Question {index + 1} of {(currentSession && currentSession.questions && currentSession.questions.length) || DEFAULT_QUESTIONS.length} — <strong>{q.difficulty}</strong>
          </Paragraph>
          <TimerProgress timeLeft={timeLeft} q={q} DIFFICULTY_SECONDS={DIFFICULTY_SECONDS} />
          <div style={{ marginBottom: 12 }}>
            <QuestionDisplay qLoading={qLoading} qError={qError} perQError={perQError} questionText={questionText} q={q} index={index} fetchQuestion={fetchQuestion} dispatch={dispatch} updateQuestion={updateQuestion} setQLoading={setQLoading} setQError={setQError} setQErrors={setQErrors} />
            <AnswerBox input={input} setInput={setInput} submittedThisQuestion={submittedThisQuestion} />
          </div>
          <Controls onSkip={() => setTimeLeft(0)} onSubmit={handleSubmit} submittedThisQuestion={submittedThisQuestion} />
        </>
      )}
    </Card>
  );
}

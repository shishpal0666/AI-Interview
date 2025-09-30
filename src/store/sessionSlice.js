import { createSlice, nanoid } from '@reduxjs/toolkit'

const initialState = {
  candidates: [],
  currentSession: null,
  sessions: [],
}

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    startSession: {
      reducer(state, action) {
        const { id, candidateId, startedAt } = action.payload
        state.currentSession = { id, candidateId, startedAt, questionIndex: 0, answers: {}, status: 'in-progress', questionStartAt: null, remainingTime: null }
      },
      prepare(candidateOrId) {
        const candidateId = typeof candidateOrId === 'string' ? candidateOrId : (candidateOrId && candidateOrId.id) || nanoid()
        return { payload: { id: nanoid(), candidateId, startedAt: Date.now() } }
      },
    },

    updateCurrentSession(state, action) {
      if (!state.currentSession) return
      state.currentSession = { ...state.currentSession, ...action.payload }
    },

    setSessionQuestions(state, action) {
      if (!state.currentSession) return
      const qs = action.payload || []
      state.currentSession.questions = qs.map((q) => ({ ...q, remainingTime: q.timeLimit || null, startedAt: null, answer: null }))
      state.currentSession.questionIndex = 0
    },

    startQuestion(state, action) {
      const { index, startedAt, remainingTime } = action.payload
      if (!state.currentSession || !Array.isArray(state.currentSession.questions)) return
      const q = state.currentSession.questions[index]
      if (!q) return
      try { console.debug('[sessionSlice] startQuestion', { index, startedAt, remainingTime, status: state.currentSession && state.currentSession.status }); } catch(e) { void e }
      q.startedAt = startedAt || Date.now()
      q.remainingTime = typeof remainingTime === 'number' ? remainingTime : (q.timeLimit || q.remainingTime || null)
    },

  tickQuestion(state, action) {
      const idx = action.payload && typeof action.payload.index === 'number' ? action.payload.index : (state.currentSession && state.currentSession.questionIndex) || 0;
      if (!state.currentSession || state.currentSession.status !== 'in-progress' || !Array.isArray(state.currentSession.questions)) {
        try { console.debug('[sessionSlice] tickQuestion ignored - no in-progress session or questions', { status: state.currentSession && state.currentSession.status }); } catch(e) { void e }
        return;
      }
      const q = state.currentSession.questions[idx];
      if (!q || typeof q.remainingTime !== 'number') return;
      try { console.debug('[sessionSlice] tickQuestion decrementing', { idx, before: q.remainingTime }); } catch(e) { void e }
      q.remainingTime = Math.max(0, q.remainingTime - 1);
    },

    updateQuestion(state, action) {
      const { index, patch } = action.payload
      if (!state.currentSession || !Array.isArray(state.currentSession.questions)) return
      const q = state.currentSession.questions[index]
      if (!q) return
      state.currentSession.questions[index] = { ...q, ...patch }
    },

    submitAnswer(state, action) {
      const { questionIndex, text, score = null, feedback = null } = action.payload
      if (!state.currentSession || !Array.isArray(state.currentSession.questions)) return
      const idx = typeof questionIndex === 'number' ? questionIndex : state.currentSession.questionIndex || 0
      const q = state.currentSession.questions[idx]
      if (!q) return
      q.answer = { text, score, feedback, submittedAt: Date.now() }
      q.startedAt = null
      q.remainingTime = typeof q.remainingTime === 'number' ? q.remainingTime : q.timeLimit || null
      state.currentSession.questionIndex = Math.min((idx + 1), (state.currentSession.questions.length || 1) - 1)
    },

    completeSession(state, action) {
      if (!state.currentSession) return
      state.currentSession.status = 'completed'
      state.currentSession.completedAt = Date.now()
      if (action.payload && action.payload.summary) {
        state.currentSession.summary = action.payload.summary
      }
      const cid = state.currentSession.candidateId
      let candidate = null
      if (cid) candidate = state.candidates.find((c) => c.id === cid)
      // If not found by id, try to match by email (to avoid duplicate candidates)
      if (!candidate && action.payload && action.payload.candidate && action.payload.candidate.email) {
        candidate = state.candidates.find((c) => c.email === action.payload.candidate.email)
      }
      if (!candidate && action.payload && action.payload.candidate) {
        const maybe = { ...(action.payload.candidate) }
        if (!maybe.id) maybe.id = cid || nanoid()
        if (!maybe.createdAt) maybe.createdAt = Date.now()
        maybe.sessions = maybe.sessions || []
        state.candidates.push(maybe)
        candidate = maybe
      }
      // Ensure that the current session's candidateId is the canonical candidate id
      if (candidate && state.currentSession) {
        state.currentSession.candidateId = candidate.id
      }

      const snapshot = { ...state.currentSession }
      if (candidate) {
        snapshot.candidate = { id: candidate.id, name: candidate.name, email: candidate.email, phone: candidate.phone }
      } else if (action.payload && action.payload.candidate) {
        const maybe = action.payload.candidate
        snapshot.candidate = { id: maybe.id, name: maybe.name, email: maybe.email, phone: maybe.phone }
      }
      state.sessions = state.sessions || []
      state.sessions.push(snapshot)

      if (candidate) {
        candidate.sessions = candidate.sessions || []
        candidate.sessions.push(snapshot)
      }

    },

    addCandidate(state, action) {
      const c = action.payload
      if (!c) return
      if (!c.id) c.id = nanoid()
      if (!c.createdAt) c.createdAt = Date.now()
      c.sessions = c.sessions || []
      const exists = c.email ? state.candidates.find((x) => x.email === c.email) : null
      if (!exists) {
        state.candidates.push(c)
      } else {
        Object.keys(c).forEach((k) => {
          if (k === 'sessions') return
          const val = c[k]
          if (val !== undefined && val !== null && val !== '') {
            exists[k] = val
          }
        })
        exists.sessions = exists.sessions || []
      }
    },
    importArchivedSession(state, action) {
      const snap = action.payload
      if (!snap || !snap.id) return
      state.sessions = state.sessions || []
      if (!state.sessions.find((s) => s.id === snap.id)) state.sessions.push(snap)
      if (snap.candidate && snap.candidate.id) {
        // Try to find candidate by id first, then by email to avoid duplicates
        let cand = state.candidates.find((c) => c.id === snap.candidate.id)
        if (!cand && snap.candidate.email) {
          cand = state.candidates.find((c) => c.email === snap.candidate.email)
        }
        if (!cand) {
          cand = { ...snap.candidate, createdAt: snap.candidate.createdAt || Date.now(), sessions: [] }
          state.candidates.push(cand)
        } else {
          Object.keys(snap.candidate).forEach((k) => {
            const val = snap.candidate[k]
            if (val !== undefined && val !== null && val !== '') cand[k] = val
          })
        }
        cand.sessions = cand.sessions || []
        if (!cand.sessions.find((x) => x.id === snap.id)) cand.sessions.push(snap)
      }
    },
    discardCurrentSession(state) {
      state.currentSession = null;
    },
    restoreSession(state, action) {
      const snap = action.payload;
      if (!snap) return;
      const normalized = { ...(snap || {}) };
      
  normalized.status = 'paused';

      if (!normalized.candidateId && normalized.candidate && normalized.candidate.id) normalized.candidateId = normalized.candidate.id;

      if (Array.isArray(normalized.questions)) {
        normalized.questions = normalized.questions.map((q, idx) => {
          const qq = { ...(q || {}) };
          if (!qq.id) qq.id = qq.id === 0 ? 0 : (idx + 1);
          qq.text = qq.text || '';
          qq.difficulty = qq.difficulty || 'Easy';
          qq.timeLimit = typeof qq.timeLimit === 'number' ? qq.timeLimit : null;
          qq.remainingTime = typeof qq.remainingTime === 'number' ? qq.remainingTime : (typeof qq.timeLimit === 'number' ? qq.timeLimit : null);
          qq.startedAt = null;
          if (!qq.answer) qq.answer = null;
          return qq;
        });
      } else {
        normalized.questions = [];
      }

      let qIndex = typeof normalized.questionIndex === 'number' ? normalized.questionIndex : -1;
      if (qIndex < 0) {
        qIndex = 0;
        for (let i = 0; i < normalized.questions.length; i += 1) {
          const qq = normalized.questions[i];
          if (!qq || !qq.answer || !qq.answer.submittedAt) {
            qIndex = i;
            break;
          }
        }
      }
      normalized.questionIndex = qIndex;
      normalized._restored = true;
      try { console.debug('[sessionSlice] restoreSession applied', { id: normalized.id, questionIndex: normalized.questionIndex, status: normalized.status }); } catch (e) { void e }
      state.currentSession = normalized;
    },
    resumeSession(state) {
      if (state.currentSession && state.currentSession.status === 'paused') {
        state.currentSession.status = 'in-progress';
  if (state.currentSession._restored) state.currentSession._restored = false;
      }
    },
  },
})

export const { startSession, setSessionQuestions, startQuestion, updateQuestion, submitAnswer, completeSession, addCandidate, updateCurrentSession, importArchivedSession, discardCurrentSession, restoreSession, tickQuestion, resumeSession } = sessionSlice.actions

export const selectCurrentSession = (state) => state.session && state.session.currentSession
export const selectCandidates = (state) => state.session && state.session.candidates

export default sessionSlice.reducer

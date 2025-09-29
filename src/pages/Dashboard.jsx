import { useMemo, useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { listenMessages } from '../utils/broadcast'
import { importArchivedSession } from '../store/sessionSlice'
import { Table, Input, Modal, Typography, Space, Tag } from 'antd'
const { Paragraph, Text, Title } = Typography
import { restoreSession, discardCurrentSession } from '../store/sessionSlice'

function getOverallScoreFromSession(s) {
  if (!s) return null;
  if (s.summary && typeof s.summary.overallScore !== 'undefined') return s.summary.overallScore;
  if (s.summary && typeof s.summary.totalScore === 'number') return s.summary.totalScore;

  let per = [];
  if (Array.isArray(s.questions) && s.questions.length) {
    per = s.questions.map((q) => (q && q.answer && typeof q.answer.score === 'number' ? q.answer.score : null)).filter((x) => x !== null);
  } else if (s.answers && typeof s.answers === 'object') {
    per = Object.values(s.answers).map((a) => (a && typeof a.score === 'number' ? a.score : null)).filter((x) => x !== null);
  }

  // If there are no numeric scores, try to pick the most recent answered question's score
  if (!per.length && Array.isArray(s.questions) && s.questions.length) {
    for (let i = s.questions.length - 1; i >= 0; i -= 1) {
      const q = s.questions[i];
      if (q && q.answer && typeof q.answer.score === 'number') return q.answer.score;
    }
  }

  if (!per.length) return null;
  const avg = Math.round(per.reduce((a, b) => a + b, 0) / per.length);
  return avg;
}

export default function Dashboard() {
  const sessionState = useSelector((s) => s.session)
  const dispatch = useDispatch()
  const combined = useMemo(() => {
    const candidates = (sessionState && sessionState.candidates) || []
    const current = sessionState && sessionState.currentSession ? sessionState.currentSession : null
    const global = (sessionState && sessionState.sessions) || []

    const sessionMap = {}
    ;[ ...(current ? [current] : []), ...global ].forEach((s) => {
      if (!s) return
      const cid = s.candidateId || (s.candidate && s.candidate.id) || null
      if (!cid) return
      const prev = sessionMap[cid]
      if (!prev || ((prev.completedAt || 0) < (s.completedAt || 0))) sessionMap[cid] = s
    })

    const byId = {}
    candidates.forEach((c) => {
      byId[c.id] = { source: 'candidate', candidate: c }
    })

    global.forEach((s) => {
      if (s && s.candidate && s.candidate.id && !byId[s.candidate.id]) {
        byId[s.candidate.id] = { source: 'session', candidate: s.candidate }
      }
    })

    const rows = Object.keys(byId).map((id) => {
      const c = byId[id].candidate || {}
      const sess = sessionMap[id] || (c.sessions && c.sessions.length ? c.sessions[c.sessions.length - 1] : null) || null
      const fallback = (sess && sess.candidate) || {}
      const name = c.name || c.fullName || fallback.name || 'Unknown'
      const email = c.email || fallback.email || ''
      const phone = c.phone || fallback.phone || ''
      const createdAt = c.createdAt || c.timestamp || fallback.createdAt || null

      return {
        key: id,
        id,
        name,
        email,
        phone,
        createdAt,
        session: sess,
        score: getOverallScoreFromSession(sess),
        allSessions: (c.sessions || (fallback.sessions ? fallback.sessions : [])).slice().reverse(),
      }
    })
    
    // Default ordering: highest score first (null/undefined go to the end)
    rows.sort((a, b) => {
      const sa = typeof a.score === 'number' ? a.score : -Infinity
      const sb = typeof b.score === 'number' ? b.score : -Infinity
      return sb - sa
    })
    
    return rows
  }, [sessionState])

  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0)
  const [welcomeBackVisible, setWelcomeBackVisible] = useState(false)
  const [incompleteSnapshot, setIncompleteSnapshot] = useState(null)

  useEffect(() => {
    const unsub = listenMessages((msg) => {
      try {
        console.debug('Dashboard received broadcast', msg && msg.type, msg && msg.payload)
        if (!msg || !msg.type) return
        if (msg.type === 'session:completed' && msg.payload) {
          dispatch(importArchivedSession(msg.payload))
          try { localStorage.removeItem('incompleteSession') } catch(e) { void e }
          return
        }
        if ((msg.type === 'session:updated' || msg.type === 'session:started') && msg.payload) {
          try { dispatch(importArchivedSession(msg.payload)) } catch(e) { console.warn('import on session update failed', e) }
          return
        }
        if (msg.type === 'candidate:added' && msg.payload) {
          try { dispatch(importArchivedSession({ id: `candidate:${msg.payload.id}`, candidate: msg.payload })) } catch(e) { void e }
          return
        }
      } catch (e) { console.warn('message handler failed', e) }
    })
    return () => { try { unsub && unsub() } catch (err) { console.warn('failed to unsubscribe listener', err) } }
  }, [dispatch])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('incompleteSession')
      if (!raw) return
      const snap = JSON.parse(raw)
      if (!snap || !snap.id) return
      // If this snapshot is already completed or archived in the store, remove it
      const alreadyArchived = (sessionState && Array.isArray(sessionState.sessions) && sessionState.sessions.find((s) => s.id === snap.id));
      const currentIsCompleted = sessionState && sessionState.currentSession && sessionState.currentSession.id === snap.id && sessionState.currentSession.status === 'completed';
      const snapCompleted = snap.status === 'completed' || (snap.summary && (snap.summary.error || snap.summary.overallSummary || snap.summary.totalScore || snap.summary.totalScore === 0));
      if (alreadyArchived || currentIsCompleted || snapCompleted) {
        try { localStorage.removeItem('incompleteSession') } catch (e) { void e }
        return
      }
      setIncompleteSnapshot(snap)
      setWelcomeBackVisible(true)
    } catch (e) { console.warn('failed to read incompleteSession from localStorage', e) }
  }, [sessionState])

  const filtered = combined.filter((r) => {
    const term = q.trim().toLowerCase()
    if (!term) return true
    return (r.name || '').toLowerCase().includes(term) || (r.email || '').toLowerCase().includes(term)
  })

  const cols = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Score', dataIndex: 'score', key: 'score', sorter: (a, b) => (a.score || 0) - (b.score || 0), render: (s) => s == null ? <Text type="secondary">N/A</Text> : <Tag color={s >= 80 ? 'green' : s >= 50 ? 'orange' : 'red'}>{s}</Tag> },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', render: (p) => p || <Text type="secondary">—</Text> },
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt', sorter: (a, b) => (new Date(a.createdAt || 0)) - (new Date(b.createdAt || 0)), render: (d) => d ? new Date(d).toLocaleString() : <Text type="secondary">—</Text> },
  { title: 'Action', key: 'action', render: (__, record) => <a onClick={() => setSelected(record.id)}>View</a> },
  ]

  return (
    <div>
    <Space direction="vertical" style={{ width: '100%' }}>
        <Title level={4}>Candidates</Title>
        <Input.Search placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 400 }} allowClear />
        <Table columns={cols} dataSource={filtered} onRow={(record) => ({
          onClick: () => setSelected(record.id),
        })} />

        <Modal
          title="Welcome back"
          open={welcomeBackVisible}
          onCancel={() => setWelcomeBackVisible(false)}
          footer={null}
        >
          {incompleteSnapshot ? (
            <div>
              <Paragraph>We found an unfinished interview session for candidate id <strong>{incompleteSnapshot.candidateId || incompleteSnapshot.id}</strong>.</Paragraph>
              <Paragraph>Do you want to resume where you left off or discard this session?</Paragraph>
              <Space>
                <a onClick={() => {
                  try {
                    dispatch(restoreSession(incompleteSnapshot))
                  } catch (e) { console.warn('restore failed', e) }
                  setWelcomeBackVisible(false)
                  try { window.location.href = '/#/chat' } catch(e) { void e }
                }}>Resume</a>
                <a onClick={() => {
                  try {
                    localStorage.removeItem('incompleteSession')
                    dispatch(discardCurrentSession())
                  } catch (e) { console.warn('discard failed', e) }
                  setWelcomeBackVisible(false)
                }}>Discard</a>
              </Space>
            </div>
          ) : (
            <Paragraph>No incomplete session found.</Paragraph>
          )}
        </Modal>

        <Modal
          title={selected ? `Candidate: ${selected}` : ''}
          open={!!selected}
          onOk={() => { setSelected(null); setSelectedSessionIndex(0) }}
          onCancel={() => { setSelected(null); setSelectedSessionIndex(0) }}
          width={900}
        >
          {selected && (() => {
            const sel = combined.find((r) => r.id === selected) || null
            if (!sel) return <Paragraph type="secondary">No session data for this candidate.</Paragraph>
            return (
              <div>
                <Paragraph><strong>Email:</strong> {sel.email}</Paragraph>
                <Paragraph><strong>Phone:</strong> {sel.phone || '—'}</Paragraph>
                <Paragraph><strong>Latest Score:</strong> {sel.score == null ? 'N/A' : sel.score}</Paragraph>

                <Title level={5}>Sessions</Title>
                {sel.allSessions && sel.allSessions.length ? (
                  <div style={{ marginBottom: 12 }}>
                    <Space style={{ marginBottom: 8 }}>
                      {sel.allSessions.map((s, i) => (
                        <Tag key={i} color={i === selectedSessionIndex ? 'blue' : 'default'} onClick={() => setSelectedSessionIndex(i)} style={{ cursor: 'pointer' }}>
                          {s.completedAt ? new Date(s.completedAt).toLocaleString() : (s.startedAt ? new Date(s.startedAt).toLocaleString() : 'Session')}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                ) : (
                  <Paragraph type="secondary">No archived sessions for this candidate.</Paragraph>
                )}

                <Title level={5}>Session Details</Title>
                {sel.allSessions && sel.allSessions.length ? (
                  (() => {
                    const sess = sel.allSessions[selectedSessionIndex]
                    if (!sess) return <Paragraph type="secondary">No session data available.</Paragraph>

                    const started = sess.startedAt || sess.createdAt || null
                    const ended = sess.completedAt || null
                    const duration = started && ended ? Math.max(0, (ended - started)) : null

                    return (
                      <div>
                        <Paragraph><strong>Session started:</strong> {started ? new Date(started).toLocaleString() : '—'}</Paragraph>
                        <Paragraph><strong>Session completed:</strong> {ended ? new Date(ended).toLocaleString() : '—'}</Paragraph>
                        <Paragraph><strong>Duration:</strong> {duration != null ? `${Math.round(duration/1000)}s` : '—'}</Paragraph>

                        {sess.summary && (
                          <div style={{ marginBottom: 12 }}>
                            <Paragraph><strong>Overall Score:</strong> {getOverallScoreFromSession(sess) == null ? '—' : getOverallScoreFromSession(sess)}</Paragraph>
                            <Paragraph><strong>Summary:</strong> {sess.summary.overallSummary || sess.summary.summary || sess.summary.error || '—'}</Paragraph>
                          </div>
                        )}

                        <div>
                          {Array.isArray(sess.questions) && sess.questions.length ? (
                            sess.questions.map((q, qi) => {
                              const ans = q.answer || { text: '' }
                              return (
                                <div key={qi} style={{ marginBottom: 12, padding: 8, background: '#fafafa' }}>
                                  <Paragraph><strong>Q {q.id || qi+1}:</strong> {q.text}</Paragraph>
                                  <Paragraph><strong>Answer:</strong> {ans.text || '—'}</Paragraph>
                                  <Paragraph><strong>Score:</strong> {typeof ans.score === 'number' ? ans.score : '—'} <br/> <strong>Feedback:</strong> {ans.feedback || '—'}</Paragraph>
                                </div>
                              )
                            })
                          ) : (sess.answers && Object.keys(sess.answers).length ? (
                            Object.keys(sess.answers).sort((a,b)=>a-b).map((k) => {
                              const it = sess.answers[k]
                              return (
                                <div key={k} style={{ marginBottom: 12, padding: 8, background: '#fafafa' }}>
                                  <Paragraph><strong>Q {k}:</strong> {it.questionText}</Paragraph>
                                  <Paragraph><strong>Answer:</strong> {it.text}</Paragraph>
                                  <Paragraph><strong>Score:</strong> {it.score == null ? '—' : it.score} <br/> <strong>Feedback:</strong> {it.feedback || '—'}</Paragraph>
                                </div>
                              )
                            })
                          ) : (
                            <Paragraph type="secondary">No answers recorded for this session.</Paragraph>
                          ))}
                        </div>
                      </div>
                    )
                  })()
                ) : (
                  <Paragraph type="secondary">No archived sessions for this candidate.</Paragraph>
                )}
              </div>
            )
          })()}
        </Modal>
      </Space>
    </div>
  )
}

import { useEffect, useState, useRef, useCallback } from 'react'
import { Card, Typography, Button, Progress, Input, Spin, Alert, List, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { fetchQuestion, callGemini } from '../utils/geminiClient'

const { Title, Paragraph } = Typography

const QUESTIONS = [
  { id: 1, text: 'Introduce yourself briefly.', difficulty: 'Easy' },
  { id: 2, text: 'Tell me about a challenging bug you fixed and how you approached it.', difficulty: 'Easy' },
  { id: 3, text: 'Explain the difference between var, let and const.', difficulty: 'Medium' },
  { id: 4, text: 'Describe how you would design a REST API for a blog platform.', difficulty: 'Medium' },
  { id: 5, text: 'Design a URL shortener and discuss scaling considerations.', difficulty: 'Hard' },
  { id: 6, text: 'Explain how you would design an eventually-consistent distributed counter and trade-offs.', difficulty: 'Hard' },
]

const DIFFICULTY_SECONDS = { Easy: 20, Medium: 60, Hard: 120 }

export default function Chat() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(() => DIFFICULTY_SECONDS[QUESTIONS[0].difficulty])
  const [answers, setAnswers] = useState({})
  const timerRef = useRef(null)
  const [input, setInput] = useState('')
  const [questionText, setQuestionText] = useState('')
  const [qLoading, setQLoading] = useState(false)
  const [qError, setQError] = useState(null)
  const [completed, setCompleted] = useState(false)
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState(null)

  useEffect(() => {
    const candidate = localStorage.getItem('candidateInfo')
    if (!candidate) {
      navigate('/interviewee')
      return
    }
  }, [navigate])


  useEffect(() => {
    let mounted = true
    const q = QUESTIONS[index]
    setQError(null)
    setQLoading(true)
    setQuestionText('')
    fetchQuestion(q.difficulty)
      .then((txt) => {
        if (!mounted) return
        setQuestionText(txt || q.text)
      })
      .catch((err) => {
        if (!mounted) return
        console.warn('fetchQuestion failed', err)
        setQError(err.message || String(err))
        setQuestionText(q.text)
      })
      .finally(() => {
        if (!mounted) return
        setQLoading(false)
        try { setTimeLeft(DIFFICULTY_SECONDS[q.difficulty] || 30) } catch { setTimeLeft(30) }
        setInput((answers && answers[q.id] && answers[q.id].text) || '')
      })
    return () => { mounted = false }
  }, [index, answers])

  useEffect(() => {
    if (qLoading) return
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => t - 1)
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [index, qLoading])

  const handleSubmit = useCallback(() => {
    const q = QUESTIONS[index]
    const qText = questionText || q.text

    const newAnswers = {
      ...answers,
      [q.id]: { text: input, questionText: qText, score: null, feedback: null, scoring: true, error: null },
    }
    setAnswers(newAnswers)

    ;(async () => {
      try {
        const scorePrompt = `You are an experienced full-stack (React/Node) interviewer. Given the question:\n"${qText}"\nAnd the candidate's answer:\n"${input}"\nProvide a numeric score between 0 and 100 (integer) for the answer, and a one-sentence constructive feedback. Return ONLY a JSON object with keys "score" and "feedback". Example: {"score": 73, "feedback": "..."}`
        const resp = await callGemini(scorePrompt, { temperature: 0.0, maxOutputTokens: 200 })

        let parsed = null
        const jsonMatch = resp && resp.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try { parsed = JSON.parse(jsonMatch[0]) } catch { parsed = null }
        }
        let score = null
        let feedback = null
        if (parsed && typeof parsed.score !== 'undefined') {
          score = parseInt(parsed.score, 10)
          feedback = parsed.feedback || null
        } else {
          const numMatch = resp && resp.match(/(\d{1,3})/)
          if (numMatch) {
            score = Math.max(0, Math.min(100, parseInt(numMatch[1], 10)))
            feedback = resp.replace(numMatch[0], '').trim()
            if (!feedback) feedback = null
          }
        }

        setAnswers((a) => ({
          ...a,
          [q.id]: { text: input, questionText: qText, score, feedback, scoring: false, error: null },
        }))
      } catch (err) {
        console.warn('Scoring failed', err)
        setAnswers((a) => ({
          ...a,
          [q.id]: { text: input, questionText: qText, score: null, feedback: null, scoring: false, error: err.message || String(err) },
        }))
      }
    })()

    if (index < QUESTIONS.length - 1) {
      setIndex((i) => i + 1)
    } else {
      try { localStorage.setItem('lastInterviewAnswers', JSON.stringify({ answers: newAnswers, timestamp: Date.now() })) } catch (err) { console.warn(err) }
      setCompleted(true)

      ;(async () => {
        setSummaryLoading(true)
        setSummaryError(null)
        try {
          const pairs = Object.keys(newAnswers)
            .sort((a, b) => Number(a) - Number(b))
            .map((k) => {
              const it = newAnswers[k]
              return `Question ${k}: ${it.questionText}\nAnswer: ${it.text}`
            })
            .join('\n\n')

          const summaryPrompt = `You are an experienced interviewer. Given the following question/answer pairs:\n\n${pairs}\n\nProvide a JSON object with keys:\n- "overallScore" (integer 0-100),\n- "perQuestion" (array of objects with keys "id", "score" (0-100 int) and "feedback" (short text)),\n- "summary" (one paragraph overall feedback).\nReturn ONLY valid JSON.`

          const raw = await callGemini(summaryPrompt, { temperature: 0.0, maxOutputTokens: 512 })
          console.log('Summary API raw response:', raw)

          let parsed = null
          const jsonMatch = raw && raw.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            try { parsed = JSON.parse(jsonMatch[0]) } catch { parsed = null }
          }
          if (!parsed) {
            setSummaryError('Failed to parse summary JSON from API')
            setSummary(null)
            console.warn('Could not parse summary JSON from API response:', raw)
          } else {
            setSummary(parsed)
            console.log('Parsed interview summary:', parsed)
          }
        } catch (err) {
          console.warn('Summary request failed', err)
          setSummaryError(err.message || String(err))
        } finally {
          setSummaryLoading(false)
        }
      })()
    }
  }, [index, input, answers, questionText])

  useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmit()
    }
  }, [timeLeft, handleSubmit])


  const q = QUESTIONS[index]

  return (
    <Card style={{ minHeight: 300 }}>
      <Title level={3}>Chat / Interview</Title>
      {completed && (
        <div style={{ marginBottom: 12 }}>
          {summaryLoading ? (
            <div><Spin /> Generating summary...</div>
          ) : summaryError ? (
            <Alert type="error" message={`Summary failed: ${summaryError}`} />
          ) : summary ? (
            <div>
              <Alert type="success" message="Interview complete — summary available in console and below." />
              <pre style={{ background: '#fafafa', padding: 12, marginTop: 8 }}>{JSON.stringify(summary, null, 2)}</pre>
            </div>
          ) : (
            <div>
              <Alert type="info" message="Interview complete. Waiting for summary..." />
            </div>
          )}
        </div>
      )}
      <Paragraph>
        Question {index + 1} of {QUESTIONS.length} — <strong>{q.difficulty}</strong>
      </Paragraph>

      <div style={{ marginBottom: 12 }}>
        <Progress percent={Math.max(0, (timeLeft / DIFFICULTY_SECONDS[q.difficulty]) * 100)} status={timeLeft <= 5 ? 'exception' : 'active'} />
        <div style={{ fontSize: 18, marginTop: 8 }}>Time left: {timeLeft}s</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        {qLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Spin /> Loading question...</div>
        ) : qError ? (
          <Alert type="warning" message={`Failed to load dynamic question: ${qError}`} />
        ) : (
          <Paragraph>{questionText || q.text}</Paragraph>
        )}
        <Input.TextArea rows={6} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your answer here (auto-submits when timer ends)" />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button onClick={() => { setTimeLeft(0) }} danger>
          Skip / Auto-submit
        </Button>
        <Button type="primary" onClick={handleSubmit}>
          Submit Answer
        </Button>
      </div>
    </Card>
  )
}

import { useEffect, useState, useRef, useCallback } from 'react'
import { Card, Typography, Button, Progress, Input } from 'antd'
import { useNavigate } from 'react-router-dom'

const { Title, Paragraph } = Typography

const QUESTIONS = [
  { id: 1, text: 'Introduce yourself briefly.', difficulty: 'Easy' },
  { id: 2, text: 'Explain the difference between var, let and const.', difficulty: 'Medium' },
  { id: 3, text: 'Design a URL shortener and discuss scaling considerations.', difficulty: 'Hard' },
]

const DIFFICULTY_SECONDS = { Easy: 20, Medium: 60, Hard: 120 }

export default function Chat() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(() => DIFFICULTY_SECONDS[QUESTIONS[0].difficulty])
  const [answers, setAnswers] = useState({})
  const timerRef = useRef(null)
  const [input, setInput] = useState('')

  useEffect(() => {
    const candidate = localStorage.getItem('candidateInfo')
    if (!candidate) {
      navigate('/interviewee')
      return
    }
  }, [navigate])

  useEffect(() => {
    const q = QUESTIONS[index]
    setTimeLeft(DIFFICULTY_SECONDS[q.difficulty] || 30)
    setInput(answers[q.id] || '')
  }, [index, answers])

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => t - 1)
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [index])

  const handleSubmit = useCallback(() => {
    const q = QUESTIONS[index]
    setAnswers((a) => ({ ...a, [q.id]: input }))
    if (index < QUESTIONS.length - 1) {
      setIndex((i) => i + 1)
    } else {
      try { localStorage.setItem('lastInterviewAnswers', JSON.stringify({ answers: { ...answers, [q.id]: input }, timestamp: Date.now() })) } catch (err) { console.warn(err) }
      navigate('/interviewee')
    }
  }, [index, input, answers, navigate])

  useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmit()
    }
  }, [timeLeft, handleSubmit])


  const q = QUESTIONS[index]

  return (
    <Card style={{ minHeight: 300 }}>
      <Title level={3}>Chat / Interview</Title>
      <Paragraph>
        Question {index + 1} of {QUESTIONS.length} — <strong>{q.difficulty}</strong>
      </Paragraph>

      <div style={{ marginBottom: 12 }}>
        <Progress percent={Math.max(0, (timeLeft / DIFFICULTY_SECONDS[q.difficulty]) * 100)} status={timeLeft <= 5 ? 'exception' : 'active'} />
        <div style={{ fontSize: 18, marginTop: 8 }}>Time left: {timeLeft}s</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Paragraph>{q.text}</Paragraph>
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

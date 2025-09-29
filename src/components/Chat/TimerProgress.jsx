import React from 'react'
import { Progress } from 'antd'

export default function TimerProgress({ timeLeft, q, DIFFICULTY_SECONDS }) {
  const denom = q && (q.timeLimit || DIFFICULTY_SECONDS[q.difficulty]) || DIFFICULTY_SECONDS.Easy
  const percent = Math.max(0, (timeLeft / denom) * 100)
  return (
    <div style={{ marginBottom: 12 }}>
      <Progress percent={percent} status={timeLeft <= 5 ? 'exception' : 'active'} />
      <div style={{ fontSize: 18, marginTop: 8 }}>Time left: {timeLeft}s</div>
    </div>
  )
}

import React from 'react'
import { Progress } from 'antd'

export default function TimerProgress({ timeLeft }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 18, marginTop: 8 }}>Time left: {timeLeft}s</div>
    </div>
  )
}

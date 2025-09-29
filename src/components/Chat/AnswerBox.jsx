import React from 'react'
import { Input } from 'antd'

export default function AnswerBox({ input, setInput, submittedThisQuestion }) {
  return (
    <Input.TextArea
      rows={6}
      value={input}
      onChange={(e) => setInput(e.target.value)}
      placeholder="Type your answer here (auto-submits when timer ends)"
      disabled={submittedThisQuestion}
    />
  )
}

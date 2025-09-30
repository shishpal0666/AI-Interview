import React from 'react'

export default function AnswerBox({ input, setInput, submittedThisQuestion }) {
  return (
    <textarea
      rows={6}
      value={input}
      onChange={(e) => setInput(e.target.value)}
      placeholder="Type your answer here (auto-submits when timer ends)"
      disabled={submittedThisQuestion}
      className="w-full textarea textarea-bordered resize-y"
    />
  )
}

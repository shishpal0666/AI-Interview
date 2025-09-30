import React from 'react'

export default function Controls({ onSkip, onSubmit, submittedThisQuestion }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onSkip} className="btn btn-error" disabled={submittedThisQuestion}>Skip</button>
      <button onClick={onSubmit} className="btn btn-primary" disabled={submittedThisQuestion}>{submittedThisQuestion ? 'Submitted' : 'Submit'}</button>
    </div>
  )
}

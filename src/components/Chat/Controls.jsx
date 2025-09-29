import React from 'react'
import { Button, Space } from 'antd'

export default function Controls({ onSkip, onSubmit, submittedThisQuestion }) {
  return (
    <Space>
      <Button onClick={onSkip} danger disabled={submittedThisQuestion}>Skip / Auto-submit</Button>
      <Button type="primary" onClick={onSubmit} disabled={submittedThisQuestion}>{submittedThisQuestion ? 'Submitted' : 'Submit Answer'}</Button>
    </Space>
  )
}

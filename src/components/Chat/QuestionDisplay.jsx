import React from 'react'
import { Typography, Spin, Alert, Button } from 'antd'

const { Paragraph } = Typography

export default function QuestionDisplay({ qLoading, qError, perQError, questionText, q, index, fetchQuestion, dispatch, updateQuestion, setQLoading, setQError, setQErrors }) {
  if (qLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Spin /> Loading question...
      </div>
    )
  }

  if (qError) {
    return (
      <div>
        <Alert type="warning" message={`Failed to load dynamic question: ${qError}`} />
        {perQError && (
          <div style={{ marginTop: 8 }}>
            <Alert type="warning" message={`This question failed to generate dynamically: ${perQError}`} />
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <Button
            onClick={async () => {
              try {
                setQLoading(true)
                const txt = await fetchQuestion(q.difficulty)
                if (!txt || !String(txt).trim()) {
                  const msg = 'AI is not responding';
                  setQErrors((prev) => ({ ...prev, [index]: msg }))
                  setQError(msg)
                } else {
                  dispatch(updateQuestion({ index, patch: { text: txt || q.text } }))
                  setQErrors((prev) => {
                    const c = { ...prev }
                    delete c[index]
                    return c
                  })
                  setQError(null)
                }
              } catch (err) {
                setQErrors((prev) => ({ ...prev, [index]: (err && err.message) || String(err) }))
                setQError((err && err.message) || String(err))
              } finally {
                setQLoading(false)
              }
            }}
          >
            Retry question
          </Button>
        </div>
      </div>
    )
  }

  return <Paragraph>{questionText || q.text}</Paragraph>
}

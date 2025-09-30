import React from 'react'
import { Spin } from 'antd'

export default function QuestionDisplay({ qLoading, qError, perQError, questionText, q, index, fetchQuestion, dispatch, updateQuestion, setQLoading, setQError, setQErrors }) {
  if (qLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral/70">
        <Spin /> Loading question...
      </div>
    )
  }
  if (qError) {
    return (
      <div className="space-y-2">
        <div className="alert alert-warning shadow-sm">Failed to load dynamic question: {qError}</div>
        {perQError && (
          <div className="alert alert-warning shadow-sm">This question failed to generate dynamically: {perQError}</div>
        )}
        <div>
          <button className="btn btn-sm" onClick={async () => {
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
              setQErrors((prev) => ({ ...prev, [index]: String(err) }))
              setQError((err && err.message) || String(err))
            } finally {
              setQLoading(false)
            }
          }}>Retry</button>
        </div>
      </div>
    )
  }

  return <div className="text-lg font-medium">{questionText || q.text}</div>
}

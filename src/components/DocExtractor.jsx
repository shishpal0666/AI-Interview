import { useState } from 'react'
import { Card, Typography, Spin, Alert } from 'antd'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url'
import mammoth from 'mammoth'

// Use Vite's ?url import so the worker asset is resolved and served correctly.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const { Title } = Typography

export default function DocExtractor() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleFile = async (file) => {
    setError(null)
    setText('')
    setLoading(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const name = (file.name || '').toLowerCase()

      if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
        const pdf = await loadingTask.promise
        let fullText = ''
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          const strings = content.items.map((item) => item.str || '').join(' ')
          fullText += strings + '\n\n'
        }
        setText(fullText)
      } else if (
        file.type ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        name.endsWith('.docx')
      ) {
        const result = await mammoth.extractRawText({ arrayBuffer })
        setText(result.value || '')
      } else {
        throw new Error('Unsupported file type — please upload a PDF or DOCX')
      }
    } catch (err) {
      console.error(err)
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const onInputChange = (e) => {
    const f = e.target.files && e.target.files[0]
    if (f) handleFile(f)
  }

  return (
    <Card style={{ marginTop: 12 }}>
      <Title level={4}>Upload a PDF or DOCX</Title>
      <input
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={onInputChange}
      />

      <div style={{ marginTop: 12 }}>
        {loading && <Spin />}
        {error && (
          <div style={{ marginTop: 12 }}>
            <Alert type="error" message={error} />
          </div>
        )}

        {text && (
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: '#f7f7f7',
              padding: 12,
              borderRadius: 4,
              marginTop: 12,
              maxHeight: '40vh',
              overflow: 'auto',
            }}
          >
            {text}
          </pre>
        )}
      </div>
    </Card>
  )
}

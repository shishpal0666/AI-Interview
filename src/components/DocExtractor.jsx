import { useState } from 'react'
import { Card, Typography, Spin, Alert, Input, Button, Space } from 'antd'
import extractFields from '../utils/extractFields'
import { useNavigate } from 'react-router-dom'
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
  const [parsed, setParsed] = useState({ name: null, email: null, phone: null })
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: '', email: '', phone: '' })

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
        const pf = extractFields(fullText)
        setText(fullText)
        setParsed(pf)
        setDraft({ name: pf.name || '', email: pf.email || '', phone: pf.phone || '' })
      } else if (
        file.type ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        name.endsWith('.docx')
      ) {
  const result = await mammoth.extractRawText({ arrayBuffer })
  const txt = result.value || ''
  setText(txt)
  setParsed(extractFields(txt))
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
          {text && (
            <div style={{ marginTop: 12 }}>
              <strong>Parsed fields:</strong>
              <div>Name: {parsed.name || '—'}</div>
              <div>Email: {parsed.email || '—'}</div>
              <div>Phone: {parsed.phone || '—'}</div>

              {(!parsed.name || !parsed.email || !parsed.phone) ? (
                <div style={{ marginTop: 12 }}>
                  <p>Please enter any missing fields before continuing:</p>
                  <Space direction="vertical">
              {editing && <Alert type="warning" message="Please fill the required fields before continuing" />}
                    {!parsed.name && (
                      <Input
                        placeholder="Full name"
                        value={draft.name}
                        onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
                      />
                    )}
                    {!parsed.email && (
                      <Input
                        placeholder="Email"
                        value={draft.email}
                        onChange={(e) => setDraft(d => ({ ...d, email: e.target.value }))}
                      />
                    )}
                    {!parsed.phone && (
                      <Input
                        placeholder="Phone"
                        value={draft.phone}
                        onChange={(e) => setDraft(d => ({ ...d, phone: e.target.value }))}
                      />
                    )}
                    <div>
                      <Button
                        type="primary"
                        onClick={() => {
                          const merged = { ...parsed, ...draft }
                          if (!merged.email || !merged.phone) {
                            setEditing(true)
                            return
                          }
                          try {
                            localStorage.setItem('candidateInfo', JSON.stringify(merged))
                          } catch (_err) {
                            console.warn('Failed to persist candidate info', _err)
                          }
                          navigate('/chat')
                        }}
                      >
                        Continue to Chat
                      </Button>
                    </div>
                  </Space>
                </div>
                ) : (
                <div style={{ marginTop: 12 }}>
                  <Button
                    type="primary"
                    onClick={() => {
                      const merged = { ...parsed, ...draft }
                      try { localStorage.setItem('candidateInfo', JSON.stringify(merged)) } catch (_err) { console.warn(_err) }
                      navigate('/chat')
                    }}
                  >
                    Start Chat
                  </Button>
                </div>
              )}
            </div>
          )}
      </div>
    </Card>
  )
}

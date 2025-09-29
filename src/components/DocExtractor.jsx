import { useState } from 'react';
import { nanoid } from '@reduxjs/toolkit';
import { Card, Typography, Spin, Alert, Input, Button, Space } from 'antd';
import extractFields from '../utils/extractFields';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { addCandidate, startSession } from '../store/sessionSlice';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
const { Title } = Typography;

export default function DocExtractor() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [parsed, setParsed] = useState({ name: null, email: null, phone: null });
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '', phone: '' });

  const handleFile = async (file) => {
    setError(null);
    setText('');
    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const name = (file.name || '').toLowerCase();
      if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item) => item.str || '').join(' ');
          fullText += strings + '\n\n';
        }
        const pf = extractFields(fullText);
        setText(fullText);
        setParsed(pf);
        setDraft({ name: pf.name || '', email: pf.email || '', phone: pf.phone || '' });
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) {
        const result = await mammoth.extractRawText({ arrayBuffer });
        const txt = result.value || '';
        setText(txt);
        const pf = extractFields(txt);
        setParsed(pf);
        setDraft({ name: pf.name || '', email: pf.email || '', phone: pf.phone || '' });
      } else {
        throw new Error('Unsupported file type — please upload a PDF or DOCX');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const onInputChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) handleFile(f);
  };

  const changeDraft = (field, value) => {
    setEditing(false);
    setDraft((d) => ({ ...d, [field]: value }));
  };

  return (
    <Card style={{ marginTop: 12 }}>
      <Title level={4}>Upload a PDF or DOCX</Title>
      <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onInputChange} />
      <div style={{ marginTop: 12 }}>
        {loading && <Spin />}
        {error && (
          <div style={{ marginTop: 12 }}>
            <Alert type="error" message={error} />
          </div>
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
                  {!parsed.name && (<Input placeholder="Full name" value={draft.name} onChange={(e) => changeDraft('name', e.target.value)} />)}
                  {!parsed.email && (<Input placeholder="Email" value={draft.email} onChange={(e) => changeDraft('email', e.target.value)} />)}
                  {!parsed.phone && (<Input placeholder="Phone" value={draft.phone} onChange={(e) => changeDraft('phone', e.target.value)} />)}
                  <div>
                    <Button type="primary" onClick={() => {
                      const merged = { ...parsed, ...draft };
                      const hasEmail = merged.email && String(merged.email).trim();
                      const hasPhone = merged.phone && String(merged.phone).trim();
                      if (!hasEmail || !hasPhone) { setEditing(true); return; }
                      try {
                        const cand = { ...merged };
                        if (!cand.id) cand.id = nanoid();
                        dispatch(addCandidate(cand));
                        try { localStorage.setItem('candidateInfo', JSON.stringify(cand)); } catch (err) { console.warn('failed to persist candidateInfo', err); }
                        dispatch(startSession(cand.id));
                      } catch (e) {
                        console.warn('Redux dispatch failed, falling back to localStorage', e);
                        try { localStorage.setItem('candidateInfo', JSON.stringify(merged)); } catch (_err) { console.warn('Failed to persist candidate info', _err); }
                      }
                      navigate('/chat', { replace: true });
                    }}>Continue to Chat</Button>
                  </div>
                </Space>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <Button type="primary" onClick={() => {
                  const merged = { ...parsed, ...draft };
                  try {
                    const cand = { ...merged };
                    if (!cand.id) cand.id = nanoid();
                    dispatch(addCandidate(cand));
                    try { localStorage.setItem('candidateInfo', JSON.stringify(cand)); } catch (err) { console.warn('failed to persist candidateInfo', err); }
                    dispatch(startSession(cand.id));
                  } catch (e) {
                    console.warn('Redux add/start failed, falling back to localStorage', e);
                    try { localStorage.setItem('candidateInfo', JSON.stringify(merged)); } catch (_err) { console.warn(_err); }
                  }
                  navigate('/chat', { replace: true });
                }}>Start Chat</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

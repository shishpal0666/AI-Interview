import { useState, useRef } from 'react';
import { nanoid } from '@reduxjs/toolkit';
import { Card, Typography, Spin, Alert, Input, Button, Space } from 'antd';
import extractFields from '../utils/extractFields';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { addCandidate, startSession } from '../store/sessionSlice';
import { broadcastMessage } from '../utils/broadcast';
import { showToast } from '../utils/toast';
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
  const candidates = useSelector((s) => s.session && s.session.candidates) || [];
  const current = useSelector((s) => s.session && s.session.currentSession);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '', phone: '' });

  const fileInputRef = useRef(null);

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
        const msg = 'Unsupported file type — please upload a PDF or DOCX';
        throw new Error(msg);
      }
    } catch (err) {
      console.error(err);
      const msg = err && err.message ? err.message : String(err);
      setError(msg);
      try { showToast('error', msg) } catch(e) { void e }
    } finally {
      setLoading(false);
    }
  };

  const onInputChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) handleFile(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // allow drop
  };

  const changeDraft = (field, value) => {
    // mark editing active when the user changes any field
    setEditing(true);
    setDraft((d) => ({ ...d, [field]: value }));
  };

  const initiateSession = (merged) => {
    try {
      const validateCandidate = (cand) => {
        const email = cand && cand.email ? String(cand.email).trim() : '';
        const phone = cand && cand.phone ? String(cand.phone).trim() : '';
        const isValidEmail = (e) => {
          if (!e) return false;
          // simple RFC-like check
          const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return re.test(String(e).toLowerCase());
        };
        const isValidPhone = (p) => {
          if (!p) return false;
          const digits = String(p).replace(/\D/g, '');
          return digits.length >= 7 && digits.length <= 15;
        };
        if (!isValidEmail(email)) return { ok: false, message: 'Please provide a valid email address.' };
        if (!isValidPhone(phone)) return { ok: false, message: 'Please provide a valid phone number.' };
        return { ok: true };
      };

      const v = validateCandidate(merged || {});
      if (!v.ok) {
        setError(v.message);
        try { showToast('error', v.message); } catch (e) { void e }
        return;
      }
      const existing = candidates.find((c) => c.email === merged.email);
      if (existing) {
        if (current && current.candidateId === existing.id && current.status === 'in-progress') {
          setError('An interview is already in progress for this candidate. Please resume the existing session or discard it from Dashboard.');
          return;
        }
        const candToUse = { ...existing };
        try { localStorage.setItem('candidateInfo', JSON.stringify(candToUse)); } catch (err) { console.warn('failed to persist candidateInfo', err); }
        dispatch(startSession(candToUse.id));
        try { broadcastMessage('session:started', { id: candToUse.id, candidate: candToUse }) } catch (e) { void e }
      } else {
        const cand = { ...merged };
        if (!cand.id) cand.id = nanoid();
        dispatch(addCandidate(cand));
        try { localStorage.setItem('candidateInfo', JSON.stringify(cand)); } catch (err) { console.warn('failed to persist candidateInfo', err); }
        dispatch(startSession(cand.id));
        try { broadcastMessage('candidate:added', cand) } catch (e) { void e }
        try { broadcastMessage('session:started', { id: cand.id, candidate: cand }) } catch (e) { void e }
      }
    } catch (e) {
      console.warn('Redux add/start failed, falling back to localStorage', e);
      try { localStorage.setItem('candidateInfo', JSON.stringify(merged)); } catch (_err) { console.warn(_err); }
    }
    navigate('/chat', { replace: true });
  };

  return (
    <Card style={{ marginTop: 12 }}>
      <Title level={4}>Upload a PDF or DOCX</Title>

      <div className="file-drop highlight" onDrop={onDrop} onDragOver={onDragOver} onClick={() => { try { fileInputRef.current && fileInputRef.current.click() } catch { void 0 } }}>
        <input ref={fileInputRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onInputChange} style={{ display: 'none' }} />
        <div className="file-drop-inner">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 3v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 7l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 15v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="file-drop-title">Drop your resume here or click to upload</div>
          <div className="file-drop-sub muted">PDF or DOCX — we extract name, email and phone</div>
        </div>
      </div>

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
            {!editing ? (
              <div style={{ marginTop: 8 }}>
                <div><strong>Name:</strong> {parsed.name || '—'}</div>
                <div><strong>Email:</strong> {parsed.email || '—'}</div>
                <div><strong>Phone:</strong> {parsed.phone || '—'}</div>
                <div style={{ marginTop: 10 }}>
                  <Space>
                    <Button onClick={() => { setEditing(true); setDraft({ name: parsed.name || '', email: parsed.email || '', phone: parsed.phone || '' }) }}>Edit details</Button>
                    <Button type="primary" onClick={() => { const merged = { ...(parsed || {}), ...(draft || {}) }; initiateSession(merged); }}>Start Chat</Button>
                  </Space>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                {error && <Alert type="error" message={error} />}
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Input placeholder="Full name" value={draft.name} onChange={(e) => changeDraft('name', e.target.value)} />
                  <Input placeholder="Email" value={draft.email} onChange={(e) => changeDraft('email', e.target.value)} />
                  <Input placeholder="Phone" value={draft.phone} onChange={(e) => changeDraft('phone', e.target.value)} />
                  <div>
                    <Space>
                      <Button type="primary" onClick={() => { const merged = { ...(parsed || {}), ...(draft || {}) }; initiateSession(merged); }}>Save & Start</Button>
                      <Button onClick={() => { setEditing(false); setDraft({ name: parsed.name || '', email: parsed.email || '', phone: parsed.phone || '' }); setError(null); }}>Cancel</Button>
                    </Space>
                  </div>
                </Space>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

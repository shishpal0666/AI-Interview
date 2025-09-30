import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { Tabs, Modal, Spin } from 'antd';
import { GithubOutlined } from '@ant-design/icons';
import Interviewee from './pages/Interviewee';
import Interviewer from './pages/Interviewer';
import Chat from './pages/Chat';
import Feedback from './pages/Feedback';
import './index.css';
import { useDispatch } from 'react-redux';
import { discardCurrentSession, restoreSession, resumeSession } from './store/sessionSlice';
import ToastContainer from './components/ToastContainer';

// layout and title come from Tailwind/daisyUI now

export default function App() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const pathToKey = (path) => {
    if (path.startsWith('/interviewer')) return 'interviewer';
    return 'interviewee';
  }

  useEffect(() => {
    if (location.pathname === '/') navigate('/interviewee', { replace: true });
  }, [location.pathname, navigate]);

  const onTabChange = (key) => {
    if (key === 'interviewer') navigate('/interviewer');
    else navigate('/interviewee');
  }

  useEffect(() => {
    try {
      const snapRaw = localStorage.getItem('incompleteSession');
      if (snapRaw) {
        const snap = JSON.parse(snapRaw);
        if (snap && snap.status !== 'completed') {
          try {
            dispatch(restoreSession(snap));
          } catch (e) { void e }
          setWelcomeMessage(`Welcome back — you have an unfinished session started ${snap.savedAt ? new Date(snap.savedAt).toLocaleString() : ''}`);
          setWelcomeVisible(true);
        }
      }
    } catch (e) { void e; }
    finally {
      setLoading(false);
    }
  }, [dispatch]);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="w-full border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-2xl font-semibold">Swipe Interview Assistant</div>
            <div className="hidden sm:block muted">AI-assisted interviewing</div>
          </div>
          <div className="flex items-center gap-2">
            <a className="btn btn-ghost" href="https://github.com/shishpal0666/AI-Interview" target="_blank" rel="noreferrer"><GithubOutlined />&nbsp;Repo</a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="card-surface">
            <Tabs
              activeKey={pathToKey(location.pathname)}
              onChange={onTabChange}
              items={[
                { key: 'interviewee', label: 'Interviewee' },
                { key: 'interviewer', label: 'Interviewer' },
              ]}
            />

            <div className="mt-4">
              <Routes>
                <Route path="/" element={<Navigate to="/interviewee" replace />} />
                <Route path="/interviewee" element={<Interviewee />} />
                <Route path="/interviewer" element={<Interviewer />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/feedback" element={<Feedback />} />
                <Route path="*" element={<Navigate to="/interviewee" replace />} />
              </Routes>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full border-t">
        <div className="max-w-6xl mx-auto px-6 py-4 text-center muted">Swipe Interview Assistant ©{new Date().getFullYear()}</div>
      </footer>
      <ToastContainer />

      <Modal
        title="Welcome back"
        open={welcomeVisible}
        onCancel={() => setWelcomeVisible(false)}
        footer={[
          <button key="discard" className="btn" onClick={() => { try { localStorage.removeItem('incompleteSession'); dispatch(discardCurrentSession()); setWelcomeVisible(false); } catch (e) { void e; } }}>Discard</button>,
          <button key="resume" className="btn btn-primary" onClick={() => {
            try {
              const raw = localStorage.getItem('incompleteSession');
              if (raw) {
                const snap = JSON.parse(raw);
                if (snap) {
                  dispatch(restoreSession(snap));
                  dispatch(resumeSession());
                  navigate('/chat');
                }
              }
            } catch (e) { console.warn('restore dispatch failed', e) }
            setWelcomeVisible(false);
          }}>Resume</button>
        ]}
      >
        <div>{welcomeMessage}</div>
      </Modal>
    </div>
  )
}


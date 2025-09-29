import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { Tabs, Layout, Typography, Space, Button, Modal } from 'antd';
import { GithubOutlined } from '@ant-design/icons';
import Interviewee from './pages/Interviewee';
import Interviewer from './pages/Interviewer';
import Chat from './pages/Chat';
import Feedback from './pages/Feedback';
import './App.css';
import { useDispatch } from 'react-redux';
import { discardCurrentSession } from './store/sessionSlice';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

export default function App() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');

  const pathToKey = (path) => {
    if (path.startsWith('/interviewer')) return 'interviewer';
    return 'interviewee';
  }

  useEffect(() => {
    if (location.pathname === '/') navigate('/interviewee', { replace: true });
  }, [location.pathname, navigate]);

  useEffect(() => {
    try {
      const snapRaw = localStorage.getItem('incompleteSession');
      if (snapRaw) {
        const snap = JSON.parse(snapRaw);
        if (snap && snap.status !== 'completed') {
          setWelcomeMessage(`Welcome back — you have an unfinished session started ${snap.savedAt ? new Date(snap.savedAt).toLocaleString() : ''}`);
          setWelcomeVisible(true);
        }
      }
    } catch (e) { void e; }
  }, []);

  const onTabChange = (key) => {
    if (key === 'interviewer') navigate('/interviewer')
    else navigate('/interviewee')
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space align="center">
            <Title level={4} style={{ margin: 0 }}>Swipe Interview Assistant</Title>
          </Space>
          <Space>
            <Button icon={<GithubOutlined />} type="link" href="https://github.com" target="_blank">Repo</Button>
          </Space>
        </div>
      </Header>

      <Content style={{ padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <div style={{ background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <Tabs
            activeKey={pathToKey(location.pathname)}
            onChange={onTabChange}
            items={[
              { key: 'interviewee', label: 'Interviewee' },
              { key: 'interviewer', label: 'Interviewer' },
            ]}
          />

          <div style={{ marginTop: 16 }}>
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
      </Content>

      <Footer style={{ textAlign: 'center' }}>Swipe Interview Assistant ©{new Date().getFullYear()}</Footer>
      <Modal
        title="Welcome back"
        open={welcomeVisible}
        onCancel={() => setWelcomeVisible(false)}
        onOk={() => setWelcomeVisible(false)}
        footer={[
          <Button key="discard" onClick={() => { try { localStorage.removeItem('incompleteSession'); dispatch(discardCurrentSession()); setWelcomeVisible(false); } catch (e) { void e; } }}>Discard</Button>,
          <Button key="resume" type="primary" onClick={() => { setWelcomeVisible(false); navigate('/chat'); }}>Resume</Button>
        ]}
      >
        <div>{welcomeMessage}</div>
      </Modal>
    </Layout>
  )
}


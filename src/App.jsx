import { useEffect } from 'react'
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom'
import { Tabs, Layout } from 'antd'
import Interviewee from './pages/Interviewee'
import Interviewer from './pages/Interviewer'
import './App.css'

const { Content } = Layout

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const pathToKey = (path) => {
    if (path.startsWith('/interviewer')) return 'interviewer'
    return 'interviewee'
  }

  useEffect(() => {
    if (location.pathname === '/') navigate('/interviewee', { replace: true })

  }, [])

  const onTabChange = (key) => {
    if (key === 'interviewer') navigate('/interviewer')
    else navigate('/interviewee')
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content style={{ padding: 24 }}>
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
            <Route path="*" element={<Navigate to="/interviewee" replace />} />
          </Routes>
        </div>
      </Content>
    </Layout>
  )
}


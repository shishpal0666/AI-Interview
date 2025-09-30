import { Card, Typography, Row, Col, Button } from 'antd'
import DocExtractor from '../components/DocExtractor.jsx'

const { Title, Paragraph } = Typography

export default function Interviewee() {
  return (
    <div className="hero">
      <div className="hero-inner max-w-6xl mx-auto">
        <div className="hero-left">
          <div className="eyebrow">AI Interview</div>
          <Title className="hero-title">Future-ready interviews, now.</Title>
          <Paragraph className="hero-sub">Upload your resume, answer timed technical questions, and get instant AI-powered feedback. The entire flow is saved locally so you can resume anytime.</Paragraph>
          {/* CTAs removed per design request - upload section is highlighted below */}
        </div>

        <div className="hero-right">
          <div className="glass-card card-surface">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Your profile</div>
                <div className="muted" style={{ fontSize: 12 }}>Attach resume & details</div>
              </div>
              <div className="time muted">Ready</div>
            </div>
            <DocExtractor />
          </div>
        </div>
      </div>
    </div>
  )
}

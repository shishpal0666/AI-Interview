import { Card, Typography, Row, Col } from 'antd'
import DocExtractor from '../components/DocExtractor.jsx'

const { Title, Paragraph } = Typography

export default function Interviewee() {
  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Card>
          <Title level={3}>Interviewee</Title>
          <Paragraph>Upload your resume and complete the timed interview. Your progress is saved locally.</Paragraph>
        </Card>
        <DocExtractor/>
      </Col>
    </Row>
  )
}

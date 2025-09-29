import { Card, Typography, Button } from 'antd'
import { useNavigate } from 'react-router-dom'

const { Title, Paragraph } = Typography

export default function Feedback() {
  const navigate = useNavigate()
  return (
    <Card>
      <Title level={3}>Interview complete</Title>
      <Paragraph>Thank you — the interview has been completed. Your responses have been submitted and cannot be changed.</Paragraph>
      <Button type="primary" onClick={() => navigate('/interviewee')}>Back to Home</Button>
    </Card>
  )
}

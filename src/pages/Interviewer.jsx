import { Card, Typography } from 'antd'

const { Title, Paragraph } = Typography

export default function Interviewer() {
  return (
    <Card>
      <Title level={3}>Interviewer View</Title>
      <Paragraph>Welcome — this is the interviewer interface.</Paragraph>
    </Card>
  )
}

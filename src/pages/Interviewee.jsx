import { Card, Typography } from 'antd'
import DocExtractor from '../components/DocExtractor'

const { Title, Paragraph } = Typography

export default function Interviewee() {
  return (
    <>
      <Card>
        <Title level={3}>Interviewee View</Title>
        <Paragraph>Welcome  this is the interviewee interface.</Paragraph>
      </Card>

      <DocExtractor />
    </>
  )
}

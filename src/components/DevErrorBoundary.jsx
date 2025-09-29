import React from 'react';
import { Alert, Button } from 'antd';

export default class DevErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  componentDidCatch(error, info) {
    this.setState({ error, info });
    console.error('DevErrorBoundary caught', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24 }}>
          <Alert
            message="Application error"
            description={
              <div>
                <div style={{ marginBottom: 12 }}><strong>{String(this.state.error)}</strong></div>
                <pre style={{ whiteSpace: 'pre-wrap', background: '#fff', padding: 12 }}>{this.state.info && this.state.info.componentStack}</pre>
                <div style={{ marginTop: 12 }}>
                  <Button onClick={() => window.location.reload()}>Reload app</Button>
                </div>
              </div>
            }
            type="error"
            showIcon
          />
        </div>
      );
    }
    return this.props.children;
  }
}

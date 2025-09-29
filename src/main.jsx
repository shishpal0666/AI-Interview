import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'antd/dist/reset.css';
import './index.css';
import App from './App.jsx';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import DevErrorBoundary from './components/DevErrorBoundary';

function showFatalError(message, details) {
  try {
    const body = document && document.body;
    if (body) {
      body.innerHTML = `
        <div style="padding:24px;font-family:system-ui,Segoe UI,Roboto,Arial;line-height:1.4;">
          <h2 style="color:#a00">Application error</h2>
          <pre style="white-space:pre-wrap;background:#fff;padding:12px;border:1px solid #eee;">${String(message)}</pre>
          <pre style="white-space:pre-wrap;background:#f7f7f7;padding:12px;border:1px solid #eee;margin-top:12px;">${String(details || '')}</pre>
          <div style="margin-top:12px;"><button onclick="location.reload()">Reload</button></div>
        </div>
      `;
    }
  } catch (e) {
    console.error('showFatalError failed', e);
  }
}

window.addEventListener('error', (ev) => {
  try {
    console.error('Global error caught', ev.error || ev.message, ev);
    showFatalError(ev.error || ev.message, ev.filename + ':' + ev.lineno + ':' + ev.colno);
  } catch (e) {
    console.error(e);
  }
});

window.addEventListener('unhandledrejection', (ev) => {
  try {
    console.error('Unhandled rejection', ev.reason);
    showFatalError(ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason), JSON.stringify(ev.reason));
  } catch (e) {
    console.error(e);
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <BrowserRouter>
          <DevErrorBoundary>
            <App />
          </DevErrorBoundary>
        </BrowserRouter>
      </PersistGate>
    </Provider>
  </StrictMode>
);

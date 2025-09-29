export function broadcastMessage(type, payload) {
  const channelName = 'swipe-interview-assistant';
  const message = { type, payload, ts: Date.now() };
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(channelName);
      bc.postMessage(message);
      bc.close();
      return;
    }
  } catch (e) {
    void e;
  }
  try {
    localStorage.setItem(`${channelName}:last`, JSON.stringify(message));
  } catch (err) {
    console.warn('broadcastMessage fallback failed', err);
  }
}

export function listenMessages(onMessage) {
  const channelName = 'swipe-interview-assistant';
  let bc = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(channelName);
      bc.onmessage = (ev) => {
        try { onMessage(ev.data); } catch (e) { console.warn('onMessage handler failed', e); }
      };
    }
  } catch (e) {
    void e;
  }
  const storageHandler = (e) => {
    try {
      if (!e.key) return;
      if (e.key === `${channelName}:last`) {
        const msg = JSON.parse(e.newValue || '{}');
        onMessage(msg);
      }
    } catch (err) { console.warn('storage handler error', err); }
  };
  window.addEventListener('storage', storageHandler);
  return () => {
    try { if (bc) bc.close(); } catch (err) { console.warn('failed to close BroadcastChannel', err); }
    window.removeEventListener('storage', storageHandler);
  };
}

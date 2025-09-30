// simple event-based toast helper
export function showToast(type, message, opts = {}) {
  try {
    const ev = new CustomEvent('app:toast', { detail: { type, message, opts } });
    window.dispatchEvent(ev);
  } catch {
    // fallback: console
    try { console.warn('toast', type, message); } catch { void 0 }
  }
}

export default showToast;

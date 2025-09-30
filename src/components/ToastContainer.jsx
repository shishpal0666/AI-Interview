import { useEffect, useState } from 'react'

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])
  useEffect(() => {
    const handler = (e) => {
      const t = e && e.detail ? e.detail : null
      if (!t) return
      const id = Date.now() + Math.random()
      setToasts((s) => [...s, { id, ...t }])
      setTimeout(() => {
        setToasts((s) => s.filter((x) => x.id !== id))
      }, (t.opts && t.opts.duration) || 4000)
    }
    window.addEventListener('app:toast', handler)
    return () => window.removeEventListener('app:toast', handler)
  }, [])

  return (
    <div style={{ position: 'fixed', right: 16, top: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type || 'info'}`} style={{ padding: '10px 14px', borderRadius: 10, boxShadow: '0 8px 20px rgba(10,20,30,0.12)', background: t.type === 'error' ? '#fee2e2' : t.type === 'success' ? '#e6ffef' : '#f0f9ff', color: '#042c40', minWidth: 220 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{t.type ? t.type.charAt(0).toUpperCase() + t.type.slice(1) : 'Info'}</div>
          <div style={{ fontSize: 13 }}>{t.message}</div>
        </div>
      ))}
    </div>
  )
}

import React from 'react'

export default function TimerProgress({ timeLeft }) {
  const pct = typeof timeLeft === 'number' && timeLeft > 0 ? Math.min(100, Math.round((timeLeft / 120) * 100)) : 0;
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm">Time left</div>
        <div className="text-sm font-semibold">{typeof timeLeft === 'number' ? `${timeLeft}s` : '—'}</div>
      </div>
      <div className="w-full bg-neutral/10 h-2 rounded-full overflow-hidden">
        <div className="h-2 bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

import React, { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') || 'mylight';
    } catch { return 'mylight' }
  });

  useEffect(() => {
    try {
      const root = document.documentElement;
      if (!root) return;
      if (theme === 'mydark') {
        root.classList.add('dark');
        root.setAttribute('data-theme', 'mydark');
      } else {
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'mylight');
      }
      try { localStorage.setItem('theme', theme); } catch { void 0 }
    } catch (e) { void e }
  }, [theme]);

  return (
    <div className="flex items-center gap-2">
      <button
        aria-label="Toggle theme"
        onClick={() => setTheme(prev => prev === 'mylight' ? 'mydark' : 'mylight')}
        className="btn btn-ghost"
      >
        {theme === 'mydark' ? '🌙 Dark' : '☀️ Light'}
      </button>
    </div>
  );
}

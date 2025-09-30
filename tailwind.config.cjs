/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx,html}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#0ea5a4',
        accent: '#7c3aed',
        danger: '#ef4444'
      }
    }
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        mylight: {
          primary: '#0ea5a4',
          secondary: '#7c3aed',
          accent: '#06b6d4',
          neutral: '#111827',
          'base-100': '#ffffff',
          '--rounded-btn': '0.5rem'
        }
      },
      {
        mydark: {
          primary: '#06b6d4',
          secondary: '#7c3aed',
          accent: '#0ea5a4',
          neutral: '#0b1220',
          'base-100': '#0b1220',
          '--rounded-btn': '0.5rem'
        }
      }
    ]
  }
}

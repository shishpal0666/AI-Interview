let plugins = {};
try {
  // try to require tailwindcss and autoprefixer; if not available, fall back to no-op so vite won't crash
  const tailwind = require('tailwindcss');
  const autoprefixer = require('autoprefixer');
  plugins = {
    tailwindcss: {},
    autoprefixer: {},
  };
} catch (e) {
  // If packages aren't installed (offline or registry issues), export empty plugins to allow dev server to run.
  plugins = {};
}

module.exports = { plugins };

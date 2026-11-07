/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#0D0E11',
          panel: '#14161B',
          surface: '#1A1D24',
          hover: '#242833',
          border: '#222630',
          borderLight: '#2E3442',
          cyan: '#38BDF8',
          emerald: '#10B981',
          muted: '#8A92A6',
          text: '#F0F3F8',
          textDim: '#64748B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'cyan-glow': '0 0 10px rgba(56, 189, 248, 0.25)',
        'emerald-glow': '0 0 10px rgba(16, 185, 129, 0.25)',
      }
    },
  },
  plugins: [],
}

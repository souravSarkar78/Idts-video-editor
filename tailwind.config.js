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
          bg: '#0A0B0E',
          panel: '#101216',
          surface: '#15171D',
          hover: '#1D212A',
          border: '#1E2128',
          borderLight: '#282C36',
          cyan: '#0284C7',
          emerald: '#059669',
          muted: '#8A92A6',
          text: '#CBD5E1',
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

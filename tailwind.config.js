/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0C0E13',
          card: '#141820',
          elevated: '#1C2030',
          overlay: 'rgba(0,0,0,0.7)',
        },
        border: {
          DEFAULT: '#252B3B',
          light: '#2E3548',
        },
        text: {
          primary: '#F0EBE1',
          secondary: '#B0BAD0',
          muted: '#7A8A9D',
        },
        accent: {
          gold: '#D4A853',
          'gold-muted': 'rgba(212,168,83,0.15)',
          green: '#6EBF8B',
          'green-muted': 'rgba(110,191,139,0.15)',
          red: '#E05C5C',
          'red-muted': 'rgba(224,92,92,0.15)',
          blue: '#6B9FD4',
          'blue-muted': 'rgba(107,159,212,0.15)',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.72rem', { lineHeight: '1.1rem' }],
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.4)',
        modal: '0 25px 60px rgba(0,0,0,0.6)',
        'glow-gold': '0 0 20px rgba(212,168,83,0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease',
        'slide-up': 'slideUp 0.25s ease',
        'spin-slow': 'spin 1.5s linear infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#040605',
        g: '#7ee08a',
        g2: '#3f9a50',
        fx: '#5b8fc7',
        mu: '#8aa38e',
        mu2: '#5f7764',
        tx: '#ecf3ed',
        base: '#0a0f1a',
        surface: '#111827',
        elevated: '#1b2434',
        'border-subtle': '#243044',
        accent: '#34d399',
        danger: '#f87171',
        warning: '#fbbf24',
        info: '#60a5fa',
        'text-primary': '#f1f5f9',
        'text-muted': '#94a3b8',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

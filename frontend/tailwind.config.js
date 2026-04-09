/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#131313',
        'surface-2': '#1c1c1c',
        'surface-3': '#242424',
        accent: '#e8a020',
        'accent-2': '#fbbf24',
        highlight: '#fbbf24',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        muted: '#6b7280',
      },
      backgroundImage: {
        'card-gradient': 'linear-gradient(135deg, rgba(232,160,32,0.04) 0%, rgba(251,191,36,0.02) 100%)',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(232, 160, 32, 0.3)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.5)',
        'card-hover': '0 4px 12px rgba(232, 160, 32, 0.12)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
        'slide-up': 'slideUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

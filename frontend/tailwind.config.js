/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#000319',
        surface: '#050d2e',
        'surface-2': '#0a1545',
        'surface-3': '#0f1e5c',
        accent: '#6366f1',
        'accent-2': '#818cf8',
        highlight: '#22d3ee',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        muted: '#64748b',
      },
      backgroundImage: {
        'card-gradient': 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(14,165,233,0.05) 100%)',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(99, 102, 241, 0.4)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 40px rgba(99, 102, 241, 0.25)',
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

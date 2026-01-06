/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Legacy brand colors (keeping for compatibility)
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        // Theme-aware colors using CSS variables
        theme: {
          bg: 'var(--bg)',
          'bg-subtle': 'var(--bg-subtle)',
          surface: 'var(--surface)',
          'surface-2': 'var(--surface-2)',
          border: 'var(--border)',
          'border-subtle': 'var(--border-subtle)',
          'border-strong': 'var(--border-strong)',
          text: 'var(--text)',
          'text-secondary': 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-subtle)',
          accent: 'var(--accent)',
          'accent-subtle': 'var(--accent-subtle)',
        },
        // Premium semantic colors
        premium: {
          slate: {
            50: '#f8f9fa',
            100: '#f1f3f5',
            200: '#e9ecef',
            300: '#dee2e6',
            400: '#ced4da',
            500: '#adb5bd',
            600: '#868e96',
            700: '#495057',
            800: '#343a40',
            900: '#212529',
          }
        }
      },
      boxShadow: {
        'premium-xs': 'var(--shadow-xs)',
        'premium-sm': 'var(--shadow-sm)',
        'premium': 'var(--shadow)',
        'premium-md': 'var(--shadow-md)',
        'premium-lg': 'var(--shadow-lg)',
        'premium-elevated': 'var(--shadow-elevated)',
        // Legacy
        theme: 'var(--shadow)',
        'theme-sm': 'var(--shadow-sm)',
      },
      borderRadius: {
        'premium-sm': 'var(--radius-sm)',
        'premium': 'var(--radius)',
        'premium-md': 'var(--radius-md)',
        'premium-lg': 'var(--radius-lg)',
        'premium-xl': 'var(--radius-xl)',
      },
      fontFamily: {
        'premium': ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
      },
      fontSize: {
        'premium-xs': ['0.6875rem', { lineHeight: '1rem' }],
        'premium-sm': ['0.8125rem', { lineHeight: '1.25rem' }],
        'premium-base': ['0.9375rem', { lineHeight: '1.5rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
};

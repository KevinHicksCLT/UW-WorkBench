/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        // paired line-height + tracking for a real editorial scale
        display: ['clamp(2rem, 1.4rem + 2.4vw, 3.25rem)', { lineHeight: '1.04', letterSpacing: '-0.025em', fontWeight: '800' }],
        h1: ['1.625rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '700' }],
        h2: ['1.25rem', { lineHeight: '1.2', letterSpacing: '-0.015em', fontWeight: '700' }],
        h3: ['1.0625rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        eyebrow: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.14em', fontWeight: '700' }],
      },
      colors: {
        // Cool navy neutral spine
        brand: {
          50:  '#f3f6fb',
          100: '#e3eaf6',
          200: '#c2d2eb',
          300: '#92b1da',
          400: '#5e8bc6',
          500: '#3d6db1',
          600: '#2c5594',
          700: '#264478',
          800: '#233a64',
          900: '#1f3253',
          950: '#141f37',
        },
        // Single refined accent (selected / CTA / focused breadcrumb)
        accent: {
          50:  '#eef4ff',
          100: '#dbe6ff',
          200: '#bdd0ff',
          300: '#90b0ff',
          400: '#5f86fa',
          500: '#3a5ff0',
          600: '#2945d6',
          700: '#2237ab',
          800: '#213188',
          900: '#212f6c',
        },
        surface: {
          DEFAULT: '#ffffff',
          raised: '#ffffff',
          sunken: '#f5f7fb',
          muted: '#eef1f7',
        },
      },
      boxShadow: {
        card:  '0 1px 2px rgba(15,23,42,0.05), 0 8px 24px -18px rgba(20,31,55,0.30)',
        float: '0 2px 6px rgba(15,23,42,0.06), 0 24px 48px -24px rgba(20,31,55,0.38)',
        pop:   '0 10px 28px -8px rgba(33,49,136,0.30), 0 2px 8px rgba(15,23,42,0.08)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.375rem',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'rise-in': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        'rise-in': 'rise-in 0.32s cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        // Paired line-height + tracking — editorial scale for a CEO-facing product.
        display: ['clamp(2rem, 1.4rem + 2.4vw, 3.25rem)', { lineHeight: '1.04', letterSpacing: '-0.025em', fontWeight: '800' }],
        h1:      ['1.625rem', { lineHeight: '1.15', letterSpacing: '-0.02em',  fontWeight: '700' }],
        h2:      ['1.25rem',  { lineHeight: '1.2',  letterSpacing: '-0.015em', fontWeight: '700' }],
        h3:      ['1.0625rem',{ lineHeight: '1.3',  letterSpacing: '-0.01em',  fontWeight: '600' }],
        eyebrow: ['0.6875rem',{ lineHeight: '1',    letterSpacing: '0.10em',   fontWeight: '600' }],
      },
      colors: {
        // ── Vercel/Geist neutral spine ─────────────────────────────────────────
        // Near-black to near-white — monochrome-first, zero blue cast.
        brand: {
          50:  '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },

        // ── Vercel blue — links, focus rings, used sparingly ──────────────────
        accent: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#0070f3',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },

        // ── CEO-domain semantic accents ────────────────────────────────────────
        // Rendered as small subtle chips/tags only — no big fills.
        // Core Business  → teal   (value-creation, growth)
        // IT             → indigo (systems, enablement)
        // Corporate Fn   → violet (governance, stewardship)
        'domain-core': {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        'domain-it': {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        'domain-corp': {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },

        // ── Overlap / gain / loss semantic encoding ────────────────────────────
        gain: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        loss: {
          50:  '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
        },
        overlap: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },

        // ── Vercel surface tokens ──────────────────────────────────────────────
        // White main, near-white sunken, hairline borders
        surface: {
          DEFAULT: '#ffffff',
          raised:  '#ffffff',
          sunken:  '#fafafa',
          muted:   '#f5f5f5',
        },

        // ── Piece-type tokens ───────────────────────────────────────────────────
        'piece-person': {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        'piece-app': {
          50:  '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
        },
        'piece-kpi': {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },

      boxShadow: {
        // Vercel-style: extremely subtle, borders do the heavy lifting
        card:  '0 1px 2px rgba(0,0,0,0.04)',
        float: '0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
        pop:   '0 8px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
        inset: 'inset 0 1px 2px rgba(0,0,0,0.04)',
        focus: '0 0 0 2px rgba(0,112,243,0.25)',
      },

      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.375rem',
      },

      keyframes: {
        'fade-in':       { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'rise-in':       { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        shimmer:         { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        ping:            { '75%, 100%': { transform: 'scale(2)', opacity: '0' } },
        'node-focus-in': { '0%': { opacity: '0.7', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'piece-arrive':  { '0%': { opacity: '0', transform: 'translateY(8px) scale(0.96)' }, '100%': { opacity: '1', transform: 'translateY(0) scale(1)' } },
      },
      animation: {
        'fade-in':       'fade-in 0.15s ease-out both',
        'rise-in':       'rise-in 0.2s cubic-bezier(0.22,1,0.36,1) both',
        shimmer:         'shimmer 1.4s linear infinite',
        'node-focus-in': 'node-focus-in 0.2s cubic-bezier(0.22,1,0.36,1) both',
        'piece-arrive':  'piece-arrive 0.25s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};

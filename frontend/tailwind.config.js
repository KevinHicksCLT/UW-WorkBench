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
        eyebrow: ['0.6875rem',{ lineHeight: '1',    letterSpacing: '0.14em',   fontWeight: '700' }],
      },
      colors: {
        // ── Neutral spine ─────────────────────────────────────────────────────
        // Cool navy: sidebar, depth anchors, strong text.
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

        // ── Interaction accent ─────────────────────────────────────────────────
        // Selection rings, CTAs, focused breadcrumb, drill affordances.
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

        // ── CEO-domain semantic accents ────────────────────────────────────────
        // Each domain gets its own hue family so nodes, pills, and lenses are
        // instantly attributable at a glance. Hues are chosen for contrast with
        // the navy sidebar and with each other; saturation is kept moderate so
        // three domains live together without fighting.
        //
        // Core Business  → teal   (value-creation, growth)
        // IT             → indigo (systems, enablement)
        // Corporate Fn   → slate-violet (governance, stewardship)
        //
        // These are the SEMANTIC layers — consumers reference `domain-core.*`,
        // `domain-it.*`, `domain-corp.*` rather than raw hue names.
        'domain-core': {
          // Teal — Core Business
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
          // Indigo — IT
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
          // Slate-violet — Corporate Function
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
        // The cross-cutting value-stream story: where do roles straddle domain
        // lines, where is value generated, where does it leak? These three
        // semantic colors must be read instantly; they are NEVER decorative.
        //
        // gain    → emerald (positive delta, value added, capacity freed)
        // loss    → rose    (negative delta, leakage, unmet demand, waste)
        // overlap → amber   (ambiguity, dual accountability, handoff risk)
        //
        // Each has a full scale so the ui-component-designer can build filled
        // chips, dot indicators, background washes, and border highlights
        // without inventing off-spec colors.
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

        // ── Surface tokens ─────────────────────────────────────────────────────
        surface: {
          DEFAULT: '#ffffff',
          raised:  '#ffffff',
          sunken:  '#f5f7fb',
          muted:   '#eef1f7',
        },
      },

      boxShadow: {
        // card   : resting card — barely visible lift
        // float  : hovered card / focused inspector panel
        // pop    : selected parent node in the drill canvas
        // inset  : subtle inner border for sunken wells
        card:  '0 1px 2px rgba(15,23,42,0.05), 0 8px 24px -18px rgba(20,31,55,0.30)',
        float: '0 2px 6px rgba(15,23,42,0.06), 0 24px 48px -24px rgba(20,31,55,0.38)',
        pop:   '0 10px 28px -8px rgba(33,49,136,0.30), 0 2px 8px rgba(15,23,42,0.08)',
        inset: 'inset 0 1px 3px rgba(15,23,42,0.06)',
      },

      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.375rem',
      },

      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'rise-in': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        shimmer:   { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        // Subtle pulse for "live / connected" indicators (data freshness dot).
        ping:      { '75%, 100%': { transform: 'scale(2)', opacity: '0' } },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        'rise-in': 'rise-in 0.32s cubic-bezier(0.22,1,0.36,1) both',
        shimmer:   'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};

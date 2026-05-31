/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
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
      },
    },
  },
  plugins: [],
};

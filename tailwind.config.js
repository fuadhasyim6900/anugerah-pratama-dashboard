/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#961818',
          900: '#7a1414',
        },
        ink: {
          50: '#f7f7f8',
          100: '#eeeef0',
          200: '#d9d9de',
          300: '#b5b5bd',
          400: '#8b8b96',
          500: '#6b6b76',
          600: '#52525c',
          700: '#3f3f47',
          800: '#26262c',
          900: '#151518',
          950: '#0c0c0e',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(15, 15, 20, 0.04), 0 1px 6px -1px rgba(15,15,20,0.06)',
      },
      borderRadius: {
        xl2: '1rem',
      },
    },
  },
  plugins: [],
}

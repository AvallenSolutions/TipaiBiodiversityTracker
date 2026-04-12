/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'tipai-green': {
          50:  '#F2F7F2',
          100: '#DFF0DE',
          200: '#BCDEBB',
          300: '#8DC28C',
          400: '#5EA35D',
          500: '#3D8A3C',
          600: '#2E7130',
          700: '#255C27',
          800: '#1B4620',
          900: '#122F16',
        },
        'tipai-stone': {
          50:  '#FAF8F4',
          100: '#F2EDE4',
          200: '#E2D9CB',
          300: '#C9BAA5',
          400: '#A89070',
          500: '#8B7355',
          600: '#725E44',
          700: '#5A4A35',
          800: '#3E3326',
          900: '#261F17',
        }
      }
    },
  },
  plugins: [],
}

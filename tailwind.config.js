/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Wildlife Luxuries palette
        paper:  '#E8E2D3',
        ivory:  '#F4EEE2',
        bone:   '#D9CEB6',
        ink:    '#1C2520',
        forest: '#3F5048',
        ochre:  '#B8935A',
        rust:   '#A0503C',
        // Legacy tipai tokens (remapped to the Wildlife Luxuries palette so
        // pages that haven't been re-skinned yet still read visually correct).
        tipai: {
          50:  '#F4EEE2',
          100: '#E8E2D3',
          200: '#D9CEB6',
          300: '#B8935A',
          400: '#7A8273',
          500: '#5F6C62',
          600: '#4D5B52',
          700: '#3F5048',
          800: '#2C3832',
          900: '#1C2520',
        },
        'tipai-stone': {
          50:  '#E8E2D3',
          100: '#D9CEB6',
          200: '#C5B896',
          300: '#A8977B',
          400: '#8B7355',
          500: '#6A583F',
          600: '#504330',
          700: '#3A3224',
          800: '#2A2419',
          900: '#1C2520',
        },
      },
      fontFamily: {
        serif:   ['Newsreader', 'Georgia', 'serif'],
        sans:    ['Inter Tight', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'ui-monospace', 'monospace'],
        heading: ['Newsreader', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}

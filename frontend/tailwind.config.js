/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        'primary-light': '#bfdbfe',
        surface: '#f8fafc',
        border: '#e2e8f0',
      },
    },
  },
  plugins: [],
};

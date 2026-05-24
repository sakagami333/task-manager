/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        redmine: {
          header: '#628a0d',
          link: '#169',
          bg: '#f8f8f8',
          border: '#d7d7d7',
        }
      }
    },
  },
  plugins: [],
}

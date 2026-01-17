/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#1e1e1e',
        surface: '#252526',
        border: '#3e3e42',
        hover: '#2a2d2e',
        text: {
          primary: '#cccccc',
          secondary: '#858585',
        },
        diff: {
          add: '#28a745',
          'add-bg': 'rgba(40, 167, 69, 0.1)',
          delete: '#d73a49',
          'delete-bg': 'rgba(215, 58, 73, 0.1)',
        },
      },
    },
  },
  plugins: [],
};

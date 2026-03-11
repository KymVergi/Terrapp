/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#06060a',
        surface: '#0c0c12',
        surface2: '#111118',
        border: '#16161e',
        border2: '#1e1e2a',
        accent: '#e8e8ff',
        amber: '#ffaa00',
        danger: '#ff3344',
        blue: '#8899ff',
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', 'monospace'],
        display: ['"Bebas Neue"', 'sans-serif'],
        body: ['Syne', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

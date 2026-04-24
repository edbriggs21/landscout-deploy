/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        deepBlue: '#0B2A4A',
        landGreen: '#9ACD32',
        dataBlue: '#25A7FF',
        brandBg: '#081425',
        brandSurface: '#0F2340',
        brandBorder: '#1E3C68',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

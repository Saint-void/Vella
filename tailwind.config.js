/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./input.css",
    "./index.tsx",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  safelist: [
    {
      pattern: /(bg|text|border)-(blue|emerald|purple|red|amber|slate|green|pink|orange|teal|indigo)-(50|100|200|300|400|500|600|700|800|900)/,
    },
  ],
}
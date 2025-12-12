/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",   // app inside src
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./web/**/*.{js,ts,jsx,tsx,mdx}",       // your web/components too
  ],
  theme: {
    extend: {
      colors: {
        primary: "#F54927",
        gold: {
          100: "#978667",
          200: "#555",
          300: "#faf8f5",
          900: "#ebd7b2",
        },
        black: {
          500: "#24262d",
          600: "#23242A",
          700: "#474747",
          800: "#383838",
          900: "#333",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0px 2px 100px rgba(0, 0, 0, 0.1)",
      },
      screens: {
        sm: "576px",
        "sm-max": { max: "576px" },
        md: "768px",
        "md-max": { max: "768px" },
        lg: "992px",
        "lg-max": { max: "992px" },
        xl: "1200px",
        "xl-max": { max: "1200px" },
        "2xl": "1400px",
        "2xl-max": { max: "1320px" },
      },
    },
  },
  plugins: [],
};

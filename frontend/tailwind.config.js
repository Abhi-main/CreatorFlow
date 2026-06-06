/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#F5A623",
          purple: "#7C4DFF",
          green: "#00C896",
          pink: "#FF4081",
          blue: "#3B82F6"
        }
      },
      boxShadow: {
        card: "0 18px 45px rgba(31, 35, 64, 0.08)",
        soft: "0 12px 30px rgba(124, 77, 255, 0.12)"
      },
      borderRadius: {
        "2.5xl": "1.5rem"
      },
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui"]
      }
    }
  },
  plugins: []
};

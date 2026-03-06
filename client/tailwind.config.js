/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",

  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],

  theme: {
    extend: {
      colors: {
        primary: "#6366f1", // Indigo
        secondary: "#8b5cf6", // Purple
        accent: "#22c55e", // Green
      },

      boxShadow: {
        card: "0 10px 25px rgba(0,0,0,0.08)",
      },

      borderRadius: {
        xl2: "1.25rem",
      },

      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
    },
  },

  plugins: [],
};

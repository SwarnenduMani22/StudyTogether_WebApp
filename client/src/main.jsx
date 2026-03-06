import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

import "./index.css";
import { AuthProvider } from "./context/AuthContext";

/* ================= LOAD SAVED THEME ================= */

const loadTheme = () => {
  try {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  } catch (error) {
    console.warn("Theme load error:", error);
  }
};

loadTheme();

/* ================= RENDER APP ================= */

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);

import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import "./index.css";

import { AuthProvider } from "./context/AuthContext";

/* ================= PDF WORKER (react-pdf) ================= */

import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

/* ================= LOAD SAVED THEME ================= */

function loadTheme() {
  try {
    const savedTheme = localStorage.getItem("theme");

    /* Default Dark */

    if (!savedTheme || savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  } catch (error) {
    console.warn("Theme load error:", error);
  }
}

/* Apply theme before render */

loadTheme();

/* ================= ROOT ELEMENT ================= */

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

/* ================= RENDER APP ================= */

createRoot(rootElement).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);

import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import "./index.css";

import { AuthProvider } from "./context/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

/* ================= LOAD SAVED THEME ================= */

function loadTheme() {
  try {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme) {
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;

      document.documentElement.classList.toggle("dark", prefersDark);
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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

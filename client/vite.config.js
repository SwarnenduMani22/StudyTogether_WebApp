import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          vendor: ["axios", "react-hot-toast"],
          pdf: ["react-pdf", "pdfjs-dist"],
        },
      },
    },
  },

  server: {
    port: 5173,
    host: true,

    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },

  preview: {
    port: 5173,
  },
});

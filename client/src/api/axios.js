import axios from "axios";

/* ================= BASE URL ================= */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

/* ================= AXIOS INSTANCE ================= */

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

/* ================= REQUEST INTERCEPTOR ================= */

api.interceptors.request.use(
  (config) => {
    try {
      const token = sessionStorage.getItem("token");

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    } catch (error) {
      console.error("Request interceptor error:", error);
      return config;
    }
  },
  (error) => Promise.reject(error),
);

/* ================= RESPONSE INTERCEPTOR ================= */

api.interceptors.response.use(
  (response) => response,

  (error) => {
    const status = error.response?.status;

    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "Unknown error";

    /* ================= UNAUTHORIZED ================= */

    if (status === 401) {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    /* ================= SERVER ERROR ================= */

    if (status === 500) {
      console.error("Server error:", message);
    }

    /* ================= NETWORK ERROR ================= */

    if (!error.response) {
      console.error("Network error: backend may be offline");
    }

    /* ================= IMPORTANT FIX ================= */
    /* keeps axios original error usable */

    error.message = message;
    error.status = status;

    return Promise.reject(error);
  },
);

export default api;

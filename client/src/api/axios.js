import axios from "axios";

/* ================= API INSTANCE ================= */

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

/* ================= REQUEST INTERCEPTOR ================= */

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/* ================= RESPONSE INTERCEPTOR ================= */

api.interceptors.response.use(
  (response) => response,

  (error) => {
    const status = error.response?.status;

    /* Unauthorized → logout */

    if (status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      window.location.replace("/login");
    }

    /* Server error */

    if (status === 500) {
      console.error("Server error occurred");
    }

    /* Network error */

    if (!error.response) {
      console.error("Network error: backend may be offline");
    }

    return Promise.reject(error);
  },
);

export default api;

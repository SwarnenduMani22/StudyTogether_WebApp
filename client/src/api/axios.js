import axios from "axios";
import toast from "react-hot-toast";

/* ================= BASE URL ================= */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
/* ================= AXIOS INSTANCE ================= */

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  withCredentials: true,
});

/* ================= REQUEST INTERCEPTOR ================= */

api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem("accessToken");

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

  async (error) => {
    const status = error.response?.status;

    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "Unknown error";

    /* ================= REFRESH TOKEN LOGIC ================= */

    if (status === 401 && !error.config._retry) {
      if (error.config?.skipAuthRedirect) {
        return Promise.reject(error);
      }

      error.config._retry = true;

      try {
        const res = await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = res.data.accessToken;

        localStorage.setItem("accessToken", newAccessToken);

        error.config.headers = {
          ...error.config.headers,
          Authorization: `Bearer ${newAccessToken}`,
        };
        return api(error.config);
      } catch (err) {
        console.error("Refresh token failed:", err);

        localStorage.removeItem("user");
        localStorage.removeItem("accessToken");

        if (!error.config?.skipAuthRedirect) {
          window.location.replace("/login");
        }
        return Promise.reject(err);
      }
    }

    /* ================= SERVER ERROR ================= */

    if (status >= 500) {
      console.error("Server error:", message);
      toast.error(message || "Internal server error");
    }

    /* ================= NETWORK ERROR ================= */

    if (!error.response) {
      console.error("Network error: backend may be offline");
      toast.error("Unable to connect to server");
    }

    error.message = !error.response ? "Unable to connect to server" : message;

    error.status = status;

    return Promise.reject(error);
  },
);

export default api;

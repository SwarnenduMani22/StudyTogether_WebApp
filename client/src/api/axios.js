import axios from "axios";

/* ================= BASE URL ================= */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
/* ================= AXIOS INSTANCE ================= */

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

/* ================= REQUEST INTERCEPTOR ================= */

api.interceptors.request.use(
  (config) => {
    try {
      const token = sessionStorage.getItem("accessToken");

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
      error.config._retry = true;

      try {
        const refreshToken = sessionStorage.getItem("refreshToken");

        if (!refreshToken) throw new Error("No refresh token");

        const res = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const newAccessToken = res.data.accessToken;

        sessionStorage.setItem("accessToken", newAccessToken);

        error.config.headers = {
          ...error.config.headers,
          Authorization: `Bearer ${newAccessToken}`,
        };
        return api(error.config);
      } catch (err) {
        console.error("Refresh token failed:", err);

        sessionStorage.removeItem("user");
        sessionStorage.removeItem("accessToken");
        sessionStorage.removeItem("refreshToken");

        window.location.replace("/login");
        return Promise.reject(err);
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

    error.message = !error.response ? "Unable to connect to server" : message;

    error.status = status;

    return Promise.reject(error);
  },
);

export default api;

import axios from "axios";

const AI_BASE_URL =
  import.meta.env.VITE_AI_API_URL || "http://localhost:5001/api/v1";

const aiApi = axios.create({
  baseURL: AI_BASE_URL,
  timeout: 30000,
  withCredentials: true,
});

aiApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default aiApi;

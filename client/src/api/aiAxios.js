import axios from "axios";

export const getAiBaseUrl = (rawUrl) => {
  const raw = (
    rawUrl ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_AI_API_URL) ||
    "http://localhost:5001/api/v1"
  )
    .trim()
    .replace(/\/+$/, "");
  return raw.endsWith("/ai") ? raw.slice(0, -3) : raw;
};

export const getAiStreamUrl = (rawBaseUrl) => {
  const raw = (
    rawBaseUrl ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_AI_API_URL) ||
    "http://localhost:5001/api/v1"
  )
    .trim()
    .replace(/\/+$/, "");

  if (raw.endsWith("/api/v1/ai") || raw.endsWith("/ai")) {
    return `${raw}/chat/stream`;
  }
  if (raw.endsWith("/api/v1")) {
    return `${raw}/ai/chat/stream`;
  }
  return `${raw}/api/v1/ai/chat/stream`;
};

const aiApi = axios.create({
  baseURL: getAiBaseUrl(),
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

const DEFAULT_API_BASE = "http://localhost:5000/api/v1";

const stripTrailingSlash = (value) => value.replace(/\/+$/, "");

const getApiOrigin = () => {
  const envBase =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE ||
    DEFAULT_API_BASE;
  const cleaned = stripTrailingSlash(envBase).replace(/\/api(?:\/v\d+)?$/i, "");
  return cleaned || "http://localhost:5000";
};

const normalizeUploadsPath = (value) => {
  if (!value) return "";

  let path = value.trim();

  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  const uploadsIndex = path.toLowerCase().indexOf("/uploads/");
  if (uploadsIndex > -1) {
    path = path.slice(uploadsIndex);
  }

  return path;
};

export const resolvePdfUrl = (pdfLink = "") => {
  if (!pdfLink) return "";

  const raw = String(pdfLink).trim();
  if (!raw) return "";

  if (/^(blob:|data:)/i.test(raw)) {
    return raw;
  }

  if (/^https?:\/\//i.test(raw)) {
    return encodeURI(raw);
  }

  const path = normalizeUploadsPath(raw);
  if (!path) return "";

  return encodeURI(`${getApiOrigin()}${path}`);
};

export default resolvePdfUrl;

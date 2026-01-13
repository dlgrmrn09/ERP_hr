import axios from "axios";

const normalizeApiBaseUrl = (value) => {
  const raw = (value ?? "").toString().trim();
  const fallback = "http://localhost:5000/api";
  const base = raw !== "" ? raw : fallback;
  const withoutTrailing = base.replace(/\/+$/, "");
  if (/\/api$/i.test(withoutTrailing)) {
    return withoutTrailing;
  }
  return `${withoutTrailing}/api`;
};

const apiClient = axios.create({
  baseURL: normalizeApiBaseUrl(import.meta.env.VITE_API_URL),
  withCredentials: true,
});

export default apiClient;

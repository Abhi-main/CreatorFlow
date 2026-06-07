import axios from "axios";

function resolveBaseUrl() {
  const configured = String(import.meta.env.VITE_API_URL || "").trim();

  if (!configured) {
    return `${window.location.protocol}//${window.location.hostname}:5000/api`;
  }

  const normalized = configured.replace(/\/+$/, "");
  return /\/api$/i.test(normalized) ? normalized : `${normalized}/api`;
}

const api = axios.create({
  baseURL: resolveBaseUrl(),
  withCredentials: true
});

let accessToken = "";
let onUnauthorized = () => {};

export function setAccessToken(nextToken) {
  accessToken = nextToken || "";
}

export function bindUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

api.interceptors.request.use((config) => {
  const method = String(config.method || "get").toLowerCase();

  if (method === "get") {
    config.headers["Cache-Control"] = "no-store";
    config.headers.Pragma = "no-cache";
    config.headers.Expires = "0";
  }

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setAccessToken("");
      onUnauthorized();
    }

    return Promise.reject(error);
  }
);

export default api;

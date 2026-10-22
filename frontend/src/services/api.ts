import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    "http://127.0.0.1:8000",

  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url ?? "";
    const detail = error.response?.data?.detail;
    const isAuthEndpoint = url.includes("/api/v1/auth/login")
      || url.includes("/api/v1/auth/register")
      || url.includes("/api/v1/auth/refresh")
      || url.includes("/api/v1/auth/logout");

    if (status === 401 && !isAuthEndpoint && typeof window !== "undefined") {
      window.dispatchEvent(new Event("aegis-auth-expired"));
    }

    if (
      status === 403
      && typeof detail === "string"
      && detail.startsWith("Organization access is blocked")
      && typeof window !== "undefined"
    ) {
      window.dispatchEvent(new Event("aegis-organization-blocked"));
    }

    return Promise.reject(error);
  }
);

export default api;
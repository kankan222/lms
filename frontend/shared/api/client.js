const API_URL = "http://localhost:5000/api/v1";
import { refreshToken } from "../../software/src/api/auth.api";

function clearWebAuthState() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  window.dispatchEvent(new Event("auth:logout"));
}

export async function apiRequest(path, options = {}, retry = true) {

  const token = localStorage.getItem("accessToken");

  const headers = {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(options.headers || {})
  };

  // Only set JSON header if body is not FormData
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const isAuthPath = path.startsWith("/auth/");

  if (response.status === 401 && retry && !isAuthPath) {

    const refreshed = await refreshToken();

    if (!refreshed) {
      clearWebAuthState();
      throw new Error("Session expired. Please login again.");
    }

    return apiRequest(path, options, false);
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && isAuthPath) {
      clearWebAuthState();
    }
    const message = payload?.message || payload?.error || `Request failed (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

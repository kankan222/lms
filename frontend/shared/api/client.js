const API_URL = "http://localhost:5000/api/v1";
import { refreshToken } from "../../software/src/api/auth.api";

export async function apiRequest(path, options = {}, retry = true) {

  const token = localStorage.getItem("accessToken");

  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  if (response.status === 401 && retry && path !== "/auth/refresh") {

    const refreshed = await refreshToken();

    if (!refreshed) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      window.location.href = "/login";
      return;
    }

    return apiRequest(path, options, false);
  }

  return response.json();
}
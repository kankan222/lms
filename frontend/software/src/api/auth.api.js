import { apiRequest } from "../../../shared/api/client.js";

export async function loginApi(email, password) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function refreshToken() {

  const refreshToken = localStorage.getItem("refreshToken");

  if (!refreshToken) return false;

  const res = await fetch("http://localhost:5000/api/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });

  if (!res.ok) return false;

  const data = await res.json();

  if (!data.accessToken) return false;

  localStorage.setItem("accessToken", data.accessToken);

  return true;
}
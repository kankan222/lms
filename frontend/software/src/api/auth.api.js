import { apiRequest } from "../../../shared/api/client.js";

export async function loginApi(identifier, password) {
  const credential = identifier?.trim();
  const isEmail = credential?.includes("@");
  const payload = {
    password,
    ...(isEmail ? { email: credential } : { phone: credential })
  };

  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
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

  if (!data?.data?.accessToken) return false;

  localStorage.setItem("accessToken", data.data.accessToken);
  if (data?.data?.refreshToken) {
    localStorage.setItem("refreshToken", data.data.refreshToken);
  }

  return true;
}

export async function logoutApi() {
  try {
    await apiRequest("/auth/logout", {
      method: "POST"
    });
  } finally {
    // Always clear tokens even if API fails
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  }
}

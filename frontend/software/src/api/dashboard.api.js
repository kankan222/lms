import axios from "axios";
import { refreshToken } from "./auth.api";

const dashboardClient = axios.create({
  baseURL: "http://localhost:5000/api/v1"
});

dashboardClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

dashboardClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error?.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;
      const ok = await refreshToken();
      if (ok) {
        const token = localStorage.getItem("accessToken");
        if (token) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return dashboardClient(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);

export async function getDashboardSummary() {
  const res = await dashboardClient.get("/dashboard/summary");
  return res.data;
}

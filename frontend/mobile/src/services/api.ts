import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { ENV } from "../constants/env";
import { useAuthStore } from "../store/authStore";
import type { RefreshResponseData } from "../types/auth";

type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

export const api = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function refreshAccessToken() {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return null;

  const response = await axios.post<{ data: RefreshResponseData }>(
    `${ENV.API_BASE_URL}/auth/refresh`,
    { refreshToken },
    { headers: { "Content-Type": "application/json" } },
  );

  const data = response.data?.data;
  if (!data?.accessToken) return null;

  await useAuthStore.getState().setAuth({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });

  return data.accessToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalRequest = error.config as RetryableRequest | undefined;

    const isAuthRoute = Boolean(originalRequest?.url?.includes("/auth/"));
    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;

      try {
        const token = await refreshAccessToken();
        if (token) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch {
        // handled below
      }
    }

    if (status === 401) {
      await useAuthStore.getState().logout();
    }

    return Promise.reject(error);
  },
);

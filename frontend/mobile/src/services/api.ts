import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { ENV } from "../constants/env";
import {
  clearApiCacheByUserScope,
  createApiCacheKey,
  getApiCacheEntry,
  setApiCacheEntry,
  type ApiCacheEntry,
} from "./apiCache";
import { useAuthStore } from "../store/authStore";
import type { RefreshResponseData } from "../types/auth";

type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean };
type CacheableRequest = RetryableRequest & {
  _cacheKey?: string;
  _cacheTtlMs?: number;
};

const MUTATION_METHODS = new Set(["post", "put", "patch", "delete"]);
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const MESSAGES_CACHE_TTL_MS = 30 * 1000;
const DASHBOARD_CACHE_TTL_MS = 60 * 1000;
const ATTENDANCE_CACHE_TTL_MS = 2 * 60 * 1000;

export const api = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

function normalizeUrl(config: InternalAxiosRequestConfig) {
  const base = config.baseURL ?? ENV.API_BASE_URL;
  const path = config.url ?? "";
  return `${base}${path}`;
}

function resolveCacheTtlMs(url: string) {
  if (url.includes("/messages")) return MESSAGES_CACHE_TTL_MS;
  if (url.includes("/dashboard")) return DASHBOARD_CACHE_TTL_MS;
  if (url.includes("/attendance")) return ATTENDANCE_CACHE_TTL_MS;
  return DEFAULT_CACHE_TTL_MS;
}

function normalizeHeaders(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== "object") return {};

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      normalized[key] = String(value);
    }
  }

  return normalized;
}

function getUserScope() {
  const userId = useAuthStore.getState().user?.id;
  return `u:${userId ?? "anon"}`;
}

function buildCachedResponse<T = unknown>(
  config: InternalAxiosRequestConfig,
  entry: ApiCacheEntry,
  source: "HIT" | "STALE",
): AxiosResponse<T> {
  return {
    data: entry.data as T,
    status: entry.status,
    statusText: entry.statusText,
    headers: {
      ...entry.headers,
      "x-cache": source,
    },
    config,
    request: { fromCache: true },
  };
}

api.interceptors.request.use(async (config) => {
  const requestConfig = config as CacheableRequest;
  const token = useAuthStore.getState().accessToken;
  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }

  const method = (requestConfig.method ?? "get").toLowerCase();
  const isCacheableGet = method === "get";
  const hasJsonResponse = !requestConfig.responseType || requestConfig.responseType === "json";

  if (!isCacheableGet || !hasJsonResponse) {
    return requestConfig;
  }

  const url = normalizeUrl(requestConfig);
  const cacheTtlMs = resolveCacheTtlMs(url);
  requestConfig._cacheTtlMs = cacheTtlMs;
  requestConfig._cacheKey = createApiCacheKey({
    userScope: getUserScope(),
    url,
    params: requestConfig.params,
  });

  const cacheEntry = await getApiCacheEntry(requestConfig._cacheKey);
  if (cacheEntry) {
    requestConfig.adapter = async () => buildCachedResponse(requestConfig, cacheEntry, "HIT");
  }

  return requestConfig;
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
  async (response) => {
    const requestConfig = response.config as CacheableRequest;
    const method = (requestConfig.method ?? "get").toLowerCase();
    const userScope = getUserScope();

    if (method === "get" && requestConfig._cacheKey && !response.headers?.["x-cache"]) {
      const ttlMs = requestConfig._cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
      await setApiCacheEntry(requestConfig._cacheKey, {
        storedAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: normalizeHeaders(response.headers),
      });
    }

    if (MUTATION_METHODS.has(method)) {
      await clearApiCacheByUserScope(userScope);
    }

    return response;
  },
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalRequest = error.config as CacheableRequest | undefined;

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

    if (!error.response && originalRequest?._cacheKey) {
      const staleEntry = await getApiCacheEntry(originalRequest._cacheKey, { allowExpired: true });
      if (staleEntry) {
        return buildCachedResponse(originalRequest, staleEntry, "STALE");
      }
    }

    return Promise.reject(error);
  },
);

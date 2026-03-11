import { api } from "./api";
import type { LoginResponseData } from "../types/auth";

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export async function login(identifier: string, password: string) {
  const credential = identifier.trim();
  const isEmail = credential.includes("@");
  const payload = {
    password,
    ...(isEmail ? { email: credential } : { phone: credential }),
  };

  const response = await api.post<ApiResponse<LoginResponseData>>("/auth/login", {
    ...payload,
  });
  return response.data.data;
}

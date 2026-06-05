import { api } from "./api";
import { getDeviceHeaders } from "../utils/device";
import type { AuthLoginResponseData, LoginResponseData, OtpChallengeResponseData } from "../types/auth";

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export function isOtpChallenge(data: AuthLoginResponseData): data is OtpChallengeResponseData {
  return "otpRequired" in data && data.otpRequired === true;
}

export async function login(identifier: string, password: string) {
  const credential = identifier.trim();
  const isEmail = credential.includes("@");
  const payload = {
    password,
    ...(isEmail ? { email: credential } : { phone: credential }),
  };

  const response = await api.post<ApiResponse<AuthLoginResponseData>>(
    "/auth/login",
    { ...payload },
    { headers: await getDeviceHeaders() },
  );
  return response.data.data;
}

export async function verifyOtp(challengeId: string, otp: string) {
  const response = await api.post<ApiResponse<LoginResponseData>>(
    "/auth/verify-otp",
    { challengeId, otp },
    { headers: await getDeviceHeaders() },
  );
  return response.data.data;
}

export async function resendOtp(challengeId: string) {
  const response = await api.post<ApiResponse<OtpChallengeResponseData>>(
    "/auth/resend-otp",
    { challengeId },
    { headers: await getDeviceHeaders() },
  );
  return response.data.data;
}

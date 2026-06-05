export type AuthUser = {
  id: number;
  name: string;
  email: string;
  roles?: string[];
  permissions?: string[];
};

export type LoginResponseData = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type OtpChallengeResponseData = {
  otpRequired: true;
  challengeId: string;
  expiresInMinutes: number;
  resendAvailableInSeconds: number;
  phone: string;
  reason?: string;
};

export type AuthLoginResponseData = LoginResponseData | OtpChallengeResponseData;

export type RefreshResponseData = {
  accessToken: string;
  refreshToken: string;
};

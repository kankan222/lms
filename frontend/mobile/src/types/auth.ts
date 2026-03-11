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

export type RefreshResponseData = {
  accessToken: string;
  refreshToken: string;
};

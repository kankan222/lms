import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { AuthUser } from "../types/auth";

const ACCESS_TOKEN_KEY = "lms.accessToken";
const REFRESH_TOKEN_KEY = "lms.refreshToken";
const USER_KEY = "lms.user";

type SetAuthPayload = {
  accessToken: string;
  refreshToken?: string;
  user?: AuthUser;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isHydrated: boolean;
  setAuth: (payload: SetAuthPayload) => Promise<void>;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isHydrated: false,

  async setAuth(payload) {
    const nextAccessToken = payload.accessToken;
    const nextRefreshToken = payload.refreshToken ?? get().refreshToken;
    const nextUser = payload.user ?? get().user;

    set({
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      user: nextUser,
    });

    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, nextAccessToken);
    if (nextRefreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, nextRefreshToken);
    }
    if (nextUser) {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser));
    }
  },

  async hydrate() {
    const [accessToken, refreshToken, rawUser] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);

    let user: AuthUser | null = null;
    if (rawUser) {
      try {
        user = JSON.parse(rawUser) as AuthUser;
      } catch {
        user = null;
      }
    }

    set({
      accessToken: accessToken ?? null,
      refreshToken: refreshToken ?? null,
      user,
      isHydrated: true,
    });
  },

  async logout() {
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
    });

    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  },
}));

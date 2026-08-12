import { Linking, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  MOBILE_ANDROID_VERSION_CODE,
  MOBILE_APP_VERSION,
  MOBILE_IOS_BUILD_NUMBER,
} from "../constants/appVersion";
import { api } from "./api";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
};

export type AppNotice = {
  id: number;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  platform: "all" | "android" | "ios";
  dismissible: boolean;
  action_label?: string | null;
  action_url?: string | null;
};

const NOTICE_DISMISSED_KEY = "kkv:dismissed_app_notice";

function currentBuild() {
  return Platform.OS === "ios" ? MOBILE_IOS_BUILD_NUMBER : MOBILE_ANDROID_VERSION_CODE;
}

export async function getActiveAppNotice() {
  const response = await api.get<ApiEnvelope<AppNotice | null>>("/app-notices/active", {
    params: {
      platform: Platform.OS === "ios" ? "ios" : "android",
      current_version: MOBILE_APP_VERSION,
      current_build: currentBuild(),
      t: Date.now(),
    },
  });
  return response.data.data ?? null;
}

export async function wasAppNoticeDismissed(notice: AppNotice | null) {
  if (!notice?.dismissible) return false;
  const dismissedId = await SecureStore.getItemAsync(NOTICE_DISMISSED_KEY);
  return dismissedId === String(notice.id);
}

export async function dismissAppNotice(notice: AppNotice) {
  await SecureStore.setItemAsync(NOTICE_DISMISSED_KEY, String(notice.id));
}

export async function openAppNoticeAction(notice: AppNotice | null) {
  const url = notice?.action_url;
  if (!url) return false;
  const supported = await Linking.canOpenURL(url);
  if (!supported) return false;
  await Linking.openURL(url);
  return true;
}

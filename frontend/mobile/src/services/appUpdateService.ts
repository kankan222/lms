import { Alert, Linking, Platform } from "react-native";
import {
  MOBILE_ANDROID_VERSION_CODE,
  MOBILE_APP_VERSION,
  MOBILE_IOS_BUILD_NUMBER,
} from "../constants/appVersion";
import { api } from "./api";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export type AppUpdateInfo = {
  update_available: boolean;
  required: boolean;
  platform: "android" | "ios";
  current_version: string;
  current_build?: number | null;
  latest_version: string;
  latest_build?: number | null;
  minimum_version: string;
  minimum_build?: number | null;
  store_url?: string | null;
  title: string;
  message: string;
};

function currentBuild() {
  return Platform.OS === "ios" ? MOBILE_IOS_BUILD_NUMBER : MOBILE_ANDROID_VERSION_CODE;
}

export async function checkAppUpdate() {
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const response = await api.get<ApiEnvelope<AppUpdateInfo>>("/app-updates/check", {
    params: {
      platform,
      current_version: MOBILE_APP_VERSION,
      current_build: currentBuild(),
    },
  });
  return response.data.data ?? null;
}

export async function openAppUpdate(info: AppUpdateInfo | null) {
  const url = info?.store_url;
  if (!url) {
    Alert.alert("Store Link Missing", "The app update link has not been configured yet.");
    return false;
  }

  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    Alert.alert("Cannot Open Link", "This device could not open the update link.");
    return false;
  }

  await Linking.openURL(url);
  return true;
}

export function showAppUpdatePrompt(info: AppUpdateInfo, options: { force?: boolean } = {}) {
  if (!info.update_available) return;

  const buttons = info.required || options.force
    ? [
        {
          text: "Update",
          onPress: () => {
            void openAppUpdate(info);
          },
        },
      ]
    : [
        { text: "Later", style: "cancel" as const },
        {
          text: "Update",
          onPress: () => {
            void openAppUpdate(info);
          },
        },
      ];

  Alert.alert(info.title || "App update available", info.message, buttons, {
    cancelable: !info.required && !options.force,
  });
}

export async function notifyAppUpdateAvailable(platform?: "android" | "ios") {
  const response = await api.post<ApiEnvelope<{ notified: number }>>("/app-updates/notify", {
    platform: platform || (Platform.OS === "ios" ? "ios" : "android"),
  });
  return response.data.data ?? { notified: 0 };
}

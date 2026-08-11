import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import type { AuthUser } from "../types/auth";
import { getDeviceId } from "../utils/device";
import { registerNotificationDevice, unregisterNotificationDevice } from "./notificationsService";

const PUSH_ENABLED_KEY = "lms.push.enabled";
const PUSH_TOKEN_KEY = "lms.push.token";
const EXPO_PROJECT_ID = "fba1d24e-70b5-462a-9cc2-aa3b038ad327";

function canReceivePush(user?: AuthUser | null) {
  return Boolean(user?.id);
}

export async function getPushPreference() {
  const value = await SecureStore.getItemAsync(PUSH_ENABLED_KEY);
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#da271f",
  });
}

async function requestExpoPushToken() {
  await ensureAndroidChannel();
  const currentPermission = await Notifications.getPermissionsAsync();
  let status = currentPermission.status;

  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== "granted") {
    await SecureStore.setItemAsync(PUSH_ENABLED_KEY, "false");
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId: EXPO_PROJECT_ID });
  return token.data;
}

export async function enablePushNotifications(user?: AuthUser | null) {
  if (!canReceivePush(user)) return false;

  const pushToken = await requestExpoPushToken();
  if (!pushToken) return false;

  const deviceToken = await getDeviceId();
  await registerNotificationDevice({
    device_token: deviceToken,
    platform: Platform.OS === "ios" ? "ios" : "android",
    push_token: pushToken,
    push_provider: "expo",
    device_name: Platform.OS,
  });

  await SecureStore.setItemAsync(PUSH_ENABLED_KEY, "true");
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, pushToken);
  return true;
}

export async function disablePushNotifications() {
  const [deviceToken, pushToken] = await Promise.all([
    getDeviceId(),
    SecureStore.getItemAsync(PUSH_TOKEN_KEY),
  ]);

  try {
    await unregisterNotificationDevice({
      device_token: deviceToken,
      push_token: pushToken,
    });
  } catch {
    // Local preference still wins; backend cleanup can retry on a later enable.
  }

  await SecureStore.setItemAsync(PUSH_ENABLED_KEY, "false");
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  return true;
}

export async function syncPushNotificationsAfterSignIn(user?: AuthUser | null) {
  if (!canReceivePush(user)) return false;

  const preference = await getPushPreference();
  if (preference === false) return false;

  try {
    return await enablePushNotifications(user);
  } catch {
    return false;
  }
}

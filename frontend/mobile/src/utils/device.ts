import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const DEVICE_ID_KEY = "lms.deviceId";

function createDeviceId() {
  return `mobile-${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function getDeviceId() {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;

  const deviceId = createDeviceId();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

export async function getDeviceHeaders() {
  return {
    "x-device-id": await getDeviceId(),
    "x-device-type": Platform.OS,
  };
}

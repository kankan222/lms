const DEVICE_ID_KEY = "lms.deviceId";

function createDeviceId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = createDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export function getDeviceHeaders() {
  return {
    "x-device-id": getDeviceId(),
    "x-device-type": "web",
  };
}

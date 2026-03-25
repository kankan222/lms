const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function chunk(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function isExpoPushToken(value) {
  return typeof value === "string" && /^ExponentPushToken\[.+\]$/.test(value);
}

export async function sendPushNotifications(devices = [], payload = {}) {
  const enabled = String(process.env.EXPO_PUSH_ENABLED || "").toLowerCase() === "true";
  if (!enabled || !devices.length) return;

  const messages = devices
    .filter((device) => isExpoPushToken(device.push_token))
    .map((device) => ({
      to: device.push_token,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: {
        notificationType: payload.type || "general",
        entityType: payload.entityType || null,
        entityId: payload.entityId || null,
      },
    }));

  if (!messages.length) return;

  const headers = {
    "Content-Type": "application/json",
  };

  if (process.env.EXPO_PUSH_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_PUSH_ACCESS_TOKEN}`;
  }

  for (const group of chunk(messages, 100)) {
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(group),
      });
    } catch {
      // Push delivery is best-effort. The in-app feed remains the source of truth.
    }
  }
}

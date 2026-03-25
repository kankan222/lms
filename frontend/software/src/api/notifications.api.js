import { apiRequest } from "../../../shared/api/client.js";

export function getMyNotifications(options = {}) {
  const params = new URLSearchParams();
  if (options.limit) {
    params.set("limit", String(options.limit));
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/notifications/me${suffix}`);
}

export function markNotificationRead(notificationId) {
  return apiRequest(`/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export function markAllNotificationsRead() {
  return apiRequest("/notifications/read-all", {
    method: "PATCH",
  });
}

export function registerNotificationDevice(payload) {
  return apiRequest("/notifications/devices", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function unregisterNotificationDevice(payload) {
  return apiRequest("/notifications/devices", {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

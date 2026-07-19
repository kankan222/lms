import { api } from "./api";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export type NotificationCategory = "message" | "attendance" | "marksheet" | "fee" | "account" | "system";

export type NotificationItem = {
  id: number;
  user_id: number;
  category?: NotificationCategory | null;
  type?: string | null;
  entity_type?: string | null;
  entity_id?: number | null;
  title: string;
  body: string;
  action_url?: string | null;
  deep_link?: string | null;
  is_read: boolean | number;
  read_at?: string | null;
  created_at: string;
};

export type NotificationsResponse = {
  list: NotificationItem[];
  unread: number;
};

export async function getMyNotifications(options: { limit?: number; category?: string } = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.category && options.category !== "all") params.set("category", options.category);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await api.get<ApiEnvelope<NotificationsResponse>>(`/notifications/me${suffix}`);
  return response.data.data ?? { list: [], unread: 0 };
}

export async function markNotificationRead(notificationId: number) {
  const response = await api.patch<ApiEnvelope<{ updated: boolean }>>(`/notifications/${notificationId}/read`);
  return response.data.data;
}

export async function markAllNotificationsRead() {
  const response = await api.patch<ApiEnvelope<{ updated: boolean }>>("/notifications/read-all");
  return response.data.data;
}

export async function registerNotificationDevice(payload: {
  device_token: string;
  platform: "android" | "ios" | "web" | "software";
  push_token?: string | null;
  push_provider?: string | null;
  device_name?: string | null;
}) {
  const response = await api.post<ApiEnvelope<{ registered: boolean }>>("/notifications/devices", payload);
  return response.data.data;
}

export async function unregisterNotificationDevice(payload: {
  device_token?: string;
  push_token?: string | null;
}) {
  const response = await api.delete<ApiEnvelope<{ removed: boolean }>>("/notifications/devices", { data: payload });
  return response.data.data;
}

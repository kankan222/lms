import { api } from "./api";

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export type AnnouncementAttachment = {
  id: number;
  file_name?: string | null;
  file_url?: string | null;
  mime_type?: string | null;
  file_size?: number | string | null;
};

export type MobileAnnouncement = {
  id: number;
  category_id?: number | null;
  category_name?: string | null;
  category_slug?: string | null;
  title: string;
  body: string;
  delivery_mode?: string | null;
  status?: string | null;
  priority?: "normal" | "urgent" | string | null;
  published_at?: string | null;
  publish_at?: string | null;
  expires_at?: string | null;
  event_start_date?: string | null;
  event_end_date?: string | null;
  reopen_date?: string | null;
  attachments?: AnnouncementAttachment[];
};

export async function getMobileAnnouncements(params: { limit?: number; category_id?: number | string } = {}) {
  const response = await api.get<ApiEnvelope<MobileAnnouncement[]>>("/announcements/mobile", { params });
  return response.data.data ?? [];
}

export async function getMobileAnnouncement(id: number | string) {
  const response = await api.get<ApiEnvelope<MobileAnnouncement>>(`/announcements/mobile/${id}`);
  return response.data.data;
}

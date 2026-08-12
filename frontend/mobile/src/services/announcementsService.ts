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
  message_type?: "custom" | "registered_dlt" | string | null;
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
  version_number?: number | string | null;
  sms_template_name?: string | null;
  sms_template_id?: number | string | null;
  sms_jobs?: AnnouncementSmsJob[];
};

export async function getMobileAnnouncements(params: { limit?: number; category_id?: number | string } = {}) {
  const response = await api.get<ApiEnvelope<MobileAnnouncement[]>>("/announcements/mobile", { params });
  return response.data.data ?? [];
}

export async function getMobileAnnouncement(id: number | string) {
  const response = await api.get<ApiEnvelope<MobileAnnouncement>>(`/announcements/mobile/${id}`);
  return response.data.data;
}

export type AnnouncementListParams = {
  limit?: number;
  status?: string;
  delivery_mode?: string;
  category_id?: number | string;
  visible_mobile?: boolean;
  visible_software?: boolean;
  published_only?: boolean;
};

export type AnnouncementSmsTemplate = {
  id: number;
  template_name?: string | null;
  dlt_template_id?: string | null;
  provider_template_id?: string | null;
  header?: string | null;
  communication_type?: string | null;
  template_content?: string | null;
  placeholder_count?: number | string | null;
  placeholder_schema_json?: string | null;
  status?: string | null;
  provider?: string | null;
};

export type AnnouncementCategory = {
  id: number;
  name: string;
  slug?: string | null;
};

export type AnnouncementHolidayName = {
  id: number;
  name: string;
  category?: string | null;
};

export type AnnouncementSmsJob = {
  id: number;
  announcement_id?: number | string | null;
  sms_template_id?: number | string | null;
  status?: string | null;
  scheduled_at?: string | null;
  total_recipients?: number | string | null;
  sent_count?: number | string | null;
  failed_count?: number | string | null;
  provider?: string | null;
};

export type AnnouncementHoliday = {
  id: number;
  announcement_id?: number | string | null;
  title?: string | null;
  description?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  reopen_date?: string | null;
  scope_type?: string | null;
};

export async function getAnnouncements(params: AnnouncementListParams = {}) {
  const response = await api.get<ApiEnvelope<MobileAnnouncement[]>>("/announcements", { params });
  return response.data.data ?? [];
}

export async function getAnnouncement(id: number | string) {
  const response = await api.get<ApiEnvelope<MobileAnnouncement>>(`/announcements/${id}`);
  return response.data.data;
}

export async function publishAnnouncement(id: number | string) {
  const response = await api.post<ApiEnvelope<{ announcement?: MobileAnnouncement }>>(`/announcements/${id}/publish`, {});
  return response.data.data;
}

export async function createAnnouncement(payload: Record<string, unknown>) {
  const response = await api.post<ApiEnvelope<MobileAnnouncement>>("/announcements", payload);
  return response.data.data;
}

export async function getAnnouncementCategories() {
  const response = await api.get<ApiEnvelope<AnnouncementCategory[]>>("/announcements/categories");
  return response.data.data ?? [];
}

export async function getAnnouncementHolidayNames(params: { q?: string; category?: string; limit?: number } = {}) {
  const response = await api.get<ApiEnvelope<AnnouncementHolidayName[]>>("/announcements/holiday-names", { params });
  return response.data.data ?? [];
}

export async function createAnnouncementHolidayName(payload: { name: string; category?: string }) {
  const response = await api.post<ApiEnvelope<AnnouncementHolidayName>>("/announcements/holiday-names", payload);
  return response.data.data;
}

export async function getAnnouncementSmsTemplates(params: { status?: string; limit?: number } = {}) {
  const response = await api.get<ApiEnvelope<AnnouncementSmsTemplate[]>>("/announcements/sms-templates", { params });
  return response.data.data ?? [];
}

export async function getAnnouncementSmsJobs(params: { limit?: number; announcement_id?: number | string; status?: string } = {}) {
  const response = await api.get<ApiEnvelope<AnnouncementSmsJob[]>>("/announcements/sms-jobs", { params });
  return response.data.data ?? [];
}

export async function getHolidays(params: { limit?: number } = {}) {
  const response = await api.get<ApiEnvelope<AnnouncementHoliday[]>>("/announcements/holidays", { params });
  return response.data.data ?? [];
}

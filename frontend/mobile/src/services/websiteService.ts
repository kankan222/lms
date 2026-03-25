import { ENV } from "../constants/env";
import { api } from "./api";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export type WebsiteCampus = "school" | "college";
export type WebsiteSection = "head" | "teaching" | "non_teaching";

export type WebsiteStaffItem = {
  id: number;
  name: string;
  image_url?: string | null;
  section: WebsiteSection;
  type: WebsiteCampus;
};

export type WebsiteContactSubmission = {
  id: number;
  name: string;
  contact_number: string;
  message?: string | null;
  created_at?: string | null;
};

export function resolveWebsiteImageUrl(imageUrl?: string | null) {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const base = ENV.API_BASE_URL.replace(/\/api\/v1\/?$/i, "");
  return `${base}${String(imageUrl).startsWith("/") ? imageUrl : `/${imageUrl}`}`;
}

export async function getWebsiteStaff(type: WebsiteCampus, section?: string) {
  const params = new URLSearchParams();
  if (section) params.set("section", section);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await api.get<ApiEnvelope<WebsiteStaffItem[]>>(`/website/${type}/staff${suffix}`);
  return response.data.data ?? [];
}

export async function getWebsiteContactSubmissions(limit = 100) {
  const response = await api.get<ApiEnvelope<WebsiteContactSubmission[]>>(`/website/contact/submissions?limit=${limit}`);
  return response.data.data ?? [];
}

export async function createWebsiteStaff(type: WebsiteCampus, payload: {
  name: string;
  section: WebsiteSection;
  image_url: string;
}) {
  const formData = new FormData();
  formData.append("name", payload.name);
  formData.append("section", payload.section);
  formData.append("image_url", payload.image_url);

  const response = await api.post<ApiEnvelope<unknown>>(`/website/${type}/staff`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function updateWebsiteStaff(
  id: number | string,
  type: WebsiteCampus,
  payload: {
    name: string;
    section: WebsiteSection;
    image_url?: string;
  },
) {
  const formData = new FormData();
  formData.append("name", payload.name);
  formData.append("section", payload.section);
  if (payload.image_url) formData.append("image_url", payload.image_url);

  const response = await api.put<ApiEnvelope<unknown>>(`/website/${type}/staff/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function deleteWebsiteStaff(id: number | string, type: WebsiteCampus) {
  const response = await api.delete<ApiEnvelope<unknown>>(`/website/${type}/staff/${id}`);
  return response.data;
}

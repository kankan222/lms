import { ENV } from "../constants/env";
import { api } from "./api";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export type StaffItem = {
  id: number;
  user_id?: number | null;
  image_url?: string | null;
  name: string;
  title?: string | null;
  section?: "head" | "teaching" | "non_teaching";
  type: "school" | "college";
};

export type StaffPayload = {
  user_id?: number | string | null;
  image_url: string;
  name: string;
  section: "head" | "teaching" | "non_teaching";
  type: "school" | "college";
};

export function resolveStaffImageUrl(imageUrl?: string | null) {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const base = ENV.API_BASE_URL.replace(/\/api\/v1\/?$/i, "");
  return `${base}${String(imageUrl).startsWith("/") ? imageUrl : `/${imageUrl}`}`;
}

export async function getStaffList() {
  const response = await api.get<ApiEnvelope<StaffItem[]>>("/staff");
  return response.data.data ?? [];
}

export async function getPublicStaffList(type?: "school" | "college" | string) {
  const response = await api.get<ApiEnvelope<StaffItem[]>>("/public/staff", {
    params: type ? { type } : undefined,
  });
  return response.data.data ?? [];
}

export async function getStaffById(id: number | string) {
  const response = await api.get<ApiEnvelope<StaffItem>>(`/staff/${id}`);
  return response.data.data;
}

export async function createStaff(payload: StaffPayload) {
  const formData = new FormData();
  if (payload.user_id) formData.append("user_id", String(payload.user_id));
  formData.append("image_url", payload.image_url);
  formData.append("name", payload.name);
  formData.append("section", payload.section);
  formData.append("type", payload.type);

  const response = await api.post<ApiEnvelope<unknown>>("/staff", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function updateStaff(id: number | string, payload: StaffPayload) {
  const formData = new FormData();
  if (payload.user_id) formData.append("user_id", String(payload.user_id));
  formData.append("image_url", payload.image_url);
  formData.append("name", payload.name);
  formData.append("section", payload.section);
  formData.append("type", payload.type);

  const response = await api.put<ApiEnvelope<unknown>>(`/staff/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function deleteStaff(id: number | string) {
  const response = await api.delete<ApiEnvelope<unknown>>(`/staff/${id}`);
  return response.data;
}

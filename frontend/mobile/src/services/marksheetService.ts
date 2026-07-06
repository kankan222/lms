import { api } from "./api";

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

export type MarksheetActivity = {
  id: number;
  name: string;
  scope_key?: string | null;
  class_id?: number | null;
  class_name?: string | null;
  section_id?: number | null;
  section_name?: string | null;
  section_medium?: string | null;
  sort_order?: number | string | null;
  max_marks?: number | string | null;
  is_active?: boolean | number;
};

export type ActivityPayload = {
  name: string;
  scope_key?: string | null;
  class_id?: number | string | null;
  section_id?: number | string | null;
  sort_order?: number | string;
  max_marks?: number | string;
  is_active?: boolean;
};

export async function getActivities(params: { scope_key?: string; class_id?: number | string; section_id?: number | string } = {}) {
  const response = await api.get<ApiEnvelope<MarksheetActivity[]>>("/marksheet/activities", { params });
  return response.data?.data ?? [];
}

export async function createActivity(payload: ActivityPayload) {
  const response = await api.post<ApiEnvelope<{ id: number }>>("/marksheet/activities", payload);
  return response.data;
}

export async function updateActivity(id: number | string, payload: ActivityPayload) {
  const response = await api.put<ApiEnvelope<{ updated: boolean }>>(`/marksheet/activities/${id}`, payload);
  return response.data;
}

export async function deleteActivity(id: number | string) {
  const response = await api.delete<ApiEnvelope<{ deleted: boolean }>>(`/marksheet/activities/${id}`);
  return response.data;
}

import { api } from "./api";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export type AcademicSessionItem = {
  id: number;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
};

export type StreamItem = {
  id: number;
  name: string;
};

export async function getSessions() {
  const response = await api.get<ApiEnvelope<AcademicSessionItem[]>>("/academic/sessions");
  return response.data.data ?? [];
}

export async function createSession(payload: {
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}) {
  const response = await api.post("/academic/sessions", payload);
  return response.data;
}

export async function updateSession(
  id: number | string,
  payload: {
    name: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  },
) {
  const response = await api.put(`/academic/sessions/${id}`, payload);
  return response.data;
}

export async function deleteSession(id: number | string) {
  const response = await api.delete(`/academic/sessions/${id}`);
  return response.data;
}

export async function getStreams() {
  const response = await api.get<ApiEnvelope<StreamItem[]>>("/academic/streams");
  return response.data.data ?? [];
}

export async function createStream(payload: { name: string }) {
  const response = await api.post("/academic/streams", payload);
  return response.data;
}

export async function updateStream(id: number | string, payload: { name: string }) {
  const response = await api.put(`/academic/streams/${id}`, payload);
  return response.data;
}

export async function deleteStream(id: number | string) {
  const response = await api.delete(`/academic/streams/${id}`);
  return response.data;
}

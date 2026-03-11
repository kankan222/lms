import { api } from "./api";

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export type SubjectItem = {
  id: number;
  name: string;
  code: string;
};

export type SubjectPayload = {
  name: string;
  code: string;
};

export type AssignSubjectsPayload = {
  classId: number;
  subjectIds: number[];
};

export async function getSubjects() {
  const response = await api.get<ApiEnvelope<SubjectItem[]>>("/subjects");
  return response.data.data ?? [];
}

export async function createSubject(payload: SubjectPayload) {
  const response = await api.post<ApiEnvelope<unknown>>("/subjects", payload);
  return response.data;
}

export async function updateSubject(id: number, payload: SubjectPayload) {
  const response = await api.put<ApiEnvelope<unknown>>(`/subjects/${id}`, payload);
  return response.data;
}

export async function deleteSubject(id: number) {
  const response = await api.delete<ApiEnvelope<unknown>>(`/subjects/${id}`);
  return response.data;
}

export async function assignSubjects(payload: AssignSubjectsPayload) {
  const response = await api.post<ApiEnvelope<unknown>>("/subjects/assign", payload);
  return response.data;
}

export async function getClassSubjects(classId: number) {
  const response = await api.get<ApiEnvelope<SubjectItem[]>>(`/subjects/class/${classId}`);
  return response.data.data ?? [];
}


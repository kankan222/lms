import { api } from "./api";

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export type ClassScope = "school" | "hs";
export type SectionMedium = "English" | "Assamese";

export type ClassItem = {
  id: number;
  name: string;
  class_scope?: ClassScope;
  medium?: string | null;
  mediums?: SectionMedium[];
  sections: string;
  section_details?: Array<{ name: string; medium: SectionMedium }>;
  subjects: string;
};

export type ClassStructureSection = {
  id: number;
  name: string;
  medium?: SectionMedium | null;
};

export type ClassStructureSubject = {
  id: number;
  name: string;
};

export type ClassStructureItem = {
  id: number;
  name: string;
  class_scope?: ClassScope;
  medium?: string | null;
  mediums?: SectionMedium[];
  sections: ClassStructureSection[];
  subjects: ClassStructureSubject[];
};

export type SessionItem = {
  id: number;
  name: string;
  start_date?: string;
  end_date?: string;
  is_active?: number | boolean;
};

export type ClassPayload = {
  name: string;
  class_scope: ClassScope;
  sections: Array<{ name: string; medium: SectionMedium }>;
};

export async function getClasses() {
  const response = await api.get<ApiEnvelope<ClassItem[]>>("/academic/classes");
  return response.data.data ?? [];
}

export async function createClass(payload: ClassPayload) {
  const response = await api.post<ApiEnvelope<unknown>>("/academic/classes", payload);
  return response.data;
}

export async function updateClass(id: number, payload: ClassPayload) {
  const response = await api.put<ApiEnvelope<unknown>>(`/academic/classes/${id}`, payload);
  return response.data;
}

export async function deleteClass(id: number) {
  const response = await api.delete<ApiEnvelope<unknown>>(`/academic/classes/${id}`);
  return response.data;
}

export async function getClassStructure() {
  const response = await api.get<ApiEnvelope<ClassStructureItem[]>>("/academic/classes/structure");
  return response.data.data ?? [];
}

export async function getSessions() {
  const response = await api.get<ApiEnvelope<SessionItem[]>>("/academic/sessions");
  return response.data.data ?? [];
}

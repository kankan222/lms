import { api } from "./api";

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export type TeacherItem = {
  id: number;
  user_id?: number;
  employee_id?: string;
  name: string;
  phone?: string;
  email?: string;
  class_scope?: string | null;
  scope_name?: string | null;
  scope?: string | null;
  photo_url?: string | null;
};

export type AttendanceDeviceUserMapping = {
  id: number;
  device_id: number;
  device_user_id: string;
  teacher_id: number;
  device_name?: string | null;
  device_code?: string | null;
  location?: string | null;
  teacher_name?: string | null;
  employee_id?: string | null;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type TeacherListResponse = {
  data: TeacherItem[];
  pagination: PaginationMeta | null;
};

export type CreateTeacherPayload = {
  employee_id: string;
  name: string;
  phone: string;
  email: string;
  class_scope: string;
  password: string;
  photo?: {
    uri: string;
    name?: string;
    type?: string;
  } | null;
};

export type UpdateTeacherPayload = {
  employee_id: string;
  name: string;
  phone: string;
  email: string;
  class_scope: string;
  photo_url?: string | null;
  photo?: {
    uri: string;
    name?: string;
    type?: string;
  } | null;
};

export type TeacherAssignment = {
  id: number;
  class_id?: number;
  section_id?: number;
  subject_id?: number;
  session_id?: number;
  teacher: string;
  class: string;
  section: string;
  section_medium?: string | null;
  subject: string;
  session: string;
};

export type TeacherAttendanceRow = {
  id: number;
  teacher_id: number;
  teacher?: string;
  device_id?: number | null;
  punch_time: string;
  punch_type: string;
  device_name?: string | null;
  device_code?: string | null;
  location?: string | null;
};

export type AttendanceDevice = {
  id: number;
  name?: string;
  device_name?: string;
  device_code: string;
  location?: string | null;
};

export type AssignTeacherPayload = {
  class_id: number;
  section_id: number;
  subject_id: number;
  session_id: number;
};

export async function getTeachers(params: { page?: number; limit?: number } = {}) {
  const response = await api.get<ApiEnvelope<TeacherItem[]> & { pagination?: PaginationMeta }>("/teachers", {
    params,
  });

  return {
    data: response.data.data ?? [],
    pagination: response.data.pagination ?? null,
  } as TeacherListResponse;
}

export async function getTeacher(id: number) {
  const response = await api.get<ApiEnvelope<TeacherItem>>(`/teachers/${id}`);
  return response.data.data;
}

export function resolveTeacherPhotoUrl(photoUrl?: string | null) {
  if (!photoUrl) return null;
  if (/^https?:\/\//i.test(photoUrl)) return photoUrl;
  return `https://kalongkapilividyapith.com${String(photoUrl).startsWith("/") ? photoUrl : `/${photoUrl}`}`;
}

export async function createTeacher(payload: CreateTeacherPayload) {
  const formData = new FormData();
  formData.append("employee_id", payload.employee_id);
  formData.append("name", payload.name);
  formData.append("phone", payload.phone);
  formData.append("email", payload.email);
  formData.append("class_scope", payload.class_scope ?? "school");
  formData.append("password", payload.password);

  if (payload.photo?.uri) {
    formData.append("photo", {
      uri: payload.photo.uri,
      name: payload.photo.name ?? "teacher-photo.jpg",
      type: payload.photo.type ?? "image/jpeg",
    } as unknown as Blob);
  }

  const response = await api.post<ApiEnvelope<unknown>>("/teachers", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function updateTeacher(id: number, payload: UpdateTeacherPayload) {
  const formData = new FormData();
  formData.append("employee_id", payload.employee_id);
  formData.append("name", payload.name);
  formData.append("phone", payload.phone);
  formData.append("email", payload.email);
  formData.append("class_scope", payload.class_scope ?? "school");

  if (payload.photo?.uri) {
    formData.append("photo", {
      uri: payload.photo.uri,
      name: payload.photo.name ?? "teacher-photo.jpg",
      type: payload.photo.type ?? "image/jpeg",
    } as unknown as Blob);
  }

  const response = await api.put<ApiEnvelope<unknown>>(`/teachers/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function deleteTeacher(id: number) {
  const response = await api.delete<ApiEnvelope<unknown>>(`/teachers/${id}`);
  return response.data;
}

export async function getTeacherAssignments(id: number) {
  const response = await api.get<ApiEnvelope<TeacherAssignment[]>>(`/teachers/${id}/assignments`);
  return response.data.data ?? [];
}

export async function assignTeacher(id: number, payload: AssignTeacherPayload) {
  const response = await api.post<ApiEnvelope<unknown>>(`/teachers/${id}/assignments`, payload);
  return response.data;
}

export async function removeAssignment(assignmentId: number) {
  const response = await api.delete<ApiEnvelope<unknown>>(`/teachers/assignments/${assignmentId}`);
  return response.data;
}

export async function getTeacherAttendance(
  id: number,
  params: { startDate?: string; endDate?: string } = {},
) {
  const response = await api.get<ApiEnvelope<TeacherAttendanceRow[]>>(`/teachers/${id}/attendance`, {
    params,
  });
  return response.data.data ?? [];
}

export async function getAllTeacherAttendance(params: { startDate?: string; endDate?: string } = {}) {
  const response = await api.get<ApiEnvelope<TeacherAttendanceRow[]>>("/teachers/attendance/all", {
    params,
  });
  return response.data.data ?? [];
}

export async function getAttendanceDevices() {
  const response = await api.get<ApiEnvelope<AttendanceDevice[]>>("/teachers/attendance/devices");
  return response.data.data ?? [];
}

export async function getAttendanceDeviceUsers(params: { device_id?: number | string } = {}) {
  const response = await api.get<ApiEnvelope<AttendanceDeviceUserMapping[]>>("/teachers/attendance/device-users", {
    params,
  });
  return response.data.data ?? [];
}

export async function upsertAttendanceDeviceUser(payload: {
  device_id: number;
  device_user_id: string;
  teacher_id: number;
}) {
  const response = await api.post<ApiEnvelope<unknown>>("/teachers/attendance/device-users", payload);
  return response.data;
}

export async function createAttendanceDevice(payload: {
  name: string;
  deviceCode: string;
  location?: string;
}) {
  const response = await api.post<ApiEnvelope<unknown>>("/teachers/attendance/devices", payload);
  return response.data;
}

export async function generateDailyAttendance(payload: {
  teacherId: number;
  date: string;
  status: string;
  checkIn?: string | null;
  checkOut?: string | null;
}) {
  const response = await api.post<ApiEnvelope<unknown>>("/teachers/attendance/generate", payload);
  return response.data;
}


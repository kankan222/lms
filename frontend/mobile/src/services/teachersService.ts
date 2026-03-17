import { api } from "./api";

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export type TeacherItem = {
  id: number;
  user_id: number;
  employee_id: string;
  name: string;
  phone: string;
  email: string;
  class_scope: "school" | "hs";
  photo_url?: string | null;
};

export type CreateTeacherPayload = {
  employee_id: string;
  name: string;
  phone: string;
  email: string;
  class_scope: "school" | "hs";
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
  class_scope: "school" | "hs";
  photo_url?: string | null;
};

export type TeacherAssignment = {
  id: number;
  teacher: string;
  class: string;
  section: string;
  subject: string;
  session: string;
};

export type TeacherAttendanceRow = {
  id: number;
  teacher_id: number;
  teacher?: string;
  attendance_date: string;
  status: string;
  check_in?: string | null;
  check_out?: string | null;
  worked_hours?: string | number | null;
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

export async function getTeachers() {
  const response = await api.get<ApiEnvelope<TeacherItem[]>>("/teachers");
  return response.data.data ?? [];
}

export async function getTeacher(id: number) {
  const response = await api.get<ApiEnvelope<TeacherItem>>(`/teachers/${id}`);
  return response.data.data;
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
  const response = await api.put<ApiEnvelope<unknown>>(`/teachers/${id}`, payload);
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


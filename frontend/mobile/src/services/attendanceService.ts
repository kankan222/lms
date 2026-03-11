import { api } from "./api";

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export type TeacherAttendanceItem = {
  id: number;
  teacher: string;
  teacher_id: number;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  worked_hours: string | null;
};

export type StudentAttendanceStatus = "present" | "absent" | "late";

export type TakeStudentAttendancePayload = {
  classId: number;
  sectionId: number;
  date: string;
  deviceSource?: string;
  attendance: Array<{
    studentId: number;
    status: StudentAttendanceStatus;
  }>;
};

export async function getAllTeacherAttendance(params?: { startDate?: string; endDate?: string }) {
  const response = await api.get<ApiEnvelope<TeacherAttendanceItem[]>>("/teachers/attendance/all", {
    params,
  });
  return response.data.data ?? [];
}

export async function takeStudentAttendance(payload: TakeStudentAttendancePayload) {
  const response = await api.post<ApiEnvelope<{ attendanceSessionId: number }>>("/attendance", payload);
  return response.data.data;
}


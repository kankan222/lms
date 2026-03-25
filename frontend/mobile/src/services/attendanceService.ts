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

export type StudentAttendanceStatus = "present" | "absent";

export type AttendanceEntryScope = {
  class_id: number;
  section_id: number;
  session_id: number;
  class_name?: string;
  class_scope?: string;
  section_name?: string;
  medium?: string | null;
  session_name?: string;
};

export type StudentAttendanceEntryScopes = {
  restricted: boolean;
  assignments: AttendanceEntryScope[];
};

export type StudentAttendanceSessionItem = {
  id: number;
  date: string;
  academic_session_id?: number;
  class_id?: number;
  section_id?: number;
  class_name?: string;
  section_name?: string;
  session_name?: string;
  student_id?: number;
  student_name?: string;
  student_status?: StudentAttendanceStatus | string;
  absent_count?: number;
  approval_status?: string;
  submitted_by_username?: string | null;
  submitted_at?: string | null;
  reviewed_by_username?: string | null;
  reviewed_at?: string | null;
  review_remarks?: string | null;
};

export type StudentAttendanceRosterStudent = {
  student_id: number;
  name: string;
  roll_number?: string | number;
  class_name?: string;
  section_name?: string;
  class_scope?: string;
  medium?: string | null;
  status: StudentAttendanceStatus;
};

export type StudentAttendanceRoster = {
  academic_session_id: number;
  academic_session_name?: string;
  class_id: number;
  section_id: number;
  date: string;
  existing_session_id: number | null;
  existing_approval_status: string | null;
  existing_submitted_at?: string | null;
  existing_submitted_by_username?: string | null;
  existing_reviewed_at?: string | null;
  existing_reviewed_by_username?: string | null;
  existing_review_remarks?: string | null;
  students: StudentAttendanceRosterStudent[];
};

export type StudentAttendanceSessionDetails = StudentAttendanceSessionItem & {
  rows: Array<{
    id: number;
    student_id: number;
    student_name: string;
    roll_number?: string | number;
    status: StudentAttendanceStatus;
  }>;
  parent_messages?: Array<{
    id: number;
    student_id: number;
    parent_user_id: number;
    message?: string;
    sent_at?: string;
  }>;
};

export type AbsenceMessageTemplate = {
  key: string;
  label: string;
  body: string;
};

export type SubmitStudentAttendancePayload = {
  session_id?: number | string;
  class_id: number;
  section_id: number;
  date: string;
  deviceSource?: string;
  attendance: Array<{
    student_id?: number;
    studentId?: number;
    status: StudentAttendanceStatus;
  }>;
};

export async function getAllTeacherAttendance(params?: { startDate?: string; endDate?: string }) {
  const response = await api.get<ApiEnvelope<TeacherAttendanceItem[]>>("/teachers/attendance/all", {
    params,
  });
  return response.data.data ?? [];
}

export async function getStudentAttendanceEntryScopes() {
  const response = await api.get<ApiEnvelope<StudentAttendanceEntryScopes>>("/attendance/students/entry-scopes");
  return response.data.data;
}

export async function getStudentAttendanceRoster(params: {
  class_id: number | string;
  section_id: number | string;
  session_id?: number | string;
  date?: string;
}) {
  const response = await api.get<ApiEnvelope<StudentAttendanceRoster>>("/attendance/students/roster", {
    params,
  });
  return response.data.data;
}

export async function submitStudentAttendance(payload: SubmitStudentAttendancePayload) {
  const response = await api.post<ApiEnvelope<{ attendanceSessionId: number; approval_status: string }>>(
    "/attendance/students",
    payload,
  );
  return response.data.data;
}

export async function getStudentAttendanceSessions(params?: {
  approval_status?: string;
  class_id?: number | string;
  section_id?: number | string;
  student_id?: number | string;
  status?: string;
  date_from?: string;
  date_to?: string;
}) {
  const response = await api.get<ApiEnvelope<StudentAttendanceSessionItem[]>>("/attendance/students", {
    params,
  });
  return response.data.data ?? [];
}

export async function getPendingStudentAttendance(params?: {
  class_id?: number | string;
  section_id?: number | string;
}) {
  const response = await api.get<ApiEnvelope<StudentAttendanceSessionItem[]>>("/attendance/students/pending", {
    params,
  });
  return response.data.data ?? [];
}

export async function getStudentAttendanceSession(sessionId: number | string) {
  const response = await api.get<ApiEnvelope<StudentAttendanceSessionDetails>>(`/attendance/students/${sessionId}`);
  return response.data.data;
}

export async function reviewStudentAttendance(payload: {
  attendance_session_id: number | string;
  status: "approved" | "rejected";
  remarks?: string;
}) {
  const response = await api.post<ApiEnvelope<unknown>>("/attendance/students/review", payload);
  return response.data.data;
}

export async function getAbsenceMessageTemplates() {
  const response = await api.get<ApiEnvelope<AbsenceMessageTemplate[]>>("/attendance/students/templates");
  return response.data.data ?? [];
}

export async function notifyAbsentParents(
  sessionId: number | string,
  payload: { template_key?: string; message?: string; student_ids: number[] },
) {
  const response = await api.post<ApiEnvelope<{ sent_count?: number; failed_count?: number }>>(
    `/attendance/students/${sessionId}/notify-parents`,
    payload,
  );
  return response.data.data;
}

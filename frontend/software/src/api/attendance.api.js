import { apiRequest } from "../../../shared/api/client.js";

export async function getStudentAttendanceSessions(params = {}) {
  const query = new URLSearchParams();

  if (params.student_id) query.set("student_id", params.student_id);
  if (params.status) query.set("status", params.status);
  if (params.approval_status) query.set("approval_status", params.approval_status);
  if (params.date_from) query.set("date_from", params.date_from);
  if (params.date_to) query.set("date_to", params.date_to);
  if (params.class_id) query.set("class_id", params.class_id);
  if (params.section_id) query.set("section_id", params.section_id);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/attendance/students${suffix}`);
}

export async function getStudentAttendanceRoster(params = {}) {
  const query = new URLSearchParams();

  if (params.class_id) query.set("class_id", params.class_id);
  if (params.section_id) query.set("section_id", params.section_id);
  if (params.session_id) query.set("session_id", params.session_id);
  if (params.academic_session_id) query.set("academic_session_id", params.academic_session_id);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/attendance/students/roster${suffix}`);
}

export async function getStudentAttendanceEntryScopes() {
  return apiRequest("/attendance/students/entry-scopes");
}

export async function submitStudentAttendance(data) {
  return apiRequest("/attendance/students", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getPendingStudentAttendance(params = {}) {
  const query = new URLSearchParams();

  if (params.class_id) query.set("class_id", params.class_id);
  if (params.section_id) query.set("section_id", params.section_id);
  if (params.date_from) query.set("date_from", params.date_from);
  if (params.date_to) query.set("date_to", params.date_to);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/attendance/students/pending${suffix}`);
}

export async function getStudentAttendanceSession(sessionId) {
  return apiRequest(`/attendance/students/${sessionId}`);
}

export async function reviewStudentAttendance(data) {
  return apiRequest("/attendance/students/review", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getAbsenceMessageTemplates() {
  return apiRequest("/attendance/students/templates");
}

export async function notifyAbsentParents(sessionId, data) {
  return apiRequest(`/attendance/students/${sessionId}/notify-parents`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

import { apiRequest } from "../../../shared/api/client.js";

/* ---------- TEACHERS ---------- */

export function getTeachers() {
  return apiRequest("/teachers");
}

export function getTeacher(id) {
  return apiRequest(`/teachers/${id}`);
}

export function createTeacher(formData) {
  return apiRequest("/teachers", {
    method: "POST",
    body: formData
  });
}

export function updateTeacher(id, data) {
  return apiRequest(`/teachers/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

export function deleteTeacher(id) {
  return apiRequest(`/teachers/${id}`, {
    method: "DELETE"
  });
}

/* ---------- ASSIGNMENTS ---------- */

export function assignTeacher(id, data) {
  return apiRequest(`/teachers/${id}/assignments`, {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function getTeacherAssignments(id) {
  return apiRequest(`/teachers/${id}/assignments`);
}

export function removeAssignment(assignmentId) {
  return apiRequest(`/teachers/assignments/${assignmentId}`, {
    method: "DELETE"
  });
}

export function getTeacherAttendance(id, params = {}) {

  const query = new URLSearchParams(params).toString();
  const url = query
    ? `/teachers/${id}/attendance?${query}`
    : `/teachers/${id}/attendance`;

  return apiRequest(url);
}
export function getAllTeacherAttendance() {

  return apiRequest("/teachers/attendance/all");
}
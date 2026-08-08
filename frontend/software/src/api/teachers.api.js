import { apiRequest } from "../../../shared/api/client.js";
import { refreshToken } from "./auth.api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== "" &&
      String(value).trim().toLowerCase() !== "all"
    ) {
      query.set(key, value);
    }
  });
  return query.toString() ? `?${query.toString()}` : "";
}

async function fetchAuthorizedBlob(path, fallbackMessage = "Failed to download file") {
  async function request() {
    const token = localStorage.getItem("accessToken");
    return fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  let response = await request();
  if (response.status === 401) {
    const refreshed = await refreshToken();
    if (refreshed) {
      response = await request();
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || fallbackMessage);
  }

  return response.blob();
}

/* ---------- TEACHERS ---------- */

export function getTeachers() {
  return apiRequest("/teachers");
}

export function getAssignedTeachers(params = {}) {
  return apiRequest(`/teachers/assigned${buildQuery(params)}`);
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

export function bulkUploadTeachers(file) {
  const form = new FormData();
  form.append("file", file);

  return apiRequest("/teachers/bulk-upload", {
    method: "POST",
    body: form,
  });
}

export function updateTeacher(id, data) {
  const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
  return apiRequest(`/teachers/${id}`, {
    method: "PUT",
    body: isFormData ? data : JSON.stringify(data)
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
  return apiRequest(`/teachers/${id}/attendance${buildQuery(params)}`);
}
export function getAllTeacherAttendance() {
  return apiRequest("/teachers/attendance/all");
}

export function downloadTeacherAttendanceMatrixPdf(params = {}) {
  return fetchAuthorizedBlob(
    `/teachers/attendance/matrix/pdf${buildQuery(params)}`,
    "Failed to download teacher attendance PDF"
  );
}

export function getAttendanceDevices() {
  return apiRequest("/teachers/attendance/devices");
}

export function getAttendanceDeviceUsers(params = {}) {
  const query = new URLSearchParams();
  if (params.device_id) {
    query.set("device_id", params.device_id);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/teachers/attendance/device-users${suffix}`);
}

export function upsertAttendanceDeviceUser(data) {
  return apiRequest("/teachers/attendance/device-users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteAttendanceDeviceUser(mappingId) {
  return apiRequest(`/teachers/attendance/device-users/${mappingId}`, {
    method: "DELETE",
  });
}

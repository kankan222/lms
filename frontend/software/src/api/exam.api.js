import { apiRequest } from "../../../shared/api/client.js";
import { refreshToken } from "./auth.api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

// Legacy helper kept for compatibility
export async function getExam(sessionId) {
  const qs = new URLSearchParams();
  if (sessionId) qs.set("session_id", sessionId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest(`/exams${suffix}`);
}

export function getExams(params = {}) {
  const qs = new URLSearchParams();
  if (params.session_id) qs.set("session_id", params.session_id);
  if (params.class_id) qs.set("class_id", params.class_id);
  if (params.section_id) qs.set("section_id", params.section_id);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest(`/exams${suffix}`);
}

export function getExamById(id) {
  return apiRequest(`/exams/${id}`);
}

export function createExam(data) {
  return apiRequest("/exams", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function updateExam(id, data) {
  return apiRequest(`/exams/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

export function deleteExam(id) {
  return apiRequest(`/exams/${id}`, { method: "DELETE" });
}

export function getMarksGrid(examId, params = {}) {
  const qs = new URLSearchParams();
  if (params.class_id) qs.set("class_id", params.class_id);
  if (params.section_id) qs.set("section_id", params.section_id);
  if (params.name) qs.set("name", params.name);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest(`/exams/${examId}/marks-grid${suffix}`);
}

export function submitExamMarks(examId, data) {
  return apiRequest(`/exams/${examId}/marks`, {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function updateExamMark(markId, data) {
  return apiRequest(`/exams/marks/${markId}`, {
    method: "PATCH",
    body: JSON.stringify(data)
  });
}

export function deleteExamMark(markId) {
  return apiRequest(`/exams/marks/${markId}`, { method: "DELETE" });
}

export function approveExamMarks(examId, data) {
  return apiRequest(`/exams/${examId}/approve`, {
    method: "POST",
    body: JSON.stringify(data)
  });
}

// Backward compatibility for old UI calls
export const getExamStudents = getMarksGrid;

export function getStudentReport(examId, studentId) {
  return apiRequest(`/exams/${examId}/report/${studentId}`);
}

export async function downloadStudentReportPdf(examId, studentId) {
  async function requestWithToken() {
    const token = localStorage.getItem("accessToken");
    return fetch(
      `${API_URL}/exams/${examId}/report/${studentId}/pdf`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }
    );
  }

  let res = await requestWithToken();
  if (res.status === 401) {
    const ok = await refreshToken();
    if (ok) {
      res = await requestWithToken();
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || "Failed to download marksheet");
  }
  return res.blob();
}

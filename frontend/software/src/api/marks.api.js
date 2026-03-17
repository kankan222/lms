import { apiRequest } from "../../../shared/api/client.js";
import { refreshToken } from "./auth.api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return suffix;
}

async function fetchAuthorizedBlob(path) {
  async function request() {
    const token = localStorage.getItem("accessToken");
    return fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  let response = await request();
  if (response.status === 401) {
    const ok = await refreshToken();
    if (ok) {
      response = await request();
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || "Failed to download marksheet");
  }

  return response.blob();
}

export function getMarksGrid(params = {}) {
  return apiRequest(`/marks/grid${buildQuery(params)}`);
}

export function getAccessibleExams() {
  return apiRequest("/marks/exams");
}

export function getAccessibleExamById(examId) {
  return apiRequest(`/marks/exams/${examId}`);
}

export function saveMarks(data) {
  return apiRequest("/marks/save", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function submitMarksForApproval(data) {
  return apiRequest("/marks/submit", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function approveMarks(data) {
  return apiRequest("/marks/approve", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function rejectMarks(data) {
  return apiRequest("/marks/reject", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getStudentReport(examId, studentId) {
  return apiRequest(`/marks/reports/${examId}/student/${studentId}`);
}

export function getMyResults(params = {}) {
  return apiRequest(`/marks/my-results${buildQuery(params)}`);
}

export function getMyStudents() {
  return apiRequest("/marks/my-students");
}

export function downloadStudentMarksheet(examId, studentId) {
  return fetchAuthorizedBlob(`/marks/reports/${examId}/student/${studentId}/pdf`);
}

export function downloadMyMarksheet(params = {}) {
  return fetchAuthorizedBlob(`/marks/my-results/pdf${buildQuery(params)}`);
}

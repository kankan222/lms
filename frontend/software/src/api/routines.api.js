import { apiRequest } from "../../../shared/api/client.js";
import { refreshToken } from "./auth.api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, value);
    }
  });
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

async function fetchRoutineBlob(path, fallbackMessage) {
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

export function getTimeSlotTemplates(params = {}) {
  return apiRequest(`/routines/time-slot-templates${buildQuery(params)}`);
}

export function getTimeSlotTemplate(id) {
  return apiRequest(`/routines/time-slot-templates/${id}`);
}

export function createTimeSlotTemplate(data) {
  return apiRequest("/routines/time-slot-templates", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTimeSlotTemplate(id, data) {
  return apiRequest(`/routines/time-slot-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteTimeSlotTemplate(id) {
  return apiRequest(`/routines/time-slot-templates/${id}`, {
    method: "DELETE",
  });
}

export function getClassRoutines(params = {}) {
  return apiRequest(`/routines/class-routines${buildQuery(params)}`);
}

export function getClassRoutineBoard(params = {}) {
  return apiRequest(`/routines/class-routines/board${buildQuery(params)}`);
}

export function getClassRoutine(id) {
  return apiRequest(`/routines/class-routines/${id}`);
}

export function createClassRoutine(data) {
  return apiRequest("/routines/class-routines", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateClassRoutine(id, data) {
  return apiRequest(`/routines/class-routines/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function updateClassRoutineSlot(id, data) {
  return apiRequest(`/routines/class-routines/${id}/slot`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async function uploadRoutineSheet(path, file, fields = {}, fallbackMessage) {
  async function request() {
    const token = localStorage.getItem("accessToken");
    const formData = new FormData();
    formData.append("file", file);
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        formData.append(key, value);
      }
    });
    return fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  }

  let response = await request();
  if (response.status === 401) {
    const refreshed = await refreshToken();
    if (refreshed) response = await request();
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallbackMessage);
  return payload;
}

export function importClassRoutineSheet(file, fields = {}) {
  return uploadRoutineSheet("/routines/class-routines/import", file, fields, "Failed to import class routine sheet");
}

export function publishClassRoutine(id) {
  return apiRequest(`/routines/class-routines/${id}/publish`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function createClassRoutineDraft(id) {
  return apiRequest(`/routines/class-routines/${id}/draft`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function deleteClassRoutine(id) {
  return apiRequest(`/routines/class-routines/${id}`, {
    method: "DELETE",
  });
}

export function downloadClassRoutinePdf(id) {
  return fetchRoutineBlob(`/routines/class-routines/${id}/pdf`, "Failed to download class routine PDF");
}

export function getExamRoutines(params = {}) {
  return apiRequest(`/routines/exam-routines${buildQuery(params)}`);
}

export function getExamRoutine(id) {
  return apiRequest(`/routines/exam-routines/${id}`);
}

export function createExamRoutine(data) {
  return apiRequest("/routines/exam-routines", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateExamRoutine(id, data) {
  return apiRequest(`/routines/exam-routines/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function createExamRoutineDraft(id) {
  return apiRequest(`/routines/exam-routines/${id}/draft`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function deleteExamRoutine(id) {
  return apiRequest(`/routines/exam-routines/${id}`, {
    method: "DELETE",
  });
}

export function importExamRoutineSheet(file, fields = {}) {
  return uploadRoutineSheet("/routines/exam-routines/import", file, fields, "Failed to import exam routine sheet");
}

export function publishExamRoutine(id) {
  return apiRequest(`/routines/exam-routines/${id}/publish`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function downloadExamRoutinePdf(id) {
  return fetchRoutineBlob(`/routines/exam-routines/${id}/pdf`, "Failed to download exam routine PDF");
}

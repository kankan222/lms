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

export function getAnnouncementCategories() {
  return apiRequest("/announcements/categories");
}

export function createAnnouncementCategory(data) {
  return apiRequest("/announcements/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getAnnouncementHolidayNames(params = {}) {
  return apiRequest(`/announcements/holiday-names${buildQuery(params)}`);
}

export function createAnnouncementHolidayName(data) {
  return apiRequest("/announcements/holiday-names", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getAnnouncementSmsTemplates(params = {}) {
  return apiRequest(`/announcements/sms-templates${buildQuery(params)}`);
}

export function createAnnouncementSmsTemplate(data) {
  return apiRequest("/announcements/sms-templates", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateAnnouncementSmsTemplate(id, data) {
  return apiRequest(`/announcements/sms-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function importAnnouncementSmsTemplates(file) {
  async function request() {
    const token = localStorage.getItem("accessToken");
    const formData = new FormData();
    formData.append("file", file);
    return fetch(`${API_URL}/announcements/sms-templates/import`, {
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
  if (!response.ok) throw new Error(payload?.message || "Could not import DLT templates");
  return payload;
}

export function getAnnouncements(params = {}) {
  return apiRequest(`/announcements${buildQuery(params)}`);
}

export function getAnnouncement(id) {
  return apiRequest(`/announcements/${id}`);
}

export function createAnnouncement(data) {
  return apiRequest("/announcements", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateAnnouncement(id, data) {
  return apiRequest(`/announcements/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function publishAnnouncement(id) {
  return apiRequest(`/announcements/${id}/publish`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function cancelAnnouncement(id) {
  return apiRequest(`/announcements/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function getAnnouncementSmsJobs(params = {}) {
  return apiRequest(`/announcements/sms-jobs${buildQuery(params)}`);
}

export function dispatchAnnouncementSmsJobs() {
  return apiRequest("/announcements/sms-jobs/dispatch", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function dispatchAnnouncementSmsJob(id) {
  return apiRequest(`/announcements/sms-jobs/${id}/dispatch`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function refreshAnnouncementSmsJobStatus(id) {
  return apiRequest(`/announcements/sms-jobs/${id}/refresh-status`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function getHolidays(params = {}) {
  return apiRequest(`/announcements/holidays${buildQuery(params)}`);
}

import { apiRequest } from "../../../shared/api/client.js";

export function getGradeSettings(params = {}) {
  const qs = new URLSearchParams();
  if (params.scale_type) qs.set("scale_type", params.scale_type);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest(`/marksheet/grade-settings${suffix}`);
}

export function createGradeSetting(data) {
  return apiRequest("/marksheet/grade-settings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateGradeSetting(id, data) {
  return apiRequest(`/marksheet/grade-settings/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteGradeSetting(id) {
  return apiRequest(`/marksheet/grade-settings/${id}`, { method: "DELETE" });
}

export function getActivities(params = {}) {
  const qs = new URLSearchParams();
  if (params.scope_key) qs.set("scope_key", params.scope_key);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest(`/marksheet/activities${suffix}`);
}

export function createActivity(data) {
  return apiRequest("/marksheet/activities", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateActivity(id, data) {
  return apiRequest(`/marksheet/activities/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteActivity(id) {
  return apiRequest(`/marksheet/activities/${id}`, { method: "DELETE" });
}

export function getActivityMarkGrid(params = {}) {
  const qs = new URLSearchParams();
  if (params.session_id) qs.set("session_id", params.session_id);
  if (params.class_id) qs.set("class_id", params.class_id);
  if (params.section_id) qs.set("section_id", params.section_id);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest(`/marksheet/activities/marks${suffix}`);
}

export function saveActivityMarks(activityId, data) {
  return apiRequest(`/marksheet/activities/${activityId}/marks`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

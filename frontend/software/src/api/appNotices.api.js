import { apiRequest } from "../../../shared/api/client.js";

export function getAppNotices() {
  return apiRequest("/app-notices");
}

export function createAppNotice(payload) {
  return apiRequest("/app-notices", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAppNotice(id, payload) {
  return apiRequest(`/app-notices/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteAppNotice(id) {
  return apiRequest(`/app-notices/${id}`, {
    method: "DELETE",
  });
}

import { apiRequest } from "../../../shared/api/client.js";

export function getAppUpdatePolicies() {
  return apiRequest("/app-updates/policies");
}

export function saveAppUpdatePolicy(payload) {
  return apiRequest("/app-updates/policies", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function notifyAppUpdate(payload) {
  return apiRequest("/app-updates/notify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

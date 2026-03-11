import { apiRequest } from "../../../shared/api/client.js";

export function getWebsiteStaff(type) {
  return apiRequest(`/website/${type}/staff`);
}

export function addWebsiteStaff(type, data) {
  return apiRequest(`/website/${type}/staff`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

import { apiRequest } from "../../../shared/api/client.js";

export function listStaff() {
  return apiRequest("/staff");
}

export function getStaffById(id) {
  return apiRequest(`/staff/${id}`);
}

export function createStaff(data) {
  return apiRequest("/staff", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateStaff(id, data) {
  return apiRequest(`/staff/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteStaff(id) {
  return apiRequest(`/staff/${id}`, {
    method: "DELETE",
  });
}

export function listPublicStaffByType(type) {
  const query = encodeURIComponent(type || "");
  return apiRequest(`/public/staff?type=${query}`);
}

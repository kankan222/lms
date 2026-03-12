import { apiRequest } from "../../../shared/api/client.js";

export function getMyAccount() {
  return apiRequest("/users/me");
}

export function changeMyPassword(data) {
  return apiRequest("/users/me/change-password", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function changePassword(data) {
  return apiRequest("/users/change-password", {
    method: "POST",
    body: JSON.stringify(data)
  });
}
export function adminResetPassword(data) {

  return apiRequest("/users/admin-reset-password", {
    method: "POST",
    body: JSON.stringify(data)
  });

}

export function getUsers(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page);
  if (params.limit) query.set("limit", params.limit);
  if (params.role) query.set("role", params.role);
  if (params.status) query.set("status", params.status);
  if (params.class_id) query.set("class_id", params.class_id);
  if (params.section_id) query.set("section_id", params.section_id);
  if (params.search) query.set("search", params.search);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/users${suffix}`);
}

export function updateUserStatus(userId, status) {
  return apiRequest(`/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function getUserRoles() {
  return apiRequest("/users/roles");
}

export function getPermissions() {
  return apiRequest("/users/permissions");
}

export function createUser(data) {
  return apiRequest("/users", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function getUserPermissions(userId) {
  return apiRequest(`/users/${userId}/permissions`);
}

export function grantUserPermissions(userId, permissionNames) {
  return apiRequest(`/users/${userId}/permissions`, {
    method: "POST",
    body: JSON.stringify({ permissions: permissionNames })
  });
}

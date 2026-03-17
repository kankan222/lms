import { apiRequest } from "../../../shared/api/client.js";

export function listStaff(params = {}) {
  const query = new URLSearchParams();
  if (params.type) query.set("type", params.type);
  if (params.section) query.set("section", params.section);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/staff${suffix}`);
}

export function getStaffById(id) {
  return apiRequest(`/staff/${id}`);
}

export function createStaff(data) {
  const body = new FormData();
  body.append("name", data.name || "");
  body.append("section", data.section || "");
  body.append("type", data.type || "school");
  body.append("user_id", data.user_id || "");
  if (data.image instanceof File) {
    body.append("image", data.image);
  }

  return apiRequest("/staff", {
    method: "POST",
    body,
  });
}

export function updateStaff(id, data) {
  const body = new FormData();
  body.append("name", data.name || "");
  body.append("section", data.section || "");
  body.append("type", data.type || "school");
  body.append("user_id", data.user_id || "");
  if (data.image instanceof File) {
    body.append("image", data.image);
  } else if (data.image_url) {
    body.append("image_url", data.image_url);
  }

  return apiRequest(`/staff/${id}`, {
    method: "PUT",
    body,
  });
}

export function deleteStaff(id) {
  return apiRequest(`/staff/${id}`, {
    method: "DELETE",
  });
}

export function bulkCreateStaff(data) {
  const body = new FormData();
  body.append("type", data.type || "school");
  body.append("section", data.section || "");

  for (const file of data.images || []) {
    body.append("images", file);
  }

  return apiRequest("/staff/bulk", {
    method: "POST",
    body,
  });
}

export function listPublicStaffByType(type) {
  const query = encodeURIComponent(type || "");
  return apiRequest(`/public/staff?type=${query}`);
}

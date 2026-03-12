import { apiRequest } from "../../../shared/api/client.js";

export function getWebsiteStaff(type, filters = {}) {
  const query = new URLSearchParams();
  if (filters.section) query.set("section", filters.section);
  const suffix = query.toString() ? `?${query.toString()}` : "";

  return apiRequest(`/website/${type || "school"}/staff${suffix}`);
}

export function addWebsiteStaff(type, data) {
  const body = new FormData();
  body.append("name", data.name || "");
  body.append("section", data.section || "");
  if (data.image instanceof File) {
    body.append("image", data.image);
  }

  return apiRequest(`/website/${type || "school"}/staff`, {
    method: "POST",
    body,
  });
}

export function updateWebsiteStaff(id, type, data) {
  const body = new FormData();
  body.append("name", data.name || "");
  body.append("section", data.section || "");
  if (data.image instanceof File) {
    body.append("image", data.image);
  } else if (data.image_url) {
    body.append("image_url", data.image_url);
  }

  return apiRequest(`/website/${type || "school"}/staff/${id}`, {
    method: "PUT",
    body,
  });
}

export function deleteWebsiteStaff(id, type) {
  return apiRequest(`/website/${type || "school"}/staff/${id}`, {
    method: "DELETE",
  });
}

export function bulkUploadWebsiteStaff(type, data) {
  const body = new FormData();
  body.append("section", data.section || "");

  for (const file of data.images || []) {
    body.append("images", file);
  }

  return apiRequest(`/website/${type || "school"}/staff/bulk`, {
    method: "POST",
    body,
  });
}

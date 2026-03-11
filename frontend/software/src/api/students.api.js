import { apiRequest } from "../../../shared/api/client.js";

export async function getStudents(params = {}) {
  const query = new URLSearchParams();

  if (params.class_id) {
    query.set("class_id", params.class_id);
  }

  if (params.section_id) {
    query.set("section_id", params.section_id);
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/students${suffix}`);
}

export async function getStudent(id) {
  return apiRequest(`/students/${id}`);
}

export async function createStudent(data) {
  const isFormData = data instanceof FormData;
  return apiRequest("/students", {
    method: "POST",
    body: isFormData ? data : JSON.stringify(data)
  });
}

export function updateStudent(id, data) {
  return apiRequest(`/students/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data)
  });
}

export function deleteStudent(id) {
  return apiRequest(`/students/${id}`, {
    method: "DELETE"
  });
}

export function searchParentByPhone(phone) {
  return apiRequest(`/students/parents/search?phone=${phone}`);
}

export function bulkUploadStudents(file) {
  const form = new FormData();
  form.append("file", file);

  return apiRequest("/students/bulk-upload", {
    method: "POST",
    body: form
  });
}

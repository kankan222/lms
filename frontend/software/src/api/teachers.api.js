import { apiRequest } from "../../../shared/api/client.js";

export function getTeachers() {
  return apiRequest("/teachers");
}

export function createTeacher(data) {
  return apiRequest("/teachers", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function updateTeacher(id, data) {
  return apiRequest(`/teachers/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

export function deleteTeacher(id) {
  return apiRequest(`/teachers/${id}`, {
    method: "DELETE"
  });
}
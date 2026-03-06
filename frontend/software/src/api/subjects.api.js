import { apiRequest } from "../../../shared/api/client.js";

// GET ALL SUBJECTS
export function getSubjects() {
  return apiRequest("/subjects");
}

// CREATE SUBJECT
export function createSubject(data) {
  return apiRequest("/subjects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// UPDATE SUBJECT
export function updateSubject(id, data) {
  return apiRequest(`/subjects/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// DELETE SUBJECT
export function deleteSubject(id) {
  return apiRequest(`/subjects/${id}`, {
    method: "DELETE",
  });
}

export function assignSubjects(data) {
  return apiRequest("/subjects/assign", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getClassSubjects(classId) {
  return apiRequest(`/subjects/class/${classId}`);
}
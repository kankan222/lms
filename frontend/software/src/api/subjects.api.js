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

export function getSubjectOfferings(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return apiRequest(`/subjects/offerings${query ? `?${query}` : ""}`);
}

export function replaceSubjectOfferings(data) {
  return apiRequest("/subjects/offerings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function getStudentSubjectRegistrations(studentId) {
  return apiRequest(`/subjects/student-registrations/${studentId}`);
}

export function replaceStudentSubjectRegistrations(studentId, data) {
  return apiRequest(`/subjects/student-registrations/${studentId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

import { apiRequest } from "../../../shared/api/client.js";

// GET ALL STUDENTS
export function getStudents() {
  return apiRequest("/students");
}

// CREATE STUDENT
export function createStudent(data) {
  return apiRequest("/students", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// UPDATE SUBJECT
export function updateStudent(id, data) {
  return apiRequest(`/students/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// DELETE SUBJECT
export function deleteStudent(id) {
  return apiRequest(`/students/${id}`, {
    method: "DELETE",
  });
}

export function getStudentsByClassSection(classId, section, sessionId) {
  return apiRequest(
    `/students/by-class-section?class_id=${classId}&section=${section}&session_id=${sessionId}`
  );
}
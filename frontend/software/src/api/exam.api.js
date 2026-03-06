import { apiRequest } from "../../../shared/api/client.js";

export async function getExam(sessionId) {
 return apiRequest(`/exams?sessionId=${sessionId}`);
}

export async function createExam(data) {
  return apiRequest("/exams",{
    method: "POST",
    body: JSON.stringify(data),
  });
}

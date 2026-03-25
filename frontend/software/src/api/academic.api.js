import { apiRequest } from "../../../shared/api/client.js";

export async function getSessions() {
  return apiRequest("/academic/sessions");
}
export async function createSession(data) {
  return apiRequest("/academic/sessions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
export async function updateSession(id, data) {
  return apiRequest(`/academic/sessions/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
export async function deleteSession(id) {
  return apiRequest(`/academic/sessions/${id}`, {
    method: "DELETE",
  });
}
export async function getStreams() {
  return apiRequest("/academic/streams");
}
export async function createStream(data) {
  return apiRequest("/academic/streams", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
export async function updateStream(id, data) {
  return apiRequest(`/academic/streams/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
export async function deleteStream(id) {
  return apiRequest(`/academic/streams/${id}`, {
    method: "DELETE",
  });
}
export async function getClasses() {
  return apiRequest("/academic/classes");
}
export async function getClassStructure() {
  return apiRequest("/academic/classes/structure");
}

export async function createClass(data) {
  return apiRequest("/academic/classes",{
    method: "POST",
    body: JSON.stringify(data),
  });
}
export function updateClass(id, data) {
  return apiRequest(`/academic/classes/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

export function deleteClass(id) {
  return apiRequest(`/academic/classes/${id}`, {
    method: "DELETE"
  });
}

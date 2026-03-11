import { apiRequest } from "../../../shared/api/client.js";

export function getConversations() {
  return apiRequest("/messages/conversations");
}

export function getMessages(conversationId) {
  return apiRequest(`/messages/${conversationId}`);
}

export function sendMessage(data) {
  return apiRequest("/messages", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function markAsRead(data) {
  return apiRequest("/messages/read", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function getTargets() {
  return apiRequest("/messages/targets");
}

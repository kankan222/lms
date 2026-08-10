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

export function uploadMessageAttachments(files, category) {
  const body = new FormData();
  body.append("category", category);
  for (const file of files) {
    body.append("files", file);
  }
  return apiRequest("/messages/attachments", {
    method: "POST",
    body
  });
}

export function getAttachmentAccess(attachmentId, variant = "original") {
  return apiRequest(
    `/messages/attachments/${attachmentId}/access?variant=${encodeURIComponent(variant)}`
  );
}

export function editMessage(messageId, message) {
  return apiRequest(`/messages/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ message })
  });
}

export function deleteMessage(messageId, mode) {
  return apiRequest(`/messages/messages/${messageId}`, {
    method: "DELETE",
    body: JSON.stringify({ mode })
  });
}

export function deleteConversation(conversationId) {
  return apiRequest(`/messages/conversations/${conversationId}`, {
    method: "DELETE"
  });
}

export function updateConversation(conversationId, data) {
  return apiRequest(`/messages/conversations/${conversationId}`, {
    method: "PATCH",
    body: JSON.stringify(data)
  });
}

export function reportMessage(messageId, reason, details = "") {
  return apiRequest(`/messages/messages/${messageId}/report`, {
    method: "POST",
    body: JSON.stringify({ reason, details })
  });
}

export function searchMessages(conversationId, query) {
  return apiRequest(
    `/messages/conversations/${conversationId}/search?q=${encodeURIComponent(query)}`
  );
}

export function sendTyping(conversationId, isTyping) {
  return apiRequest(`/messages/conversations/${conversationId}/typing`, {
    method: "POST",
    body: JSON.stringify({ is_typing: isTyping })
  });
}

export function getModerationReports(status = "") {
  return apiRequest(`/messages/moderation/reports?status=${encodeURIComponent(status)}`);
}

export function updateModerationReport(reportId, status, note = "") {
  return apiRequest(`/messages/moderation/reports/${reportId}`, {
    method: "PATCH",
    body: JSON.stringify({ status, note })
  });
}

export function getMessagingAudit(conversationId = "") {
  return apiRequest(
    `/messages/moderation/audit?conversationId=${encodeURIComponent(conversationId)}`
  );
}

export function suspendMessagingUser(userId, reason, expiresAt = null) {
  return apiRequest(`/messages/moderation/users/${userId}/suspend`, {
    method: "POST",
    body: JSON.stringify({ reason, expires_at: expiresAt })
  });
}

export function unsuspendMessagingUser(userId) {
  return apiRequest(`/messages/moderation/users/${userId}/suspend`, {
    method: "DELETE"
  });
}

export function getConversationMembers(conversationId) {
  return apiRequest(`/messages/moderation/conversations/${conversationId}/members`);
}

export function addConversationMember(conversationId, userId) {
  return apiRequest(`/messages/moderation/conversations/${conversationId}/members`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId })
  });
}

export function removeConversationMember(conversationId, userId) {
  return apiRequest(
    `/messages/moderation/conversations/${conversationId}/members/${userId}`,
    { method: "DELETE" }
  );
}

export function removeMessageAttachment(attachmentId) {
  return apiRequest(`/messages/moderation/attachments/${attachmentId}`, {
    method: "DELETE"
  });
}

export function exportConversation(conversationId) {
  return apiRequest(`/messages/conversations/${conversationId}/export`);
}

export function getTargets() {
  return apiRequest("/messages/targets");
}

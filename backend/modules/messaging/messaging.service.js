import * as repo from "./messaging.repository.js";

export async function sendMessage(data, senderId) {

  const isMember = await repo.findMember(data.conversation_id, senderId);

  if (!isMember) {
    throw new Error("User not part of conversation");
  }

  const messageId = await repo.insertMessage({
    conversation_id: data.conversation_id,
    sender_id: senderId,
    message: data.message,
    attachment_url: data.attachment_url || null
  });

  await repo.updateConversationLastMessage(data.conversation_id);

  return messageId;
}

export async function fetchMessages(conversationId, page = 1, limit = 30) {

  const offset = (page - 1) * limit;

  return repo.getConversationMessages(conversationId, limit, offset);
}

export async function fetchUserConversations(userId) {
  return repo.getUserConversations(userId);
}

export async function markRead(conversationId, userId) {
  await repo.markConversationRead(conversationId, userId);
}

export async function unreadCounts(userId) {
  return repo.getUnreadCounts(userId);
}
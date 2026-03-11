import * as service from "./messaging.service.js";

export async function sendMessage(req, res) {
  try {
    const senderId = req.user.userId;
    const result = await service.sendMessage(req.body, senderId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function getMessages(req, res) {
  try {
    const conversationId = Number(req.params.conversationId);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 30));

    const messages = await service.fetchMessages(conversationId, page, limit);
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getConversations(req, res) {
  try {
    const userId = req.user.userId;
    const data = await service.fetchUserConversations(userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function markAsRead(req, res) {
  try {
    const userId = req.user.userId;
    const { conversation_id } = req.body;
    await service.markRead(conversation_id, userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function unreadMessages(req, res) {
  try {
    const userId = req.user.userId;
    const data = await service.unreadCounts(userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getTargets(req, res) {
  try {
    const data = await service.getTargets();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

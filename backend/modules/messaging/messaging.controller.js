import * as service from "./messaging.service.js";

export async function sendMessage(req, res) {
  try {

    const senderId = req.user.id;

    const messageId = await service.sendMessage(req.body, senderId);

    res.json({
      success: true,
      message_id: messageId
    });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function getMessages(req, res) {

  try {

    const conversationId = req.params.conversationId;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 30);

    const messages = await service.fetchMessages(conversationId, page, limit);

    res.json(messages);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getConversations(req, res) {

  try {

    const userId = req.user.id;

    const data = await service.fetchUserConversations(userId);

    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function markAsRead(req, res) {

  try {

    const userId = req.user.id;
    const { conversation_id } = req.body;

    await service.markRead(conversation_id, userId);

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function unreadMessages(req, res) {

  try {

    const userId = req.user.id;

    const data = await service.unreadCounts(userId);

    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
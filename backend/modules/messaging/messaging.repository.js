import { query } from "../../core/db/query.js";

export async function findMember(conversationId, userId) {
  const rows = await query(
    `SELECT 1
     FROM conversation_members
     WHERE conversation_id=? AND user_id=?`,
    [conversationId, userId]
  );

  return rows.length > 0;
}

export async function insertMessage(data) {
  const { conversation_id, sender_id, message, attachment_url } = data;

  const result = await query(
    `INSERT INTO messages
     (conversation_id, sender_id, message, attachment_url)
     VALUES (?, ?, ?, ?)`,
    [conversation_id, sender_id, message, attachment_url]
  );

  return result.insertId;
}

export async function updateConversationLastMessage(conversationId) {
  await db.query(
    `UPDATE conversations
     SET last_message_at = NOW()
     WHERE id=?`,
    [conversationId]
  );
}

export async function getConversationMessages(conversationId, limit, offset) {
  const rows = await query(
    `SELECT
       id,
       conversation_id,
       sender_id,
       message,
       attachment_url,
       created_at
     FROM messages
     WHERE conversation_id=?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [conversationId, limit, offset]
  );

  return rows;
}

export async function getUserConversations(userId) {
  const rows = await query(
    `SELECT
      c.id,
      c.type,
      c.name,
      c.last_message_at,
      (
        SELECT m.message
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_message
    FROM conversations c
    JOIN conversation_members cm
      ON cm.conversation_id = c.id
    WHERE cm.user_id=?
    ORDER BY c.last_message_at DESC`,
    [userId]
  );

  return rows;
}

export async function markConversationRead(conversationId, userId) {
  await db.query(
    `UPDATE conversation_members
     SET last_read_at = NOW()
     WHERE conversation_id=? AND user_id=?`,
    [conversationId, userId]
  );
}

export async function getUnreadCounts(userId) {
  const rows = await query(
    `SELECT
      c.id AS conversation_id,
      COUNT(m.id) AS unread
    FROM conversations c
    JOIN conversation_members cm
      ON cm.conversation_id = c.id
    LEFT JOIN messages m
      ON m.conversation_id = c.id
      AND m.created_at > IFNULL(cm.last_read_at, '1970-01-01')
    WHERE cm.user_id=?
    GROUP BY c.id`,
    [userId]
  );

  return rows;
}
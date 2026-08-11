export async function createNotification(conn, data){
  const [result] = await conn.execute(`
    INSERT INTO notifications
    (user_id, category, type, entity_type, entity_id, title, body, action_url, deep_link)
    VALUES (?,?,?,?,?,?,?,?,?)
  `,[
    data.userId,
    data.category,
    data.type,
    data.entityType || null,
    data.entityId || null,
    data.title,
    data.body,
    data.actionUrl || null,
    data.deepLink || null
  ]);

  return result.insertId;
}

export async function createBulk(conn, users, payload){

  const values = users.map(u => [
    u,
    payload.category,
    payload.type,
    payload.entityType || null,
    payload.entityId || null,
    payload.title,
    payload.body,
    payload.actionUrl || null,
    payload.deepLink || null
  ]);

  const [result] = await conn.query(`
    INSERT INTO notifications
    (user_id, category, type, entity_type, entity_id, title, body, action_url, deep_link)
    VALUES ?
  `,[values]);

  return Array.from({ length: Number(result.affectedRows || 0) }, (_, index) => Number(result.insertId) + index);
}

export async function getUserNotifications(conn, userId, options = {}){
  const limit = Math.max(1, Math.min(100, Number(options.limit) || 50));
  const params = [userId];
  const where = ["user_id=?"];
  const category = String(options.category || "").trim().toLowerCase();
  if (category) {
    where.push("category = ?");
    params.push(category);
  }

  const [rows] = await conn.execute(`
    SELECT *
    FROM notifications
    WHERE ${where.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `,params);

  return rows;
}

export async function getUnreadCount(conn, userId){

  const [rows] = await conn.execute(`
    SELECT COUNT(*) as total
    FROM notifications
    WHERE user_id=?
      AND is_read=false
  `,[userId]);

  return rows[0].total;
}

export async function markAsRead(conn, notificationId, userId){

  await conn.execute(`
    UPDATE notifications
    SET is_read=true,
        read_at=NOW()
    WHERE id=?
      AND user_id=?
  `,[notificationId, userId]);
}

export async function markAllAsRead(conn, userId){
  await conn.execute(`
    UPDATE notifications
    SET is_read=true,
        read_at=NOW()
    WHERE user_id=?
      AND is_read=false
  `,[userId]);
}

function userFilter(userIds = [], alias = "") {
  const normalized = [...new Set((userIds || []).map(Number).filter(Boolean))];
  if (!normalized.length) return { sql: "", params: [] };
  const column = alias ? `${alias}.user_id` : "user_id";
  return {
    sql: ` AND ${column} IN (${normalized.map(() => "?").join(",")})`,
    params: normalized,
  };
}

export async function deleteMessageNotificationsForMessage(conn, data = {}) {
  const messageId = Number(data.messageId);
  const conversationId = Number(data.conversationId);
  const legacyBody = data.legacyBody === undefined || data.legacyBody === null ? null : String(data.legacyBody);
  const filter = userFilter(data.userIds);
  if (!messageId && !conversationId) return { affectedRows: 0 };

  const conditions = [];
  const params = [];
  if (messageId) {
    conditions.push("(entity_type = 'message' AND entity_id = ?)");
    params.push(messageId);
  }
  if (conversationId && legacyBody !== null) {
    conditions.push("(entity_type = 'conversation' AND entity_id = ? AND body = ?)");
    params.push(conversationId, legacyBody);
  }
  if (!conditions.length) return { affectedRows: 0 };

  const [result] = await conn.execute(
    `
      DELETE FROM notifications
      WHERE category = 'message'
        AND (${conditions.join(" OR ")})
        ${filter.sql}
    `,
    [...params, ...filter.params]
  );
  return { affectedRows: Number(result.affectedRows || 0) };
}

export async function deleteMessageNotificationsForConversation(conn, data = {}) {
  const conversationId = Number(data.conversationId);
  const filter = userFilter(data.userIds, "n");
  if (!conversationId) return { affectedRows: 0 };

  const [result] = await conn.execute(
    `
      DELETE n
      FROM notifications n
      LEFT JOIN messages m
        ON n.entity_type = 'message'
       AND n.entity_id = m.id
      WHERE n.category = 'message'
        AND (
          (n.entity_type = 'conversation' AND n.entity_id = ?)
          OR m.conversation_id = ?
          OR n.action_url = ?
          OR n.deep_link = ?
        )
        ${filter.sql}
    `,
    [
      conversationId,
      conversationId,
      `/messages?conversation_id=${conversationId}`,
      `app://messages/conversations/${conversationId}`,
      ...filter.params,
    ]
  );
  return { affectedRows: Number(result.affectedRows || 0) };
}

export async function upsertDevice(conn, data) {
  await conn.execute(
    `
      INSERT INTO notification_devices
      (
        user_id,
        platform,
        device_token,
        push_token,
        push_provider,
        device_name,
        is_active,
        last_seen_at
      )
      VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW())
      ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        platform = VALUES(platform),
        push_token = VALUES(push_token),
        push_provider = VALUES(push_provider),
        device_name = VALUES(device_name),
        is_active = TRUE,
        last_seen_at = NOW(),
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      data.userId,
      data.platform,
      data.deviceToken,
      data.pushToken || null,
      data.pushProvider || null,
      data.deviceName || null,
    ]
  );
}

export async function deactivateDevice(conn, data) {
  await conn.execute(
    `
      UPDATE notification_devices
      SET is_active = FALSE,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
        AND (
          device_token = ?
          OR (push_token IS NOT NULL AND push_token = ?)
        )
    `,
    [data.userId, data.deviceToken, data.pushToken || null]
  );
}

export async function listActivePushDevices(conn, userIds = []) {
  if (!Array.isArray(userIds) || !userIds.length) {
    return [];
  }

  const placeholders = userIds.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `
      SELECT
        nd.id,
        nd.user_id,
        nd.platform,
        nd.device_token,
        nd.push_token,
        nd.push_provider,
        nd.device_name
      FROM notification_devices nd
      WHERE nd.user_id IN (${placeholders})
        AND nd.is_active = TRUE
        AND nd.push_token IS NOT NULL
    `,
    userIds
  );

  return rows;
}

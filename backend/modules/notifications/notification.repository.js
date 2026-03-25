export async function createNotification(conn, data){
  const [result] = await conn.execute(`
    INSERT INTO notifications
    (user_id, type, entity_type, entity_id, title, body)
    VALUES (?,?,?,?,?,?)
  `,[
    data.userId,
    data.type,
    data.entityType || null,
    data.entityId || null,
    data.title,
    data.body
  ]);

  return result.insertId;
}

export async function createBulk(conn, users, payload){

  const values = users.map(u => [
    u,
    payload.type,
    payload.entityType || null,
    payload.entityId || null,
    payload.title,
    payload.body
  ]);

  await conn.query(`
    INSERT INTO notifications
    (user_id, type, entity_type, entity_id, title, body)
    VALUES ?
  `,[values]);
}

export async function getUserNotifications(conn, userId, options = {}){
  const limit = Math.max(1, Math.min(100, Number(options.limit) || 50));

  const [rows] = await conn.execute(`
    SELECT *
    FROM notifications
    WHERE user_id=?
    ORDER BY created_at DESC
    LIMIT ${limit}
  `,[userId]);

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
        id,
        user_id,
        platform,
        device_token,
        push_token,
        push_provider,
        device_name
      FROM notification_devices
      WHERE user_id IN (${placeholders})
        AND is_active = TRUE
        AND push_token IS NOT NULL
    `,
    userIds
  );

  return rows;
}

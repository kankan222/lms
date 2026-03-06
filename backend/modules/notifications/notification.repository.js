export async function createNotification(conn, data){

  await conn.execute(`
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

export async function getUserNotifications(conn, userId){

  const [rows] = await conn.execute(`
    SELECT *
    FROM notifications
    WHERE user_id=?
    ORDER BY created_at DESC
    LIMIT 50
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

export async function markAsRead(conn, notificationId){

  await conn.execute(`
    UPDATE notifications
    SET is_read=true,
        read_at=NOW()
    WHERE id=?
  `,[notificationId]);
}
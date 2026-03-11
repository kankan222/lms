import { query } from "../../core/db/query.js";

export async function findUserByEmailOrPhone({ email, phone }) {
  if (!email && !phone) {
    throw new Error("Email or phone is required");
  }

  const where = [];
  const params = [];

  if (email) {
    where.push("email = ?");
    params.push(email);
  }
  if (phone) {
    where.push("phone = ?");
    params.push(phone);
  }

  const sql = `
    SELECT * FROM users
    WHERE ${where.join(" OR ")}
    LIMIT 1
  `;

  const rows = await query(sql, params);

  return rows[0] || null;
}
export async function getUserPermissions(userId) {
  const sqlWithUserPermissions = `
    SELECT DISTINCT name
    FROM (
      SELECT p.name
      FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      JOIN user_roles ur ON ur.role_id = rp.role_id
      WHERE ur.user_id = ?

      UNION

      SELECT p2.name
      FROM permissions p2
      JOIN user_permissions up ON up.permission_id = p2.id
      WHERE up.user_id = ?
    ) x
  `;

  try {
    return await query(sqlWithUserPermissions, [userId, userId]);
  } catch (err) {
    if (err?.code !== "ER_NO_SUCH_TABLE") throw err;

    const fallbackSql = `
      SELECT DISTINCT p.name
      FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      JOIN user_roles ur ON ur.role_id = rp.role_id
      WHERE ur.user_id = ?
    `;
    return query(fallbackSql, [userId]);
  }
}

export async function getUserRoles(userId) {
  const sql = `
    SELECT r.name
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = ?
  `;
  return query(sql, [userId]);
}

export async function createSession(data) {
  const sql = `
    INSERT INTO user_sessions
    (id, user_id, refresh_token_hash,
     device_id, device_type, ip_address, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  return query(sql, [
    data.sessionId,
    data.userId,
    data.refreshHash,
    data.deviceId ?? null,
    data.deviceType ?? null,
    data.ip ?? null,
    data.expiresAt
  ]);
}
export async function findSession(sessionId) {
  const sql = `
    SELECT * FROM user_sessions
    WHERE id = ? AND revoked_at IS NULL
    LIMIT 1
  `;

  const rows = await query(sql, [sessionId]);
  return rows[0];
}
export async function updateSessionToken(
  sessionId,
  refreshHash,
  expiresAt
) {
  const sql = `
    UPDATE user_sessions
    SET refresh_token_hash = ?,
        expires_at = ?
    WHERE id = ?
  `;

  return query(sql, [
    refreshHash,
    expiresAt,
    sessionId
  ]);
}
export async function revokeSession(sessionId) {
  const sql = `
    UPDATE user_sessions
    SET revoked_at = NOW()
    WHERE id = ?
  `;

  return query(sql, [sessionId]);
}
export async function revokeAllUserSessions(userId) {
  const sql = `
    UPDATE user_sessions
    SET revoked_at = NOW()
    WHERE user_id = ?
  `;

  return query(sql, [userId]);
}

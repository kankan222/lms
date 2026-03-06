import { query } from "../../core/db/query.js";

export async function findUserByIdentifier(identifier) {
   if (!identifier) {
    throw new Error("Identifier missing");
  }
  const sql = `
    SELECT * FROM users
    WHERE email = ? OR phone = ? OR username = ?
    LIMIT 1
  `;

  const rows = await query(sql, [
    identifier,
    identifier,
    identifier
  ]);

  return rows[0] || null;
}
export async function getUserPermissions(userId) {
  const sql = `
    SELECT p.name
    FROM permissions p
    JOIN role_permissions rp ON rp.permission_id = p.id
    JOIN user_roles ur ON ur.role_id = rp.role_id
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
import { query } from "../../core/db/query.js";

export async function findTrustedDevice(userId, deviceId) {
  const rows = await query(
    `SELECT *
     FROM auth_trusted_devices
     WHERE user_id = ?
       AND device_id = ?
       AND revoked_at IS NULL
     LIMIT 1`,
    [userId, deviceId]
  );
  return rows[0] || null;
}

export async function trustDevice({ userId, deviceId, deviceType, ip }) {
  await query(
    `INSERT INTO auth_trusted_devices
       (user_id, device_id, device_type, last_seen_at, last_ip)
     VALUES (?, ?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       device_type = VALUES(device_type),
       last_seen_at = NOW(),
       last_ip = VALUES(last_ip),
       revoked_at = NULL,
       revoke_reason = NULL`,
    [userId, deviceId, deviceType ?? null, ip ?? null]
  );
}

export async function touchTrustedDevice({ userId, deviceId, deviceType, ip }) {
  await query(
    `UPDATE auth_trusted_devices
     SET last_seen_at = NOW(),
         device_type = ?,
         last_ip = ?
     WHERE user_id = ?
       AND device_id = ?
       AND revoked_at IS NULL`,
    [deviceType ?? null, ip ?? null, userId, deviceId]
  );
}

export async function revokeTrustedDevicesForUser(userId, reason = "revoked") {
  await query(
    `UPDATE auth_trusted_devices
     SET revoked_at = NOW(),
         revoke_reason = ?
     WHERE user_id = ?
       AND revoked_at IS NULL`,
    [reason, userId]
  );
}

export async function createOtpChallenge(data) {
  await query(
    `INSERT INTO auth_otp_challenges
       (id, user_id, phone, role_name, otp_template_id, otp_hash,
        device_id, device_type, ip_address, reason, expires_at, last_sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      data.challengeId,
      data.userId,
      data.phone,
      data.roleName ?? null,
      data.templateId,
      data.otpHash,
      data.deviceId ?? null,
      data.deviceType ?? null,
      data.ip ?? null,
      data.reason ?? null,
      data.expiresAt,
    ]
  );
}

export async function getOtpChallenge(challengeId) {
  const rows = await query(
    `SELECT *
     FROM auth_otp_challenges
     WHERE id = ?
     LIMIT 1`,
    [challengeId]
  );
  return rows[0] || null;
}

export async function updateOtpForResend({ challengeId, otpHash, expiresAt }) {
  await query(
    `UPDATE auth_otp_challenges
     SET otp_hash = ?,
         expires_at = ?,
         resend_count = resend_count + 1,
         last_sent_at = NOW(),
         failed_attempts = 0
     WHERE id = ?`,
    [otpHash, expiresAt, challengeId]
  );
}

export async function countOtpResendsLast24Hours(userId) {
  const rows = await query(
    `SELECT COALESCE(SUM(resend_count), 0) AS total
     FROM auth_otp_challenges
     WHERE user_id = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
    [userId]
  );
  return Number(rows[0]?.total || 0);
}

export async function getActiveOtpBlock(userId) {
  const rows = await query(
    `SELECT blocked_until
     FROM auth_otp_challenges
     WHERE user_id = ?
       AND blocked_until IS NOT NULL
       AND blocked_until > NOW()
     ORDER BY blocked_until DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

export async function incrementOtpFailure(challengeId, shouldBlock) {
  await query(
    `UPDATE auth_otp_challenges
     SET failed_attempts = failed_attempts + 1,
         blocked_until = CASE WHEN ? THEN DATE_ADD(NOW(), INTERVAL 24 HOUR) ELSE blocked_until END
     WHERE id = ?`,
    [shouldBlock ? 1 : 0, challengeId]
  );
}

export async function markOtpVerified(challengeId) {
  await query(
    `UPDATE auth_otp_challenges
     SET verified_at = NOW()
     WHERE id = ?`,
    [challengeId]
  );
}

export async function recordLoginFailure({ userId, deviceId, deviceType, ip }) {
  await query(
    `INSERT INTO auth_login_failures
       (user_id, device_id, device_type, ip_address)
     VALUES (?, ?, ?, ?)`,
    [userId, deviceId ?? null, deviceType ?? null, ip ?? null]
  );
}

export async function countRecentLoginFailures(userId) {
  const rows = await query(
    `SELECT COUNT(*) AS total
     FROM auth_login_failures
     WHERE user_id = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
    [userId]
  );
  return Number(rows[0]?.total || 0);
}

export async function clearLoginFailures(userId) {
  await query(
    `DELETE FROM auth_login_failures
     WHERE user_id = ?`,
    [userId]
  );
}

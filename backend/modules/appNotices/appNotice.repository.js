import { execute, query } from "../../core/db/query.js";

function schoolTimezoneOffsetMinutes() {
  const raw = String(process.env.SCHOOL_TIMEZONE_OFFSET || process.env.APP_TIMEZONE_OFFSET || "+05:30").trim();
  const match = raw.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) return 330;
  const [, sign, hours, minutes] = match;
  const total = Number(hours) * 60 + Number(minutes);
  return sign === "-" ? -total : total;
}

function schoolNowSql() {
  const minutes = schoolTimezoneOffsetMinutes();
  if (minutes === 0) return "UTC_TIMESTAMP()";
  return `DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${minutes} MINUTE)`;
}

export function listNotices() {
  return query(
    `SELECT *
     FROM mobile_app_notices
     ORDER BY is_active DESC, COALESCE(starts_at, created_at) DESC, id DESC
     LIMIT 100`
  );
}

export function listActiveNotices(platform = "android") {
  return query(
    `SELECT *
     FROM mobile_app_notices
     WHERE is_active = TRUE
       AND platform IN ('all', ?)
       AND (starts_at IS NULL OR starts_at <= ${schoolNowSql()})
       AND (ends_at IS NULL OR ends_at >= ${schoolNowSql()})
     ORDER BY FIELD(severity, 'critical', 'warning', 'info'), COALESCE(starts_at, created_at) DESC, id DESC
     LIMIT 5`,
    [platform]
  );
}

export function getNoticeById(id) {
  return query("SELECT * FROM mobile_app_notices WHERE id = ? LIMIT 1", [id]).then((rows) => rows[0] || null);
}

export async function createNotice(data) {
  const result = await execute(
    `INSERT INTO mobile_app_notices
       (title, message, severity, platform, starts_at, ends_at, min_app_version, max_app_version,
        min_build, max_build, dismissible, action_label, action_url, is_active, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.title,
      data.message,
      data.severity,
      data.platform,
      data.starts_at,
      data.ends_at,
      data.min_app_version,
      data.max_app_version,
      data.min_build,
      data.max_build,
      data.dismissible,
      data.action_label,
      data.action_url,
      data.is_active,
      data.user_id,
      data.user_id,
    ]
  );
  return getNoticeById(result.insertId);
}

export async function updateNotice(id, data) {
  await execute(
    `UPDATE mobile_app_notices
     SET title = ?, message = ?, severity = ?, platform = ?, starts_at = ?, ends_at = ?,
         min_app_version = ?, max_app_version = ?, min_build = ?, max_build = ?,
         dismissible = ?, action_label = ?, action_url = ?, is_active = ?, updated_by = ?
     WHERE id = ?`,
    [
      data.title,
      data.message,
      data.severity,
      data.platform,
      data.starts_at,
      data.ends_at,
      data.min_app_version,
      data.max_app_version,
      data.min_build,
      data.max_build,
      data.dismissible,
      data.action_label,
      data.action_url,
      data.is_active,
      data.user_id,
      id,
    ]
  );
  return getNoticeById(id);
}

export async function deleteNotice(id) {
  const result = await execute("DELETE FROM mobile_app_notices WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

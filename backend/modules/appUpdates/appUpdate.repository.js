import { execute, query } from "../../core/db/query.js";

export async function listPolicies() {
  return query(
    `SELECT *
     FROM mobile_app_update_policy
     ORDER BY FIELD(platform, 'android', 'ios'), platform`
  );
}

export async function getPolicy(platform) {
  const rows = await query(
    `SELECT *
     FROM mobile_app_update_policy
     WHERE platform = ?
       AND is_active = TRUE
     LIMIT 1`,
    [platform]
  );
  return rows[0] || null;
}

export async function upsertPolicy(data) {
  await execute(
    `INSERT INTO mobile_app_update_policy
       (platform, latest_version, latest_build, minimum_version, minimum_build, store_url, title, message, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       latest_version = VALUES(latest_version),
       latest_build = VALUES(latest_build),
       minimum_version = VALUES(minimum_version),
       minimum_build = VALUES(minimum_build),
       store_url = VALUES(store_url),
       title = VALUES(title),
       message = VALUES(message),
       is_active = VALUES(is_active),
       updated_at = CURRENT_TIMESTAMP`,
    [
      data.platform,
      data.latestVersion,
      data.latestBuild,
      data.minimumVersion,
      data.minimumBuild,
      data.storeUrl,
      data.title,
      data.message,
      data.isActive,
    ]
  );
  return getPolicyIncludingInactive(data.platform);
}

export async function getPolicyIncludingInactive(platform) {
  const rows = await query(
    `SELECT *
     FROM mobile_app_update_policy
     WHERE platform = ?
     LIMIT 1`,
    [platform]
  );
  return rows[0] || null;
}

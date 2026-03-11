import { query } from "../db/query.js";

export async function getPermissionsByUserId(userId) {

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

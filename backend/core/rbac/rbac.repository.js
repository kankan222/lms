import { query } from "../db/query.js";

export async function getPermissionsByUserId(userId) {

  const sql = `
    SELECT DISTINCT p.name
    FROM permissions p
    JOIN role_permissions rp ON rp.permission_id = p.id
    JOIN user_roles ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = ?
  `;

  return query(sql, [userId]);
}
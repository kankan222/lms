import { query } from "../../core/db/query.js";

export async function getUserPasswordHash(userId) {
  const rows = await query(
    `SELECT password_hash FROM users WHERE id = ?`,
    [userId]
  );
  return rows[0];
}

export async function updatePassword(userId, hash) {
  return query(
    `UPDATE users SET password_hash = ? WHERE id = ?`,
    [hash, userId]
  );
}

function buildUserFilters(filters = {}) {
  const where = [];
  const params = [];

  if (filters.status) {
    where.push("u.status = ?");
    params.push(filters.status);
  }

  if (filters.search) {
    where.push("(u.username LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.role) {
    where.push(`EXISTS (
      SELECT 1
      FROM user_roles ur2
      JOIN roles r2 ON r2.id = ur2.role_id
      WHERE ur2.user_id = u.id AND r2.name = ?
    )`);
    params.push(filters.role);
  }

  if (filters.class_id) {
    where.push(`EXISTS (
      SELECT 1
      FROM parents p2
      JOIN student_parents sp2 ON sp2.parent_id = p2.id
      JOIN student_enrollments se2 ON se2.student_id = sp2.student_id
      WHERE p2.user_id = u.id
        AND se2.status = 'active'
        AND se2.class_id = ?
    )`);
    params.push(Number(filters.class_id));
  }

  if (filters.section_id) {
    where.push(`EXISTS (
      SELECT 1
      FROM parents p2
      JOIN student_parents sp2 ON sp2.parent_id = p2.id
      JOIN student_enrollments se2 ON se2.student_id = sp2.student_id
      WHERE p2.user_id = u.id
        AND se2.status = 'active'
        AND se2.section_id = ?
    )`);
    params.push(Number(filters.section_id));
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params
  };
}

export async function listUsers(filters = {}) {
  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.min(50, Math.max(1, Number(filters.limit || 5)));
  const offset = (page - 1) * limit;

  const { whereSql, params } = buildUserFilters(filters);

  const countRows = await query(
    `SELECT COUNT(*) AS total
     FROM users u
     ${whereSql}`,
    params
  );

  const rows = await query(
    `SELECT
      u.id,
      u.username,
      u.email,
      u.phone,
      u.status,
      u.created_at,
      GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ', ') AS roles,
      MAX(t.name) AS teacher_name,
      MAX(p.name) AS parent_name,
      GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') AS parent_classes,
      GROUP_CONCAT(DISTINCT sec.name ORDER BY sec.name SEPARATOR ', ') AS parent_sections
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    LEFT JOIN teachers t ON t.user_id = u.id
    LEFT JOIN parents p ON p.user_id = u.id
    LEFT JOIN student_parents sp ON sp.parent_id = p.id
    LEFT JOIN student_enrollments se ON se.student_id = sp.student_id AND se.status = 'active'
    LEFT JOIN classes c ON c.id = se.class_id
    LEFT JOIN sections sec ON sec.id = se.section_id
    ${whereSql}
    GROUP BY u.id, u.username, u.email, u.phone, u.status, u.created_at
    ORDER BY u.id DESC
    LIMIT ${offset}, ${limit}`,
    params
  );

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: Number(countRows?.[0]?.total || 0),
      totalPages: Math.ceil(Number(countRows?.[0]?.total || 0) / limit)
    }
  };
}

export async function updateUserStatus(userId, status) {
  return query(
    `UPDATE users SET status = ? WHERE id = ?`,
    [status, userId]
  );
}

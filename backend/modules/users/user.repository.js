import { query } from "../../core/db/query.js";
import { pool } from "../../database/pool.js";

export async function getUserPasswordHash(userId) {
  const rows = await query(
    `SELECT password_hash FROM users WHERE id = ?`,
    [userId]
  );
  return rows[0];
}

export async function getUserAccountProfile(userId) {
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
      MAX(p.name) AS parent_name
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    LEFT JOIN teachers t ON t.user_id = u.id
    LEFT JOIN parents p ON p.user_id = u.id
    WHERE u.id = ?
    GROUP BY u.id, u.username, u.email, u.phone, u.status, u.created_at`,
    [userId]
  );

  return rows[0] || null;
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

export async function listRoles() {
  return query(
    `SELECT id, name
     FROM roles
     ORDER BY name ASC`
  );
}

export async function listPermissions() {
  return query(
    `SELECT id, name
     FROM permissions
     ORDER BY name ASC`
  );
}

export async function getUserByUsernameOrContact({ username, email, phone }) {
  const conditions = [];
  const params = [];

  if (username) {
    conditions.push("username = ?");
    params.push(username);
  }
  if (email) {
    conditions.push("email = ?");
    params.push(email);
  }
  if (phone) {
    conditions.push("phone = ?");
    params.push(phone);
  }

  if (!conditions.length) return null;

  const rows = await query(
    `SELECT id, username, email, phone
     FROM users
     WHERE ${conditions.join(" OR ")}
     LIMIT 1`,
    params
  );

  return rows[0] || null;
}

export async function createUserWithRoles({ username, email, phone, passwordHash, status, roles }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [userResult] = await conn.execute(
      `INSERT INTO users (username, email, phone, password_hash, status)
       VALUES (?, ?, ?, ?, ?)`,
      [username, email || null, phone || null, passwordHash, status]
    );

    const userId = userResult.insertId;

    if (roles.length) {
      const placeholders = roles.map(() => "?").join(",");
      const [roleRows] = await conn.execute(
        `SELECT id, name
         FROM roles
         WHERE name IN (${placeholders})`,
        roles
      );

      for (const role of roleRows) {
        await conn.execute(
          `INSERT IGNORE INTO user_roles (user_id, role_id)
           VALUES (?, ?)`,
          [userId, role.id]
        );
      }
    }

    await conn.commit();
    return userId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function getUserDirectPermissions(userId) {
  return query(
    `SELECT p.id, p.name
     FROM user_permissions up
     JOIN permissions p ON p.id = up.permission_id
     WHERE up.user_id = ?
     ORDER BY p.name ASC`,
    [userId]
  );
}

export async function replaceUserPermissions(userId, permissionNames = []) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `DELETE FROM user_permissions WHERE user_id = ?`,
      [userId]
    );

    if (permissionNames.length) {
      const placeholders = permissionNames.map(() => "?").join(",");
      const [permissionRows] = await conn.execute(
        `SELECT id, name
         FROM permissions
         WHERE name IN (${placeholders})`,
        permissionNames
      );

      for (const permission of permissionRows) {
        await conn.execute(
          `INSERT IGNORE INTO user_permissions (user_id, permission_id)
           VALUES (?, ?)`,
          [userId, permission.id]
        );
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function getUserById(userId) {
  const rows = await query(
    `SELECT id, username, email, phone, status
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

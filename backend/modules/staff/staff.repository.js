import { execute, query } from "../../core/db/query.js";
import { pool } from "../../database/pool.js";

const SECTION_TITLE_MAP = {
  head: "HEADSTAFF",
  teaching: "TEACHINGSTAFF",
  non_teaching: "NONTEACHINGSTAFF",
  nonteaching: "NONTEACHINGSTAFF",
  "non-teaching": "NONTEACHINGSTAFF",
  headstaff: "HEADSTAFF",
  teachingstaff: "TEACHINGSTAFF",
  nonteachingstaff: "NONTEACHINGSTAFF",
};

let staffUserIdColumnPromise;

async function hasStaffUserIdColumn() {
  if (!staffUserIdColumnPromise) {
    staffUserIdColumnPromise = query(`SHOW COLUMNS FROM staff LIKE 'user_id'`)
      .then((rows) => Array.isArray(rows) && rows.length > 0)
      .catch((err) => {
        staffUserIdColumnPromise = null;
        throw err;
      });
  }

  return staffUserIdColumnPromise;
}

async function selectStaffColumns(whereSql = "", params = []) {
  const supportsUserId = await hasStaffUserIdColumn();
  const userIdSelect = supportsUserId ? "user_id" : "NULL AS user_id";

  return query(
    `SELECT id, ${userIdSelect}, image_url, name, title, type, created_at, updated_at
     FROM staff
     ${whereSql}
     ORDER BY type ASC, title ASC, name ASC, id DESC`,
    params
  );
}

function normalizeSectionFilter(raw) {
  const key = String(raw || "").trim().toLowerCase().replace(/[^a-z]+/g, "_");
  return SECTION_TITLE_MAP[key] || String(raw || "").trim().toUpperCase();
}

function buildListFilters(filters = {}) {
  const where = [];
  const params = [];

  if (filters.type) {
    where.push("type = ?");
    params.push(String(filters.type).trim().toLowerCase());
  }

  if (filters.section) {
    where.push("title = ?");
    params.push(normalizeSectionFilter(filters.section));
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

export async function listStaff(filters = {}) {
  const { whereSql, params } = buildListFilters(filters);
  return selectStaffColumns(whereSql, params);
}

export async function listStaffByCampus(type) {
  const supportsUserId = await hasStaffUserIdColumn();
  const userIdSelect = supportsUserId ? "user_id" : "NULL AS user_id";

  return query(
    `SELECT id, ${userIdSelect}, image_url, name, title, type, created_at, updated_at
     FROM staff
     WHERE type = ?
     ORDER BY title ASC, name ASC, id DESC`,
    [type]
  );
}

export async function getStaffById(id) {
  const supportsUserId = await hasStaffUserIdColumn();
  const userIdSelect = supportsUserId ? "user_id" : "NULL AS user_id";
  const rows = await query(
    `SELECT id, ${userIdSelect}, image_url, name, title, type, created_at, updated_at
     FROM staff
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function getStaffByUserId(userId) {
  const supportsUserId = await hasStaffUserIdColumn();
  if (!supportsUserId) {
    return null;
  }

  const rows = await query(
    `SELECT id, user_id, image_url, name, title, type, created_at, updated_at
     FROM staff
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

export async function createStaff(data) {
  const supportsUserId = await hasStaffUserIdColumn();
  if (supportsUserId) {
    return execute(
      `INSERT INTO staff (user_id, image_url, name, title, type)
       VALUES (?, ?, ?, ?, ?)`,
      [data.user_id ?? null, data.image_url ?? null, data.name, data.title, data.type]
    );
  }

  return execute(
    `INSERT INTO staff (image_url, name, title, type)
     VALUES (?, ?, ?, ?)`,
    [data.image_url ?? null, data.name, data.title, data.type]
  );
}

export async function bulkCreateStaff(records = []) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const inserted = [];
    const supportsUserId = await hasStaffUserIdColumn();

    for (const record of records) {
      const [result] = supportsUserId
        ? await conn.execute(
            `INSERT INTO staff (user_id, image_url, name, title, type)
             VALUES (?, ?, ?, ?, ?)`,
            [record.user_id ?? null, record.image_url ?? null, record.name, record.title, record.type]
          )
        : await conn.execute(
            `INSERT INTO staff (image_url, name, title, type)
             VALUES (?, ?, ?, ?)`,
            [record.image_url ?? null, record.name, record.title, record.type]
          );
      inserted.push({ id: result.insertId, ...record });
    }

    await conn.commit();
    return inserted;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateStaff(id, data) {
  const supportsUserId = await hasStaffUserIdColumn();
  if (supportsUserId) {
    return execute(
      `UPDATE staff
       SET user_id = ?,
           image_url = ?,
           name = ?,
           title = ?,
           type = ?
       WHERE id = ?`,
      [data.user_id ?? null, data.image_url ?? null, data.name, data.title, data.type, id]
    );
  }

  return execute(
    `UPDATE staff
     SET image_url = ?,
         name = ?,
         title = ?,
         type = ?
     WHERE id = ?`,
    [data.image_url ?? null, data.name, data.title, data.type, id]
  );
}

export function deleteStaff(id) {
  return execute(`DELETE FROM staff WHERE id = ?`, [id]);
}

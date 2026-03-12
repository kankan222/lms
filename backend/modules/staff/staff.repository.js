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

export function listStaff(filters = {}) {
  const { whereSql, params } = buildListFilters(filters);
  return query(
    `SELECT id, image_url, name, title, type, created_at, updated_at
     FROM staff
     ${whereSql}
     ORDER BY type ASC, title ASC, name ASC, id DESC`,
    params
  );
}

export function listStaffByCampus(type) {
  return query(
    `SELECT id, image_url, name, title, type, created_at, updated_at
     FROM staff
     WHERE type = ?
     ORDER BY title ASC, name ASC, id DESC`,
    [type]
  );
}

export async function getStaffById(id) {
  const rows = await query(
    `SELECT id, image_url, name, title, type, created_at, updated_at
     FROM staff
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export function createStaff(data) {
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

    for (const record of records) {
      const [result] = await conn.execute(
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

export function updateStaff(id, data) {
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

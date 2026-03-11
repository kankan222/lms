import { execute, query } from "../../core/db/query.js";

export function listStaff() {
  return query(`
    SELECT id, image_url, name, title, type, created_at, updated_at
    FROM staff
    ORDER BY type ASC, title ASC, name ASC, id DESC
  `);
}

export function listStaffByCampus(type) {
  return query(
    `SELECT id, image_url, name, title, type, created_at, updated_at
     FROM staff
     WHERE type = ?
     ORDER BY title ASC, name ASC, id DESC`,
    [type],
  );
}

export function getStaffById(id) {
  return query(
    `SELECT id, image_url, name, title, type, created_at, updated_at
     FROM staff
     WHERE id = ?`,
    [id],
  );
}

export function createStaff(data) {
  return execute(
    `INSERT INTO staff (image_url, name, title, type)
     VALUES (?, ?, ?, ?)`,
    [data.image_url ?? null, data.name, data.title, data.type],
  );
}

export function updateStaff(id, data) {
  return execute(
    `UPDATE staff
     SET image_url = ?,
         name = ?,
         title = ?,
         type = ?
     WHERE id = ?`,
    [data.image_url ?? null, data.name, data.title, data.type, id],
  );
}

export function deleteStaff(id) {
  return execute(`DELETE FROM staff WHERE id = ?`, [id]);
}

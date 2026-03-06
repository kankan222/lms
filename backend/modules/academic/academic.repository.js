import { query } from "../../core/db/query.js";
import { pool } from "../../database/pool.js";
export async function createSession(data) {
  const sql = `
    INSERT INTO academic_sessions
    (name, start_date, end_date, is_active)
    VALUES (?, ?, ?, ?)
  `;

  return query(sql, [
    data.name,
    data.startDate,
    data.endDate,
    data.isActive || false,
  ]);
}

export async function getSessions() {
  return query(`
    SELECT * FROM academic_sessions
    ORDER BY start_date DESC
  `);
}
export async function deactivateAllSessions() {
  return query(`UPDATE academic_sessions SET is_active=false`);
}
// CLASSES 7 SECTIONS
export async function getClasses() {
  return query(`
  SELECT
  c.id,
  c.name,
  IFNULL(GROUP_CONCAT(DISTINCT sec.name ORDER BY sec.name), '') AS sections,
  IFNULL(GROUP_CONCAT(DISTINCT sub.name ORDER BY sub.name), '') AS subjects
FROM classes c
LEFT JOIN sections sec ON sec.class_id = c.id
LEFT JOIN class_subjects cs ON cs.class_id = c.id
LEFT JOIN subjects sub ON sub.id = cs.subject_id
WHERE c.is_active = TRUE
GROUP BY c.id
ORDER BY c.id
  `);
}
export async function createClass(name, sections) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO classes (name, is_active) VALUES (?, TRUE)`,
      [name]
    );

    const classId = result.insertId;
    console.log("Repo", classId);

    for (const sec of sections) {
      await conn.query(
        `INSERT INTO sections (class_id, name) VALUES (?, ?)`,
        [classId, sec]
      );
    }

    await conn.commit();
    return { id: classId };

  } catch (err) {
    await conn.rollback();
    throw err;

  } finally {
    conn.release();
  }
}
export async function updateClass(id, name, sections) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(`UPDATE classes SET name=? WHERE id=?`, [name, id]);

    await conn.query(`DELETE FROM sections WHERE class_id=?`, [id]);

    for (const sec of sections) {
      await conn.query(
        `INSERT INTO sections (class_id, name) VALUES (?, ?)`,
        [id, sec]
      );
    }

    await conn.commit();

  } catch (err) {
    await conn.rollback();
    throw err;

  } finally {
    conn.release();
  }
}
export async function deleteClass(id) {
  return query(`UPDATE classes SET is_active = FALSE WHERE id=?`, [id]);
}

export async function createSubject(data) {
  const sql = `
    INSERT INTO subjects (name, code)
    VALUES (?, ?)
  `;

  return query(sql, [data.name, data.code]);
}

export async function getSubjects() {
  return query(`SELECT * FROM subjects`);
}

export async function countSections(classId) {
  const rows = await query(
    `SELECT COUNT(*) as total
     FROM sections
     WHERE class_id=?`,
    [classId],
  );

  return rows[0].total;
}

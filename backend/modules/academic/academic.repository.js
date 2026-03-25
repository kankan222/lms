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

export async function updateSession(id, data) {
  return query(
    `UPDATE academic_sessions
     SET name = ?, start_date = ?, end_date = ?, is_active = ?
     WHERE id = ?`,
    [data.name, data.startDate, data.endDate, data.isActive || false, id]
  );
}

export async function deleteSession(id) {
  return query(`DELETE FROM academic_sessions WHERE id = ?`, [id]);
}

export async function getStreams() {
  return query(`
    SELECT id, name
    FROM streams
    ORDER BY name ASC, id ASC
  `);
}

export async function createStream(name) {
  return query(
    `INSERT INTO streams (name)
     VALUES (?)`,
    [name]
  );
}

export async function updateStream(id, name) {
  return query(
    `UPDATE streams
     SET name = ?
     WHERE id = ?`,
    [name, id]
  );
}

export async function deleteStream(id) {
  return query(`DELETE FROM streams WHERE id = ?`, [id]);
}
// CLASSES 7 SECTIONS
export async function getClasses() {
  return query(`
  SELECT
  c.id,
  c.name,
  c.class_scope,
  c.medium,
  IFNULL(GROUP_CONCAT(DISTINCT sec.name ORDER BY sec.name), '') AS sections,
  IFNULL(GROUP_CONCAT(DISTINCT CONCAT(sec.name, ':', sec.medium) ORDER BY sec.name), '') AS section_mediums,
  IFNULL(GROUP_CONCAT(DISTINCT sub.name ORDER BY sub.name), '') AS subjects
FROM classes c
LEFT JOIN sections sec ON sec.class_id = c.id
LEFT JOIN class_subjects cs ON cs.class_id = c.id
LEFT JOIN subjects sub ON sub.id = cs.subject_id
WHERE c.is_active = TRUE
GROUP BY c.id, c.name, c.class_scope, c.medium
ORDER BY c.id
  `);
}
export async function getClassStructure() {
  return query(`
    SELECT
      c.id AS class_id,
      c.name AS class_name,
      c.class_scope AS class_scope,
      c.medium AS class_medium,
      s.id AS section_id,
      s.name AS section_name,
      s.medium AS section_medium,
      sub.id AS subject_id,
      sub.name AS subject_name
    FROM classes c
    LEFT JOIN sections s ON s.class_id = c.id
    LEFT JOIN class_subjects cs ON cs.class_id = c.id
    LEFT JOIN subjects sub ON sub.id = cs.subject_id
    WHERE c.is_active = TRUE
    ORDER BY c.id
  `);
}
export async function createClass(name, classScope, sections = []) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const mediumValue = Array.isArray(sections)
      ? [...new Set(sections.map((s) => String(s?.medium || "").trim()).filter(Boolean))].join(",")
      : "";
    if (!mediumValue.trim()) {
      throw new Error("Each section must have a medium");
    }
    const [result] = await conn.query(
      `INSERT INTO classes (name, class_scope, medium, is_active) VALUES (?, ?, ?, TRUE)`,
      [name, classScope, mediumValue]
    );

    const classId = result.insertId;

    for (const sec of sections) {
      await conn.query(
        `INSERT INTO sections (class_id, name, medium) VALUES (?, ?, ?)`,
        [classId, sec.name, sec.medium]
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
export async function updateClass(id, name, classScope, sections = []) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const mediumValue = Array.isArray(sections)
      ? [...new Set(sections.map((s) => String(s?.medium || "").trim()).filter(Boolean))].join(",")
      : "";
    if (!mediumValue.trim()) {
      throw new Error("Each section must have a medium");
    }
    await conn.query(
      `UPDATE classes SET name=?, class_scope=?, medium=? WHERE id=?`,
      [name, classScope, mediumValue, id]
    );

    // Non-destructive section sync:
    // keep existing sections (they may be referenced by enrollments/exams/assignments)
    // and insert only new section names.
    const [existingSections] = await conn.query(
      `SELECT id, name, medium FROM sections WHERE class_id=?`,
      [id]
    );
    const existingByName = new Map(
      existingSections.map((s) => [
        String(s.name || "").trim().toLowerCase(),
        { id: s.id, medium: s.medium },
      ])
    );

    const normalizedIncoming = (sections || [])
      .map((s) => ({
        name: String(s?.name || "").trim(),
        medium: String(s?.medium || "").trim(),
      }))
      .filter((s) => s.name && s.medium);

    for (const sec of normalizedIncoming) {
      const key = sec.name.toLowerCase();
      const existing = existingByName.get(key);
      if (!existing) {
        await conn.query(
          `INSERT INTO sections (class_id, name, medium) VALUES (?, ?, ?)`,
          [id, sec.name, sec.medium]
        );
      } else if (String(existing.medium || "") !== sec.medium) {
        await conn.query(
          `UPDATE sections SET medium=? WHERE id=?`,
          [sec.medium, existing.id]
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

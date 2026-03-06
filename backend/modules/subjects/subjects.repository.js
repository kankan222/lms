import { query } from "../../core/db/query.js";
import { pool } from "../../database/pool.js";
// CREATE SUBJECT
export async function createSubject(name, code) {
  const sql = `
    INSERT INTO subjects (name, code)
    VALUES (?, ?)
  `;

  const result = await query(sql, [name, code]);

  return { id: result.insertId };
}

// GET ALL SUBJECTS
export async function getSubjects() {
  return query(`
    SELECT
      id,
      name,
      code
    FROM subjects
    WHERE is_active = TRUE
    ORDER BY name
  `);
}

// UPDATE SUBJECT
export async function updateSubject(id, name, code) {
  return query(
    `UPDATE subjects
     SET name = ?, code = ?
     WHERE id = ?`,
    [name, code, id],
  );
}

// DELETE SUBJECT
export async function deleteSubject(id) {
  return query(`UPDATE subjects
     SET is_active = FALSE
     WHERE id = ?`, [id]);
}

export async function assignSubjects(classId, subjectIds) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(`DELETE FROM class_subjects WHERE class_id = ?`, [
      classId,
    ]);

    for (const subjectId of subjectIds) {
      await conn.query(
        `INSERT INTO class_subjects (class_id, subject_id)
         VALUES (?, ?)`,
        [classId, subjectId],
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
export async function getClassSubjects(classId) {
  return query(
    `SELECT
        s.id,
        s.name,
        s.code
     FROM class_subjects cs
     JOIN subjects s ON s.id = cs.subject_id
     WHERE cs.class_id = ?
     ORDER BY s.name`,
    [classId],
  );
}

export async function getSubjectsByTeacher(conn, teacherId) {
  const [rows] = await conn.execute(
    `
    SELECT DISTINCT s.id, s.name
    FROM teacher_class_assignments tca
    JOIN subjects s ON s.id = tca.subject_id
    WHERE tca.teacher_id = ?
  `,
    [teacherId],
  );

  return rows;
}

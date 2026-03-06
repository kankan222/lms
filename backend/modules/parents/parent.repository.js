import { query } from "../../core/db/query.js";

export async function createParent(data, conn) {
  const sql = `
    INSERT INTO parents (name, phone, email, address)
    VALUES (?, ?, ?, ?)
  `;

  const [result] = await conn.execute(sql, [
    data.name,
    data.phone,
    data.email,
    data.address
  ]);

  return result.insertId;
}

export async function linkParentStudent(data, conn) {

  const sql = `
    INSERT INTO parent_students
    (parent_id, student_id, relationship)
    VALUES (?, ?, ?)
  `;

  await conn.execute(sql, [
    data.parentId,
    data.studentId,
    data.relationship
  ]);
}

export function getParents() {

  return query(`
    SELECT
      p.id,
      p.name,
      s.id AS student_id,
      s.first_name,
      s.last_name,
      ps.relationship
    FROM parents p
    LEFT JOIN parent_students ps
      ON ps.parent_id = p.id
    LEFT JOIN students s
      ON s.id = ps.student_id
  `);
}
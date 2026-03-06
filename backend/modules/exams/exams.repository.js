import { query } from "../../core/db/query.js";

export async function createExam(data, conn){
  const [result] = await conn.execute(
    `INSERT INTO exams (name, session_id)
     VALUES (?, ?)`,
    [data.name, data.sessionId]
  );

  return result.insertId;
}

export async function getExam(sessionId) {
  return query(`
    SELECT id, name
    FROM exams
    WHERE session_id=?
    ORDER BY id DESC
  `,[sessionId]);
}
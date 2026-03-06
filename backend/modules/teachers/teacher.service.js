import { pool } from "../../database/pool.js";
import * as repo from "./teacher.repository.js";
import AppError from "../../core/errors/AppError.js";
import { query } from "../../core/db/query.js";

export async function createTeacher(data) {

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const teacherId =
      await repo.createTeacher(data, conn);

    await conn.commit();

    return { teacherId };

  } catch (err) {
    await conn.rollback();
     console.error("TEACHER CREATE ERROR:", err);

  throw err; // TEMP DEBUG
  } finally {
    conn.release();
  }
}

export async function getTeachers(){
  return repo.getTeachers();
}

export async function updateTeacher(id,data){
  return repo.updateTeacher(id,data);
}

export async function deleteTeacher(id){
  return repo.deleteTeacher(id);
}
export async function assignTeacher(data) {

  const conn = await pool.getConnection();

  try {

    await conn.beginTransaction();

    // allow assignment only in active session
    const session = await query(`
      SELECT id FROM academic_sessions
      WHERE id=? AND is_active=true
    `, [data.sessionId]);

    if (!session.length)
      throw new AppError("Session not active", 400);

    await repo.assignTeacher(data, conn);

    await conn.commit();

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

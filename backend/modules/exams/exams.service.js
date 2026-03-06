import { pool } from "../../database/pool.js";
import * as repo from "./exams.repository.js";
import AppError from "../../core/errors/AppError.js";

export async function createExam(data){

  const conn = await pool.getConnection();

  try{
    await conn.beginTransaction();

    if(!data || !data.name)
      throw new AppError("Exam name required",400);

    const [session] = await conn.execute(`
      SELECT id FROM academic_sessions
      WHERE is_active=true
      LIMIT 1
    `);

    if(!session.length)
      throw new AppError("No active session",400);

    const examId =
      await repo.createExam({
        name:data.name,
        sessionId:session[0].id
      },conn);

    await conn.commit();

    return { examId };

  }catch(err){
    await conn.rollback();
    throw err;
  }finally{
    conn.release();
  }
}


export function getExam(sessionId){
  return repo.getExam(sessionId);
}
import { pool } from "../../database/pool.js";
import * as repo from "./subjects.repository.js";
import AppError from "../../core/errors/AppError.js";

export async function createSubject(data) {
  if (!data.name) {
    throw new Error("Subject name required");
  }

  return repo.createSubject(data.name, data.code);
}

export async function getSubjects() {
  return repo.getSubjects();
}

export async function updateSubject(id, data) {
  if (!data.name) {
    throw new Error("Subject name required");
  }

  return repo.updateSubject(id, data.name, data.code);
}

export async function deleteSubject(id) {
  return repo.deleteSubject(id);
}



export async function assignSubjects(classId, subjectIds) {

  if (!Array.isArray(subjectIds)) {
    throw new Error("subjectIds must be an array");
  }

  return repo.assignSubjects(classId, subjectIds);
}
export async function getClassSubjects(classId) {

  const conn = await pool.getConnection();

  try {
    console.log("I am service", classId)
    return await repo.getSubjectsByClass(conn, classId);
  } finally {
    conn.release();
  }
}

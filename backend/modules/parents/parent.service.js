import { pool } from "../../database/pool.js";
import * as repo from "./parent.repository.js";
import AppError from "../../core/errors/AppError.js";

export async function createParent(data) {

  const conn = await pool.getConnection();

  try {

    await conn.beginTransaction();

    const parentId =
      await repo.createParent(data, conn);

    for (const child of data.children) {
      await repo.linkParentStudent({
        parentId,
        studentId: child.studentId,
        relationship: child.relationship
      }, conn);
    }

    await conn.commit();

    return { parentId };

  } catch (err) {

    await conn.rollback();
    throw new AppError("Parent creation failed");

  } finally {
    conn.release();
  }
}

export function getParents() {
  return repo.getParents();
}
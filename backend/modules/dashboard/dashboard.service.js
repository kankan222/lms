import { pool } from "../../database/pool.js";
import * as repo from "./dashboard.repository.js";

export async function parentDashboard(parentId){

  const conn = await pool.getConnection();

  try{

    const children =
      await repo.getChildren(conn,parentId);

    const result = [];

    for(const child of children){

      const attendance =
        await repo.getAttendanceSummary(conn,child.id);

      const results =
        await repo.getResultSummary(conn,child.id);

      const fees =
        await repo.getFeeStatus(conn,child.id);

      result.push({
        student: child,
        attendance,
        results,
        fees
      });
    }

    return result;

  }finally{
    conn.release();
  }
}
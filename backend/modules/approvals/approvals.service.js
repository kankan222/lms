import { pool } from "../../database/pool.js";
import * as repo from "./approvals.repository.js";
import AppError from "../../core/errors/AppError.js";
import { query } from "../../core/db/query.js";

export async function getPendingApprovals(){

  const conn = await pool.getConnection();

  try{
    return await repo.getPending(conn);
  }finally{
    conn.release();
  }
}

export async function reviewApproval(data,userId){

  const conn = await pool.getConnection();

  try{
    await conn.beginTransaction();

    if(!["approved","rejected"].includes(data.status))
      throw new AppError("Invalid status",400);

    // update approval
    await repo.updateApproval(conn,{
      approvalId:data.approvalId,
      status:data.status,
      approvedBy:userId,
      remarks:data.remarks || null
    });

    // update marks
    await repo.updateMarksStatus(conn,{
      examId:data.examId,
      status:data.status
    });

    await conn.commit();

    return { reviewed:true };

  }catch(err){
    await conn.rollback();
    throw err;
  }finally{
    conn.release();
  }
}
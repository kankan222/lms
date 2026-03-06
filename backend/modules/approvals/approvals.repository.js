import { query } from "../../core/db/query.js";
export async function createApproval(conn,data){

  await conn.execute(`
    INSERT INTO approvals
    (entity_type, entity_id, submitted_by)
    VALUES (?,?,?)
  `,[
    data.entityType,
    data.entityId,
    data.submittedBy
  ]);
}

export async function getPending(conn){
  const [rows] = await conn.execute(`
    SELECT *
    FROM approvals
    WHERE status='pending'
    ORDER BY id DESC
  `);

  return rows;
}

export async function updateApproval(conn,data){

  await conn.execute(`
    UPDATE approvals
    SET status=?,
        approved_by=?,
        approved_at=NOW(),
        remarks=?
    WHERE id=?
  `,[
    data.status,
    data.approvedBy,
    data.remarks,
    data.approvalId
  ]);
}

export async function updateMarksStatus(conn,data){

  await conn.execute(`
    UPDATE marks_entries
    SET approval_status=?
    WHERE exam_id=?
  `,[
    data.status,
    data.examId
  ]);
}
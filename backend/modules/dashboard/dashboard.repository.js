export async function getChildren(conn, parentUserId) {

  const [rows] = await conn.execute(`
    SELECT s.id, s.first_name, s.last_name
    FROM parent_students ps
    JOIN parents p ON p.id = ps.parent_id
    JOIN students s ON s.id = ps.student_id
    WHERE p.id = ?
  `,[parentUserId]);

  return rows;
}

export async function getAttendanceSummary(conn, studentId){

  const [rows] = await conn.execute(`
    SELECT status, COUNT(*) as total
    FROM student_attendance
    WHERE student_id=?
    GROUP BY status
  `,[studentId]);

  return rows;
}


export async function getResultSummary(conn, studentId){

  const [rows] = await conn.execute(`
    SELECT
      e.name,
      AVG(me.marks) as average
    FROM marks_entries me
    JOIN exams e ON e.id = me.exam_id
    WHERE me.student_id=?
      AND approval_status='approved'
    GROUP BY e.id
  `,[studentId]);

  return rows;
}

export async function getFeeStatus(conn, studentId){

  const [rows] = await conn.execute(`
    SELECT status, total_amount
    FROM invoices
    WHERE student_id=?
    ORDER BY id DESC
    LIMIT 1
  `,[studentId]);

  return rows[0];
}
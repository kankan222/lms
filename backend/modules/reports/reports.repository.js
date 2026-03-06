export async function getStudentMarks(conn,data){

  const [rows] = await conn.execute(`
    SELECT
      s.id AS student_id,
      s.first_name,
      s.last_name,
      sub.name AS subject,
      me.marks,
      e.name AS exam
    FROM marks_entries me

    JOIN students s
      ON s.id = me.student_id

    JOIN subjects sub
      ON sub.id = me.subject_id

    JOIN exams e
      ON e.id = me.exam_id

    WHERE me.student_id=?
      AND me.exam_id=?
      AND me.approval_status='approved'
  `,[data.studentId,data.examId]);

  console.log(rows)
  return rows;
}
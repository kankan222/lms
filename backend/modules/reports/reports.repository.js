export async function getStudentMarks(conn,data){

  const [rows] = await conn.execute(`
    SELECT
      s.id AS student_id,
      s.name AS student_name,
      e.id AS exam_id,
      e.name AS exam_name,
      c.name AS class_name,
      c.class_scope,
      sec.name AS section_name,
      sec.medium,
      se.roll_number,
      sub.name AS subject_name,
      es.max_marks,
      es.pass_marks,
      me.marks,
      me.approval_status
    FROM marks_entries me
    JOIN students s
      ON s.id = me.student_id
    JOIN exams e
      ON e.id = me.exam_id
    JOIN student_enrollments se
      ON se.student_id = s.id
     AND se.session_id = e.session_id
     AND se.status = 'active'
    JOIN exam_scopes sc
      ON sc.exam_id = e.id
     AND sc.class_id = se.class_id
     AND sc.section_id = se.section_id
    JOIN classes c
      ON c.id = sc.class_id
    JOIN sections sec
      ON sec.id = sc.section_id
    JOIN exam_subjects es
      ON es.exam_id = e.id
     AND es.subject_id = me.subject_id
    JOIN subjects sub
      ON sub.id = me.subject_id
    WHERE me.student_id = ?
      AND me.exam_id = ?
      AND me.approval_status = 'approved'
    ORDER BY sub.name ASC
  `,[data.studentId,data.examId]);
  return rows;
}

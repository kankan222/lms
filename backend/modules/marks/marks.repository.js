export async function getExam(conn, examId){
  const [rows] = await conn.execute(`
    SELECT e.id, e.session_id
    FROM exams e
    JOIN academic_sessions s
      ON s.id = e.session_id
    WHERE e.id=? AND s.is_active=true
  `,[examId]);

  return rows[0];
}

export function checkTeacherSubject(conn, data) {
  return conn.execute(`
    SELECT id
    FROM teacher_class_assignments
    WHERE teacher_id=?
      AND class_id=?
      AND section_id=?
      AND subject_id=?
      AND session_id=?
  `, [
    data.teacherId,
    data.classId,
    data.sectionId,
    data.subjectId,
    data.sessionId
  ]);
}

export async function getEnrolledStudents(conn,data){
  const [rows] = await conn.execute(`
    SELECT student_id
    FROM student_enrollments
    WHERE class_id=?
      AND section_id=?
      AND session_id=?
      AND status='active'
  `,[
    data.classId,
    data.sectionId,
    data.sessionId
  ]);

  return rows;
}

export async function marksExist(conn,data){
  const [rows] = await conn.execute(`
    SELECT id
    FROM marks_entries
    WHERE exam_id=?
      AND subject_id=?
    LIMIT 1
  `,[data.examId,data.subjectId]);

  return rows.length > 0;
}

export async function insertMarks(rows, conn) {
  if(!Array.isArray(rows))
    throw new Error("Insert Marks expects array")
  
  const values = rows.map(r => [
    r.studentId,
    r.examId,
    r.subjectId,
    r.marks,
    r.enteredBy
  ]);

  await conn.query(`
    INSERT INTO marks_entries
    (student_id, exam_id, subject_id, marks, entered_by)
    VALUES ?
  `,[values]);
}

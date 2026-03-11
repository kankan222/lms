import { query } from "../../core/db/query.js";

export async function getTeacherProfileByUser(userId) {
  const rows = await query(`SELECT id FROM teachers WHERE user_id = ? LIMIT 1`, [userId]);
  return rows[0] || null;
}

export async function getParentProfileByUser(userId) {
  const rows = await query(`SELECT id FROM parents WHERE user_id = ? LIMIT 1`, [userId]);
  return rows[0] || null;
}

export async function isParentOfStudent(userId, studentId) {
  const rows = await query(
    `SELECT 1
     FROM parents p
     JOIN student_parents sp ON sp.parent_id = p.id
     WHERE p.user_id = ? AND sp.student_id = ?
     LIMIT 1`,
    [userId, studentId]
  );
  return rows.length > 0;
}

export async function getActiveSessionId(conn) {
  const [rows] = await conn.execute(
    `SELECT id
     FROM academic_sessions
     WHERE is_active = TRUE
     ORDER BY id DESC
     LIMIT 1`
  );
  return rows[0]?.id || null;
}

export async function createExam(conn, data) {
  const [result] = await conn.execute(
    `INSERT INTO exams (name, session_id, class_id, section_id, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [data.name, data.session_id, data.class_id ?? null, data.section_id ?? null, data.created_by]
  );
  return result.insertId;
}

export async function updateExam(conn, id, data) {
  await conn.execute(
    `UPDATE exams
     SET name = ?, session_id = ?, class_id = ?, section_id = ?
     WHERE id = ?`,
    [data.name, data.session_id, data.class_id ?? null, data.section_id ?? null, id]
  );
}

export async function deleteExam(conn, id) {
  await conn.execute(`DELETE FROM exams WHERE id = ?`, [id]);
}

export async function replaceExamScopes(conn, examId, scopes) {
  await conn.execute(`DELETE FROM exam_scopes WHERE exam_id = ?`, [examId]);
  if (!scopes.length) return;

  const values = scopes.map((s) => [examId, s.class_id, s.section_id]);
  await conn.query(
    `INSERT INTO exam_scopes (exam_id, class_id, section_id)
     VALUES ?`,
    [values]
  );
}

export async function getExamScopes(examId) {
  return query(
    `SELECT
      es.id,
      es.exam_id,
      es.class_id,
      es.section_id,
      c.name AS class_name,
      s.name AS section_name
     FROM exam_scopes es
     JOIN classes c ON c.id = es.class_id
     JOIN sections s ON s.id = es.section_id
     WHERE es.exam_id = ?
     ORDER BY c.name, s.name`,
    [examId]
  );
}

export async function getExamById(id) {
  const rows = await query(
    `SELECT
      e.id,
      e.name,
      e.session_id,
      e.class_id,
      e.section_id,
      e.created_by,
      ses.name AS session_name
     FROM exams e
     LEFT JOIN academic_sessions ses ON ses.id = e.session_id
     WHERE e.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function listExams(filters, userId, isTeacher) {
  const where = [];
  const params = [];
  let join = `
    LEFT JOIN exam_scopes sc ON sc.exam_id = e.id
    LEFT JOIN classes c ON c.id = sc.class_id
    LEFT JOIN sections sec ON sec.id = sc.section_id
  `;

  if (isTeacher) {
    join += `
      JOIN teachers t ON t.user_id = ?
      JOIN teacher_class_assignments tca
        ON tca.teacher_id = t.id
       AND tca.session_id = e.session_id
       AND tca.class_id = sc.class_id
       AND tca.section_id = sc.section_id
    `;
    params.push(userId);
  }

  if (filters.session_id) {
    where.push("e.session_id = ?");
    params.push(Number(filters.session_id));
  }
  if (filters.class_id) {
    where.push("sc.class_id = ?");
    params.push(Number(filters.class_id));
  }
  if (filters.section_id) {
    where.push("sc.section_id = ?");
    params.push(Number(filters.section_id));
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  return query(
    `SELECT DISTINCT
      e.id,
      e.name,
      e.session_id,
      ses.name AS session_name
     FROM exams e
     ${join}
     LEFT JOIN academic_sessions ses ON ses.id = e.session_id
     ${whereSql}
     ORDER BY e.id DESC`,
    params
  );
}

export async function getExamSubjects(examId) {
  return query(
    `SELECT
      es.id,
      es.exam_id,
      es.subject_id,
      es.max_marks,
      es.pass_marks,
      sub.name AS subject_name
     FROM exam_subjects es
     JOIN subjects sub ON sub.id = es.subject_id
     WHERE es.exam_id = ?
     ORDER BY sub.name ASC`,
    [examId]
  );
}

export async function replaceExamSubjects(conn, examId, subjects) {
  await conn.execute(`DELETE FROM exam_subjects WHERE exam_id = ?`, [examId]);
  if (!subjects.length) return;

  const values = subjects.map((s) => [examId, s.subject_id, s.max_marks, s.pass_marks]);
  await conn.query(
    `INSERT INTO exam_subjects (exam_id, subject_id, max_marks, pass_marks)
     VALUES ?`,
    [values]
  );
}

export async function isTeacherAssignedToExamScope(userId, examId, classId, sectionId, subjectId = null) {
  const params = [userId, examId, classId, sectionId];
  let subjectClause = "";
  if (subjectId) {
    subjectClause = `AND tca.subject_id = ?`;
    params.push(subjectId);
  }

  const rows = await query(
    `SELECT 1
     FROM exams e
     JOIN teachers t ON t.user_id = ?
     JOIN exam_scopes sc
       ON sc.exam_id = e.id
      AND sc.class_id = ?
      AND sc.section_id = ?
     JOIN teacher_class_assignments tca
       ON tca.teacher_id = t.id
      AND tca.session_id = e.session_id
      AND tca.class_id = sc.class_id
      AND tca.section_id = sc.section_id
      ${subjectClause}
     WHERE e.id = ?
     LIMIT 1`,
    subjectId
      ? [userId, classId, sectionId, subjectId, examId]
      : [userId, classId, sectionId, examId]
  );

  return rows.length > 0;
}

export async function getAllowedTeacherScopes(userId, examId) {
  return query(
    `SELECT DISTINCT
      sc.class_id,
      sc.section_id,
      c.name AS class_name,
      s.name AS section_name
     FROM exam_scopes sc
     JOIN exams e ON e.id = sc.exam_id
     JOIN teachers t ON t.user_id = ?
     JOIN teacher_class_assignments tca
       ON tca.teacher_id = t.id
      AND tca.session_id = e.session_id
      AND tca.class_id = sc.class_id
      AND tca.section_id = sc.section_id
     JOIN classes c ON c.id = sc.class_id
     JOIN sections s ON s.id = sc.section_id
     WHERE sc.exam_id = ?
     ORDER BY c.name, s.name`,
    [userId, examId]
  );
}

export async function getStudentsForScope(examId, classId, sectionId, name = "") {
  const params = [examId, classId, sectionId];
  const nameSql = name ? `AND st.name LIKE ?` : "";
  if (name) params.push(`%${name}%`);

  return query(
    `SELECT
      st.id AS student_id,
      st.name AS student_name,
      se.roll_number
     FROM exams e
     JOIN exam_scopes sc
       ON sc.exam_id = e.id
      AND sc.class_id = ?
      AND sc.section_id = ?
     JOIN student_enrollments se
       ON se.class_id = sc.class_id
      AND se.section_id = sc.section_id
      AND se.session_id = e.session_id
      AND se.status = 'active'
     JOIN students st ON st.id = se.student_id
     WHERE e.id = ?
       ${nameSql}
     ORDER BY se.roll_number ASC, st.name ASC`,
    name ? [classId, sectionId, examId, `%${name}%`] : [classId, sectionId, examId]
  );
}

export async function getMarksGrid(examId, classId, sectionId, name = "") {
  const students = await getStudentsForScope(examId, classId, sectionId, name);
  const subjects = await getExamSubjects(examId);
  if (!students.length || !subjects.length) {
    return { students, subjects, marks: [] };
  }

  const studentIds = students.map((s) => s.student_id);
  const placeholders = studentIds.map(() => "?").join(",");

  const marks = await query(
    `SELECT
      id AS mark_id,
      student_id,
      subject_id,
      marks,
      approval_status
     FROM marks_entries
     WHERE exam_id = ?
       AND student_id IN (${placeholders})`,
    [examId, ...studentIds]
  );

  return { students, subjects, marks };
}

export async function getExamSubject(examId, subjectId) {
  const rows = await query(
    `SELECT id, exam_id, subject_id, max_marks, pass_marks
     FROM exam_subjects
     WHERE exam_id = ? AND subject_id = ?
     LIMIT 1`,
    [examId, subjectId]
  );
  return rows[0] || null;
}

export async function upsertMarks(conn, rows) {
  if (!rows.length) return;
  const values = rows.map((r) => [r.student_id, r.exam_id, r.subject_id, r.marks, r.entered_by]);

  await conn.query(
    `INSERT INTO marks_entries
     (student_id, exam_id, subject_id, marks, entered_by, approval_status, approved_by, approved_at)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       marks = VALUES(marks),
       entered_by = VALUES(entered_by),
       approval_status = 'pending',
       approved_by = NULL,
       approved_at = NULL`,
    [values]
  );
}

export async function getMarkById(markId) {
  const rows = await query(
    `SELECT id, student_id, exam_id, subject_id, marks, entered_by, approval_status
     FROM marks_entries
     WHERE id = ?
     LIMIT 1`,
    [markId]
  );
  return rows[0] || null;
}

export async function getStudentScopeForExam(studentId, examId) {
  const rows = await query(
    `SELECT se.class_id, se.section_id
     FROM exams e
     JOIN student_enrollments se
       ON se.student_id = ?
      AND se.session_id = e.session_id
      AND se.status = 'active'
     JOIN exam_scopes sc
       ON sc.exam_id = e.id
      AND sc.class_id = se.class_id
      AND sc.section_id = se.section_id
     WHERE e.id = ?
     LIMIT 1`,
    [studentId, examId]
  );
  return rows[0] || null;
}

export async function updateMarkById(conn, markId, marks, enteredBy) {
  await conn.execute(
    `UPDATE marks_entries
     SET marks = ?,
         entered_by = ?,
         approval_status = 'pending',
         approved_by = NULL,
         approved_at = NULL
     WHERE id = ?`,
    [marks, enteredBy, markId]
  );
}

export async function deleteMarkById(conn, markId) {
  await conn.execute(`DELETE FROM marks_entries WHERE id = ?`, [markId]);
}

export async function approveMarksByExamSubjectScope(conn, examId, subjectId, classId, sectionId, status, approvedBy) {
  const [result] = await conn.execute(
    `UPDATE marks_entries me
     JOIN student_enrollments se
       ON se.student_id = me.student_id
     JOIN exams e
       ON e.id = me.exam_id
      AND e.session_id = se.session_id
     SET me.approval_status = ?,
         me.approved_by = ?,
         me.approved_at = NOW()
     WHERE me.exam_id = ?
       AND me.subject_id = ?
       AND se.class_id = ?
       AND se.section_id = ?
       AND se.status = 'active'
       AND me.approval_status = 'pending'`,
    [status, approvedBy, examId, subjectId, classId, sectionId]
  );
  return result.affectedRows;
}

export async function getStudentReportRows(examId, studentId, onlyApproved = true) {
  const approvalClause = onlyApproved ? `AND me.approval_status = 'approved'` : "";
  return query(
    `SELECT
      st.id AS student_id,
      st.name AS student_name,
      e.id AS exam_id,
      e.name AS exam_name,
      c.name AS class_name,
      sec.name AS section_name,
      se.roll_number,
      sub.name AS subject_name,
      es.max_marks,
      es.pass_marks,
      me.marks,
      me.approval_status
     FROM exams e
     JOIN student_enrollments se
       ON se.student_id = ?
      AND se.session_id = e.session_id
      AND se.status = 'active'
     JOIN exam_scopes sc
       ON sc.exam_id = e.id
      AND sc.class_id = se.class_id
      AND sc.section_id = se.section_id
     JOIN students st ON st.id = se.student_id
     JOIN classes c ON c.id = sc.class_id
     JOIN sections sec ON sec.id = sc.section_id
     JOIN exam_subjects es ON es.exam_id = e.id
     JOIN subjects sub ON sub.id = es.subject_id
     LEFT JOIN marks_entries me
       ON me.exam_id = e.id
      AND me.subject_id = es.subject_id
      AND me.student_id = st.id
     WHERE e.id = ?
       ${approvalClause}
     ORDER BY sub.name ASC`,
    [studentId, examId]
  );
}

export async function getUserRoleNames(userId) {
  const rows = await query(
    `SELECT r.name
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = ?`,
    [userId]
  );
  return rows.map((r) => r.name);
}

import { query } from "../../core/db/query.js";

export async function getUserRoleNames(userId) {
  const rows = await query(
    `SELECT r.name
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = ?`,
    [userId]
  );
  return rows.map((row) => row.name);
}

export async function getTeacherProfileByUser(userId) {
  const rows = await query(`SELECT id FROM teachers WHERE user_id = ? LIMIT 1`, [userId]);
  return rows[0] || null;
}

export async function getParentStudentIds(userId) {
  const rows = await query(
    `SELECT DISTINCT sp.student_id
     FROM parents p
     JOIN student_parents sp ON sp.parent_id = p.id
     WHERE p.user_id = ?`,
    [userId]
  );
  return rows.map((row) => Number(row.student_id));
}

export async function getStudentsByIds(studentIds) {
  if (!studentIds.length) return [];

  const placeholders = studentIds.map(() => "?").join(",");
  return query(
    `SELECT
      s.id,
      s.name,
      se.roll_number,
      c.name AS class_name,
      sec.name AS section_name
     FROM students s
     LEFT JOIN student_enrollments se
       ON se.student_id = s.id
      AND se.status = 'active'
     LEFT JOIN classes c ON c.id = se.class_id
     LEFT JOIN sections sec ON sec.id = se.section_id
     WHERE s.id IN (${placeholders})
     ORDER BY s.name ASC`,
    studentIds
  );
}

export async function getStudentProfileByUser(userId) {
  const rows = await query(
    `SELECT s.id
     FROM users u
     JOIN students s ON s.mobile = u.phone
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

export async function getExamById(examId) {
  const rows = await query(
    `SELECT
      e.id,
      e.name,
      e.session_id,
      ses.name AS session_name
     FROM exams e
     LEFT JOIN academic_sessions ses ON ses.id = e.session_id
     WHERE e.id = ?
     LIMIT 1`,
    [examId]
  );
  return rows[0] || null;
}

export async function getExamSubject(examId, subjectId) {
  const rows = await query(
    `SELECT
      es.id,
      es.exam_id,
      es.subject_id,
      es.max_marks,
      es.pass_marks,
      sub.name AS subject_name
     FROM exam_subjects es
     JOIN subjects sub ON sub.id = es.subject_id
     WHERE es.exam_id = ? AND es.subject_id = ?
     LIMIT 1`,
    [examId, subjectId]
  );
  return rows[0] || null;
}

export async function isTeacherAssignedToExamScope(userId, examId, classId, sectionId, subjectId = null) {
  const params = subjectId
    ? [userId, classId, sectionId, subjectId, examId]
    : [userId, classId, sectionId, examId];

  const subjectClause = subjectId ? `AND tca.subject_id = ?` : "";

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
    params
  );

  return rows.length > 0;
}

export async function getStudentsForScope({ examId, classId, sectionId, medium, name }) {
  const params = [classId, sectionId, examId];
  const where = [];

  if (medium) {
    where.push("LOWER(sec.medium) = ?");
    params.push(String(medium).trim().toLowerCase());
  }

  if (name) {
    where.push("st.name LIKE ?");
    params.push(`%${String(name).trim()}%`);
  }

  const extraWhere = where.length ? `AND ${where.join(" AND ")}` : "";

  return query(
    `SELECT
      st.id AS student_id,
      st.name AS student_name,
      se.roll_number,
      sec.medium
     FROM exams e
     JOIN exam_scopes sc
       ON sc.exam_id = e.id
      AND sc.class_id = ?
      AND sc.section_id = ?
     JOIN sections sec ON sec.id = sc.section_id
     JOIN student_enrollments se
       ON se.class_id = sc.class_id
      AND se.section_id = sc.section_id
      AND se.session_id = e.session_id
      AND se.status = 'active'
     JOIN students st ON st.id = se.student_id
     WHERE e.id = ?
       ${extraWhere}
     ORDER BY se.roll_number ASC, st.name ASC`,
    params
  );
}

export async function getMarksByExamSubjectStudentIds(examId, subjectId, studentIds) {
  if (!studentIds.length) return [];

  const placeholders = studentIds.map(() => "?").join(",");
  return query(
    `SELECT
      id AS mark_id,
      student_id,
      marks,
      approval_status,
      approved_by,
      approved_at
     FROM marks_entries
     WHERE exam_id = ?
       AND subject_id = ?
       AND student_id IN (${placeholders})`,
    [examId, subjectId, ...studentIds]
  );
}

export async function upsertMarksDraft(conn, rows) {
  if (!rows.length) return;

  const values = rows.map((row) => [
    row.student_id,
    row.exam_id,
    row.subject_id,
    row.marks,
    row.entered_by,
  ]);

  await conn.query(
    `INSERT INTO marks_entries
     (student_id, exam_id, subject_id, marks, entered_by)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       marks = VALUES(marks),
       entered_by = VALUES(entered_by),
       approval_status = 'draft',
       approved_by = NULL,
       approved_at = NULL`,
    [values]
  );
}

export async function updateApprovalStatusBySelection(conn, payload) {
  const params = [];
  const setSql = [];

  setSql.push(`me.approval_status = ?`);
  params.push(payload.nextStatus);

  if (payload.nextStatus === "approved") {
    setSql.push(`me.approved_by = ?`);
    params.push(payload.approvedBy);
    setSql.push(`me.approved_at = NOW()`);
  } else {
    setSql.push(`me.approved_by = NULL`);
    setSql.push(`me.approved_at = NULL`);
  }

  const where = [
    `me.exam_id = ?`,
    `me.subject_id = ?`,
    `se.class_id = ?`,
    `se.section_id = ?`,
    `se.status = 'active'`,
  ];

  params.push(payload.examId, payload.subjectId, payload.classId, payload.sectionId);

  if (payload.medium) {
    where.push(`LOWER(sec.medium) = ?`);
    params.push(String(payload.medium).trim().toLowerCase());
  }

  if (Array.isArray(payload.studentIds) && payload.studentIds.length) {
    where.push(`me.student_id IN (${payload.studentIds.map(() => "?").join(",")})`);
    params.push(...payload.studentIds);
  }

  if (Array.isArray(payload.currentStatuses) && payload.currentStatuses.length) {
    where.push(`me.approval_status IN (${payload.currentStatuses.map(() => "?").join(",")})`);
    params.push(...payload.currentStatuses);
  }

  const [result] = await conn.execute(
    `UPDATE marks_entries me
     JOIN student_enrollments se
       ON se.student_id = me.student_id
     JOIN exams e
       ON e.id = me.exam_id
      AND e.session_id = se.session_id
     JOIN sections sec ON sec.id = se.section_id
     SET ${setSql.join(", ")}
     WHERE ${where.join(" AND ")}`,
    params
  );

  return result.affectedRows;
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

export async function getStudentReportRows(examId, studentId, onlyApproved = true) {
  const approvalClause = onlyApproved ? `AND me.approval_status = 'approved'` : "";

  return query(
    `SELECT
      st.id AS student_id,
      st.name AS student_name,
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

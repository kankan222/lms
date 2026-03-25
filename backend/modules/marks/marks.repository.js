import { query } from "../../core/db/query.js";

export async function supportsMarksDraftStatus() {
  const rows = await query(
    `SELECT COLUMN_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'marks_entries'
       AND COLUMN_NAME = 'approval_status'
     LIMIT 1`
  );

  const columnType = String(rows[0]?.COLUMN_TYPE || "").toLowerCase();
  return columnType.includes("'draft'");
}

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

export async function getExamSubjects(examId) {
  return query(
    `SELECT
      es.subject_id,
      sub.name AS subject_name,
      es.max_marks,
      es.pass_marks
     FROM exam_subjects es
     JOIN subjects sub ON sub.id = es.subject_id
     WHERE es.exam_id = ?
     ORDER BY sub.name ASC`,
    [examId]
  );
}

export async function getExamScopes(examId) {
  return query(
    `SELECT
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

export async function getTeacherAccessibleExams(userId) {
  return query(
    `SELECT DISTINCT
      e.id,
      e.name,
      e.session_id,
      ses.name AS session_name
     FROM teachers t
     JOIN teacher_class_assignments tca
       ON tca.teacher_id = t.id
     JOIN exams e
       ON e.session_id = tca.session_id
     JOIN exam_scopes sc
       ON sc.exam_id = e.id
      AND sc.class_id = tca.class_id
      AND sc.section_id = tca.section_id
     LEFT JOIN academic_sessions ses ON ses.id = e.session_id
     WHERE t.user_id = ?
     ORDER BY e.id DESC`,
    [userId]
  );
}

export async function getOwnedStudentAccessibleExams(studentIds) {
  if (!studentIds.length) return [];

  const placeholders = studentIds.map(() => "?").join(",");
  return query(
    `SELECT DISTINCT
      e.id,
      e.name,
      e.session_id,
      ses.name AS session_name
     FROM exams e
     JOIN student_enrollments se
       ON se.session_id = e.session_id
      AND se.status = 'active'
     JOIN exam_scopes sc
       ON sc.exam_id = e.id
      AND sc.class_id = se.class_id
      AND sc.section_id = se.section_id
     LEFT JOIN academic_sessions ses ON ses.id = e.session_id
     WHERE se.student_id IN (${placeholders})
     ORDER BY e.id DESC`,
    studentIds
  );
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

export async function getPendingApprovalScopes() {
  return query(
    `SELECT
      me.exam_id,
      e.name AS exam_name,
      e.session_id,
      sess.name AS session_name,
      se.class_id,
      c.name AS class_name,
      se.section_id,
      sec.name AS section_name,
      sec.medium,
      me.subject_id,
      sub.name AS subject_name,
      COUNT(*) AS pending_count,
      MAX(me.id) AS latest_entry_id
     FROM marks_entries me
     JOIN exams e ON e.id = me.exam_id
     LEFT JOIN academic_sessions sess ON sess.id = e.session_id
     JOIN student_enrollments se
       ON se.student_id = me.student_id
      AND se.session_id = e.session_id
      AND se.status = 'active'
     JOIN classes c ON c.id = se.class_id
     JOIN sections sec ON sec.id = se.section_id
     JOIN subjects sub ON sub.id = me.subject_id
     WHERE me.approval_status = 'pending'
     GROUP BY
      me.exam_id,
      e.name,
      e.session_id,
      sess.name,
      se.class_id,
      c.name,
      se.section_id,
      sec.name,
      sec.medium,
      me.subject_id,
      sub.name
     ORDER BY latest_entry_id DESC`
  );
}

export async function getApprovalStatusSummary() {
  const rows = await query(
    `SELECT
      SUM(CASE WHEN approval_status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN approval_status = 'draft' THEN 1 ELSE 0 END) AS draft_count,
      SUM(CASE WHEN approval_status = 'approved' THEN 1 ELSE 0 END) AS approved_count
     FROM marks_entries`
  );

  return rows[0] || { pending_count: 0, draft_count: 0, approved_count: 0 };
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
       approval_status = CASE
         WHEN approval_status = 'pending' THEN 'pending'
         WHEN approval_status = 'approved' AND marks = VALUES(marks) THEN 'approved'
         ELSE 'draft'
       END,
       approved_by = CASE
         WHEN approval_status = 'approved' AND marks = VALUES(marks) THEN approved_by
         ELSE NULL
       END,
       approved_at = CASE
         WHEN approval_status = 'approved' AND marks = VALUES(marks) THEN approved_at
         ELSE NULL
       END`,
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

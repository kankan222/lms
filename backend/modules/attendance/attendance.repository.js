import { query } from "../../core/db/query.js";

const STUDENT_ATTENDANCE_ENTITY = "student_attendance_session";
let approvalsTablePromise;

function hasApprovalsTable() {
  if (!approvalsTablePromise) {
    approvalsTablePromise = query(
      `
        SELECT 1
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'approvals'
        LIMIT 1
      `
    ).then((rows) => rows.length > 0);
  }

  return approvalsTablePromise;
}

export function getActiveAcademicSession() {
  return query(
    `
      SELECT id, name, start_date, end_date
      FROM academic_sessions
      WHERE is_active = TRUE
      ORDER BY id DESC
      LIMIT 1
    `
  );
}

export function getAcademicSessionById(id) {
  return query(
    `
      SELECT id, name, start_date, end_date
      FROM academic_sessions
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );
}

export function getTeacherByUserId(userId) {
  return query(
    `
      SELECT id, user_id, name
      FROM teachers
      WHERE user_id = ?
      LIMIT 1
    `,
    [userId]
  );
}

export function checkTeacherAssignment(data) {
  return query(
    `
      SELECT id
      FROM teacher_class_assignments
      WHERE teacher_id = ?
        AND class_id = ?
        AND section_id = ?
        AND session_id = ?
      LIMIT 1
    `,
    [data.teacherId, data.classId, data.sectionId, data.sessionId]
  );
}

export function getEnrolledStudents(data) {
  return query(
    `
      SELECT
        se.student_id,
        se.roll_number,
        s.name AS student_name,
        c.name AS class_name,
        c.class_scope,
        sec.name AS section_name,
        sec.medium,
        sess.name AS session_name
      FROM student_enrollments se
      JOIN students s ON s.id = se.student_id
      JOIN classes c ON c.id = se.class_id
      JOIN sections sec ON sec.id = se.section_id
      JOIN academic_sessions sess ON sess.id = se.session_id
      WHERE se.class_id = ?
        AND se.section_id = ?
        AND se.session_id = ?
        AND se.status = 'active'
      ORDER BY COALESCE(se.roll_number, 999999), s.name ASC
    `,
    [data.classId, data.sectionId, data.sessionId]
  );
}

export async function getTeacherAssignedScopes(userId) {
  const [teacher] = await getTeacherByUserId(userId);
  if (!teacher?.id) return [];

  return query(
    `
      SELECT DISTINCT
        tca.class_id,
        tca.section_id,
        tca.session_id,
        c.name AS class_name,
        c.class_scope,
        sec.name AS section_name,
        sec.medium,
        sess.name AS session_name
      FROM teacher_class_assignments tca
      JOIN classes c ON c.id = tca.class_id
      JOIN sections sec ON sec.id = tca.section_id
      LEFT JOIN academic_sessions sess ON sess.id = tca.session_id
      WHERE tca.teacher_id = ?
      ORDER BY tca.class_id, tca.section_id, tca.session_id
    `,
    [teacher.id]
  );
}

export function attendanceExists(data) {
  return query(
    `
      SELECT id
      FROM attendance_sessions
      WHERE class_id = ?
        AND section_id = ?
        AND date = ?
        AND attendance_type = ?
        AND (academic_session_id <=> ?)
      LIMIT 1
    `,
    [
      data.classId,
      data.sectionId,
      data.date,
      data.attendanceType || "student",
      data.academicSessionId ?? null,
    ]
  );
}

export async function getStudentAttendanceSessionForScope(data) {
  const useApprovals = await hasApprovalsTable();

  return query(
    `
      SELECT
        att.id,
        att.class_id,
        att.section_id,
        att.academic_session_id,
        att.date,
        att.device_source,
        att.attendance_type,
        att.approval_status,
        att.submitted_by,
        att.submitted_at,
        att.reviewed_by,
        att.reviewed_at,
        att.review_remarks,
        c.name AS class_name,
        c.class_scope,
        sec.name AS section_name,
        sec.medium,
        sess.name AS session_name,
        submitter.username AS submitted_by_username,
        reviewer.username AS reviewed_by_username,
        ${useApprovals ? "ap.id" : "NULL"} AS approval_id,
        ${useApprovals ? "ap.status" : "NULL"} AS approval_record_status,
        ${useApprovals ? "ap.remarks" : "NULL"} AS approval_remarks
      FROM attendance_sessions att
      JOIN classes c ON c.id = att.class_id
      JOIN sections sec ON sec.id = att.section_id
      LEFT JOIN academic_sessions sess ON sess.id = att.academic_session_id
      LEFT JOIN users submitter ON submitter.id = att.submitted_by
      LEFT JOIN users reviewer ON reviewer.id = att.reviewed_by
      ${useApprovals ? `LEFT JOIN approvals ap
        ON ap.entity_type = '${STUDENT_ATTENDANCE_ENTITY}'
       AND ap.entity_id = att.id` : ""}
      WHERE att.class_id = ?
        AND att.section_id = ?
        AND att.date = ?
        AND att.attendance_type = 'student'
        AND (att.academic_session_id <=> ?)
      ORDER BY att.id DESC
      LIMIT 1
    `,
    [
      data.classId,
      data.sectionId,
      data.date,
      data.academicSessionId ?? null,
    ]
  );
}

export async function createAttendanceSession(data, conn) {
  const [result] = await conn.execute(
    `
      INSERT INTO attendance_sessions
      (
        class_id,
        section_id,
        academic_session_id,
        date,
        taken_by,
        device_source,
        attendance_type,
        approval_status,
        submitted_by,
        submitted_at,
        reviewed_by,
        reviewed_at,
        review_remarks
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.classId,
      data.sectionId,
      data.academicSessionId,
      data.date,
      data.takenBy,
      data.deviceSource ?? "manual",
      data.attendanceType ?? "student",
      data.approvalStatus,
      data.submittedBy,
      data.submittedAt,
      data.reviewedBy ?? null,
      data.reviewedAt ?? null,
      data.reviewRemarks ?? null,
    ]
  );

  return result.insertId;
}

export async function insertAttendanceRows(rows, conn) {
  const values = rows.map((row) => [
    row.sessionId,
    row.studentId,
    row.status,
  ]);

  await conn.query(
    `
      INSERT INTO student_attendance
      (attendance_session_id, student_id, status)
      VALUES ?
    `,
    [values]
  );
}

export async function deleteAttendanceRows(conn, sessionId) {
  await conn.execute(
    `
      DELETE FROM student_attendance
      WHERE attendance_session_id = ?
    `,
    [sessionId]
  );
}

export async function createApproval(conn, data) {
  if (!(await hasApprovalsTable())) {
    return;
  }

  await conn.execute(
    `
      INSERT INTO approvals
      (entity_type, entity_id, submitted_by, status)
      VALUES (?, ?, ?, 'pending')
    `,
    [STUDENT_ATTENDANCE_ENTITY, data.sessionId, data.submittedBy]
  );
}

export async function upsertApproval(conn, data) {
  if (!(await hasApprovalsTable())) {
    return;
  }

  const [updateResult] = await conn.execute(
    `
      UPDATE approvals
      SET submitted_by = ?,
          status = ?,
          approved_by = ?,
          approved_at = ?,
          remarks = ?
      WHERE entity_type = ?
        AND entity_id = ?
    `,
    [
      data.submittedBy ?? null,
      data.status,
      data.approvedBy ?? null,
      data.approvedAt ?? null,
      data.remarks ?? null,
      STUDENT_ATTENDANCE_ENTITY,
      data.sessionId,
    ]
  );

  if (updateResult.affectedRows > 0) {
    return;
  }

  await conn.execute(
    `
      INSERT INTO approvals
      (entity_type, entity_id, submitted_by, status, approved_by, approved_at, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      STUDENT_ATTENDANCE_ENTITY,
      data.sessionId,
      data.submittedBy ?? null,
      data.status,
      data.approvedBy ?? null,
      data.approvedAt ?? null,
      data.remarks ?? null,
    ]
  );
}

export async function getStudentAttendanceSessions(filters = {}) {
  const where = [`att.attendance_type = 'student'`];
  const params = [];
  const studentFilterId = Number(filters.student_id || 0) || null;
  const useApprovals = await hasApprovalsTable();
  const approvalsJoin = useApprovals
    ? `LEFT JOIN approvals ap
        ON ap.entity_type = '${STUDENT_ATTENDANCE_ENTITY}'
       AND ap.entity_id = att.id`
    : "";
  const approvalsGroupBy = useApprovals ? ", ap.id, ap.status" : "";

  if (filters.approval_status) {
    where.push("att.approval_status = ?");
    params.push(filters.approval_status);
  }

  if (filters.class_id) {
    where.push("att.class_id = ?");
    params.push(Number(filters.class_id));
  }

  if (filters.section_id) {
    where.push("att.section_id = ?");
    params.push(Number(filters.section_id));
  }

  if (filters.date_from) {
    where.push("att.date >= ?");
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push("att.date <= ?");
    params.push(filters.date_to);
  }

  if (studentFilterId) {
    where.push("student_row.student_id IS NOT NULL");
  }

  if (filters.status) {
    where.push("student_row.status = ?");
    params.push(filters.status);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  return query(
    `
      SELECT
        att.id,
        att.class_id,
        att.section_id,
        att.academic_session_id,
        att.date,
        att.device_source,
        att.approval_status,
        att.submitted_by,
        att.submitted_at,
        att.reviewed_by,
        att.reviewed_at,
        att.review_remarks,
        c.name AS class_name,
        c.class_scope,
        sec.name AS section_name,
        sec.medium,
        sess.name AS session_name,
        submitter.username AS submitted_by_username,
        reviewer.username AS reviewed_by_username,
        student_row.student_id AS filtered_student_id,
        student_row.status AS student_status,
        COUNT(sa.student_id) AS total_students,
        SUM(CASE WHEN sa.status = 'present' THEN 1 ELSE 0 END) AS present_count,
        SUM(CASE WHEN sa.status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
        SUM(CASE WHEN sa.status <> 'present' THEN 1 ELSE 0 END) AS non_present_count,
        ${useApprovals ? "ap.id" : "NULL"} AS approval_id,
        ${useApprovals ? "ap.status" : "NULL"} AS approval_record_status
      FROM attendance_sessions att
      JOIN classes c ON c.id = att.class_id
      JOIN sections sec ON sec.id = att.section_id
      LEFT JOIN academic_sessions sess ON sess.id = att.academic_session_id
      LEFT JOIN users submitter ON submitter.id = att.submitted_by
      LEFT JOIN users reviewer ON reviewer.id = att.reviewed_by
      LEFT JOIN student_attendance sa ON sa.attendance_session_id = att.id
      LEFT JOIN student_attendance student_row
        ON student_row.attendance_session_id = att.id
       AND student_row.student_id <=> ?
      ${approvalsJoin}
      ${whereClause}
      GROUP BY
        att.id,
        att.class_id,
        att.section_id,
        att.academic_session_id,
        att.date,
        att.device_source,
        att.approval_status,
        att.submitted_by,
        att.submitted_at,
        att.reviewed_by,
        att.reviewed_at,
        att.review_remarks,
        c.name,
        c.class_scope,
        sec.name,
        sec.medium,
        sess.name,
        submitter.username,
        reviewer.username,
        student_row.student_id,
        student_row.status
        ${approvalsGroupBy}
      ORDER BY att.date DESC, att.id DESC
    `,
    [studentFilterId, ...params]
  );
}

export async function getStudentAttendanceSessionById(sessionId) {
  const useApprovals = await hasApprovalsTable();

  return query(
    `
      SELECT
        att.id,
        att.class_id,
        att.section_id,
        att.academic_session_id,
        att.date,
        att.device_source,
        att.attendance_type,
        att.approval_status,
        att.submitted_by,
        att.submitted_at,
        att.reviewed_by,
        att.reviewed_at,
        att.review_remarks,
        c.name AS class_name,
        c.class_scope,
        sec.name AS section_name,
        sec.medium,
        sess.name AS session_name,
        submitter.username AS submitted_by_username,
        reviewer.username AS reviewed_by_username,
        ${useApprovals ? "ap.id" : "NULL"} AS approval_id,
        ${useApprovals ? "ap.status" : "NULL"} AS approval_record_status,
        ${useApprovals ? "ap.remarks" : "NULL"} AS approval_remarks
      FROM attendance_sessions att
      JOIN classes c ON c.id = att.class_id
      JOIN sections sec ON sec.id = att.section_id
      LEFT JOIN academic_sessions sess ON sess.id = att.academic_session_id
      LEFT JOIN users submitter ON submitter.id = att.submitted_by
      LEFT JOIN users reviewer ON reviewer.id = att.reviewed_by
      ${useApprovals ? `LEFT JOIN approvals ap
        ON ap.entity_type = '${STUDENT_ATTENDANCE_ENTITY}'
       AND ap.entity_id = att.id` : ""}
      WHERE att.id = ?
        AND att.attendance_type = 'student'
      LIMIT 1
    `,
    [sessionId]
  );
}

export function getStudentAttendanceRows(sessionId) {
  return query(
    `
      SELECT
        sa.id,
        sa.student_id,
        sa.status,
        s.name AS student_name,
        se.roll_number,
        c.name AS class_name,
        sec.name AS section_name
      FROM student_attendance sa
      JOIN students s ON s.id = sa.student_id
      LEFT JOIN attendance_sessions att ON att.id = sa.attendance_session_id
      LEFT JOIN student_enrollments se
        ON se.student_id = sa.student_id
       AND se.class_id = att.class_id
       AND se.section_id = att.section_id
       AND se.session_id = att.academic_session_id
       AND se.status = 'active'
      LEFT JOIN classes c ON c.id = att.class_id
      LEFT JOIN sections sec ON sec.id = att.section_id
      WHERE sa.attendance_session_id = ?
      ORDER BY COALESCE(se.roll_number, 999999), s.name ASC
    `,
    [sessionId]
  );
}

export async function updateAttendanceSessionReview(conn, data) {
  await conn.execute(
    `
      UPDATE attendance_sessions
      SET approval_status = ?,
          reviewed_by = ?,
          reviewed_at = NOW(),
          review_remarks = ?
      WHERE id = ?
    `,
    [data.status, data.reviewedBy, data.remarks ?? null, data.sessionId]
  );
}

export async function resubmitAttendanceSession(conn, data) {
  await conn.execute(
    `
      UPDATE attendance_sessions
      SET taken_by = ?,
          device_source = ?,
          approval_status = ?,
          submitted_by = ?,
          submitted_at = ?,
          reviewed_by = ?,
          reviewed_at = ?,
          review_remarks = ?
      WHERE id = ?
    `,
    [
      data.takenBy,
      data.deviceSource ?? "manual",
      data.approvalStatus,
      data.submittedBy ?? null,
      data.submittedAt ?? null,
      data.reviewedBy ?? null,
      data.reviewedAt ?? null,
      data.reviewRemarks ?? null,
      data.sessionId,
    ]
  );
}

export async function updateApprovalReview(conn, data) {
  if (!(await hasApprovalsTable())) {
    return;
  }

  await conn.execute(
    `
      UPDATE approvals
      SET status = ?,
          approved_by = ?,
          approved_at = NOW(),
          remarks = ?
      WHERE entity_type = ?
        AND entity_id = ?
    `,
    [
      data.status,
      data.reviewedBy,
      data.remarks ?? null,
      STUDENT_ATTENDANCE_ENTITY,
      data.sessionId,
    ]
  );
}

export function getAbsentStudentsWithParents(sessionId, studentIds = []) {
  const studentFilter =
    Array.isArray(studentIds) && studentIds.length
      ? `AND sa.student_id IN (${studentIds.map(() => "?").join(",")})`
      : "";

  return query(
    `
      SELECT
        sa.student_id,
        s.name AS student_name,
        sa.status,
        att.id AS attendance_session_id,
        att.date AS attendance_date,
        att.approval_status,
        c.name AS class_name,
        c.class_scope,
        sec.name AS section_name,
        sec.medium,
        sess.name AS session_name,
        p.id AS parent_id,
        p.name AS parent_name,
        p.user_id AS parent_user_id,
        sp.relationship
      FROM student_attendance sa
      JOIN attendance_sessions att ON att.id = sa.attendance_session_id
      JOIN students s ON s.id = sa.student_id
      JOIN student_parents sp ON sp.student_id = s.id
      JOIN parents p ON p.id = sp.parent_id
      LEFT JOIN classes c ON c.id = att.class_id
      LEFT JOIN sections sec ON sec.id = att.section_id
      LEFT JOIN academic_sessions sess ON sess.id = att.academic_session_id
      WHERE sa.attendance_session_id = ?
        AND sa.status = 'absent'
        AND p.user_id IS NOT NULL
        ${studentFilter}
      ORDER BY s.name ASC, p.name ASC
    `,
    [sessionId, ...studentIds]
  );
}

export async function createNotification(conn, data) {
  const [result] = await conn.execute(
    `
      INSERT INTO notifications
      (user_id, type, entity_type, entity_id, title, body)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      data.userId,
      data.type,
      data.entityType || null,
      data.entityId || null,
      data.title,
      data.body,
    ]
  );

  return result.insertId;
}

export async function logParentMessage(conn, data) {
  const [result] = await conn.execute(
    `
      INSERT INTO student_attendance_parent_messages
      (
        attendance_session_id,
        student_id,
        parent_user_id,
        conversation_id,
        message_id,
        notification_id,
        message_body,
        sent_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.attendanceSessionId,
      data.studentId,
      data.parentUserId,
      data.conversationId ?? null,
      data.messageId ?? null,
      data.notificationId ?? null,
      data.messageBody,
      data.sentBy,
    ]
  );

  return result.insertId;
}

export function getParentMessageHistory(sessionId) {
  return query(
    `
      SELECT
        id,
        student_id,
        parent_user_id,
        conversation_id,
        message_id,
        notification_id,
        message_body,
        sent_by,
        sent_at
      FROM student_attendance_parent_messages
      WHERE attendance_session_id = ?
      ORDER BY sent_at DESC, id DESC
    `,
    [sessionId]
  );
}

import { query } from "../../core/db/query.js";

export async function getTotalStudents() {
  const rows = await query(`SELECT COUNT(*) AS total FROM students`);
  return Number(rows?.[0]?.total || 0);
}

export async function getTotalTeachers() {
  const rows = await query(`SELECT COUNT(*) AS total FROM teachers`);
  return Number(rows?.[0]?.total || 0);
}

export async function getStudentAttendanceTodayBreakdown() {
  const rows = await query(
    `SELECT
      sa.status,
      COUNT(*) AS total
     FROM student_attendance sa
     JOIN attendance_sessions sess
       ON sess.id = sa.attendance_session_id
     WHERE sess.date = CURDATE()
     GROUP BY sa.status`
  );

  const breakdown = { present: 0, absent: 0, late: 0 };
  for (const row of rows) {
    if (row.status in breakdown) {
      breakdown[row.status] = Number(row.total || 0);
    }
  }
  return breakdown;
}

export async function getTeacherAttendanceTodayBreakdown() {
  const rows = await query(
    `SELECT
      status,
      COUNT(*) AS total
     FROM teacher_daily_attendance
     WHERE attendance_date = CURDATE()
     GROUP BY status`
  );

  let present = 0;
  let absent = 0;

  for (const row of rows) {
    const status = String(row.status || "").toLowerCase();
    const total = Number(row.total || 0);
    if (status === "absent") absent += total;
    else present += total; // present, late, half_day treated as present in summary
  }

  return { present, absent };
}

export async function getUpcomingExamsCount() {
  const rows = await query(
    `SELECT COUNT(*) AS total
     FROM exams e
     JOIN academic_sessions s ON s.id = e.session_id
     WHERE s.end_date >= CURDATE()`
  );
  return Number(rows?.[0]?.total || 0);
}

export async function getNewAdmissionsThisMonth() {
  const rows = await query(
    `SELECT COUNT(*) AS total
     FROM students
     WHERE date_of_admission >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
       AND date_of_admission < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)`
  );
  return Number(rows?.[0]?.total || 0);
}

export async function getUpcomingExams(limit = 5) {
  const safeLimit = Math.max(1, Math.min(20, Number(limit) || 5));
  return query(
    `SELECT
      e.id,
      e.name AS exam_name,
      c.name AS class_name,
      sec.name AS section_name,
      s.name AS session_name,
      s.end_date AS exam_date
     FROM exams e
     LEFT JOIN exam_scopes es ON es.exam_id = e.id
     LEFT JOIN classes c ON c.id = es.class_id
     LEFT JOIN sections sec ON sec.id = es.section_id
     JOIN academic_sessions s ON s.id = e.session_id
     WHERE s.end_date >= CURDATE()
     ORDER BY s.end_date ASC, e.id DESC
     LIMIT ${safeLimit}`
  );
}

export async function getRecentActivities(limit = 10) {
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
  return query(
    `SELECT
      al.id,
      al.user_id,
      COALESCE(u.username, u.email, u.phone, CONCAT('User#', al.user_id)) AS actor,
      al.action,
      CONCAT(
        COALESCE(al.action, 'action'),
        IF(al.entity_type IS NOT NULL, CONCAT(' on ', al.entity_type), ''),
        IF(al.entity_id IS NOT NULL, CONCAT(' #', al.entity_id), '')
      ) AS description,
      al.created_at
     FROM activity_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ORDER BY al.created_at DESC
     LIMIT ${safeLimit}`
  );
}

export async function getRecentConversations(limit = 5) {
  const safeLimit = Math.max(1, Math.min(20, Number(limit) || 5));
  return query(
    `SELECT
      c.id,
      COALESCE(c.name, CONCAT(UPPER(LEFT(c.type, 1)), SUBSTRING(c.type, 2), ' Conversation')) AS conversation_name,
      lm.message AS last_message,
      lm.created_at AS last_message_time
     FROM conversations c
     JOIN (
       SELECT m1.conversation_id, m1.message, m1.created_at
       FROM messages m1
       JOIN (
         SELECT conversation_id, MAX(created_at) AS max_created_at
         FROM messages
         GROUP BY conversation_id
       ) last_m
         ON last_m.conversation_id = m1.conversation_id
        AND last_m.max_created_at = m1.created_at
     ) lm ON lm.conversation_id = c.id
     ORDER BY lm.created_at DESC
     LIMIT ${safeLimit}`
  );
}

export async function getClassOverview() {
  return query(
    `SELECT
      c.id AS class_id,
      c.name AS class_name,
      COALESCE(c.class_scope, 'school') AS class_scope,
      sec.id AS section_id,
      sec.name AS section_name,
      ac.students,
      COALESCE(pc.present_today, 0) AS present_today
     FROM (
       SELECT
         class_id,
         section_id,
         COUNT(DISTINCT student_id) AS students
       FROM student_enrollments
       WHERE status = 'active'
       GROUP BY class_id, section_id
     ) ac
     JOIN classes c ON c.id = ac.class_id
     JOIN sections sec ON sec.id = ac.section_id
     LEFT JOIN (
       SELECT
         sess.class_id,
         sess.section_id,
         COUNT(*) AS present_today
       FROM attendance_sessions sess
       JOIN student_attendance sa
         ON sa.attendance_session_id = sess.id
       WHERE sess.date = CURDATE()
         AND sa.status IN ('present', 'late')
       GROUP BY sess.class_id, sess.section_id
     ) pc
       ON pc.class_id = ac.class_id
      AND pc.section_id = ac.section_id
     ORDER BY c.name ASC, sec.name ASC`
  );
}

export async function getStudentClassStats() {
  return query(
    `SELECT
      COALESCE(c.class_scope, 'school') AS class_scope,
      c.id AS class_id,
      c.name AS class_name,
      COUNT(DISTINCT se.student_id) AS total
     FROM student_enrollments se
     JOIN classes c ON c.id = se.class_id
     WHERE se.status = 'active'
     GROUP BY COALESCE(c.class_scope, 'school'), c.id, c.name
     ORDER BY COALESCE(c.class_scope, 'school') ASC, c.name ASC`
  );
}

export async function getStudentScopeStats() {
  return query(
    `SELECT
      COALESCE(c.class_scope, 'school') AS class_scope,
      COUNT(DISTINCT se.student_id) AS total
     FROM student_enrollments se
     JOIN classes c ON c.id = se.class_id
     WHERE se.status = 'active'
     GROUP BY COALESCE(c.class_scope, 'school')`
  );
}

export async function getStudentAttendanceTrend(days = 7) {
  const safeDays = Math.max(1, Math.min(31, Number(days) || 7));
  return query(
    `SELECT
      sess.date AS attendance_date,
      sa.status,
      COUNT(*) AS total
     FROM attendance_sessions sess
     JOIN student_attendance sa
       ON sa.attendance_session_id = sess.id
     WHERE sess.attendance_type = 'student'
       AND sess.approval_status = 'approved'
       AND sess.date >= DATE_SUB(CURDATE(), INTERVAL ${safeDays - 1} DAY)
     GROUP BY sess.date, sa.status
     ORDER BY sess.date ASC`
  );
}

export async function getTeacherAttendanceTrend(days = 7) {
  const safeDays = Math.max(1, Math.min(31, Number(days) || 7));
  return query(
    `SELECT
      attendance_date,
      status,
      COUNT(*) AS total
     FROM teacher_daily_attendance
     WHERE attendance_date >= DATE_SUB(CURDATE(), INTERVAL ${safeDays - 1} DAY)
     GROUP BY attendance_date, status
     ORDER BY attendance_date ASC`
  );
}

export async function getAdmissionsTrend(months = 6) {
  const safeMonths = Math.max(1, Math.min(12, Number(months) || 6));
  return query(
    `SELECT
      DATE_FORMAT(date_of_admission, '%Y-%m') AS bucket,
      COUNT(*) AS total
     FROM students
     WHERE date_of_admission IS NOT NULL
       AND date_of_admission >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL ${safeMonths - 1} MONTH)
     GROUP BY DATE_FORMAT(date_of_admission, '%Y-%m')
     ORDER BY bucket ASC`
  );
}

export async function getFeeCollectionTrend(months = 6) {
  const safeMonths = Math.max(1, Math.min(12, Number(months) || 6));
  return query(
    `SELECT
      DATE_FORMAT(p.created_at, '%Y-%m') AS bucket,
      SUM(p.amount_paid) AS total
     FROM payments p
     WHERE p.status = 'approved'
       AND p.created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL ${safeMonths - 1} MONTH)
     GROUP BY DATE_FORMAT(p.created_at, '%Y-%m')
     ORDER BY bucket ASC`
  );
}

export async function getPaymentCollectionTrendByScope(months = 6) {
  const safeMonths = Math.max(1, Math.min(12, Number(months) || 6));
  return query(
    `SELECT
      DATE_FORMAT(p.created_at, '%Y-%m') AS bucket,
      COALESCE(c.class_scope, 'school') AS class_scope,
      SUM(p.amount_paid) AS total
     FROM payments p
     JOIN student_fees sf ON sf.id = p.student_fee_id
     JOIN student_enrollments se ON se.id = sf.enrollment_id
     JOIN classes c ON c.id = se.class_id
     WHERE p.status = 'approved'
       AND p.created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL ${safeMonths - 1} MONTH)
     GROUP BY DATE_FORMAT(p.created_at, '%Y-%m'), COALESCE(c.class_scope, 'school')
     ORDER BY bucket ASC`
  );
}

export async function getFeeStatusBreakdown() {
  return query(
    `SELECT
      sf.status,
      COUNT(*) AS total_items,
      COALESCE(SUM(sf.amount), 0) AS total_amount,
      COALESCE(SUM(sf.paid_amount), 0) AS paid_amount,
      COALESCE(SUM(GREATEST(sf.amount - sf.paid_amount, 0)), 0) AS outstanding_amount
     FROM (
       SELECT
         student_fees.id,
         student_fees.status,
         student_fees.amount,
         COALESCE(SUM(payments.amount_paid), 0) AS paid_amount
       FROM student_fees
       LEFT JOIN payments
         ON payments.student_fee_id = student_fees.id
        AND payments.status = 'approved'
       GROUP BY student_fees.id, student_fees.status, student_fees.amount
     ) sf
     GROUP BY sf.status
     ORDER BY FIELD(sf.status, 'paid', 'partial', 'pending')`
  );
}

export async function getFeeStatusBreakdownByScope() {
  return query(
    `SELECT
      scoped_fees.class_scope,
      scoped_fees.status,
      COUNT(*) AS total_items,
      COALESCE(SUM(scoped_fees.amount), 0) AS total_amount,
      COALESCE(SUM(scoped_fees.paid_amount), 0) AS paid_amount,
      COALESCE(SUM(GREATEST(scoped_fees.amount - scoped_fees.paid_amount, 0)), 0) AS outstanding_amount
     FROM (
       SELECT
         COALESCE(c.class_scope, 'school') AS class_scope,
         student_fees.id,
         student_fees.status,
         student_fees.amount,
         COALESCE(SUM(payments.amount_paid), 0) AS paid_amount
       FROM student_fees
       JOIN student_enrollments se ON se.id = student_fees.enrollment_id
       JOIN classes c ON c.id = se.class_id
       LEFT JOIN payments
         ON payments.student_fee_id = student_fees.id
        AND payments.status = 'approved'
       GROUP BY
         COALESCE(c.class_scope, 'school'),
         student_fees.id,
         student_fees.status,
         student_fees.amount
     ) scoped_fees
     GROUP BY scoped_fees.class_scope, scoped_fees.status
     ORDER BY scoped_fees.class_scope ASC, FIELD(scoped_fees.status, 'paid', 'partial', 'pending')`
  );
}

export async function getStudentAttendanceTodayByScope() {
  return query(
    `SELECT
      COALESCE(c.class_scope, 'school') AS class_scope,
      sa.status,
      COUNT(*) AS total
     FROM student_attendance sa
     JOIN attendance_sessions sess
       ON sess.id = sa.attendance_session_id
     JOIN classes c ON c.id = sess.class_id
     WHERE sess.date = CURDATE()
     GROUP BY COALESCE(c.class_scope, 'school'), sa.status`
  );
}

export async function getStudentAttendanceTrendByScope(days = 7) {
  const safeDays = Math.max(1, Math.min(31, Number(days) || 7));
  return query(
    `SELECT
      sess.date AS attendance_date,
      COALESCE(c.class_scope, 'school') AS class_scope,
      sa.status,
      COUNT(*) AS total
     FROM attendance_sessions sess
     JOIN student_attendance sa
       ON sa.attendance_session_id = sess.id
     JOIN classes c ON c.id = sess.class_id
     WHERE sess.attendance_type = 'student'
       AND sess.approval_status = 'approved'
       AND sess.date >= DATE_SUB(CURDATE(), INTERVAL ${safeDays - 1} DAY)
     GROUP BY sess.date, COALESCE(c.class_scope, 'school'), sa.status
     ORDER BY sess.date ASC`
  );
}

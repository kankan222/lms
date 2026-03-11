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
      sec.id AS section_id,
      sec.name AS section_name,
      COUNT(DISTINCT se.student_id) AS students,
      COALESCE(SUM(CASE WHEN sa.status IN ('present', 'late') THEN 1 ELSE 0 END), 0) AS present_today
     FROM student_enrollments se
     JOIN classes c ON c.id = se.class_id
     JOIN sections sec ON sec.id = se.section_id
     LEFT JOIN attendance_sessions sess
       ON sess.class_id = se.class_id
      AND sess.section_id = se.section_id
      AND sess.date = CURDATE()
     LEFT JOIN student_attendance sa
       ON sa.attendance_session_id = sess.id
      AND sa.student_id = se.student_id
     WHERE se.status = 'active'
     GROUP BY c.id, c.name, sec.id, sec.name
     ORDER BY c.name ASC, sec.name ASC`
  );
}

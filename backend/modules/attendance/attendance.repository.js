import { query } from "../../core/db/query.js";

export function checkTeacherAssignment(data) {

  return query(`
    SELECT id
    FROM teacher_class_assignments
    WHERE teacher_id = ?
      AND class_id = ?
      AND section_id = ?
      AND session_id = ?
  `, [
    data.teacherId,
    data.classId,
    data.sectionId,
    data.sessionId
  ]);
}

export function getEnrolledStudents(data) {

  return query(`
    SELECT se.student_id
    FROM student_enrollments se
    JOIN academic_sessions s
      ON s.id = se.session_id
    WHERE se.class_id = ?
      AND se.section_id = ?
      AND se.status = 'active'
      AND s.is_active = true
  `, [
    data.classId,
    data.sectionId
  ]);
}

export async function createAttendanceSession(data, conn) {

  const [result] = await conn.execute(`
    INSERT INTO attendance_sessions
    (class_id, section_id, date, taken_by, device_source)
    VALUES (?, ?, ?, ?, ?)
  `, [
    data.classId,
    data.sectionId,
    data.date,
    data.teacherId,
    data.deviceSource ?? "manual"
  ]);

  return result.insertId;
}

export async function insertAttendanceRows(rows, conn) {

  const values = rows.map(r => [
    r.sessionId,
    r.studentId,
    r.status
  ]);

  await conn.query(`
    INSERT INTO student_attendance
    (attendance_session_id, student_id, status)
    VALUES ?
  `, [values]);
}

export function attendanceExists(data) {
  return query(`
    SELECT id
    FROM attendance_sessions
    WHERE class_id = ?
      AND section_id = ?
      AND date = ?
    LIMIT 1
  `, [
    data.classId,
    data.sectionId,
    data.date
  ]);
}

export async function getTeacherByUser(conn, userId){
  const [rows] = await conn.execute(
    `SELECT id FROM teachers WHERE user_id=?`,
    [userId]
  );
  return rows[0];
}
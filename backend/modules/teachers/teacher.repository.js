import { query } from "../../core/db/query.js";

export async function createTeacher(data, conn) {

  const [result] = await conn.execute(`
    INSERT INTO teachers
    (employee_id, name, phone, email, photo_url)
    VALUES (?, ?, ?, ?, ?)
  `, [
    data.employee_id ?? null,
    data.name ?? null,
    data.phone ?? null,
    data.email ?? null,
    data.photo_url ?? null
  ]);

  return result.insertId;
}

export function getTeachers() {
  return query(`
    SELECT
      id,
      employee_id,
      name,
      phone,
      email,
      photo_url
    FROM teachers
    ORDER BY id DESC
  `);
}

export function updateTeacher(id,data) {
  return query(`
    UPDATE teachers
    SET
      employee_id=?,
      name=?,
      phone=?,
      email=?,
      photo_url=?
    WHERE id=?
  `,[
    data.employeeId,
    data.name,
    data.phone,
    data.email,
    data.photoUrl,
    id
  ]);
}

export function deleteTeacher(id) {
  return query(`DELETE FROM teachers WHERE id=?`,[id]);
}

export async function assignTeacher(data, conn) {

  await conn.execute(`
    INSERT INTO teacher_class_assignments
    (teacher_id, class_id, section_id, subject_id, session_id)
    VALUES (?, ?, ?, ?, ?)
  `, [
    data.teacherId,
    data.classId,
    data.sectionId,
    data.subjectId,
    data.sessionId
  ]);
}

export function getTeacherAssignments(teacherId) {

  return query(`
    SELECT
      t.id,
      t.name,
      c.name AS class,
      s.name AS section,
      sub.name AS subject,
      ses.name AS session
    FROM teacher_class_assignments ta
    JOIN teachers t ON t.id = ta.teacher_id
    JOIN classes c ON c.id = ta.class_id
    JOIN sections s ON s.id = ta.section_id
    JOIN subjects sub ON sub.id = ta.subject_id
    JOIN academic_sessions ses ON ses.id = ta.session_id
    WHERE t.id = ?
  `, [teacherId]);
}
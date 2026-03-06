import { query } from "../../core/db/query.js";

/* CREATE */

export async function createStudent(data) {

  const sql = `
  INSERT INTO students
  (admission_no, first_name, last_name, dob, gender)
  VALUES (?, ?, ?, ?, ?)
  `;

  const result = await query(sql, [
    data.admission_no || null,
    data.first_name || null,
    data.last_name || null,
    data.dob || null,
    data.gender || null
  ]);

  return result.insertId;
}


/* CREATE ENROLLMENT */

export async function createEnrollment(studentId, data) {

  const sql = `
  INSERT INTO student_enrollments
  (student_id, class_id, section_id, session_id, roll_number, status)
  VALUES (?, ?, ?, ?, ?, ?)
  `;

  await query(sql, [
    studentId,
    data.class_id || null,
    data.section_id || null,
    data.session_id || null,
    data.roll_number || null,
    data.status || "active"
  ]);
}


/* GET ALL STUDENTS */

export function getStudents() {

  return query(`
  SELECT
    s.id,
    s.admission_no,
    s.first_name,
    s.last_name,
    DATE_FORMAT(s.dob,'%Y-%m-%d') as dob,
    s.gender,
    se.roll_number,
    se.status,
    c.name AS class,
    sec.name AS section
  FROM students s

  LEFT JOIN student_enrollments se
    ON se.student_id = s.id
    AND se.status='active'

  LEFT JOIN classes c
    ON c.id = se.class_id

  LEFT JOIN sections sec
    ON sec.id = se.section_id

  ORDER BY s.id DESC
  `);

}

export function getStudentsByClassSection() {

  return query(`
  SELECT
s.id,
s.first_name,
s.last_name
FROM students s
JOIN student_enrollments e
ON s.id = e.student_id
WHERE e.class_id = ?
AND e.section = ?
AND e.session_id = ?
  `);

}


/* UPDATE STUDENT */

export async function updateStudent(id, data) {

  const sql = `
  UPDATE students
  SET
    admission_no = ?,
    first_name = ?,
    last_name = ?,
    dob = ?,
    gender = ?
  WHERE id = ?
  `;

  await query(sql, [
    data.admission_no || null,
    data.first_name || null,
    data.last_name || null,
    data.dob || null,
    data.gender || null,
    id
  ]);

}


/* UPDATE ENROLLMENT */

export async function updateEnrollment(id, data) {

  const sql = `
  UPDATE student_enrollments
  SET
    class_id = ?,
    section_id = ?,
    session_id = ?,
    roll_number = ?,
    status = ?
  WHERE student_id = ?
  `;

  await query(sql, [
    data.classId || null,
    data.sectionId || null,
    data.sessionId || null,
    data.rollNumber || null,
    data.status || "active",
    id
  ]);

}


/* DELETE */

export async function deleteStudent(id) {

  await query(
    `DELETE FROM student_enrollments WHERE student_id=?`,
    [id]
  );

  await query(
    `DELETE FROM students WHERE id=?`,
    [id]
  );

}


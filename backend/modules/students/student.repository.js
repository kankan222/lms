import {pool} from "../../database/pool.js";

export async function insertStudent(conn, student) {

  const [result] = await conn.execute(
    `INSERT INTO students
     (admission_no, name, dob, gender, date_of_admission, mobile, photo_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      student.admission_no || null,
      student.name || null,
      student.dob || null,
      student.gender || null,
      student.date_of_admission || null,
      student.mobile || null,
      student.photo_url || null
    ]
  );

  return result.insertId;
}

export async function findUserByPhone(conn, phone) {

  const [rows] = await conn.execute(
    `SELECT id FROM users WHERE phone = ?`,
    [phone]
  );

  return rows[0];
}

export async function createUser(conn, user) {

  const [result] = await conn.execute(
    `INSERT INTO users (phone, email, password_hash)
     VALUES (?, ?, ?)`,
    [user.phone, user.email, user.password_hash]
  );

  return result.insertId;
}

export async function assignParentRole(conn, userId) {

  await conn.execute(
    `INSERT IGNORE INTO user_roles (user_id, role_id)
     SELECT ?, id FROM roles WHERE name = 'parent'`,
    [userId]
  );
}

export async function createParent(conn, parent) {

  const [result] = await conn.execute(
    `INSERT INTO parents
     (user_id, name, qualification, occupation)
     VALUES (?, ?, ?, ?)`,
    [
      parent.user_id,
      parent.name,
      parent.qualification,
      parent.occupation
    ]
  );

  return result.insertId;
}

export async function findParentByUser(conn, userId) {

  const [rows] = await conn.execute(
    `SELECT * FROM parents WHERE user_id = ?`,
    [userId]
  );

  return rows[0];
}

export async function linkParent(conn, studentId, parentId, relationship) {

  await conn.execute(
    `INSERT INTO student_parents
     (student_id, parent_id, relationship)
     VALUES (?, ?, ?)`,
    [studentId, parentId, relationship]
  );
}

export async function insertEnrollment(conn, enrollment) {

  const [result] = await conn.execute(
    `INSERT INTO student_enrollments
     (student_id, session_id, class_id, section_id, stream_id, roll_number, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`,
    [
      enrollment.student_id,
      enrollment.session_id,
      enrollment.class_id,
      enrollment.section_id,
      enrollment.stream_id || null,
      enrollment.roll_number || null
    ]
  );

  return result.insertId;
}

export async function getClassById(classId) {
  const [rows] = await pool.execute(
    `SELECT id, name, class_scope
     FROM classes
     WHERE id = ?
     LIMIT 1`,
    [classId]
  );

  return rows[0] || null;
}

export async function getStreamById(streamId) {
  const [rows] = await pool.execute(
    `SELECT id, name
     FROM streams
     WHERE id = ?
     LIMIT 1`,
    [streamId]
  );

  return rows[0] || null;
}

export async function getStreamByName(name) {
  const [rows] = await pool.execute(
    `SELECT id, name
     FROM streams
     WHERE LOWER(name) = LOWER(?)
     LIMIT 1`,
    [name]
  );

  return rows[0] || null;
}

export async function getStudents(filters = {}) {
  const classId = filters.class_id ?? filters.classId;
  const sectionId = filters.section_id ?? filters.sectionId;

  const where = [];
  const params = [];

  if (classId) {
    where.push("se.class_id = ?");
    params.push(classId);
  }

  if (sectionId) {
    where.push("se.section_id = ?");
    params.push(sectionId);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.execute(
    `SELECT
      s.id,
      s.admission_no,
      s.name,
      s.mobile AS phone,
      s.gender,
      s.dob,
      se.roll_number,
      se.class_id,
      se.section_id,
      se.stream_id,
      c.name AS class,
      c.class_scope,
      sec.name AS section,
      sec.medium AS medium,
      str.name AS stream_name
     FROM students s
     LEFT JOIN student_enrollments se
       ON s.id = se.student_id AND se.status='active'
     LEFT JOIN classes c
       ON se.class_id = c.id
     LEFT JOIN sections sec
       ON se.section_id = sec.id
     LEFT JOIN streams str
       ON se.stream_id = str.id
     ${whereClause}
     ORDER BY s.id DESC`,
    params
  );

  return rows;
}

export async function getStudentById(id) {
  const [rows] = await pool.execute(
    `SELECT
      s.*,
      se.roll_number,
      se.class_id,
      se.section_id,
      se.stream_id,
      se.session_id,
      c.name AS class,
      c.class_scope,
      sec.name AS section,
      sec.medium AS medium,
      str.name AS stream_name,
      sess.name AS session
     FROM students s
     LEFT JOIN student_enrollments se
       ON s.id = se.student_id AND se.status='active'
     LEFT JOIN classes c
       ON se.class_id = c.id
     LEFT JOIN sections sec
       ON se.section_id = sec.id
     LEFT JOIN streams str
       ON se.stream_id = str.id
     LEFT JOIN academic_sessions sess
       ON se.session_id = sess.id
     WHERE s.id=?`,
    [id]
  );

  const student = rows[0];
  if (!student) return null;

  const [parentRows] = await pool.execute(
    `SELECT
      sp.relationship,
      p.name,
      u.phone AS mobile,
      u.email,
      p.qualification,
      p.occupation
     FROM student_parents sp
     JOIN parents p ON p.id = sp.parent_id
     JOIN users u ON u.id = p.user_id
     WHERE sp.student_id = ?`,
    [id]
  );

  return {
    ...student,
    parents: parentRows
  };
}

export async function updateStudent(id, data) {

  await pool.execute(
    `UPDATE students
     SET
       admission_no = ?,
       name = ?,
       mobile = ?,
       gender = ?,
       dob = ?,
       date_of_admission = ?,
       photo_url = COALESCE(?, photo_url)
     WHERE id = ?`,
    [
      data.admission_no ?? null,
      data.name ?? null,
      data.mobile ?? null,
      data.gender ?? null,
      data.dob ?? null,
      data.date_of_admission ?? null,
      data.photo_url ?? null,
      id
    ]
  );

  return { message: "updated" };
}

export async function updateActiveEnrollment(studentId, data) {
  await pool.execute(
    `UPDATE student_enrollments
     SET
       session_id = ?,
       class_id = ?,
       section_id = ?,
       stream_id = ?,
       roll_number = ?
     WHERE student_id = ?
       AND status = 'active'`,
    [
      data.session_id ?? null,
      data.class_id ?? null,
      data.section_id ?? null,
      data.stream_id ?? null,
      data.roll_number ?? null,
      studentId
    ]
  );

  return { message: "enrollment updated" };
}

export async function deleteStudent(id) {

  await pool.execute(
    `DELETE FROM students WHERE id=?`,
    [id]
  );
}

export async function searchParent(phone) {

  const [rows] = await pool.execute(
    `SELECT p.id, p.name, u.phone
     FROM parents p
     JOIN users u ON p.user_id=u.id
     WHERE u.phone=?`,
    [phone]
  );

  return rows;
}

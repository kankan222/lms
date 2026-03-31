import { query } from "../../core/db/query.js";

let teacherClassScopeColumnPromise;

function hasTeacherClassScopeColumn() {
  if (!teacherClassScopeColumnPromise) {
    teacherClassScopeColumnPromise = query(
      `
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'teachers'
          AND COLUMN_NAME = 'class_scope'
        LIMIT 1
      `
    ).then((rows) => rows.length > 0);
  }

  return teacherClassScopeColumnPromise;
}

/* ------------------ CREATE ------------------ */

export async function createTeacher(data, conn) {
  const hasClassScope = await hasTeacherClassScopeColumn();

  if (hasClassScope) {
    const [result] = await conn.execute(`
      INSERT INTO teachers
      (user_id, employee_id, name, phone, email, class_scope, photo_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      data.user_id ,
      data.employee_id || null,
      data.name || null,
      data.phone || null,
      data.email || null,
      data.class_scope || "school",
      data.photo_url || null
    ]);

    return result.insertId;
  }

  const [result] = await conn.execute(`
    INSERT INTO teachers
    (user_id, employee_id, name, phone, email, photo_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    data.user_id ,
    data.employee_id || null,
    data.name || null,
    data.phone || null,
    data.email || null,
    data.photo_url || null
  ]);

  return result.insertId;
}

/* ------------------ READ ------------------ */

export async function getTeachers() {
  const hasClassScope = await hasTeacherClassScopeColumn();

  return query(`
    SELECT
      t.id,
      t.user_id,
      t.employee_id,
      t.name,
      t.phone,
      t.email,
      ${hasClassScope ? "t.class_scope" : "'school' AS class_scope"},
      t.photo_url
    FROM teachers t
    ORDER BY t.id DESC
  `);
}

export async function getTeacherById(id) {
  const hasClassScope = await hasTeacherClassScopeColumn();

  return query(`
    SELECT
      id,
      user_id,
      employee_id,
      name,
      phone,
      email,
      ${hasClassScope ? "class_scope" : "'school' AS class_scope"},
      photo_url
    FROM teachers
    WHERE id = ?
  `, [id]).then(rows => rows[0]);
}

export async function getTeacherByUserId(userId) {
  const hasClassScope = await hasTeacherClassScopeColumn();

  return query(`
    SELECT
      id,
      user_id,
      employee_id,
      name,
      phone,
      email,
      ${hasClassScope ? "class_scope" : "'school' AS class_scope"},
      photo_url
    FROM teachers
    WHERE user_id = ?
    LIMIT 1
  `, [userId]).then((rows) => rows[0]);
}



/* ------------------ UPDATE ------------------ */

export function updateTeacher(id, data) {
  return hasTeacherClassScopeColumn().then((hasClassScope) => {
    const employeeId = data.employee_id ?? null;
    const name = data.name ?? null;
    const phone = data.phone ?? null;
    const email = data.email ?? null;
    const classScope = data.class_scope ?? null;
    const photoUrl = data.photo_url ?? null;

    if (hasClassScope) {
      return query(`
        UPDATE teachers
        SET
          employee_id = ?,
          name = ?,
          phone = ?,
          email = ?,
          class_scope = COALESCE(?, class_scope),
          photo_url = ?
        WHERE id = ?
      `, [
        employeeId,
        name,
        phone,
        email,
        classScope,
        photoUrl,
        id
      ]);
    }

    return query(`
      UPDATE teachers
      SET
        employee_id = ?,
        name = ?,
        phone = ?,
        email = ?,
        photo_url = ?
      WHERE id = ?
    `, [
      employeeId,
      name,
      phone,
      email,
      photoUrl,
      id
    ]);
  });
}

export function getClassById(classId) {
  return query(
    `
      SELECT id, name
      FROM classes
      WHERE id = ? AND is_active = TRUE
    `,
    [classId]
  ).then((rows) => rows[0]);
}

/* ------------------ DELETE ------------------ */

export function deleteTeacher(id) {
  return query(
    `DELETE FROM teachers WHERE id=?`,
    [id]
  );
}

/* ------------------ ASSIGNMENTS ------------------ */
export async function createUser(data, conn) {
  const [result] = await conn.execute(`
    INSERT INTO users (email, phone, password_hash)
    VALUES (?, ?, ?)
  `, [
    data.email,
    data.phone,
    data.password_hash
  ]);

  return result.insertId;
}
export async function assignUserRole(userId, roleName, conn) {

  const [role] = await conn.execute(`
    SELECT id FROM roles WHERE name = ?
  `, [roleName]);

  await conn.execute(`
    INSERT INTO user_roles (user_id, role_id)
    VALUES (?, ?)
  `, [userId, role[0].id]);
}
export async function assignTeacher(data, conn) {

  await conn.execute(`
    INSERT INTO teacher_class_assignments
    (teacher_id, class_id, section_id, subject_id, session_id)
    VALUES (?, ?, ?, ?, ?)
  `, [
    data.teacherId,
    data.class_id,
    data.section_id,
    data.subject_id,
    data.session_id
  ])
}

export function removeAssignment(id) {
  return query(
    `DELETE FROM teacher_class_assignments WHERE id=?`,
    [id]
  );
}

export function getTeacherAssignments(teacherId) {

  return query(`
    SELECT
      ta.id,
      ta.class_id,
      ta.section_id,
      ta.subject_id,
      ta.session_id,
      t.name AS teacher,
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
    WHERE ta.teacher_id = ?
    ORDER BY c.name, s.name
  `, [teacherId]);
}

/* ------------------ ATTENDANCE DEVICES ------------------ */
export function createAttendanceDevice(data){

  return query(`
    INSERT INTO attendance_devices
    (device_name,device_code,location)
    VALUES (?,?,?)
  `,[
    data.name,
    data.deviceCode,
    data.location
  ]);
}
export function getAttendanceDevices(){

  return query(`
    SELECT
      id,
      device_name AS name,
      device_code,
      location
    FROM attendance_devices
  `);
}
//  DEVICE ATTENDANCE LOG

export function logTeacherAttendance(data){

  return query(`
    INSERT INTO teacher_attendance_logs
    (teacher_id,device_id,punch_time, punch_type)
    VALUES (?,?,?, ?)
  `,[
    data.teacherId,
    data.deviceId,
    data.punchTime,
    data.punchType
  ]);
}

/* ------------------ DAILY ATTENDANCE ------------------ */

export function getTeacherAttendance(data){

  return query(`
    SELECT
      l.id,
      t.name AS teacher,
      l.teacher_id,
      l.device_id,
      l.punch_time,
      l.punch_type,
      d.device_name,
      d.device_code,
      d.location
    FROM teacher_attendance_logs l
    JOIN teachers t ON t.id = l.teacher_id
    LEFT JOIN attendance_devices d ON d.id = l.device_id
    WHERE l.teacher_id = ?
      AND DATE(l.punch_time) BETWEEN ? AND ?
    ORDER BY l.punch_time DESC
  `,[
    data.teacherId,
    data.startDate || "2000-01-01",
    data.endDate || "2100-01-01"
  ]);
}
export function getAllTeacherAttendance({ startDate, endDate }) {

  return query(`
    SELECT
      l.id,
      t.name AS teacher,
      l.teacher_id,
      l.device_id,
      l.punch_time,
      l.punch_type,
      d.device_name,
      d.device_code,
      d.location
    FROM teacher_attendance_logs l
    JOIN teachers t ON t.id = l.teacher_id
    LEFT JOIN attendance_devices d ON d.id = l.device_id
    WHERE DATE(l.punch_time) BETWEEN ? AND ?
    ORDER BY l.punch_time DESC
  `, [
    startDate || "2000-01-01",
    endDate || "2100-01-01"
  ]);

}
export function generateDailyAttendance(data){
  const attendanceDate = data.attendanceDate || data.date;
  const checkIn = data.checkIn || null;
  const checkOut = data.checkOut || null;

  return query(`
    INSERT INTO teacher_daily_attendance
    (teacher_id,attendance_date,status,check_in,check_out,worked_hours)
    VALUES (?,?,?,?,?,
      CASE
        WHEN ? IS NOT NULL AND ? IS NOT NULL
          THEN ROUND(TIMESTAMPDIFF(MINUTE, ?, ?) / 60, 2)
        ELSE NULL
      END
    )
    ON DUPLICATE KEY UPDATE
      status = VALUES(status),
      check_in = VALUES(check_in),
      check_out = VALUES(check_out),
      worked_hours = VALUES(worked_hours)
  `,[
    data.teacherId,
    attendanceDate,
    data.status,
    checkIn,
    checkOut,
    checkIn,
    checkOut,
    checkIn,
    checkOut
  ]);
}

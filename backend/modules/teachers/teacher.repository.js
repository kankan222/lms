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

export async function getTeachers(filters = {}) {
  const hasClassScope = await hasTeacherClassScopeColumn();
  const rawPage = Number(filters.page);
  const rawLimit = Number(filters.limit);
  const hasPagination = Number.isFinite(rawPage) || Number.isFinite(rawLimit);
  const page = Math.max(1, Number.isFinite(rawPage) ? Math.trunc(rawPage) : 1);
  const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 25));
  const offset = (page - 1) * limit;
  const selectSql = `
    SELECT
      t.id,
      t.user_id,
      t.employee_id,
      t.name,
      t.phone,
      t.email,
      ${hasClassScope ? "t.class_scope" : "'school' AS class_scope"},
      t.photo_url
    FROM teachers t`;

  const rows = await query(
    hasPagination
      ? `${selectSql}
         ORDER BY t.id DESC
         LIMIT ${offset}, ${limit}`
      : `${selectSql}
         ORDER BY t.id DESC`
  );

  if (!hasPagination) {
    return rows;
  }

  const countRows = await query(`SELECT COUNT(*) AS total FROM teachers`);
  const total = Number(countRows?.[0]?.total || 0);

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
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

export async function getActiveSubjectOfferingForAssignment(data, conn) {
  const [rows] = await conn.execute(
    `
      SELECT id
      FROM subject_offerings
      WHERE class_id = ?
        AND subject_id = ?
        AND is_active = TRUE
        AND (section_id IS NULL OR section_id = ?)
      LIMIT 1
    `,
    [data.class_id, data.subject_id, data.section_id]
  );

  return rows[0] || null;
}

/* ------------------ DELETE ------------------ */

export async function deleteTeacher(id, conn) {
  const executor = conn || {
    execute: async (sql, params) => [await query(sql, params)],
  };

  await executor.execute(
    `DELETE FROM teacher_attendance_logs WHERE teacher_id = ?`,
    [id]
  );

  await executor.execute(
    `DELETE FROM teacher_daily_attendance WHERE teacher_id = ?`,
    [id]
  );

  const [result] = await executor.execute(
    `DELETE FROM teachers WHERE id = ?`,
    [id]
  );

  return result.affectedRows;
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
  const [existingRows] = await conn.execute(`
    SELECT id
    FROM teacher_class_assignments
    WHERE teacher_id = ?
      AND class_id = ?
      AND section_id = ?
      AND subject_id = ?
      AND session_id = ?
    LIMIT 1
  `, [
    data.teacherId,
    data.class_id,
    data.section_id,
    data.subject_id,
    data.session_id
  ]);

  if (existingRows.length) {
    return { assignmentId: existingRows[0].id, created: false };
  }

  const [result] = await conn.execute(`
    INSERT INTO teacher_class_assignments
    (teacher_id, class_id, section_id, subject_id, session_id)
    VALUES (?, ?, ?, ?, ?)
  `, [
    data.teacherId,
    data.class_id,
    data.section_id,
    data.subject_id,
    data.session_id
  ]);

  return { assignmentId: result.insertId, created: true };
}

export async function removeAssignment(id) {
  const result = await query(
    `DELETE FROM teacher_class_assignments WHERE id=?`,
    [id]
  );

  return result.affectedRows > 0;
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

export function getAttendanceDeviceById(deviceId) {
  return query(
    `
      SELECT
        id,
        device_name AS name,
        device_code,
        location
      FROM attendance_devices
      WHERE id = ?
      LIMIT 1
    `,
    [deviceId]
  ).then((rows) => rows[0] || null);
}

export function getAttendanceDeviceUserMappings({ deviceId } = {}) {
  const where = [];
  const params = [];

  if (deviceId) {
    where.push("m.device_id = ?");
    params.push(deviceId);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  return query(
    `
      SELECT
        m.id,
        m.device_id,
        m.device_user_id,
        m.teacher_id,
        m.created_at,
        m.updated_at,
        d.device_name,
        d.device_code,
        d.location,
        t.name AS teacher_name,
        t.employee_id
      FROM teacher_device_users m
      JOIN attendance_devices d ON d.id = m.device_id
      JOIN teachers t ON t.id = m.teacher_id
      ${whereClause}
      ORDER BY d.device_code ASC, m.device_user_id ASC
    `,
    params
  );
}

export async function getAttendanceDeviceUserMappingById(mappingId, conn) {
  const [rows] = await conn.execute(
    `
      SELECT id, device_id, device_user_id, teacher_id
      FROM teacher_device_users
      WHERE id = ?
      LIMIT 1
    `,
    [mappingId]
  );

  return rows[0] || null;
}

export async function upsertAttendanceDeviceUserMapping(data, conn) {
  await conn.execute(
    `
      INSERT INTO teacher_device_users
      (device_id, device_user_id, teacher_id)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        teacher_id = VALUES(teacher_id)
    `,
    [data.deviceId, data.deviceUserId, data.teacherId]
  );

  const [rows] = await conn.execute(
    `
      SELECT id
      FROM teacher_device_users
      WHERE device_id = ?
        AND device_user_id = ?
      LIMIT 1
    `,
    [data.deviceId, data.deviceUserId]
  );

  return rows.length ? Number(rows[0].id) : null;
}

export async function deleteAttendanceDeviceUserMapping(mappingId, conn) {
  const [result] = await conn.execute(
    `
      DELETE FROM teacher_device_users
      WHERE id = ?
    `,
    [mappingId]
  );

  return result.affectedRows > 0;
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
      DATE_FORMAT(l.punch_time, '%Y-%m-%d %H:%i:%s') AS punch_time,
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
      DATE_FORMAT(l.punch_time, '%Y-%m-%d %H:%i:%s') AS punch_time,
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

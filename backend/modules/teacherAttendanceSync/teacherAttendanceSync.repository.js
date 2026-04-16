import { query } from "../../core/db/query.js";

let ensureSyncTablePromise = null;

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return null;
  }
}

export async function ensureSyncTable() {
  if (!ensureSyncTablePromise) {
    ensureSyncTablePromise = query(`
      CREATE TABLE IF NOT EXISTS teacher_attendance_sync_events (
        id BIGINT NOT NULL AUTO_INCREMENT,
        site_id VARCHAR(120) NOT NULL,
        source_log_id BIGINT NOT NULL,
        teacher_id BIGINT NULL,
        teacher_employee_id VARCHAR(50) NULL,
        device_code VARCHAR(100) NULL,
        punch_time DATETIME NOT NULL,
        punch_type ENUM('in','out','unknown') NOT NULL DEFAULT 'unknown',
        payload_json JSON NULL,
        received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_site_source_log (site_id, source_log_id),
        KEY idx_sync_punch_time (punch_time),
        KEY idx_sync_teacher_employee (teacher_employee_id),
        KEY idx_sync_device_code (device_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `).catch((error) => {
      ensureSyncTablePromise = null;
      throw error;
    });
  }

  return ensureSyncTablePromise;
}

export async function upsertSyncEvent({
  siteId,
  sourceLogId,
  teacherId,
  teacherEmployeeId,
  deviceCode,
  punchTime,
  punchType,
  rawPayload,
}) {
  await ensureSyncTable();

  await query(
    `
      INSERT INTO teacher_attendance_sync_events
      (
        site_id,
        source_log_id,
        teacher_id,
        teacher_employee_id,
        device_code,
        punch_time,
        punch_type,
        payload_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        teacher_id = VALUES(teacher_id),
        teacher_employee_id = VALUES(teacher_employee_id),
        device_code = VALUES(device_code),
        punch_time = VALUES(punch_time),
        punch_type = VALUES(punch_type),
        payload_json = VALUES(payload_json)
    `,
    [
      siteId,
      sourceLogId,
      teacherId,
      teacherEmployeeId,
      deviceCode,
      punchTime,
      punchType,
      safeJsonStringify(rawPayload),
    ]
  );
}

export async function findTeacherIdByEmployeeId(employeeId) {
  const normalized = String(employeeId || "").trim();
  if (!normalized) return null;

  const rows = await query(
    `
      SELECT id
      FROM teachers
      WHERE employee_id = ?
      LIMIT 1
    `,
    [normalized]
  );

  return rows.length ? Number(rows[0].id) : null;
}

export async function teacherExists(teacherId) {
  const normalized = Number(teacherId);
  if (!Number.isInteger(normalized) || normalized <= 0) return false;

  const rows = await query(
    `
      SELECT 1
      FROM teachers
      WHERE id = ?
      LIMIT 1
    `,
    [normalized]
  );

  return rows.length > 0;
}

export async function getDeviceIdByCode(deviceCode) {
  const normalized = String(deviceCode || "").trim();
  if (!normalized) return null;

  const rows = await query(
    `
      SELECT id
      FROM attendance_devices
      WHERE device_code = ?
      LIMIT 1
    `,
    [normalized]
  );

  return rows.length ? Number(rows[0].id) : null;
}

export async function attendanceLogExists({ teacherId, deviceId, punchTime }) {
  const rows = await query(
    `
      SELECT id
      FROM teacher_attendance_logs
      WHERE teacher_id = ?
        AND device_id <=> ?
        AND punch_time = ?
      LIMIT 1
    `,
    [teacherId, deviceId, punchTime]
  );

  return rows.length > 0;
}

export async function insertTeacherAttendanceLog({
  teacherId,
  deviceId,
  punchTime,
  punchType,
}) {
  await query(
    `
      INSERT INTO teacher_attendance_logs
      (teacher_id, device_id, punch_time, punch_type)
      VALUES (?, ?, ?, ?)
    `,
    [teacherId, deviceId, punchTime, punchType]
  );
}


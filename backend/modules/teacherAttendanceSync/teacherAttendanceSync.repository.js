import { query } from "../../core/db/query.js";

let ensureSyncTablePromise = null;
let teacherDeviceUsersTableSupportedCache = null;

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return null;
  }
}

function normalizeMachineUserId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/^\d+$/.test(raw)) return raw;
  const normalized = raw.replace(/^0+(?=\d)/, "");
  return normalized || "0";
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

async function hasTeacherDeviceUsersTable() {
  if (typeof teacherDeviceUsersTableSupportedCache === "boolean") {
    return teacherDeviceUsersTableSupportedCache;
  }

  try {
    const rows = await query(
      `
        SELECT 1
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'teacher_device_users'
        LIMIT 1
      `
    );
    teacherDeviceUsersTableSupportedCache = rows.length > 0;
  } catch {
    teacherDeviceUsersTableSupportedCache = false;
  }

  return teacherDeviceUsersTableSupportedCache;
}

async function findUniqueTeacherByExactEmployeeId(employeeId) {
  const normalized = String(employeeId || "").trim();
  if (!normalized) return { teacherId: null, ambiguous: false };

  const rows = await query(
    `
      SELECT id
      FROM teachers
      WHERE employee_id = ?
      LIMIT 2
    `,
    [normalized]
  );

  if (rows.length === 1) {
    return { teacherId: Number(rows[0].id), ambiguous: false };
  }

  return { teacherId: null, ambiguous: rows.length > 1 };
}

async function findUniqueTeacherByEmployeeNumericPart(deviceUserComparable) {
  const normalized = String(deviceUserComparable || "").trim();
  if (!normalized || !/^\d+$/.test(normalized)) {
    return { teacherId: null, ambiguous: false };
  }

  const rows = await query(
    `
      SELECT id
      FROM teachers
      WHERE employee_id REGEXP '[0-9]'
        AND COALESCE(
          NULLIF(
            TRIM(LEADING '0' FROM REGEXP_REPLACE(employee_id, '[^0-9]', '')),
            ''
          ),
          '0'
        ) = ?
      LIMIT 2
    `,
    [normalized]
  );

  if (rows.length === 1) {
    return { teacherId: Number(rows[0].id), ambiguous: false };
  }

  return { teacherId: null, ambiguous: rows.length > 1 };
}

export async function getTeacherMappingForDeviceUser({ deviceUserId, deviceId = null }) {
  const normalized = String(deviceUserId || "").trim();
  if (!normalized) return { teacherId: null, source: "empty" };
  const normalizedComparable = normalizeMachineUserId(normalized);

  const normalizedDeviceId = Number(deviceId);
  const resolvedDeviceId =
    Number.isInteger(normalizedDeviceId) && normalizedDeviceId > 0
      ? normalizedDeviceId
      : null;
  let deviceHasMappings = false;

  if (resolvedDeviceId && (await hasTeacherDeviceUsersTable())) {
    const mappedRows = await query(
      `
        SELECT teacher_id, device_user_id
        FROM teacher_device_users
        WHERE device_id = ?
      `,
      [resolvedDeviceId]
    );

    const matchedRow = mappedRows.find((row) => {
      const candidate = String(row.device_user_id || "").trim();
      if (!candidate) return false;
      if (candidate === normalized) return true;
      return normalizeMachineUserId(candidate) === normalizedComparable;
    });

    if (matchedRow) {
      return {
        teacherId: Number(matchedRow.teacher_id),
        source: "device_user_mapping",
        shouldAutoMap: false,
      };
    }

    const deviceHasMappingsRows = await query(
      `
        SELECT 1
        FROM teacher_device_users
        WHERE device_id = ?
        LIMIT 1
      `,
      [resolvedDeviceId]
    );

    deviceHasMappings = deviceHasMappingsRows.length > 0;
  }

  const exactMatch = await findUniqueTeacherByExactEmployeeId(normalized);
  if (exactMatch.teacherId) {
    return {
      teacherId: exactMatch.teacherId,
      source: "employee_id_exact",
      shouldAutoMap: Boolean(resolvedDeviceId),
    };
  }

  if (exactMatch.ambiguous) {
    return { teacherId: null, source: "employee_id_ambiguous", shouldAutoMap: false };
  }

  if (normalizedComparable !== normalized) {
    const normalizedExactMatch = await findUniqueTeacherByExactEmployeeId(normalizedComparable);
    if (normalizedExactMatch.teacherId) {
      return {
        teacherId: normalizedExactMatch.teacherId,
        source: "employee_id_normalized_exact",
        shouldAutoMap: Boolean(resolvedDeviceId),
      };
    }
    if (normalizedExactMatch.ambiguous) {
      return { teacherId: null, source: "employee_id_ambiguous", shouldAutoMap: false };
    }
  }

  const numericMatch = await findUniqueTeacherByEmployeeNumericPart(normalizedComparable);
  if (numericMatch.teacherId) {
    return {
      teacherId: numericMatch.teacherId,
      source: "employee_id_numeric_unique_fallback",
      shouldAutoMap: Boolean(resolvedDeviceId),
    };
  }

  if (numericMatch.ambiguous) {
    return { teacherId: null, source: "employee_id_numeric_ambiguous", shouldAutoMap: false };
  }

  if (deviceHasMappings) {
    return { teacherId: null, source: "device_user_unmapped", shouldAutoMap: false };
  }

  return { teacherId: null, source: "none", shouldAutoMap: false };
}

export async function upsertTeacherDeviceUserMapping({
  deviceId,
  deviceUserId,
  teacherId,
}) {
  const normalizedDeviceId = Number(deviceId);
  const normalizedTeacherId = Number(teacherId);
  const normalizedDeviceUserId = normalizeMachineUserId(deviceUserId);

  if (
    !Number.isInteger(normalizedDeviceId) ||
    normalizedDeviceId <= 0 ||
    !Number.isInteger(normalizedTeacherId) ||
    normalizedTeacherId <= 0 ||
    !normalizedDeviceUserId
  ) {
    return null;
  }

  if (!(await hasTeacherDeviceUsersTable())) {
    return null;
  }

  const existingRows = await query(
    `
      SELECT id, device_user_id
      FROM teacher_device_users
      WHERE device_id = ?
    `,
    [normalizedDeviceId]
  );

  const matchedRow = existingRows.find(
    (row) => normalizeMachineUserId(row.device_user_id) === normalizedDeviceUserId
  );

  if (matchedRow) {
    await query(
      `
        UPDATE teacher_device_users
        SET teacher_id = ?,
            device_user_id = ?
        WHERE id = ?
      `,
      [normalizedTeacherId, normalizedDeviceUserId, Number(matchedRow.id)]
    );
    return Number(matchedRow.id);
  }

  await query(
    `
      INSERT INTO teacher_device_users
      (device_id, device_user_id, teacher_id)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        teacher_id = VALUES(teacher_id)
    `,
    [normalizedDeviceId, normalizedDeviceUserId, normalizedTeacherId]
  );

  const rows = await query(
    `
      SELECT id
      FROM teacher_device_users
      WHERE device_id = ?
        AND device_user_id = ?
      LIMIT 1
    `,
    [normalizedDeviceId, normalizedDeviceUserId]
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

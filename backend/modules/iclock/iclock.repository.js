import { query } from "../../core/db/query.js";

const commandQueueByDevice = new Map();
let teacherDeviceUsersTableSupportedCache = null;

function normalizeMachineUserId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/^\d+$/.test(raw)) return raw;
  const normalized = raw.replace(/^0+(?=\d)/, "");
  return normalized || "0";
}

export function queueDeviceCommand(deviceCode, command) {
  const key = deviceCode || "__default__";
  commandQueueByDevice.set(key, String(command || "").trim());
}

export function consumeDeviceCommand(deviceCode) {
  const key = deviceCode || "__default__";
  const command = commandQueueByDevice.get(key);
  if (!command) return null;

  commandQueueByDevice.delete(key);
  return command;
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

export async function getTeacherMappingForDeviceUser({ deviceUserId, deviceId = null }) {
  const normalized = String(deviceUserId || "").trim();
  if (!normalized) return { teacherId: null, source: "empty" };
  const normalizedComparable = normalizeMachineUserId(normalized);

  const normalizedDeviceId = Number(deviceId);
  const resolvedDeviceId =
    Number.isInteger(normalizedDeviceId) && normalizedDeviceId > 0
      ? normalizedDeviceId
      : null;

  // Preferred mapping: (device_id, device_user_id) -> teacher_id
  // This avoids collisions when different devices reuse the same user_id.
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
      };
    }

    // If this device already has explicit mappings, do not fall back globally.
    const deviceHasMappings = await query(
      `
        SELECT 1
        FROM teacher_device_users
        WHERE device_id = ?
        LIMIT 1
      `,
      [resolvedDeviceId]
    );

    if (deviceHasMappings.length) {
      return { teacherId: null, source: "device_user_unmapped" };
    }
  }

  let rows = await query(
    `
      SELECT id
      FROM teachers
      WHERE employee_id = ?
      LIMIT 1
    `,
    [normalized]
  );

  if (!rows.length && normalizedComparable !== normalized) {
    rows = await query(
      `
        SELECT id
        FROM teachers
        WHERE employee_id = ?
        LIMIT 1
      `,
      [normalizedComparable]
    );
  }

  if (!rows.length && /^\d+$/.test(normalizedComparable)) {
    rows = await query(
      `
        SELECT id
        FROM teachers
        WHERE id = ?
        LIMIT 1
      `,
      [Number(normalizedComparable)]
    );
  }

  if (rows.length) {
    return { teacherId: Number(rows[0].id), source: "legacy_global_mapping" };
  }

  return { teacherId: null, source: "none" };
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

export async function getDeviceById(deviceId) {
  const normalized = Number(deviceId);
  if (!Number.isInteger(normalized) || normalized <= 0) return null;

  const rows = await query(
    `
      SELECT id, device_code, device_name
      FROM attendance_devices
      WHERE id = ?
      LIMIT 1
    `,
    [normalized]
  );

  return rows.length ? rows[0] : null;
}

export async function getAllDevicesForPull() {
  return query(
    `
      SELECT id, device_code, device_name
      FROM attendance_devices
      WHERE device_code IS NOT NULL
        AND TRIM(device_code) <> ''
      ORDER BY id ASC
    `
  );
}

export async function getLatestPunchTimeByDeviceId(deviceId) {
  const normalized = Number(deviceId);
  if (!Number.isInteger(normalized) || normalized <= 0) return null;

  const rows = await query(
    `
      SELECT MAX(punch_time) AS latest_punch_time
      FROM teacher_attendance_logs
      WHERE device_id = ?
    `,
    [normalized]
  );

  return rows.length ? rows[0]?.latest_punch_time || null : null;
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

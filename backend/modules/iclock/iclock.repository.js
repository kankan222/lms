import { query } from "../../core/db/query.js";

const commandQueueByDevice = new Map();

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

export async function getTeacherIdForDeviceUser(deviceUserId) {
  const normalized = String(deviceUserId || "").trim();
  if (!normalized) return null;

  let rows = await query(
    `
      SELECT id
      FROM teachers
      WHERE employee_id = ?
      LIMIT 1
    `,
    [normalized]
  );

  if (!rows.length && /^\d+$/.test(normalized)) {
    rows = await query(
      `
        SELECT id
        FROM teachers
        WHERE id = ?
        LIMIT 1
      `,
      [Number(normalized)]
    );
  }

  return rows.length ? Number(rows[0].id) : null;
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

import * as repo from "./iclock.repository.js";
import { logTeacherAttendance } from "../teachers/teacher.service.js";

function readBodyText(body) {
  if (Buffer.isBuffer(body)) return body.toString("utf8");
  if (typeof body === "string") return body;
  if (body && typeof body === "object") return JSON.stringify(body);
  return "";
}

function parseDevicePayload(bodyText) {
  const start = bodyText.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < bodyText.length; i += 1) {
    const ch = bodyText[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{") {
      depth += 1;
      continue;
    }

    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const jsonPart = bodyText.slice(start, i + 1);
        try {
          return JSON.parse(jsonPart);
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function formatDeviceDateTime(value) {
  const raw = String(value || "").trim();
  if (!/^\d{14}$/.test(raw)) return null;

  const yyyy = raw.slice(0, 4);
  const mm = raw.slice(4, 6);
  const dd = raw.slice(6, 8);
  const hh = raw.slice(8, 10);
  const mi = raw.slice(10, 12);
  const ss = raw.slice(12, 14);
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function getDeviceUserId(payload) {
  return String(payload?.user_id || payload?.PIN || payload?.UserID || "").trim() || null;
}

function normalizeGlogPayload(headers, payload) {
  return {
    type: "attendance",
    requestCode: "realtime_glog",
    deviceCode: String(headers?.dev_id || "").trim() || null,
    deviceUserId: getDeviceUserId(payload),
    punchTime: formatDeviceDateTime(payload?.io_time),
    punchType: "unknown",
    ioMode: payload?.io_mode ?? null,
    verifyMode: payload?.verify_mode ?? null,
  };
}

const recentEventCache = new Map();
const RECENT_TTL_MS = 10 * 60 * 1000;

function pruneRecentEventCache(now) {
  for (const [key, seenAt] of recentEventCache.entries()) {
    if (now - seenAt > RECENT_TTL_MS) {
      recentEventCache.delete(key);
    }
  }
}

function isRecentDuplicate(eventKey) {
  const now = Date.now();
  pruneRecentEventCache(now);
  const seenAt = recentEventCache.get(eventKey);
  if (seenAt && now - seenAt <= RECENT_TTL_MS) return true;
  recentEventCache.set(eventKey, now);
  return false;
}

export function getPollResponse({ headers }) {
  const deviceCode = String(headers?.dev_id || "").trim() || null;
  return repo.consumeDeviceCommand(deviceCode) || "OK";
}

export function parseIncomingPacket({ headers, body }) {
  const requestCode = String(headers?.request_code || "").trim().toLowerCase();
  const bodyText = readBodyText(body);
  const payload = parseDevicePayload(bodyText);
  const deviceCode = String(headers?.dev_id || "").trim() || null;

  if (requestCode === "realtime_glog") {
    return normalizeGlogPayload(headers, payload);
  }

  if (requestCode === "realtime_enroll_data") {
    return {
      type: "enrollment",
      requestCode,
      deviceCode,
      deviceUserId: getDeviceUserId(payload),
    };
  }

  if (requestCode === "receive_cmd") {
    return {
      type: "heartbeat",
      requestCode,
      deviceCode,
      deviceTime: payload?.fk_time || null,
    };
  }

  return {
    type: "other",
    requestCode: requestCode || "unknown",
    deviceCode,
    hasPayload: Boolean(payload),
  };
}

export function logPacket(packet) {
  if (packet.type === "attendance") {
    console.log("ICLOCK ATTENDANCE PACKET:", packet);
    return;
  }

  if (packet.type === "enrollment") {
    console.log("ICLOCK ENROLLMENT PACKET:", packet);
    return;
  }

  if (packet.type === "heartbeat") {
    console.log("ICLOCK HEARTBEAT PACKET:", packet);
    return;
  }

  console.log("ICLOCK OTHER PACKET:", packet);
}

export async function handleIncomingPacket({ headers, body }) {
  const packet = parseIncomingPacket({ headers, body });

  if (packet.type !== "attendance") {
    logPacket(packet);
    return;
  }

  if (!packet.deviceUserId || !packet.punchTime) {
    console.log("ICLOCK ATTENDANCE INVALID:", packet);
    return;
  }

  const eventKey = `${packet.deviceCode || "unknown"}|${packet.deviceUserId}|${packet.punchTime}`;
  if (isRecentDuplicate(eventKey)) {
    console.log("ICLOCK DUPLICATE SKIPPED:", eventKey);
    return;
  }

  const teacherId = await repo.getTeacherIdForDeviceUser(packet.deviceUserId);
  if (!teacherId) {
    console.log("ICLOCK NO TEACHER MAPPING:", {
      deviceUserId: packet.deviceUserId,
      hint: "Set teachers.employee_id equal to device user_id.",
    });
    return;
  }

  const deviceId = await repo.getDeviceIdByCode(packet.deviceCode);
  if (!deviceId) {
    console.log("ICLOCK NO DEVICE MAPPING:", {
      deviceCode: packet.deviceCode,
      hint: "Create attendance_devices row with matching device_code.",
    });
  }

  const alreadyExists = await repo.attendanceLogExists({
    teacherId,
    deviceId,
    punchTime: packet.punchTime,
  });
  if (alreadyExists) {
    console.log("ICLOCK DUPLICATE (DB) SKIPPED:", {
      teacherId,
      deviceId,
      punchTime: packet.punchTime,
    });
    return;
  }

  await logTeacherAttendance({
    teacherId,
    deviceId,
    punchTime: packet.punchTime,
    punchType: packet.punchType,
  });

  console.log("ICLOCK ATTENDANCE STORED:", {
    teacherId,
    deviceId,
    punchTime: packet.punchTime,
    punchType: packet.punchType,
    ioMode: packet.ioMode,
    verifyMode: packet.verifyMode,
  });
}

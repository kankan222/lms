import * as repo from "./iclock.repository.js";
import { logTeacherAttendance } from "../teachers/teacher.service.js";

function readBodyText(body) {
  if (Buffer.isBuffer(body)) return body.toString("utf8");
  if (typeof body === "string") return body;
  if (body && typeof body === "object") return JSON.stringify(body);
  return "";
}

function safeDecode(value) {
  const raw = String(value ?? "");
  try {
    return decodeURIComponent(raw.replace(/\+/g, "%20"));
  } catch {
    return raw;
  }
}

function pickQueryValue(query = {}, keys = []) {
  for (const key of keys) {
    const value = query?.[key];
    if (value === undefined || value === null) continue;

    const normalized = Array.isArray(value) ? String(value[0] || "").trim() : String(value).trim();
    if (normalized) return normalized;
  }
  return null;
}

function resolveDeviceCode(headers = {}, query = {}) {
  return (
    String(headers?.dev_id || "").trim() ||
    pickQueryValue(query, ["dev_id", "device_id", "SN", "sn", "serial", "device_sn"]) ||
    null
  );
}

function resolveRequestCode(headers = {}, query = {}) {
  const fromHeader = String(headers?.request_code || "").trim().toLowerCase();
  if (fromHeader) return fromHeader;

  const fromQuery =
    pickQueryValue(query, ["request_code", "request", "rq"])?.toLowerCase() || "";
  if (fromQuery) return fromQuery;

  const table = pickQueryValue(query, ["table", "Table"])?.toLowerCase() || "";
  if (table === "attlog") return "table_attlog";
  if (table === "operlog") return "table_operlog";

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

function normalizeDateTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const fromCompact = formatDeviceDateTime(raw);
  if (fromCompact) return fromCompact;

  if (/^\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return raw.replaceAll("/", "-").replace("T", " ");
  }

  const dateOnly = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (dateOnly) {
    return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]} 00:00:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return raw.replace("T", " ");
  }

  return null;
}

function getDeviceUserId(payload) {
  return (
    String(
      payload?.user_id ||
      payload?.userid ||
      payload?.PIN ||
      payload?.pin ||
      payload?.UserID ||
      payload?.enrollid ||
      payload?.badgenumber ||
      ""
    ).trim() || null
  );
}

function parseModeList(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

const DEFAULT_IN_MODES = new Set(["0", "3", "4"]);
const DEFAULT_OUT_MODES = new Set(["1", "2", "5"]);

const inModes = (() => {
  const configured = parseModeList(process.env.ICLOCK_IO_MODE_IN);
  return configured.size ? configured : DEFAULT_IN_MODES;
})();

const outModes = (() => {
  const configured = parseModeList(process.env.ICLOCK_IO_MODE_OUT);
  return configured.size ? configured : DEFAULT_OUT_MODES;
})();

function mapIoModeToPunchType(ioMode) {
  const normalized = String(ioMode ?? "").trim();
  if (!normalized) return "unknown";
  if (inModes.has(normalized)) return "in";
  if (outModes.has(normalized)) return "out";

  const lower = normalized.toLowerCase();
  if (["in", "checkin", "check_in", "i"].includes(lower)) return "in";
  if (["out", "checkout", "check_out", "o"].includes(lower)) return "out";
  return "unknown";
}

function normalizeGlogPayload(headers, payload) {
  const ioMode = payload?.io_mode ?? null;
  return {
    type: "attendance",
    requestCode: "realtime_glog",
    deviceCode: String(headers?.dev_id || "").trim() || null,
    deviceUserId: getDeviceUserId(payload),
    punchTime: formatDeviceDateTime(payload?.io_time),
    punchType: mapIoModeToPunchType(ioMode),
    ioMode,
    verifyMode: payload?.verify_mode ?? null,
  };
}

function normalizeAttendanceFromPayload({
  requestCode,
  deviceCode,
  payload,
}) {
  const ioMode = payload?.io_mode ?? payload?.status ?? payload?.inout ?? null;
  return {
    type: "attendance",
    requestCode: String(requestCode || "unknown"),
    deviceCode: String(deviceCode || "").trim() || null,
    deviceUserId: getDeviceUserId(payload),
    punchTime: normalizeDateTime(
      payload?.io_time ||
      payload?.punch_time ||
      payload?.datetime ||
      payload?.time ||
      payload?.atttime
    ),
    punchType: mapIoModeToPunchType(ioMode),
    ioMode,
    verifyMode: payload?.verify_mode ?? payload?.verify ?? null,
  };
}

function parseAttendanceLineParts(line) {
  const text = String(line || "").trim();
  if (!text) return [];

  const primary = text
    .split(/[\t,;]+/)
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (primary.length >= 2) return primary;

  return text
    .split(/\s+/)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function looksLikeDateTimeToken(token) {
  return (
    /^\d{14}$/.test(token) ||
    /^\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(token)
  );
}

function looksLikeDateOnlyToken(token) {
  return /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(String(token || "").trim());
}

function looksLikeTimeOnlyToken(token) {
  return /^\d{2}:\d{2}:\d{2}$/.test(String(token || "").trim());
}

function parseKeyValueMap(line) {
  const text = String(line || "").trim();
  if (!text || !text.includes("=")) return {};

  const map = {};

  const urlEncodedStyle = text.includes("&") ? new URLSearchParams(text) : null;
  if (urlEncodedStyle) {
    for (const [key, value] of urlEncodedStyle.entries()) {
      const normalizedKey = String(key || "").trim().toLowerCase();
      if (!normalizedKey) continue;
      map[normalizedKey] = safeDecode(value);
    }
  }

  const normalized = text.replace(/&/g, " ");
  const regex = /([A-Za-z0-9_]+)=([\s\S]*?)(?=\s+[A-Za-z0-9_]+=|$)/g;
  for (const match of normalized.matchAll(regex)) {
    const key = String(match[1] || "").trim().toLowerCase();
    const value = safeDecode(String(match[2] || "").trim());
    if (!key) continue;
    map[key] = value;
  }

  return map;
}

function parseFkWebKeyValueLine(line) {
  const map = parseKeyValueMap(line);
  if (!Object.keys(map).length) return null;

  const dateToken = String(
    map.date || map.logdate || map.io_date || ""
  ).trim();
  const timeToken = String(
    map.clock || map.logtime || map.io_clock || ""
  ).trim();

  let punchTime = normalizeDateTime(
    map.io_time || map.datetime || map.time || map.punch_time || map.atttime
  );
  if (!punchTime && dateToken && timeToken) {
    punchTime = normalizeDateTime(`${dateToken} ${timeToken}`);
  }

  const deviceUserId = String(
    map.user_id || map.userid || map.pin || map.enrollid || map.badgenumber || ""
  ).trim();

  if (!deviceUserId || !punchTime) return null;

  return {
    deviceUserId,
    punchTime,
    ioMode: map.io_mode || map.status || map.inout || null,
    verifyMode: map.verify_mode || map.verify || null,
  };
}

function parseFkWebTabLine(line) {
  const withoutPrefix = String(line || "")
    .replace(/^attlog[:\s]*/i, "")
    .trim();
  const parts = parseAttendanceLineParts(withoutPrefix);
  if (parts.length < 2) return null;

  let timeIndex = parts.findIndex((item) => looksLikeDateTimeToken(item));
  let punchTime = timeIndex >= 0 ? normalizeDateTime(parts[timeIndex]) : null;
  let dateTimeTokenSpan = 1;

  if (!punchTime) {
    const combinedIndex = parts.findIndex(
      (item, index) =>
        looksLikeDateOnlyToken(item) && looksLikeTimeOnlyToken(parts[index + 1])
    );
    if (combinedIndex >= 0) {
      timeIndex = combinedIndex;
      dateTimeTokenSpan = 2;
      punchTime = normalizeDateTime(`${parts[combinedIndex]} ${parts[combinedIndex + 1]}`);
    }
  }

  if (!punchTime) return null;

  const candidateTokens = parts.filter(
    (item) =>
      !looksLikeDateTimeToken(item) &&
      !looksLikeDateOnlyToken(item) &&
      !looksLikeTimeOnlyToken(item) &&
      !/^(attlog|verify|status|punch|type|date|time)$/i.test(String(item || "").trim())
  );

  const firstToken = String(candidateTokens[0] || parts[0] || "").trim();
  const fallbackToken = String(candidateTokens[1] || parts[1] || "").trim();
  const deviceUserId =
    firstToken && !looksLikeDateTimeToken(firstToken)
      ? firstToken
      : fallbackToken && !looksLikeDateTimeToken(fallbackToken)
        ? fallbackToken
        : null;

  if (!deviceUserId) return null;

  // Most FKWeb payloads keep status/io mode near datetime.
  const ioModeCandidates = [
    parts[timeIndex + dateTimeTokenSpan],
    parts[timeIndex + dateTimeTokenSpan + 1],
    parts[3],
    parts[2],
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  return {
    deviceUserId,
    punchTime,
    ioMode: ioModeCandidates[0] ?? null,
    verifyMode: null,
  };
}

function parseFkWebAttendancePayload({ bodyText, query, headers }) {
  const table = pickQueryValue(query, ["table", "Table"])?.toLowerCase() || "";
  if (table !== "attlog") return [];

  const deviceCode = resolveDeviceCode(headers, query);
  const lines = String(bodyText || "")
    .replace(/\0/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const entries = [];
  for (const line of lines) {
    const parsed = parseFkWebKeyValueLine(line) || parseFkWebTabLine(line);
    if (!parsed?.deviceUserId || !parsed?.punchTime) continue;

    entries.push({
      type: "attendance",
      requestCode: "table_attlog",
      deviceCode,
      deviceUserId: parsed.deviceUserId,
      punchTime: parsed.punchTime,
      ioMode: parsed.ioMode,
      verifyMode: parsed.verifyMode,
      punchType: mapIoModeToPunchType(parsed.ioMode),
    });
  }

  if (!entries.length && lines.length) {
    console.log("ICLOCK ATTLOG UNPARSED SAMPLE:", {
      deviceCode,
      query,
      lineCount: lines.length,
      sample: lines.slice(0, 3),
    });
  }

  return entries;
}

const recentEventCache = new Map();
const RECENT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_PULL_LOOKBACK_MINUTES = 5;
const DEFAULT_PULL_WINDOW_HOURS = 24;
const LOG_THROTTLE_MS = 30 * 1000;
const logThrottleCache = new Map();

function shouldLogWithThrottle(key, throttleMs = LOG_THROTTLE_MS) {
  const now = Date.now();
  const previous = logThrottleCache.get(key) || 0;
  if (now - previous < throttleMs) return false;
  logThrottleCache.set(key, now);

  // Prevent unbounded growth in long-running dev sessions.
  if (logThrottleCache.size > 5000) {
    for (const [cacheKey, ts] of logThrottleCache.entries()) {
      if (now - ts > throttleMs * 10) {
        logThrottleCache.delete(cacheKey);
      }
    }
  }

  return true;
}

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

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatCommandDateTime(value) {
  const date = toDate(value);
  if (!date) return null;
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function applyTemplate(template, placeholders) {
  return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, token) => {
    const value = placeholders[token];
    return value === undefined || value === null ? "" : String(value);
  });
}

async function buildPullCommandForDevice({
  device,
  commandTemplate,
  fromTime,
  toTime,
  lookbackMinutes,
  defaultWindowHours,
}) {
  const template = String(commandTemplate || "").trim();
  if (!template) return null;

  const now = toDate(toTime) || new Date();
  const latestPunchTime = await repo.getLatestPunchTimeByDeviceId(device.id);
  const latest = toDate(latestPunchTime);

  const lookbackMs = lookbackMinutes * 60 * 1000;
  const defaultWindowMs = defaultWindowHours * 60 * 60 * 1000;
  const computedFrom = latest
    ? new Date(latest.getTime() - lookbackMs)
    : new Date(now.getTime() - defaultWindowMs);

  const from = toDate(fromTime) || computedFrom;
  const fromFormatted = formatCommandDateTime(from);
  const toFormatted = formatCommandDateTime(now);
  const latestFormatted = formatCommandDateTime(latest);

  return applyTemplate(template, {
    device_id: device.id,
    device_code: device.device_code,
    device_name: device.device_name || "",
    from: fromFormatted,
    to: toFormatted,
    latest: latestFormatted || "",
  }).trim();
}

export async function queuePullCommandForDevice({
  deviceId,
  commandTemplate,
  fromTime,
  toTime,
}) {
  const device = await repo.getDeviceById(deviceId);
  if (!device) {
    return { success: false, reason: "device_not_found" };
  }

  const lookbackMinutes = parsePositiveInt(
    process.env.ICLOCK_PULL_LOOKBACK_MINUTES,
    DEFAULT_PULL_LOOKBACK_MINUTES
  );
  const defaultWindowHours = parsePositiveInt(
    process.env.ICLOCK_PULL_DEFAULT_WINDOW_HOURS,
    DEFAULT_PULL_WINDOW_HOURS
  );
  const template = String(
    commandTemplate || process.env.ICLOCK_PULL_COMMAND_TEMPLATE || ""
  ).trim();

  if (!template) {
    return { success: false, reason: "missing_template" };
  }

  const command = await buildPullCommandForDevice({
    device,
    commandTemplate: template,
    fromTime,
    toTime,
    lookbackMinutes,
    defaultWindowHours,
  });

  if (!command) {
    return { success: false, reason: "empty_command" };
  }

  repo.queueDeviceCommand(device.device_code, command);
  return {
    success: true,
    deviceId: device.id,
    deviceCode: device.device_code,
    command,
  };
}

export async function queuePullCommandsForAllDevices() {
  const template = String(process.env.ICLOCK_PULL_COMMAND_TEMPLATE || "").trim();
  if (!template) {
    return {
      queuedCount: 0,
      skippedCount: 0,
      reason: "missing_template",
      items: [],
    };
  }

  const lookbackMinutes = parsePositiveInt(
    process.env.ICLOCK_PULL_LOOKBACK_MINUTES,
    DEFAULT_PULL_LOOKBACK_MINUTES
  );
  const defaultWindowHours = parsePositiveInt(
    process.env.ICLOCK_PULL_DEFAULT_WINDOW_HOURS,
    DEFAULT_PULL_WINDOW_HOURS
  );
  const devices = await repo.getAllDevicesForPull();
  const items = [];
  let queuedCount = 0;

  for (const device of devices) {
    const command = await buildPullCommandForDevice({
      device,
      commandTemplate: template,
      lookbackMinutes,
      defaultWindowHours,
    });

    if (!command) {
      items.push({
        deviceId: device.id,
        deviceCode: device.device_code,
        status: "skipped",
      });
      continue;
    }

    repo.queueDeviceCommand(device.device_code, command);
    queuedCount += 1;
    items.push({
      deviceId: device.id,
      deviceCode: device.device_code,
      status: "queued",
    });
  }

  return {
    queuedCount,
    skippedCount: items.length - queuedCount,
    items,
  };
}

export function getPollResponse({ headers, query }) {
  const deviceCode = resolveDeviceCode(headers, query);
  return repo.consumeDeviceCommand(deviceCode) || "OK";
}

function parseIncomingPacketInternal({ headers, query, body }) {
  const requestCode = resolveRequestCode(headers, query);
  const bodyText = readBodyText(body);
  const keyValuePayload = parseKeyValueMap(bodyText);
  const payload = parseDevicePayload(bodyText);
  const deviceCode = resolveDeviceCode(headers, query);
  const mergedPayload =
    payload && typeof payload === "object"
      ? { ...keyValuePayload, ...payload }
      : keyValuePayload;

  if (requestCode === "realtime_glog") {
    return normalizeGlogPayload(headers, mergedPayload);
  }

  if (requestCode === "realtime_enroll_data") {
    const asAttendance = normalizeAttendanceFromPayload({
      requestCode,
      deviceCode,
      payload: mergedPayload,
    });

    if (asAttendance.deviceUserId && asAttendance.punchTime) {
      return asAttendance;
    }

    return {
      type: "enrollment",
      requestCode,
      deviceCode,
      deviceUserId: getDeviceUserId(mergedPayload),
    };
  }

  if (requestCode === "receive_cmd") {
    return {
      type: "heartbeat",
      requestCode,
      deviceCode,
      deviceTime:
        mergedPayload?.fk_time ||
        mergedPayload?.time ||
        mergedPayload?.datetime ||
        null,
    };
  }

  const fkWebEntries = parseFkWebAttendancePayload({
    bodyText,
    query,
    headers,
  });
  if (fkWebEntries.length) {
    return {
      type: "attendance_batch",
      requestCode: requestCode || "table_attlog",
      deviceCode,
      entries: fkWebEntries,
    };
  }

  return {
    type: "other",
    requestCode: requestCode || "unknown",
    deviceCode,
    hasPayload: Boolean(payload),
  };
}

export function parseIncomingPacket({ headers, query, body }) {
  return parseIncomingPacketInternal({ headers, query, body });
}

export function logPacket(packet) {
  if (packet.type === "attendance") {
    console.log("ICLOCK ATTENDANCE PACKET:", packet);
    return;
  }

  if (packet.type === "enrollment") {
    const key = `enrollment:${packet.deviceCode || "unknown"}:${packet.deviceUserId || "unknown"}`;
    if (!shouldLogWithThrottle(key)) return;
    console.log("ICLOCK ENROLLMENT PACKET:", packet);
    return;
  }

  if (packet.type === "heartbeat") {
    console.log("ICLOCK HEARTBEAT PACKET:", packet);
    return;
  }

  console.log("ICLOCK OTHER PACKET:", packet);
}

async function processAttendancePacket(packet) {
  if (!packet.deviceUserId || !packet.punchTime) {
    console.log("ICLOCK ATTENDANCE INVALID:", packet);
    return "OK";
  }

  const eventKey = `${packet.deviceCode || "unknown"}|${packet.deviceUserId}|${packet.punchTime}`;
  if (isRecentDuplicate(eventKey)) {
    if (shouldLogWithThrottle(`dup:${eventKey}`)) {
      console.log("ICLOCK DUPLICATE SKIPPED:", eventKey);
    }
    return "OK";
  }

  const deviceId = await repo.getDeviceIdByCode(packet.deviceCode);
  if (!deviceId) {
    console.log("ICLOCK NO DEVICE MAPPING:", {
      deviceCode: packet.deviceCode,
      hint: "Create attendance_devices row with matching device_code.",
    });
  }

  const mapping = await repo.getTeacherMappingForDeviceUser({
    deviceUserId: packet.deviceUserId,
    deviceId,
  });
  const teacherId = mapping?.teacherId ? Number(mapping.teacherId) : null;
  if (!teacherId) {
    const hint =
      mapping?.source === "device_user_unmapped"
        ? "Map this device user in teacher_device_users (device_id + device_user_id -> teacher_id)."
        : "Set teachers.employee_id equal to device user_id, or configure teacher_device_users mapping.";
    console.log("ICLOCK NO TEACHER MAPPING:", {
      deviceCode: packet.deviceCode,
      deviceId: deviceId || null,
      deviceUserId: packet.deviceUserId,
      mappingSource: mapping?.source || "none",
      hint,
    });
    return "OK";
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
    return "OK";
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
    mappingSource: mapping?.source || "unknown",
    punchTime: packet.punchTime,
    punchType: packet.punchType,
    ioMode: packet.ioMode,
    verifyMode: packet.verifyMode,
  });

  return "OK";
}

export async function handleIncomingPacket({ headers, query, body }) {
  const packet = parseIncomingPacket({ headers, query, body });

  if (packet.type === "heartbeat") {
    logPacket(packet);
    const command = repo.consumeDeviceCommand(packet.deviceCode);
    if (command) {
      console.log("ICLOCK HEARTBEAT COMMAND SENT:", {
        deviceCode: packet.deviceCode,
        command,
      });
      return command;
    }
    console.log("ICLOCK HEARTBEAT COMMAND SENT:", {
      deviceCode: packet.deviceCode,
      command: "OK",
    });
    return "OK";
  }

  if (packet.type === "attendance_batch") {
    for (const entry of packet.entries || []) {
      await processAttendancePacket(entry);
    }
    console.log("ICLOCK ATTLOG BATCH PROCESSED:", {
      deviceCode: packet.deviceCode,
      count: (packet.entries || []).length,
    });
    return "OK";
  }

  if (packet.type !== "attendance") {
    logPacket(packet);
    return "OK";
  }

  return processAttendancePacket(packet);
}

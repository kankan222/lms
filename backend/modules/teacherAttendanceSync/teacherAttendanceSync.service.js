import AppError from "../../core/errors/AppError.js";
import * as repo from "./teacherAttendanceSync.repository.js";

const MAX_BATCH_SIZE = 1000;
const COMPACT_DATETIME_RE = /^\d{14}$/;
const SQL_DATETIME_RE = /^\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}:\d{2}$/;

function normalizeSourceLogId(value) {
  const normalized = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(normalized) || normalized <= 0) return null;
  return normalized;
}

function normalizeTeacherId(value) {
  const normalized = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(normalized) || normalized <= 0) return null;
  return normalized;
}

function normalizePunchType(value) {
  const raw = String(value || "unknown").trim().toLowerCase();
  if (raw === "in" || raw === "out" || raw === "unknown") return raw;
  if (raw === "checkin" || raw === "check_in" || raw === "i") return "in";
  if (raw === "checkout" || raw === "check_out" || raw === "o") return "out";
  return "unknown";
}

function normalizePunchTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (COMPACT_DATETIME_RE.test(raw)) {
    const yyyy = raw.slice(0, 4);
    const mm = raw.slice(4, 6);
    const dd = raw.slice(6, 8);
    const hh = raw.slice(8, 10);
    const mi = raw.slice(10, 12);
    const ss = raw.slice(12, 14);
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  }

  if (SQL_DATETIME_RE.test(raw)) {
    return raw.replaceAll("/", "-").replace("T", " ");
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.valueOf())) return null;

  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const hh = String(parsed.getHours()).padStart(2, "0");
  const mi = String(parsed.getMinutes()).padStart(2, "0");
  const ss = String(parsed.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function normalizeRecord(record, index) {
  const sourceLogId = normalizeSourceLogId(
    record?.sourceLogId ?? record?.source_log_id ?? record?.id
  );
  if (!sourceLogId) {
    throw new AppError(`records[${index}].source_log_id is required`, 400);
  }

  const punchTime = normalizePunchTime(
    record?.punchTime ?? record?.punch_time ?? record?.time
  );
  if (!punchTime) {
    throw new AppError(`records[${index}].punch_time is required`, 400);
  }

  return {
    sourceLogId,
    teacherId: normalizeTeacherId(record?.teacherId ?? record?.teacher_id),
    teacherEmployeeId: String(
      record?.teacherEmployeeId ?? record?.teacher_employee_id ?? record?.employee_id ?? ""
    ).trim() || null,
    deviceCode: String(record?.deviceCode ?? record?.device_code ?? "").trim() || null,
    punchTime,
    punchType: normalizePunchType(record?.punchType ?? record?.punch_type),
    rawPayload: record,
  };
}

async function resolveTeacherId({ teacherId, teacherEmployeeId }, cache) {
  const cacheKey = `${teacherId || ""}|${teacherEmployeeId || ""}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  let resolvedTeacherId = null;

  if (teacherEmployeeId) {
    resolvedTeacherId = await repo.findTeacherIdByEmployeeId(teacherEmployeeId);
  }

  if (!resolvedTeacherId && teacherId) {
    const exists = await repo.teacherExists(teacherId);
    if (exists) resolvedTeacherId = teacherId;
  }

  cache.set(cacheKey, resolvedTeacherId || null);
  return resolvedTeacherId || null;
}

async function resolveDeviceId(deviceCode, cache) {
  const cacheKey = String(deviceCode || "");
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const resolved = await repo.getDeviceIdByCode(deviceCode);
  cache.set(cacheKey, resolved);
  return resolved;
}

export async function ingestAttendanceLogs({ siteId, records }) {
  const normalizedSiteId = String(siteId || "").trim();
  if (!normalizedSiteId) {
    throw new AppError("siteId is required", 400);
  }

  if (!Array.isArray(records)) {
    throw new AppError("records must be an array", 400);
  }

  if (!records.length) {
    return {
      siteId: normalizedSiteId,
      receivedCount: 0,
      storedCount: 0,
      duplicateCount: 0,
      unmappedTeacherCount: 0,
      invalidCount: 0,
      maxSourceLogId: null,
    };
  }

  if (records.length > MAX_BATCH_SIZE) {
    throw new AppError(`records length cannot exceed ${MAX_BATCH_SIZE}`, 400);
  }

  const teacherCache = new Map();
  const deviceCache = new Map();

  let storedCount = 0;
  let duplicateCount = 0;
  let unmappedTeacherCount = 0;
  let invalidCount = 0;
  let maxSourceLogId = null;

  for (let index = 0; index < records.length; index += 1) {
    let normalized;
    try {
      normalized = normalizeRecord(records[index], index);
    } catch {
      invalidCount += 1;
      continue;
    }

    maxSourceLogId = Math.max(maxSourceLogId || 0, normalized.sourceLogId);

    await repo.upsertSyncEvent({
      siteId: normalizedSiteId,
      sourceLogId: normalized.sourceLogId,
      teacherId: normalized.teacherId,
      teacherEmployeeId: normalized.teacherEmployeeId,
      deviceCode: normalized.deviceCode,
      punchTime: normalized.punchTime,
      punchType: normalized.punchType,
      rawPayload: normalized.rawPayload,
    });

    const resolvedTeacherId = await resolveTeacherId(normalized, teacherCache);
    if (!resolvedTeacherId) {
      unmappedTeacherCount += 1;
      continue;
    }

    const resolvedDeviceId = await resolveDeviceId(normalized.deviceCode, deviceCache);
    const alreadyExists = await repo.attendanceLogExists({
      teacherId: resolvedTeacherId,
      deviceId: resolvedDeviceId,
      punchTime: normalized.punchTime,
    });

    if (alreadyExists) {
      duplicateCount += 1;
      continue;
    }

    try {
      await repo.insertTeacherAttendanceLog({
        teacherId: resolvedTeacherId,
        deviceId: resolvedDeviceId,
        punchTime: normalized.punchTime,
        punchType: normalized.punchType,
      });
      storedCount += 1;
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") {
        duplicateCount += 1;
      } else {
        throw error;
      }
    }
  }

  return {
    siteId: normalizedSiteId,
    receivedCount: records.length,
    storedCount,
    duplicateCount,
    unmappedTeacherCount,
    invalidCount,
    maxSourceLogId,
  };
}


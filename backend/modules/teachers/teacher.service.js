import { pool } from "../../database/pool.js";
import * as repo from "./teacher.repository.js";
import AppError from "../../core/errors/AppError.js";
import { query } from "../../core/db/query.js";

import bcrypt from "bcrypt";

const ALLOWED_CLASS_SCOPES = new Set(["school", "hs"]);

function normalizeClassScope(value) {
  const raw = String(value || "school").trim().toLowerCase();
  if (!ALLOWED_CLASS_SCOPES.has(raw)) {
    throw new AppError("Invalid class_scope. Allowed: school, hs", 400);
  }
  return raw;
}

function isHigherSecondaryClassName(name) {
  const value = String(name || "").trim().toLowerCase();
  if (!value) return false;
  if (value.includes("higher secondary")) return true;
  if (/\bhs\b/.test(value)) return true;
  if (/\b(11|12|xi|xii)\b/.test(value)) return true;
  if (value.includes("1st year") || value.includes("2nd year")) return true;
  return false;
}

function normalizeMachineUserId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/^\d+$/.test(raw)) return raw;
  const normalized = raw.replace(/^0+(?=\d)/, "");
  return normalized || "0";
}

function readClassScope(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  return ALLOWED_CLASS_SCOPES.has(raw) ? raw : "";
}

function normalizeClassScopeFilter(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || raw === "all") return "";
  if (!ALLOWED_CLASS_SCOPES.has(raw)) {
    throw new AppError("Invalid class_scope filter. Allowed: school, hs", 400);
  }
  return raw;
}

function normalizeTeacherIdFilter(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.toLowerCase() === "all") return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError("Invalid teacher_id filter", 400);
  }
  return parsed;
}

function normalizeDateInput(value, fieldName) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new AppError(`Invalid ${fieldName}. Expected YYYY-MM-DD`, 400);
  }
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid ${fieldName}. Expected YYYY-MM-DD`, 400);
  }
  return raw;
}

function resolveMatrixDateRange(startDate, endDate) {
  const today = new Date().toISOString().slice(0, 10);
  const from = normalizeDateInput(startDate, "startDate") || today;
  const to = normalizeDateInput(endDate, "endDate") || today;
  if (from > to) {
    throw new AppError("startDate cannot be later than endDate", 400);
  }
  return { from, to };
}

function buildDateRangeKeys(from, to) {
  if (!from || !to || from > to) return [];
  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return [];

  const keys = [];
  const cursor = new Date(fromDate);
  while (cursor.getTime() <= toDate.getTime()) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function toDateKey(value) {
  const raw = String(value || "").trim();
  const direct = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (direct) return direct[0];

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatScopeFilterLabel(value) {
  if (value === "hs") return "HS";
  if (value === "school") return "School";
  return "All Scopes";
}

/* ------------------ TEACHERS ------------------ */

export async function createTeacher(data) {

  const conn = await pool.getConnection();

  try {
    const employeeId = String(data.employee_id || "").trim() || null;
    const name = String(data.name || "").trim();
    const phone = String(data.phone || "").trim() || null;
    const email = String(data.email || "").trim() || null;
    const password = String(data.password || "");

    if (!name) throw new AppError("Name required", 400);
    if (!phone && !email) throw new AppError("Email or phone required", 400);
    if (!password) throw new AppError("Password required", 400);
    const classScope = normalizeClassScope(data.class_scope);
    await conn.beginTransaction();

    const passwordHash = await bcrypt.hash(password, 10);
    // 1️⃣ create user
    const userId = await repo.createUser({
      email,
      phone,
      password_hash: passwordHash
    }, conn);
    // 2️⃣ assign teacher role
    await repo.assignUserRole(userId, "teacher", conn);

     // 3️⃣ create teacher profile
    const teacherId = await repo.createTeacher({
      ...data,
      employee_id: employeeId,
      name,
      phone,
      email,
      class_scope: classScope,
      user_id: userId
    }, conn);

    await conn.commit();

    return { teacherId };

  } catch (err) {

    await conn.rollback();
    throw err;

  } finally {
    conn.release();
  }
}

export async function getTeachers() {
  return repo.getTeachers();
}

async function resolveActorTeacher(actorUserId) {
  const teacher = await repo.getTeacherByUserId(actorUserId);
  if (!teacher) {
    throw new AppError("Teacher profile not found", 404);
  }
  return teacher;
}

function canManageTeachers(actorPermissions = []) {
  return actorPermissions.includes("teacher.update");
}

export async function getTeachersForActor({
  actorUserId,
  actorPermissions = [],
  page,
  limit,
}) {
  const paging = {};
  if (page !== undefined) paging.page = page;
  if (limit !== undefined) paging.limit = limit;
  const hasPaging = Object.prototype.hasOwnProperty.call(paging, "page")
    || Object.prototype.hasOwnProperty.call(paging, "limit");

  if (canManageTeachers(actorPermissions)) {
    return repo.getTeachers(hasPaging ? paging : undefined);
  }

  const teacher = await resolveActorTeacher(actorUserId);
  if (!hasPaging) {
    return [teacher];
  }

  const currentPage = Math.max(1, Number(page || 1));
  const currentLimit = Math.min(100, Math.max(1, Number(limit || 25)));
  const total = 1;

  return {
    data: currentPage === 1 ? [teacher] : [],
    pagination: {
      page: currentPage,
      limit: currentLimit,
      total,
      totalPages: Math.ceil(total / currentLimit),
    },
  };
}

export async function getTeacherById(id) {

  const teacher = await repo.getTeacherById(id);

  if (!teacher)
    throw new AppError("Teacher not found", 404);

  return teacher;
}

export async function getTeacherForActor({ teacherId, actorUserId, actorPermissions = [] }) {
  if (canManageTeachers(actorPermissions)) {
    return getTeacherById(teacherId);
  }

  const teacher = await resolveActorTeacher(actorUserId);
  if (Number(teacher.id) !== Number(teacherId)) {
    throw new AppError("Forbidden", 403);
  }

  return teacher;
}

export async function updateTeacher(id, data) {
  const existing = await repo.getTeacherById(id);
  if (!existing) {
    throw new AppError("Teacher not found", 404);
  }

  const classScope =
    data.class_scope === undefined
      ? undefined
      : normalizeClassScope(data.class_scope);

  const affected =
    await repo.updateTeacher(id, {
      ...data,
      photo_url: data.photo_url === undefined ? existing.photo_url ?? null : data.photo_url,
      class_scope: classScope,
    });

  if (!affected)
    throw new AppError("Teacher not found", 404);

  if (existing.user_id) {
    await repo.updateTeacherUserContact(existing.user_id, {
      email: data.email ?? existing.email ?? null,
      phone: data.phone ?? existing.phone ?? null,
    });
  }
}

export async function deleteTeacher(id) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const affected = await repo.deleteTeacher(id, conn);

    if (!affected) {
      throw new AppError("Teacher not found", 404);
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function bulkCreateTeachers(rows = []) {
  const successes = [];
  const failures = [];

  for (const row of rows) {
    const meta = row?._meta || {};

    try {
      const result = await createTeacher({
        employee_id: row?.employee_id,
        name: row?.name,
        phone: row?.phone,
        email: row?.email,
        class_scope: row?.class_scope,
        password: row?.password,
        photo_url: row?.photo_url || null,
      });

      successes.push({
        rowNo: meta.rowNo ?? null,
        teacherId: result.teacherId,
        employeeId: meta.employeeId || row?.employee_id || null,
        name: meta.teacherName || row?.name || null,
      });
    } catch (err) {
      failures.push({
        rowNo: meta.rowNo ?? null,
        employeeId: meta.employeeId || row?.employee_id || null,
        name: meta.teacherName || row?.name || null,
        message: err?.message || "Unknown error",
      });
    }
  }

  return {
    totalRows: rows.length,
    createdCount: successes.length,
    failedCount: failures.length,
    successes,
    failures,
  };
}

/* ------------------ TEACHER ASSIGNMENTS ------------------ */

export async function assignTeacher(data) {

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // ensure teacher exists
    const teacher =
      await repo.getTeacherById(data.teacherId);

    if (!teacher)
      throw new AppError("Teacher not found", 404);

    // ensure session active
    const session = await query(`
      SELECT id
      FROM academic_sessions
      WHERE id=? AND is_active=true
    `, [data.session_id]);

    if (!session.length)
      throw new AppError("Session not active", 400);

    const selectedClass = await repo.getClassById(data.class_id);
    if (!selectedClass) {
      throw new AppError("Class not found", 404);
    }

    const teacherScope = normalizeClassScope(teacher.class_scope);
    const classIsHs = isHigherSecondaryClassName(selectedClass.name);
    if (teacherScope === "hs" && !classIsHs) {
      throw new AppError("HS teacher can only be assigned to HS classes", 400);
    }
    if (teacherScope === "school" && classIsHs) {
      throw new AppError("School teacher cannot be assigned to HS classes", 400);
    }

    const subjectOffering = await repo.getActiveSubjectOfferingForAssignment(data, conn);
    if (!subjectOffering) {
      throw new AppError("Subject is not offered for the selected class", 400);
    }

    const result = await repo.assignTeacher(data, conn);

    await conn.commit();
    return result;

  } catch (err) {

    await conn.rollback();
    throw err;

  } finally {
    conn.release();
  }
}

export async function removeAssignment(assignmentId) {

  const affected =
    await repo.removeAssignment(assignmentId);

  if (!affected)
    throw new AppError("Assignment not found", 404);
}

export async function getTeacherAssignments(teacherId) {

  const teacher =
    await repo.getTeacherById(teacherId);

  if (!teacher)
    throw new AppError("Teacher not found", 404);

  return repo.getTeacherAssignments(teacherId);
}

export async function getTeacherAssignmentsForActor({ teacherId, actorUserId, actorPermissions = [] }) {
  const teacher = canManageTeachers(actorPermissions)
    ? await repo.getTeacherById(teacherId)
    : await resolveActorTeacher(actorUserId);

  if (!teacher) {
    throw new AppError("Teacher not found", 404);
  }

  if (!canManageTeachers(actorPermissions) && Number(teacher.id) !== Number(teacherId)) {
    throw new AppError("Forbidden", 403);
  }

  return repo.getTeacherAssignments(teacher.id);
}

/* ------------------ ATTENDANCE DEVICES ------------------ */

export async function createAttendanceDevice(data) {

  const conn = await pool.getConnection();

  try {

    await conn.beginTransaction();

    const deviceId =
      await repo.createAttendanceDevice(data, conn);

    await conn.commit();

    return { deviceId };

  } catch (err) {

    await conn.rollback();
    throw err;

  } finally {
    conn.release();
  }
}

export async function getAttendanceDevices() {
  return repo.getAttendanceDevices();
}

export async function getAttendanceDeviceUserMappings({ deviceId } = {}) {
  const normalizedDeviceId = Number(deviceId || 0);
  return repo.getAttendanceDeviceUserMappings({
    deviceId: Number.isInteger(normalizedDeviceId) && normalizedDeviceId > 0
      ? normalizedDeviceId
      : null,
  });
}

export async function upsertAttendanceDeviceUserMapping(data) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const deviceId = Number(data?.deviceId || data?.device_id);
    const teacherId = Number(data?.teacherId || data?.teacher_id);
    const rawDeviceUserId = String(data?.deviceUserId || data?.device_user_id || "").trim();
    const deviceUserId = normalizeMachineUserId(rawDeviceUserId);

    if (!deviceId) {
      throw new AppError("deviceId is required", 400);
    }
    if (!teacherId) {
      throw new AppError("teacherId is required", 400);
    }
    if (!deviceUserId) {
      throw new AppError("deviceUserId is required", 400);
    }

    const device = await repo.getAttendanceDeviceById(deviceId);
    if (!device) {
      throw new AppError("Attendance device not found", 404);
    }

    const teacher = await repo.getTeacherById(teacherId);
    if (!teacher) {
      throw new AppError("Teacher not found", 404);
    }

    const mappingId = await repo.upsertAttendanceDeviceUserMapping(
      {
        deviceId,
        teacherId,
        deviceUserId,
      },
      conn
    );

    await conn.commit();
    return { mappingId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function deleteAttendanceDeviceUserMapping(mappingId) {
  const normalized = Number(mappingId);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new AppError("Invalid mapping id", 400);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const existing = await repo.getAttendanceDeviceUserMappingById(normalized, conn);
    if (!existing) {
      throw new AppError("Mapping not found", 404);
    }

    await repo.deleteAttendanceDeviceUserMapping(normalized, conn);
    await conn.commit();
    return { success: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* ------------------ ATTENDANCE LOGS ------------------ */

export async function logTeacherAttendance(data) {

  const conn = await pool.getConnection();

  try {

    await conn.beginTransaction();

    const teacherId = Number(data?.teacherId || data?.teacher_id);
    const deviceId =
      data?.deviceId === null || data?.device_id === null
        ? null
        : (data?.deviceId || data?.device_id ? Number(data.deviceId || data.device_id) : null);
    const punchTime = data?.punchTime || data?.punch_time;
    const punchType = String(data?.punchType || data?.punch_type || "unknown").trim().toLowerCase();

    // ensure teacher exists
    const teacher = await repo.getTeacherById(teacherId);

    if (!teacher)
      throw new AppError("Teacher not found", 404);

    await repo.logTeacherAttendance({
      teacherId,
      deviceId,
      punchTime,
      punchType,
    }, conn);

    await conn.commit();

    return { success: true };

  } catch (err) {

    await conn.rollback();
    throw err;

  } finally {
    conn.release();
  }
}

/* ------------------ DAILY ATTENDANCE ------------------ */

export async function getTeacherAttendance({
  teacherId,
  startDate,
  endDate
}) {

  return repo.getTeacherAttendance({
    teacherId,
    startDate,
    endDate
  });
}

export async function getTeacherAttendanceForActor({
  teacherId,
  actorUserId,
  actorPermissions = [],
  startDate,
  endDate,
}) {
  const teacher = canManageTeachers(actorPermissions)
    ? await repo.getTeacherById(teacherId)
    : await resolveActorTeacher(actorUserId);

  if (!teacher) {
    throw new AppError("Teacher not found", 404);
  }

  if (!canManageTeachers(actorPermissions) && Number(teacher.id) !== Number(teacherId)) {
    throw new AppError("Forbidden", 403);
  }

  return repo.getTeacherAttendance({
    teacherId: teacher.id,
    startDate,
    endDate,
  });
}
export async function getAllTeacherAttendance(params) {

  return repo.getAllTeacherAttendance(params);

}

export async function getAllTeacherAttendanceForActor({
  actorUserId,
  actorPermissions = [],
  startDate,
  endDate,
}) {
  if (canManageTeachers(actorPermissions)) {
    return repo.getAllTeacherAttendance({ startDate, endDate });
  }

  const teacher = await resolveActorTeacher(actorUserId);
  return repo.getTeacherAttendance({
    teacherId: teacher.id,
    startDate,
    endDate,
  });
}

export async function getTeacherAttendanceMatrixForActor({
  actorUserId,
  actorPermissions = [],
  startDate,
  endDate,
  teacherId,
  classScope,
}) {
  const { from, to } = resolveMatrixDateRange(startDate, endDate);
  const selectedTeacherId = normalizeTeacherIdFilter(teacherId);
  const selectedScope = normalizeClassScopeFilter(classScope);

  const teachersForActor = await getTeachersForActor({
    actorUserId,
    actorPermissions,
  });

  if (
    !canManageTeachers(actorPermissions) &&
    selectedTeacherId &&
    Number(teachersForActor?.[0]?.id) !== selectedTeacherId
  ) {
    throw new AppError("Forbidden", 403);
  }

  const eligibleTeachers = (Array.isArray(teachersForActor) ? teachersForActor : [])
    .map((teacher) => ({
      id: Number(teacher.id),
      name: String(teacher.name || `Teacher ${teacher.id}`),
      class_scope: readClassScope(teacher.class_scope) || "school",
    }))
    .filter((teacher) => {
      if (!teacher.id) return false;
      if (selectedTeacherId && teacher.id !== selectedTeacherId) return false;
      if (selectedScope && teacher.class_scope !== selectedScope) return false;
      return true;
    });

  const eligibleTeacherIds = new Set(eligibleTeachers.map((teacher) => teacher.id));
  const dateKeys = buildDateRangeKeys(from, to);
  const validDateKeys = new Set(dateKeys);

  const logs = await getAllTeacherAttendanceForActor({
    actorUserId,
    actorPermissions,
    startDate: from,
    endDate: to,
  });

  const teacherPresenceByDate = new Map();
  (Array.isArray(logs) ? logs : []).forEach((row) => {
    const currentTeacherId = Number(row?.teacher_id);
    if (!eligibleTeacherIds.has(currentTeacherId)) return;

    const dateKey = toDateKey(row?.punch_time);
    if (!dateKey || !validDateKeys.has(dateKey)) return;

    if (!teacherPresenceByDate.has(currentTeacherId)) {
      teacherPresenceByDate.set(currentTeacherId, new Set());
    }

    teacherPresenceByDate.get(currentTeacherId).add(dateKey);
  });

  const rows = eligibleTeachers
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((teacher) => {
      const presentDates = teacherPresenceByDate.get(teacher.id) || new Set();
      const statusByDate = {};

      dateKeys.forEach((dateKey) => {
        statusByDate[dateKey] = presentDates.has(dateKey) ? "present" : "absent";
      });

      const presentDays = dateKeys.filter((dateKey) => statusByDate[dateKey] === "present").length;

      return {
        id: teacher.id,
        name: teacher.name,
        class_scope: teacher.class_scope,
        presentDays,
        absentDays: Math.max(dateKeys.length - presentDays, 0),
        statusByDate,
      };
    });

  const selectedTeacher = selectedTeacherId
    ? eligibleTeachers.find((teacher) => teacher.id === selectedTeacherId)
    : null;

  return {
    meta: {
      from,
      to,
      teacherLabel: selectedTeacher?.name || (selectedTeacherId ? `Teacher ${selectedTeacherId}` : "All Teachers"),
      scopeLabel: formatScopeFilterLabel(selectedScope),
    },
    dateKeys,
    rows,
  };
}
export async function generateDailyAttendance(data) {

  const conn = await pool.getConnection();

  try {

    await conn.beginTransaction();

    const teacherId = Number(data?.teacherId || data?.teacher_id);
    if (!teacherId) {
      throw new AppError("teacherId is required", 400);
    }

    const teacher = await repo.getTeacherById(teacherId);
    if (!teacher) {
      throw new AppError("Teacher not found", 404);
    }

    await repo.generateDailyAttendance({
      ...data,
      teacherId,
    }, conn);

    await conn.commit();

    return { success: true };

  } catch (err) {

    await conn.rollback();
    throw err;

  } finally {
    conn.release();
  }
}

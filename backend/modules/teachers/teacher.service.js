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

/* ------------------ TEACHERS ------------------ */

export async function createTeacher(data) {

  const conn = await pool.getConnection();

  try {
    if (!data.employee_id) throw new AppError("Employee ID required", 400);
    if (!data.name) throw new AppError("Name required", 400);
    if (!data.phone) throw new AppError("Phone required", 400);
    if (!data.email) throw new AppError("Email required", 400);
    if (!data.password) throw new AppError("Password required", 400);
    const classScope = normalizeClassScope(data.class_scope);
    await conn.beginTransaction();

    const passwordHash = await bcrypt.hash(data.password, 10);
    // 1️⃣ create user
    const userId = await repo.createUser({
      email: data.email,
      phone: data.phone,
      password_hash: passwordHash
    }, conn);
    // 2️⃣ assign teacher role
    await repo.assignUserRole(userId, "teacher", conn);

     // 3️⃣ create teacher profile
    const teacherId = await repo.createTeacher({
      ...data,
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

export async function getTeacherById(id) {

  const teacher = await repo.getTeacherById(id);

  if (!teacher)
    throw new AppError("Teacher not found", 404);

  return teacher;
}

export async function updateTeacher(id, data) {
  const classScope =
    data.class_scope === undefined
      ? undefined
      : normalizeClassScope(data.class_scope);

  const affected =
    await repo.updateTeacher(id, {
      ...data,
      class_scope: classScope,
    });

  if (!affected)
    throw new AppError("Teacher not found", 404);
}

export async function deleteTeacher(id) {

  const affected =
    await repo.deleteTeacher(id);

  if (!affected)
    throw new AppError("Teacher not found", 404);
}

/* ------------------ TEACHER ASSIGNMENTS ------------------ */

export async function assignTeacher(data) {

  const conn = await pool.getConnection();

  try {
    console.log("Service", data)
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

    await repo.assignTeacher(data, conn);

    await conn.commit();

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

/* ------------------ ATTENDANCE LOGS ------------------ */

export async function logTeacherAttendance(data) {

  const conn = await pool.getConnection();

  try {

    await conn.beginTransaction();

    // ensure teacher exists
    const teacher =
      await repo.getTeacherById(data.teacher_id);

    if (!teacher)
      throw new AppError("Teacher not found", 404);

    await repo.logTeacherAttendance(data, conn);

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
export async function getAllTeacherAttendance(params) {

  return repo.getAllTeacherAttendance(params);

}
export async function generateDailyAttendance(data) {

  const conn = await pool.getConnection();

  try {

    await conn.beginTransaction();

    await repo.generateDailyAttendance(data, conn);

    await conn.commit();

    return { success: true };

  } catch (err) {

    await conn.rollback();
    throw err;

  } finally {
    conn.release();
  }
}

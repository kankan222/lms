import { pool } from "../../database/pool.js";
import * as repo from "./attendance.repository.js";
import AppError from "../../core/errors/AppError.js";
import { query } from "../../core/db/query.js";

export async function takeAttendance(data, userId) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    /* --------------------------------------------------
       1️⃣ SYSTEM CONTEXT (Active Academic Session)
    -------------------------------------------------- */
    const [session] = await query(`
      SELECT id
      FROM academic_sessions
      WHERE is_active = true
      LIMIT 1
    `);

    if (!session) {
      throw new AppError("No active session", 400);
    }

    /* --------------------------------------------------
       2️⃣ AUTHORIZATION (Teacher Assignment)
    -------------------------------------------------- */
    const allowed = await repo.checkTeacherAssignment({
      teacherId: userId,
      classId: data.classId,
      sectionId: data.sectionId,
      sessionId: session.id,
    });

    if (!allowed.length) {
      throw new AppError("Not authorized for this class", 403);
    }

    /* --------------------------------------------------
       3️⃣ BUSINESS VALIDATION
    -------------------------------------------------- */

    // Prevent duplicate attendance
    const existing = await repo.attendanceExists({
      classId: data.classId,
      sectionId: data.sectionId,
      date: data.date,
    });

    if (existing.length) {
      throw new AppError(
        "Attendance already taken for this class today",
        400
      );
    }

    // Fetch enrolled students
    const enrolled = await repo.getEnrolledStudents({
      classId: data.classId,
      sectionId: data.sectionId,
    });

    if (!enrolled.length) {
      throw new AppError("No enrolled students", 400);
    }

    /* --------------------------------------------------
       4️⃣ DATA NORMALIZATION
    -------------------------------------------------- */

    const enrolledSet = new Set(
      enrolled.map((s) => s.student_id)
    );

    // Validate incoming students
    for (const a of data.attendance) {
      if (!enrolledSet.has(a.studentId)) {
        throw new AppError(
          `Student ${a.studentId} not in this class`,
          400
        );
      }
    }

    // Map attendance input
    const attendanceMap = new Map(
      data.attendance.map((a) => [a.studentId, a.status])
    );

    // Default absent handling
    const finalRows = enrolled.map((s) => ({
      studentId: s.student_id,
      status: attendanceMap.get(s.student_id) || "absent",
    }));

    /* --------------------------------------------------
       5️⃣ PERSISTENCE
    -------------------------------------------------- */

    // Create attendance session
    const attendanceSessionId =
      await repo.createAttendanceSession(
        {
          ...data,
          teacherId: userId,
        },
        conn
      );

    // Prepare rows
    const rows = finalRows.map((s) => ({
      sessionId: attendanceSessionId,
      studentId: s.studentId,
      status: s.status,
    }));

    await repo.insertAttendanceRows(rows, conn);

    /* --------------------------------------------------
       6️⃣ COMMIT
    -------------------------------------------------- */
    await conn.commit();

    return { attendanceSessionId };

  } catch (err) {
    await conn.rollback();

    if (err.code === "ER_DUP_ENTRY") {
      throw new AppError("Attendance already recorded", 400);
    }

    throw err;
  } finally {
    conn.release();
  }
}
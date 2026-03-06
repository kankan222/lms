import { pool } from "../../database/pool.js";
import * as repo from "./marks.repository.js";
import * as approvalRepo from "../approvals/approvals.repository.js"
import AppError from "../../core/errors/AppError.js";

export async function submitMarks(data, userId) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    if (!data.examId || !data.subjectId)
      throw new AppError("Exam & subject required", 400);

    // 1️⃣ exam validation
    const exam = await repo.getExam(conn, data.examId);

    if (!exam) throw new AppError("Invalid exam", 400);

    // 2️⃣ teacher authorization
    const allowed = await repo.checkTeacherSubject(conn, {
      teacherId: userId,
      classId: data.classId,
      sectionId: data.sectionId,
      subjectId: data.subjectId,
      sessionId: exam.session_id,
    });

    if (!allowed) throw new AppError("Not authorized", 403);

    // 3️⃣ duplicate protection
    const exists = await repo.marksExist(conn, data);

    if (exists) throw new AppError("Marks already submitted", 400);

    // 4️⃣ enrolled students
    const enrolled = await repo.getEnrolledStudents(conn, {
      classId: data.classId,
      sectionId: data.sectionId,
      sessionId: exam.session_id,
    });

    const enrolledSet = new Set(enrolled.map((s) => s.student_id));

    // validate payload
    for (const m of data.marks) {
      if (!enrolledSet.has(m.studentId))
        throw new AppError(`Student ${m.studentId} invalid`, 400);
    }

    // 5️⃣ build rows
    const rows = data.marks.map((m) => ({
      studentId: m.studentId,
      examId: data.examId,
      subjectId: data.subjectId,
      marks: m.marks,
      enteredBy: userId,
    }));
    console.log("Rows : ", rows);
    console.log("Rows : ", Array.isArray(rows));
    await repo.insertMarks(rows, conn);
    await approvalRepo.createApproval(conn, {
      entityType: "marks",
      entityId: data.examId,
      submittedBy: userId,
    });
    await conn.commit();

    return { submitted: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

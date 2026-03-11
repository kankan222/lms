import { pool } from "../../database/pool.js";
import AppError from "../../core/errors/AppError.js";
import * as repo from "./exams.repository.js";
import { generateMarksheetPdf } from "./marksheetPdf.service.js";

function normalizeSubjects(subjects) {
  if (!Array.isArray(subjects)) return [];
  return subjects
    .map((s) => ({
      subject_id: Number(s.subject_id),
      max_marks: Number(s.max_marks ?? 100),
      pass_marks: Number(s.pass_marks ?? 33)
    }))
    .filter((s) => s.subject_id && s.max_marks > 0);
}

function normalizeScopes(scopes, fallbackClassId, fallbackSectionId) {
  let parsed = Array.isArray(scopes) ? scopes : [];

  if (!parsed.length && fallbackClassId && fallbackSectionId) {
    parsed = [{ class_id: fallbackClassId, section_id: fallbackSectionId }];
  }

  const map = new Map();
  parsed.forEach((s) => {
    const classId = Number(s.class_id);
    const sectionId = Number(s.section_id);
    if (!classId || !sectionId) return;
    map.set(`${classId}-${sectionId}`, { class_id: classId, section_id: sectionId });
  });

  return Array.from(map.values());
}

async function getUserFlags(userId) {
  const [teacher, parent] = await Promise.all([
    repo.getTeacherProfileByUser(userId),
    repo.getParentProfileByUser(userId)
  ]);
  return { isTeacher: Boolean(teacher), isParent: Boolean(parent) };
}

export async function createExam(data, userId) {
  if (!data?.name?.trim()) throw new AppError("Exam name is required", 400);

  const subjects = normalizeSubjects(data.subjects);
  if (!subjects.length) throw new AppError("At least one subject with max marks is required", 400);

  const scopes = normalizeScopes(data.scopes, data.class_id, data.section_id);
  if (!scopes.length) throw new AppError("At least one class-section scope is required", 400);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let sessionId = Number(data.session_id || 0);
    if (!sessionId) sessionId = await repo.getActiveSessionId(conn);
    if (!sessionId) throw new AppError("No active session found", 400);

    const examId = await repo.createExam(conn, {
      name: data.name.trim(),
      session_id: sessionId,
      class_id: scopes[0].class_id,
      section_id: scopes[0].section_id,
      created_by: userId
    });

    await repo.replaceExamScopes(conn, examId, scopes);
    await repo.replaceExamSubjects(conn, examId, subjects);
    await conn.commit();
    return { exam_id: examId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listExams(filters, userId) {
  const { isTeacher } = await getUserFlags(userId);
  return repo.listExams(filters || {}, userId, isTeacher);
}

export async function getExamById(id, userId) {
  const examId = Number(id);
  const exam = await repo.getExamById(examId);
  if (!exam) throw new AppError("Exam not found", 404);

  const [subjects, allScopes] = await Promise.all([
    repo.getExamSubjects(examId),
    repo.getExamScopes(examId)
  ]);

  const { isTeacher } = await getUserFlags(userId);
  let scopes = allScopes;

  if (isTeacher) {
    const allowed = await repo.getAllowedTeacherScopes(userId, examId);
    const allowedKeys = new Set(allowed.map((s) => `${s.class_id}-${s.section_id}`));
    scopes = allScopes.filter((s) => allowedKeys.has(`${s.class_id}-${s.section_id}`));
  }

  return { ...exam, subjects, scopes };
}

export async function updateExam(id, data) {
  const examId = Number(id);
  const existing = await repo.getExamById(examId);
  if (!existing) throw new AppError("Exam not found", 404);

  const subjects = normalizeSubjects(data.subjects);
  if (!subjects.length) throw new AppError("At least one subject with max marks is required", 400);

  const scopes = normalizeScopes(data.scopes, data.class_id, data.section_id);
  if (!scopes.length) throw new AppError("At least one class-section scope is required", 400);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await repo.updateExam(conn, examId, {
      name: (data.name || existing.name).trim(),
      session_id: Number(data.session_id || existing.session_id),
      class_id: scopes[0].class_id,
      section_id: scopes[0].section_id
    });
    await repo.replaceExamScopes(conn, examId, scopes);
    await repo.replaceExamSubjects(conn, examId, subjects);
    await conn.commit();
    return { updated: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function deleteExam(id) {
  const examId = Number(id);
  const existing = await repo.getExamById(examId);
  if (!existing) throw new AppError("Exam not found", 404);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await repo.deleteExam(conn, examId);
    await conn.commit();
    return { deleted: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function ensureTeacherScopeAccess(userId, examId, classId, sectionId, subjectId = null) {
  const allowed = await repo.isTeacherAssignedToExamScope(
    userId,
    examId,
    classId,
    sectionId,
    subjectId
  );
  if (!allowed) {
    throw new AppError("Not authorized for this class/section/subject in selected exam", 403);
  }
}

export async function getMarksGrid(examId, queryParams, userId) {
  const normalizedExamId = Number(examId);
  const classId = Number(queryParams.class_id);
  const sectionId = Number(queryParams.section_id);
  const name = String(queryParams.name || "").trim();

  if (!classId || !sectionId) {
    throw new AppError("class_id and section_id are required", 400);
  }

  const { isTeacher } = await getUserFlags(userId);
  if (isTeacher) {
    await ensureTeacherScopeAccess(userId, normalizedExamId, classId, sectionId);
  }

  return repo.getMarksGrid(normalizedExamId, classId, sectionId, name);
}

export async function submitMarks(examId, data, userId) {
  const normalizedExamId = Number(examId);
  const classId = Number(data.class_id);
  const sectionId = Number(data.section_id);

  if (!classId || !sectionId) {
    throw new AppError("class_id and section_id are required", 400);
  }

  const { isTeacher } = await getUserFlags(userId);
  if (!isTeacher) throw new AppError("Only teachers can submit marks", 403);

  const subjectBlocks = Array.isArray(data.subjects)
    ? data.subjects
    : data.subject_id
      ? [{ subject_id: data.subject_id, marks: data.marks || [] }]
      : [];

  if (!subjectBlocks.length) {
    throw new AppError("subjects[] (or subject_id) is required", 400);
  }

  const students = await repo.getStudentsForScope(normalizedExamId, classId, sectionId);
  const studentSet = new Set(students.map((s) => Number(s.student_id)));

  const rows = [];
  for (const block of subjectBlocks) {
    const subjectId = Number(block.subject_id);
    if (!subjectId || !Array.isArray(block.marks)) {
      throw new AppError("Each subject block needs subject_id and marks[]", 400);
    }

    await ensureTeacherScopeAccess(userId, normalizedExamId, classId, sectionId, subjectId);
    const examSubject = await repo.getExamSubject(normalizedExamId, subjectId);
    if (!examSubject) throw new AppError(`Subject ${subjectId} is not allocated to this exam`, 400);

    for (const m of block.marks) {
      const studentId = Number(m.student_id);
      const marks = Number(m.marks);
      if (!studentSet.has(studentId)) {
        throw new AppError(`Student ${studentId} is not part of selected class/section for this exam`, 400);
      }
      if (Number.isNaN(marks) || marks < 0 || marks > Number(examSubject.max_marks)) {
        throw new AppError(`Marks for student ${studentId} must be between 0 and ${examSubject.max_marks}`, 400);
      }
      rows.push({
        student_id: studentId,
        exam_id: normalizedExamId,
        subject_id: subjectId,
        marks,
        entered_by: userId
      });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await repo.upsertMarks(conn, rows);
    await conn.commit();
    return { saved: true, count: rows.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateMark(markId, data, userId) {
  const entry = await repo.getMarkById(Number(markId));
  if (!entry) throw new AppError("Mark entry not found", 404);

  const { isTeacher } = await getUserFlags(userId);
  if (!isTeacher) throw new AppError("Only teachers can edit marks", 403);

  const scope = await repo.getStudentScopeForExam(entry.student_id, entry.exam_id);
  if (!scope) throw new AppError("Student scope not found for this exam", 400);

  await ensureTeacherScopeAccess(
    userId,
    Number(entry.exam_id),
    Number(scope.class_id),
    Number(scope.section_id),
    Number(entry.subject_id)
  );

  const examSubject = await repo.getExamSubject(entry.exam_id, entry.subject_id);
  const marks = Number(data.marks);
  if (Number.isNaN(marks) || marks < 0 || marks > Number(examSubject.max_marks)) {
    throw new AppError(`Marks must be between 0 and ${examSubject.max_marks}`, 400);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await repo.updateMarkById(conn, Number(markId), marks, userId);
    await conn.commit();
    return { updated: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function deleteMark(markId, userId) {
  const entry = await repo.getMarkById(Number(markId));
  if (!entry) throw new AppError("Mark entry not found", 404);

  const { isTeacher } = await getUserFlags(userId);
  if (!isTeacher) throw new AppError("Only teachers can delete marks", 403);

  const scope = await repo.getStudentScopeForExam(entry.student_id, entry.exam_id);
  if (!scope) throw new AppError("Student scope not found for this exam", 400);

  await ensureTeacherScopeAccess(
    userId,
    Number(entry.exam_id),
    Number(scope.class_id),
    Number(scope.section_id),
    Number(entry.subject_id)
  );

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await repo.deleteMarkById(conn, Number(markId));
    await conn.commit();
    return { deleted: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function approveMarks(examId, data, userId) {
  const normalizedExamId = Number(examId);
  const subjectId = Number(data.subject_id);
  const classId = Number(data.class_id);
  const sectionId = Number(data.section_id);
  const status = data.status;

  const roles = await repo.getUserRoleNames(userId);
  if (!roles.includes("super_admin")) {
    throw new AppError("Admin approval required for marks", 403);
  }

  if (!subjectId || !classId || !sectionId || !["approved", "rejected"].includes(status)) {
    throw new AppError("subject_id, class_id, section_id and valid status are required", 400);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const affected = await repo.approveMarksByExamSubjectScope(
      conn,
      normalizedExamId,
      subjectId,
      classId,
      sectionId,
      status,
      userId
    );
    await conn.commit();
    return { reviewed: true, affected };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function getStudentReport(examId, studentId, userId) {
  const normalizedExamId = Number(examId);
  const normalizedStudentId = Number(studentId);
  const { isTeacher, isParent } = await getUserFlags(userId);

  const scope = await repo.getStudentScopeForExam(normalizedStudentId, normalizedExamId);
  if (!scope) throw new AppError("Student is not part of this exam scope/session", 404);

  if (isTeacher) {
    await ensureTeacherScopeAccess(
      userId,
      normalizedExamId,
      Number(scope.class_id),
      Number(scope.section_id)
    );
  }

  if (isParent) {
    const ownsStudent = await repo.isParentOfStudent(userId, normalizedStudentId);
    if (!ownsStudent) throw new AppError("Not authorized to view this student's report", 403);
  }

  const rows = await repo.getStudentReportRows(normalizedExamId, normalizedStudentId, true);
  if (!rows.length) throw new AppError("No approved marks found for this student in this exam", 404);

  const total = rows.reduce((sum, r) => sum + Number(r.marks || 0), 0);
  const maxTotal = rows.reduce((sum, r) => sum + Number(r.max_marks || 0), 0);
  const percentage = maxTotal ? (total / maxTotal) * 100 : 0;

  return {
    student: { id: rows[0].student_id, name: rows[0].student_name, roll_number: rows[0].roll_number },
    exam: {
      id: rows[0].exam_id,
      name: rows[0].exam_name,
      class_name: rows[0].class_name,
      section_name: rows[0].section_name
    },
    subjects: rows.map((r) => ({
      subject: r.subject_name,
      marks: Number(r.marks || 0),
      max_marks: Number(r.max_marks || 0),
      pass_marks: Number(r.pass_marks || 0)
    })),
    summary: {
      total,
      max_total: maxTotal,
      percentage: Number(percentage.toFixed(2))
    }
  };
}

export async function downloadStudentReport(examId, studentId, userId) {
  const report = await getStudentReport(examId, studentId, userId);
  const buffer = await generateMarksheetPdf(report);
  return {
    buffer,
    fileName: `marksheet-exam-${examId}-student-${studentId}.pdf`
  };
}

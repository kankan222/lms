import { pool } from "../../database/pool.js";
import AppError from "../../core/errors/AppError.js";
import { generateMarksheetPdf } from "../exams/marksheetPdf.service.js";
import * as repo from "./marks.repository.js";

async function getUserContext(userId) {
  const [roles, teacher, parentStudentIds, studentProfile] = await Promise.all([
    repo.getUserRoleNames(userId),
    repo.getTeacherProfileByUser(userId),
    repo.getParentStudentIds(userId),
    repo.getStudentProfileByUser(userId),
  ]);

  return {
    roles,
    isTeacher: Boolean(teacher),
    isParent: parentStudentIds.length > 0,
    isStudent: Boolean(studentProfile),
    parentStudentIds,
    studentId: studentProfile?.id ? Number(studentProfile.id) : null,
  };
}

function canManageExamCatalog(userCtx) {
  return !userCtx.isTeacher && !userCtx.isParent && !userCtx.isStudent;
}

function normalizeNumber(value, fieldName) {
  const parsed = Number(value);
  if (!parsed) throw new AppError(`${fieldName} is required`, 400);
  return parsed;
}

function normalizeSelectionIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => Number(item)).filter(Boolean))];
}

async function ensureTeacherScopeAccess(userId, examId, classId, sectionId, subjectId) {
  const allowed = await repo.isTeacherAssignedToExamScope(
    userId,
    examId,
    classId,
    sectionId,
    subjectId
  );

  if (!allowed) {
    throw new AppError("Not authorized for this class, section, and subject", 403);
  }
}

function formatReport(rows) {
  const total = rows.reduce((sum, row) => sum + Number(row.marks || 0), 0);
  const maxTotal = rows.reduce((sum, row) => sum + Number(row.max_marks || 0), 0);
  const percentage = maxTotal ? (total / maxTotal) * 100 : 0;
  const classScope = String(rows[0].class_scope || "school").trim().toLowerCase();

  return {
    student: {
      id: rows[0].student_id,
      name: rows[0].student_name,
      roll_number: rows[0].roll_number,
    },
    exam: {
      id: rows[0].exam_id,
      name: rows[0].exam_name,
      class_name: rows[0].class_name,
      class_scope: classScope,
      section_name: rows[0].section_name,
      medium: rows[0].medium,
    },
    subjects: rows.map((row) => ({
      subject: row.subject_name,
      marks: Number(row.marks || 0),
      max_marks: Number(row.max_marks || 0),
      pass_marks: Number(row.pass_marks || 0),
    })),
    summary: {
      total,
      max_total: maxTotal,
      percentage: Number(percentage.toFixed(2)),
    },
  };
}

async function getValidatedScope(payload, userId, { teacherOnly = false } = {}) {
  const examId = normalizeNumber(payload.exam_id ?? payload.examId, "exam_id");
  const classId = normalizeNumber(payload.class_id ?? payload.classId, "class_id");
  const sectionId = normalizeNumber(payload.section_id ?? payload.sectionId, "section_id");
  const subjectId = normalizeNumber(payload.subject_id ?? payload.subjectId, "subject_id");
  const medium = String(payload.medium || "").trim().toLowerCase() || null;

  const [exam, examSubject, userCtx] = await Promise.all([
    repo.getExamById(examId),
    repo.getExamSubject(examId, subjectId),
    getUserContext(userId),
  ]);

  if (!exam) throw new AppError("Exam not found", 404);
  if (!examSubject) throw new AppError("Subject is not allocated to the selected exam", 400);
  if (teacherOnly && !userCtx.isTeacher) {
    throw new AppError("Only teachers can perform this action", 403);
  }

  if (userCtx.isTeacher) {
    await ensureTeacherScopeAccess(userId, examId, classId, sectionId, subjectId);
  }

  return { examId, classId, sectionId, subjectId, medium, exam, examSubject, userCtx };
}

export async function getMarksGrid(filters, userId) {
  const { examId, classId, sectionId, subjectId, medium, examSubject } = await getValidatedScope(filters, userId);
  const name = String(filters.name || "").trim();
  const approvalStatus = String(filters.approval_status || "").trim().toLowerCase();

  const students = await repo.getStudentsForScope({
    examId,
    classId,
    sectionId,
    medium,
    name,
  });

  const marks = await repo.getMarksByExamSubjectStudentIds(
    examId,
    subjectId,
    students.map((student) => student.student_id)
  );

  const marksByStudent = new Map(marks.map((row) => [Number(row.student_id), row]));

  let rows = students.map((student) => {
    const entry = marksByStudent.get(Number(student.student_id));
    return {
      mark_id: entry?.mark_id || null,
      student_id: Number(student.student_id),
      roll_number: student.roll_number,
      student_name: student.student_name,
      medium: student.medium,
      marks: entry ? Number(entry.marks) : null,
      approval_status: entry?.approval_status || "draft",
      has_entry: Boolean(entry),
    };
  });

  if (approvalStatus) {
    rows = rows.filter((row) => row.approval_status === approvalStatus);
  }

  return {
    exam_id: examId,
    class_id: classId,
    section_id: sectionId,
    subject: {
      id: Number(examSubject.subject_id),
      name: examSubject.subject_name,
      max_marks: Number(examSubject.max_marks || 0),
      pass_marks: Number(examSubject.pass_marks || 0),
    },
    rows,
  };
}

export async function getPendingApprovalQueue() {
  const rows = await repo.getPendingApprovalScopes();
  return {
    total_pending: rows.reduce((sum, row) => sum + Number(row.pending_count || 0), 0),
    groups: rows.map((row) => ({
      exam_id: Number(row.exam_id),
      exam_name: row.exam_name,
      session_id: Number(row.session_id),
      session_name: row.session_name,
      class_id: Number(row.class_id),
      class_name: row.class_name,
      section_id: Number(row.section_id),
      section_name: row.section_name,
      medium: row.medium || "",
      subject_id: Number(row.subject_id),
      subject_name: row.subject_name,
      pending_count: Number(row.pending_count || 0),
      latest_entry_id: Number(row.latest_entry_id || 0),
    })),
  };
}

export async function getApprovalStatusSummary() {
  const summary = await repo.getApprovalStatusSummary();
  return {
    pending: Number(summary.pending_count || 0),
    draft: Number(summary.draft_count || 0),
    approved: Number(summary.approved_count || 0),
  };
}

export async function getAccessibleExams(userId) {
  const userCtx = await getUserContext(userId);

  if (userCtx.isTeacher) {
    return repo.getTeacherAccessibleExams(userId);
  }

  if (userCtx.isParent) {
    return repo.getOwnedStudentAccessibleExams(userCtx.parentStudentIds);
  }

  if (userCtx.isStudent && userCtx.studentId) {
    return repo.getOwnedStudentAccessibleExams([userCtx.studentId]);
  }

  return repo.getOwnedStudentAccessibleExams([]);
}

export async function getAccessibleExamById(examIdValue, userId) {
  const examId = normalizeNumber(examIdValue, "exam_id");
  const userCtx = await getUserContext(userId);
  const exam = await repo.getExamById(examId);

  if (!exam) {
    throw new AppError("Exam not found", 404);
  }

  if (userCtx.isTeacher) {
    const exams = await repo.getTeacherAccessibleExams(userId);
    if (!exams.some((item) => Number(item.id) === examId)) {
      throw new AppError("Forbidden", 403);
    }
  } else if (userCtx.isParent) {
    const exams = await repo.getOwnedStudentAccessibleExams(userCtx.parentStudentIds);
    if (!exams.some((item) => Number(item.id) === examId)) {
      throw new AppError("Forbidden", 403);
    }
  } else if (userCtx.isStudent && userCtx.studentId) {
    const exams = await repo.getOwnedStudentAccessibleExams([userCtx.studentId]);
    if (!exams.some((item) => Number(item.id) === examId)) {
      throw new AppError("Forbidden", 403);
    }
  } else if (!canManageExamCatalog(userCtx)) {
    throw new AppError("Forbidden", 403);
  }

  const [subjects, scopes] = await Promise.all([
    repo.getExamSubjects(examId),
    repo.getExamScopes(examId),
  ]);
  return {
    ...exam,
    subjects,
    scopes,
  };
}

export async function saveMarks(payload, userId) {
  const { examId, classId, sectionId, subjectId, medium, examSubject } = await getValidatedScope(
    payload,
    userId
  );

  const hasDraftStatus = await repo.supportsMarksDraftStatus();
  if (!hasDraftStatus) {
    throw new AppError(
      "Marks draft workflow is not enabled on this database. Apply migration 20260312_marks_workflow_draft_status.sql.",
      500
    );
  }

  const marks = Array.isArray(payload.marks) ? payload.marks : [];
  if (!marks.length) throw new AppError("marks[] is required", 400);

  const students = await repo.getStudentsForScope({ examId, classId, sectionId, medium });
  const studentIds = new Set(students.map((student) => Number(student.student_id)));

  const rows = marks.map((item) => {
    const studentId = Number(item.student_id ?? item.studentId);
    const marksValue = Number(item.marks);

    if (!studentIds.has(studentId)) {
      throw new AppError(`Student ${studentId} is not part of the selected scope`, 400);
    }

    if (Number.isNaN(marksValue) || marksValue < 0 || marksValue > Number(examSubject.max_marks)) {
      throw new AppError(`Marks for student ${studentId} must be between 0 and ${examSubject.max_marks}`, 400);
    }

    return {
      student_id: studentId,
      exam_id: examId,
      subject_id: subjectId,
      marks: marksValue,
      entered_by: userId,
    };
  });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await repo.upsertMarksDraft(conn, rows);
    await conn.commit();
    return { saved: true, count: rows.length, approval_status: "draft" };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function changeSelectionStatus(payload, userId, options) {
  const { examId, classId, sectionId, subjectId, medium, userCtx } = await getValidatedScope(
    payload,
    userId,
    { teacherOnly: options.teacherOnly }
  );

  const studentIds = normalizeSelectionIds(payload.student_ids ?? payload.studentIds);
  const applyToAll = Boolean(payload.apply_all ?? payload.applyAll);

  if (!applyToAll && !studentIds.length) {
    throw new AppError("Select one or more students or use apply_all", 400);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const affected = await repo.updateApprovalStatusBySelection(conn, {
      examId,
      classId,
      sectionId,
      subjectId,
      medium,
      studentIds: applyToAll ? [] : studentIds,
      currentStatuses: options.currentStatuses,
      nextStatus: options.nextStatus,
      approvedBy: options.nextStatus === "approved" ? userId : null,
    });
    await conn.commit();
    return { affected, approval_status: options.nextStatus };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function submitMarksForApproval(payload, userId) {
  return changeSelectionStatus(payload, userId, {
    teacherOnly: false,
    adminOnly: false,
    currentStatuses: ["draft"],
    nextStatus: "pending",
  });
}

export async function approveMarks(payload, userId) {
  return changeSelectionStatus(payload, userId, {
    teacherOnly: false,
    currentStatuses: ["pending"],
    nextStatus: "approved",
  });
}

export async function rejectMarks(payload, userId) {
  return changeSelectionStatus(payload, userId, {
    teacherOnly: false,
    currentStatuses: ["pending", "approved"],
    nextStatus: "draft",
  });
}

export async function getStudentReport(examIdValue, studentIdValue, userId) {
  const examId = normalizeNumber(examIdValue, "exam_id");
  const studentId = normalizeNumber(studentIdValue, "student_id");
  const userCtx = await getUserContext(userId);

  const scope = await repo.getStudentScopeForExam(studentId, examId);
  if (!scope) throw new AppError("Student is not part of the selected exam scope", 404);

  if (userCtx.isTeacher) {
    const allowed = await repo.isTeacherAssignedToExamScope(
      userId,
      examId,
      Number(scope.class_id),
      Number(scope.section_id)
    );
    if (!allowed) {
      throw new AppError("Not authorized to view this student's marksheet", 403);
    }
  }

  if (userCtx.isParent && !userCtx.parentStudentIds.includes(studentId)) {
    throw new AppError("Not authorized to view this student's marksheet", 403);
  }

  if (userCtx.isStudent && userCtx.studentId !== studentId) {
    throw new AppError("Students can only view their own marksheet", 403);
  }

  const rows = await repo.getStudentReportRows(examId, studentId, true);
  if (!rows.length) {
    throw new AppError("No approved marks found for this student in this exam", 404);
  }

  return formatReport(rows);
}

function resolveOwnedStudentId(query, userCtx) {
  const requestedStudentId = query.student_id ? Number(query.student_id) : null;

  if (userCtx.isStudent) {
    if (requestedStudentId && requestedStudentId !== userCtx.studentId) {
      throw new AppError("Students can only view their own results", 403);
    }
    return userCtx.studentId;
  }

  if (userCtx.isParent) {
    if (requestedStudentId) {
      if (!userCtx.parentStudentIds.includes(requestedStudentId)) {
        throw new AppError("Not authorized to view this student's results", 403);
      }
      return requestedStudentId;
    }

    if (userCtx.parentStudentIds.length === 1) {
      return userCtx.parentStudentIds[0];
    }

    throw new AppError("student_id is required for parents linked to multiple students", 400);
  }

  throw new AppError("Only parents or students can use this endpoint", 403);
}

export async function getMyApprovedResults(query, userId) {
  const userCtx = await getUserContext(userId);
  const examId = normalizeNumber(query.exam_id, "exam_id");
  const studentId = resolveOwnedStudentId(query, userCtx);
  return getStudentReport(examId, studentId, userId);
}

export async function downloadMyApprovedMarksheet(query, userId) {
  const userCtx = await getUserContext(userId);
  const examId = normalizeNumber(query.exam_id, "exam_id");
  const studentId = resolveOwnedStudentId(query, userCtx);
  return downloadStudentReport(examId, studentId, userId);
}

export async function getMyStudents(userId) {
  const userCtx = await getUserContext(userId);

  if (userCtx.isStudent && userCtx.studentId) {
    const rows = await repo.getStudentsByIds([userCtx.studentId]);
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      roll_number: row.roll_number,
      class_name: row.class_name,
      section_name: row.section_name,
    }));
  }

  if (userCtx.isParent) {
    const rows = await repo.getStudentsByIds(userCtx.parentStudentIds);
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      roll_number: row.roll_number,
      class_name: row.class_name,
      section_name: row.section_name,
    }));
  }

  throw new AppError("Only parents or students can use this endpoint", 403);
}

export async function downloadStudentReport(examId, studentId, userId) {
  const report = await getStudentReport(examId, studentId, userId);
  const buffer = await generateMarksheetPdf(report);
  return {
    buffer,
    fileName: `marksheet-exam-${examId}-student-${studentId}.pdf`,
  };
}

import { pool } from "../../database/pool.js";
import AppError from "../../core/errors/AppError.js";
import * as repo from "./exams.repository.js";
import { generateMarksheetPdf } from "./marksheetPdf.service.js";

function parseOptionalNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeMarkPattern(value, hasSplitValues) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "split") return "split";
  if (normalized === "single") return "single";
  return hasSplitValues ? "split" : "single";
}

const FINAL_CALCULATION_TYPES = new Set([
  "unit_test",
  "half_yearly",
  "annual",
  "mock",
  "display_only",
  "single_marksheet_only",
]);

function normalizeFinalCalculationType(value) {
  const normalized = String(value || "display_only").trim().toLowerCase();
  if (FINAL_CALCULATION_TYPES.has(normalized)) return normalized;
  throw new AppError("Invalid final marksheet calculation type", 400);
}

function normalizeSubjectComponents(components) {
  if (!Array.isArray(components)) return [];

  return components
    .map((component, index) => {
      const name = String(component?.name || "").trim();
      if (!name) return null;

      const theoryMax = parseOptionalNumber(component.theory_max);
      const theoryPass = parseOptionalNumber(component.theory_pass);
      const practicalMax = parseOptionalNumber(component.practical_max);
      const practicalPass = parseOptionalNumber(component.practical_pass);
      const hasSplitValues =
        theoryMax !== null || theoryPass !== null || practicalMax !== null || practicalPass !== null;
      const markPattern = normalizeMarkPattern(component.mark_pattern, hasSplitValues);

      if (markPattern === "split") {
        const normalizedTheoryMax = Number(theoryMax ?? 0);
        const normalizedPracticalMax = Number(practicalMax ?? 0);
        const normalizedTheoryPass = Number(theoryPass ?? 0);
        const normalizedPracticalPass = Number(practicalPass ?? 0);
        const totalMax = normalizedTheoryMax + normalizedPracticalMax;
        const totalPass = normalizedTheoryPass + normalizedPracticalPass;

        if (normalizedTheoryMax < 0 || normalizedPracticalMax < 0 || totalMax <= 0) return null;
        if (
          normalizedTheoryPass < 0 ||
          normalizedPracticalPass < 0 ||
          normalizedTheoryPass > normalizedTheoryMax ||
          normalizedPracticalPass > normalizedPracticalMax ||
          totalPass > totalMax
        ) {
          return null;
        }

        return {
          name,
          mark_pattern: "split",
          max_marks: totalMax,
          pass_marks: totalPass,
          theory_max: normalizedTheoryMax,
          theory_pass: normalizedTheoryPass,
          practical_max: normalizedPracticalMax,
          practical_pass: normalizedPracticalPass,
          sort_order: Number(component.sort_order ?? index),
        };
      }

      const maxMarks = Number(component.max_marks ?? 0);
      const passMarks = Number(component.pass_marks ?? 0);
      if (Number.isNaN(maxMarks) || maxMarks <= 0) return null;
      if (Number.isNaN(passMarks) || passMarks < 0 || passMarks > maxMarks) return null;

      return {
        name,
        mark_pattern: "single",
        max_marks: maxMarks,
        pass_marks: passMarks,
        theory_max: null,
        theory_pass: null,
        practical_max: null,
        practical_pass: null,
        sort_order: Number(component.sort_order ?? index),
      };
    })
    .filter(Boolean);
}

function normalizeSubjects(subjects) {
  if (!Array.isArray(subjects)) return [];

  return subjects
    .map((s) => {
      const subjectId = Number(s.subject_id);
      if (!subjectId) return null;
      const subjectOfferingId = Number(s.subject_offering_id ?? s.subjectOfferingId ?? 0) || null;
      const components = normalizeSubjectComponents(s.components);

      const theoryMax = parseOptionalNumber(s.theory_max);
      const theoryPass = parseOptionalNumber(s.theory_pass);
      const practicalMax = parseOptionalNumber(s.practical_max);
      const practicalPass = parseOptionalNumber(s.practical_pass);
      const hasSplitValues =
        theoryMax !== null || theoryPass !== null || practicalMax !== null || practicalPass !== null;

      const markPattern = normalizeMarkPattern(s.mark_pattern, hasSplitValues);

      if (components.length) {
        const totalMax = components.reduce((sum, component) => sum + Number(component.max_marks || 0), 0);
        const totalPass = components.reduce((sum, component) => sum + Number(component.pass_marks || 0), 0);

        return {
          subject_id: subjectId,
          subject_offering_id: subjectOfferingId,
          mark_pattern: "split",
          max_marks: totalMax,
          pass_marks: totalPass,
          theory_max: components.reduce((sum, component) => sum + Number(component.theory_max || 0), 0),
          theory_pass: components.reduce((sum, component) => sum + Number(component.theory_pass || 0), 0),
          practical_max: components.reduce((sum, component) => sum + Number(component.practical_max || 0), 0),
          practical_pass: components.reduce((sum, component) => sum + Number(component.practical_pass || 0), 0),
          components,
        };
      }

      if (markPattern === "split") {
        const normalizedTheoryMax = Number(theoryMax ?? 0);
        const normalizedPracticalMax = Number(practicalMax ?? 0);
        const normalizedTheoryPass = Number(theoryPass ?? 0);
        const normalizedPracticalPass = Number(practicalPass ?? 0);
        const totalMax = normalizedTheoryMax + normalizedPracticalMax;
        const totalPass = normalizedTheoryPass + normalizedPracticalPass;

        if (normalizedTheoryMax < 0 || normalizedPracticalMax < 0 || totalMax <= 0) return null;
        if (
          normalizedTheoryPass < 0 ||
          normalizedPracticalPass < 0 ||
          normalizedTheoryPass > normalizedTheoryMax ||
          normalizedPracticalPass > normalizedPracticalMax ||
          totalPass > totalMax
        ) {
          return null;
        }

        return {
          subject_id: subjectId,
          subject_offering_id: subjectOfferingId,
          mark_pattern: "split",
          max_marks: totalMax,
          pass_marks: totalPass,
          theory_max: normalizedTheoryMax,
          theory_pass: normalizedTheoryPass,
          practical_max: normalizedPracticalMax,
          practical_pass: normalizedPracticalPass,
          components: [],
        };
      }

      const maxMarks = Number(s.max_marks ?? 100);
      const passMarks = Number(s.pass_marks ?? 33);
      if (Number.isNaN(maxMarks) || maxMarks <= 0) return null;
      if (Number.isNaN(passMarks) || passMarks < 0 || passMarks > maxMarks) return null;

      return {
        subject_id: subjectId,
        subject_offering_id: subjectOfferingId,
        mark_pattern: "single",
        max_marks: maxMarks,
        pass_marks: passMarks,
        theory_max: null,
        theory_pass: null,
        practical_max: null,
        practical_pass: null,
        components: [],
      };
    })
    .filter(Boolean);
}

function normalizeScopes(scopes, fallbackClassId, fallbackSectionId) {
  let parsed = Array.isArray(scopes) ? scopes : [];

  if (!parsed.length && fallbackClassId) {
    parsed = [{ class_id: fallbackClassId, section_id: fallbackSectionId ?? null }];
  }

  const map = new Map();
  parsed.forEach((s) => {
    const classId = Number(s.class_id);
    if (!classId) return;

    const hasSectionValue =
      s.section_id !== undefined &&
      s.section_id !== null &&
      String(s.section_id).trim() !== "";
    const sectionId = hasSectionValue ? Number(s.section_id) : null;
    if (hasSectionValue && !sectionId) return;

    const key = `${classId}-${sectionId ?? "all"}`;
    map.set(key, { class_id: classId, section_id: sectionId });
  });

  return Array.from(map.values());
}

function hasClassOnlyScopes(scopes) {
  return scopes.some((scope) => scope.section_id === null);
}

function hasSplitPatternSubjects(subjects) {
  return subjects.some((subject) => subject.mark_pattern === "split");
}

function hasComponentSubjects(subjects) {
  return subjects.some((subject) => Array.isArray(subject.components) && subject.components.length);
}

async function ensureExamSplitSubjectSchemaSupport(subjects) {
  if (!hasSplitPatternSubjects(subjects)) return;

  const schema = await repo.getExamSubjectSplitSchemaStatus();
  const schemaReady =
    schema.hasMarkPattern &&
    schema.hasTheoryMax &&
    schema.hasTheoryPass &&
    schema.hasPracticalMax &&
    schema.hasPracticalPass;

  if (!schemaReady) {
    throw new AppError(
      "Exam split marks schema is missing. Run: backend/database/migrations/20260419_exam_marks_split_components.sql",
      500
    );
  }
}

async function ensureExamSubjectComponentSchemaSupport(subjects) {
  if (!hasComponentSubjects(subjects)) return;

  const schemaReady = await repo.supportsExamSubjectComponentsTable();
  if (!schemaReady) {
    throw new AppError(
      "Exam subject branch component schema is missing. Run: backend/database/migrations/20260625_exam_subject_branch_components.sql",
      500
    );
  }
}

async function ensureMarksSplitSchemaSupport(subject) {
  if (!subject || String(subject.mark_pattern || "single") !== "split") return;

  const schema = await repo.getMarksEntrySplitSchemaStatus();
  const schemaReady = schema.hasTheoryMarks && schema.hasPracticalMarks;
  if (!schemaReady) {
    throw new AppError(
      "Marks component columns are missing. Run: backend/database/migrations/20260419_exam_marks_split_components.sql",
      500
    );
  }
}

function normalizeStudentSubjectMappings(studentSubjects, subjectIdsSet) {
  if (!Array.isArray(studentSubjects)) return [];

  const rows = [];
  studentSubjects.forEach((item) => {
    const studentId = Number(item?.student_id ?? item?.studentId);
    if (!studentId) return;

    if (Array.isArray(item?.subject_ids) || Array.isArray(item?.subjectIds)) {
      const subjectIds = Array.isArray(item.subject_ids) ? item.subject_ids : item.subjectIds;
      subjectIds.forEach((subjectIdRaw) => {
        const subjectId = Number(subjectIdRaw);
        if (!subjectId || !subjectIdsSet.has(subjectId)) return;
        rows.push({ student_id: studentId, subject_id: subjectId });
      });
      return;
    }

    const subjectId = Number(item?.subject_id ?? item?.subjectId);
    if (!subjectId || !subjectIdsSet.has(subjectId)) return;
    rows.push({ student_id: studentId, subject_id: subjectId });
  });

  const dedup = new Map();
  rows.forEach((row) => {
    dedup.set(`${row.student_id}-${row.subject_id}`, row);
  });
  return Array.from(dedup.values());
}

async function ensureStudentExamSubjectMappingSupport(rows) {
  if (!rows.length) return;
  const hasTable = await repo.supportsStudentExamSubjectsTable();
  if (!hasTable) {
    throw new AppError(
      "Student subject mapping schema is missing. Run: backend/database/migrations/20260419_exam_marks_split_components.sql",
      500
    );
  }
}

function normalizeMarksPayloadForSubject(markRow, examSubject) {
  const pattern = String(examSubject.mark_pattern || "single").trim().toLowerCase();
  const maxMarks = Number(examSubject.max_marks || 0);

  if (pattern === "split") {
    const theoryMax = Number(examSubject.theory_max ?? 0);
    const practicalMax = Number(examSubject.practical_max ?? 0);
    const theoryMarksRaw = markRow?.theory_marks ?? markRow?.theoryMarks;
    const practicalMarksRaw = markRow?.practical_marks ?? markRow?.practicalMarks;

    const theoryMarks = Number(theoryMarksRaw);
    if (Number.isNaN(theoryMarks) || theoryMarks < 0 || theoryMarks > theoryMax) {
      throw new AppError(`Theory marks must be between 0 and ${theoryMax}`, 400);
    }

    const practicalMarksValue = practicalMax > 0 ? Number(practicalMarksRaw) : Number(practicalMarksRaw ?? 0);
    if (Number.isNaN(practicalMarksValue) || practicalMarksValue < 0 || practicalMarksValue > practicalMax) {
      throw new AppError(`Practical marks must be between 0 and ${practicalMax}`, 400);
    }

    const totalMarks = theoryMarks + practicalMarksValue;
    if (totalMarks > maxMarks) {
      throw new AppError(`Total marks must be between 0 and ${maxMarks}`, 400);
    }

    return {
      marks: totalMarks,
      theory_marks: theoryMarks,
      practical_marks: practicalMarksValue,
    };
  }

  const marks = Number(markRow?.marks);
  if (Number.isNaN(marks) || marks < 0 || marks > maxMarks) {
    throw new AppError(`Marks must be between 0 and ${maxMarks}`, 400);
  }

  return { marks, theory_marks: null, practical_marks: null };
}

async function ensureExamClassOnlyScopeSchemaSupport(scopes) {
  if (!hasClassOnlyScopes(scopes)) return;

  const schema = await repo.getExamScopesClassOnlySchemaStatus();
  const schemaReady =
    schema.hasSectionId &&
    schema.hasNullableSectionId &&
    schema.hasSectionIdDedupe &&
    schema.hasScopeUniqueIndex;

  if (!schemaReady) {
    throw new AppError(
      "Exam class-only scopes need schema migration. Run: backend/database/migrations/20260419_exam_scopes_class_only.sql",
      500
    );
  }
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
  await ensureExamSplitSubjectSchemaSupport(subjects);
  await ensureExamSubjectComponentSchemaSupport(subjects);

  const scopes = normalizeScopes(data.scopes, data.class_id, data.section_id);
  if (!scopes.length) throw new AppError("At least one class scope is required", 400);
  await ensureExamClassOnlyScopeSchemaSupport(scopes);
  const hasStudentSubjectPayload =
    data.student_subjects !== undefined || data.studentSubjects !== undefined;
  const studentSubjectRows = hasStudentSubjectPayload
    ? normalizeStudentSubjectMappings(
        data.student_subjects ?? data.studentSubjects,
        new Set(subjects.map((subject) => Number(subject.subject_id)))
      )
    : [];
  await ensureStudentExamSubjectMappingSupport(studentSubjectRows);

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
      final_calculation_type: normalizeFinalCalculationType(data.final_calculation_type ?? data.finalCalculationType),
      created_by: userId
    });

    await repo.replaceExamScopes(conn, examId, scopes);
    const subjectsWithOfferings = await repo.attachUniqueSubjectOfferingIds(conn, scopes, subjects);
    await repo.replaceExamSubjects(conn, examId, subjectsWithOfferings);
    if (hasStudentSubjectPayload) {
      await repo.replaceStudentExamSubjects(conn, examId, studentSubjectRows);
    }
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
  const exams = await repo.listExams(filters || {}, userId, isTeacher);

  return Promise.all(
    exams.map(async (exam) => {
      const [subjects, scopes] = await Promise.all([
        repo.getExamSubjects(exam.id),
        isTeacher ? repo.getAllowedTeacherScopes(userId, exam.id) : repo.getExamScopes(exam.id),
      ]);

      return {
        ...exam,
        subjects,
        scopes,
      };
    })
  );
}

export async function getExamById(id, userId) {
  const examId = Number(id);
  const exam = await repo.getExamById(examId);
  if (!exam) throw new AppError("Exam not found", 404);

  const [subjects, allScopes, studentSubjects] = await Promise.all([
    repo.getExamSubjects(examId),
    repo.getExamScopes(examId),
    repo.getStudentExamSubjects(examId),
  ]);

  const { isTeacher } = await getUserFlags(userId);
  const scopes = isTeacher ? await repo.getAllowedTeacherScopes(userId, examId) : allScopes;

  return { ...exam, subjects, scopes, student_subjects: studentSubjects };
}

export async function updateExam(id, data) {
  const examId = Number(id);
  const existing = await repo.getExamById(examId);
  if (!existing) throw new AppError("Exam not found", 404);

  const subjects = normalizeSubjects(data.subjects);
  if (!subjects.length) throw new AppError("At least one subject with max marks is required", 400);
  await ensureExamSplitSubjectSchemaSupport(subjects);
  await ensureExamSubjectComponentSchemaSupport(subjects);

  const scopes = normalizeScopes(data.scopes, data.class_id, data.section_id);
  if (!scopes.length) throw new AppError("At least one class scope is required", 400);
  await ensureExamClassOnlyScopeSchemaSupport(scopes);
  const hasStudentSubjectPayload =
    data.student_subjects !== undefined || data.studentSubjects !== undefined;
  const studentSubjectRows = hasStudentSubjectPayload
    ? normalizeStudentSubjectMappings(
        data.student_subjects ?? data.studentSubjects,
        new Set(subjects.map((subject) => Number(subject.subject_id)))
      )
    : [];
  await ensureStudentExamSubjectMappingSupport(studentSubjectRows);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await repo.updateExam(conn, examId, {
      name: (data.name || existing.name).trim(),
      session_id: Number(data.session_id || existing.session_id),
      class_id: scopes[0].class_id,
      section_id: scopes[0].section_id,
      final_calculation_type: normalizeFinalCalculationType(
        data.final_calculation_type ?? data.finalCalculationType ?? existing.final_calculation_type
      )
    });
    await repo.replaceExamScopes(conn, examId, scopes);
    const subjectsWithOfferings = await repo.attachUniqueSubjectOfferingIds(conn, scopes, subjects);
    await repo.replaceExamSubjects(conn, examId, subjectsWithOfferings);
    if (hasStudentSubjectPayload) {
      await repo.replaceStudentExamSubjects(conn, examId, studentSubjectRows);
    }
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
    if (err?.code === "ER_ROW_IS_REFERENCED_2" || err?.code === "ER_ROW_IS_REFERENCED") {
      throw new AppError("Exam cannot be deleted because marks already exist for this exam", 400);
    }
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

  const rows = [];
  for (const block of subjectBlocks) {
    const subjectId = Number(block.subject_id);
    if (!subjectId || !Array.isArray(block.marks)) {
      throw new AppError("Each subject block needs subject_id and marks[]", 400);
    }

    await ensureTeacherScopeAccess(userId, normalizedExamId, classId, sectionId, subjectId);
    const examSubject = await repo.getExamSubject(normalizedExamId, subjectId);
    if (!examSubject) throw new AppError(`Subject ${subjectId} is not allocated to this exam`, 400);
    await ensureMarksSplitSchemaSupport(examSubject);

    const students = await repo.getStudentsForScope(normalizedExamId, classId, sectionId, "", subjectId);
    const studentSet = new Set(students.map((s) => Number(s.student_id)));

    for (const m of block.marks) {
      const studentId = Number(m.student_id);
      if (!studentSet.has(studentId)) {
        throw new AppError(`Student ${studentId} is not part of selected class/section for this exam`, 400);
      }

      const normalizedMarks = normalizeMarksPayloadForSubject(m, examSubject);
      rows.push({
        student_id: studentId,
        exam_id: normalizedExamId,
        subject_id: subjectId,
        marks: normalizedMarks.marks,
        theory_marks: normalizedMarks.theory_marks,
        practical_marks: normalizedMarks.practical_marks,
        entered_by: userId
      });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await repo.upsertMarks(conn, rows);
    await conn.commit();
    return { saved: true, count: rows.length, approval_status: "draft" };
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
  await ensureMarksSplitSchemaSupport(examSubject);
  const normalizedMarks = normalizeMarksPayloadForSubject(data, examSubject);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await repo.updateMarkById(conn, Number(markId), normalizedMarks, userId);
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
  const requestedStatus = String(data.status || "").trim().toLowerCase();
  const status = requestedStatus === "rejected" ? "draft" : requestedStatus;

  const roles = await repo.getUserRoleNames(userId);
  if (!roles.includes("super_admin")) {
    throw new AppError("Admin approval required for marks", 403);
  }

  if (!subjectId || !classId || !sectionId || !["approved", "draft"].includes(status)) {
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
    student: {
      id: rows[0].student_id,
      name: rows[0].student_name,
      roll_number: rows[0].roll_number,
      guardian_name: rows[0].guardian_name || "",
    },
    exam: {
      id: rows[0].exam_id,
      name: rows[0].exam_name,
      class_name: rows[0].class_name,
      class_scope: String(rows[0].class_scope || "school").trim().toLowerCase(),
      section_name: rows[0].section_name
    },
    subjects: rows.map((r) => ({
      subject: r.subject_name,
      mark_pattern: String(r.mark_pattern || "single").trim().toLowerCase(),
      marks: Number(r.marks || 0),
      max_marks: Number(r.max_marks || 0),
      pass_marks: Number(r.pass_marks || 0),
      theory_marks: r.theory_marks === null ? null : Number(r.theory_marks),
      practical_marks: r.practical_marks === null ? null : Number(r.practical_marks),
      theory_max: r.theory_max === null ? null : Number(r.theory_max),
      theory_pass: r.theory_pass === null ? null : Number(r.theory_pass),
      practical_max: r.practical_max === null ? null : Number(r.practical_max),
      practical_pass: r.practical_pass === null ? null : Number(r.practical_pass),
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

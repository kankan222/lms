import { pool } from "../../database/pool.js";
import AppError from "../../core/errors/AppError.js";
import { generateMarkStatementPdf } from "./markStatementPdf.service.js";
import { generateAdmitCardPdf } from "./admitCardPdf.service.js";
import { generateFinalMarksheetPdf } from "../exams/finalMarksheetPdf.service.js";
import { generateMarksheetPdf } from "../exams/marksheetPdf.service.js";
import * as marksheetRepo from "../marksheet/marksheet.repository.js";
import { resolveGrade } from "../marksheet/marksheet.service.js";
import * as repo from "./marks.repository.js";

const FINAL_MARKSHEET_EXCLUDED_TYPES = new Set(["single_marksheet_only"]);

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

function hasEnteredValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function normalizeMarkStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return ["present", "absent", "pending"].includes(status) ? status : "present";
}

function rowHasSubjectMarks(row, examSubject) {
  const pattern = String(examSubject.mark_pattern || "single").trim().toLowerCase();
  if (pattern === "split") {
    return (
      hasEnteredValue(row?.theory_marks ?? row?.theoryMarks) ||
      hasEnteredValue(row?.practical_marks ?? row?.practicalMarks)
    );
  }

  return hasEnteredValue(row?.marks);
}

function rowHasComponentMarks(row) {
  const componentMarks = Array.isArray(row?.component_marks)
    ? row.component_marks
    : Array.isArray(row?.componentMarks)
      ? row.componentMarks
      : [];

  return componentMarks.some(
    (component) =>
      hasEnteredValue(component?.marks) ||
      hasEnteredValue(component?.theory_marks ?? component?.theoryMarks) ||
      hasEnteredValue(component?.practical_marks ?? component?.practicalMarks)
  );
}

function resolveEntryStatus(row, hasMarks) {
  if (hasMarks) return "present";
  const requestedStatus = normalizeMarkStatus(row?.mark_status ?? row?.markStatus);
  return requestedStatus === "absent" ? "absent" : "pending";
}

function normalizeDateString(value, fieldName) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new AppError(`${fieldName} must be a valid date`, 400);
  }

  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new AppError(`${fieldName} must be a valid date`, 400);
  }

  return text;
}

function isPublishedForStudent(publication) {
  if (!publication?.published_on) return false;
  const today = new Date().toISOString().slice(0, 10);
  return String(publication.published_on) <= today;
}

function gradeForPercentage(percentage) {
  const value = Number(percentage || 0);
  if (value >= 85) return "A++";
  if (value >= 75) return "A+";
  if (value >= 60) return "A";
  if (value >= 45) return "B";
  return "C";
}

function normalizeMarksForSubject(row, examSubject) {
  const pattern = String(examSubject.mark_pattern || "single").trim().toLowerCase();
  const maxMarks = Number(examSubject.max_marks || 0);

  if (pattern === "split") {
    const theoryMax = Number(examSubject.theory_max ?? 0);
    const practicalMax = Number(examSubject.practical_max ?? 0);
    const theoryMarks = Number(row?.theory_marks ?? row?.theoryMarks);
    const practicalMarks = Number(row?.practical_marks ?? row?.practicalMarks ?? 0);

    if (Number.isNaN(theoryMarks) || theoryMarks < 0 || theoryMarks > theoryMax) {
      throw new AppError(
        `Theory marks for student ${row?.student_id ?? row?.studentId} must be between 0 and ${theoryMax}`,
        400
      );
    }

    if (Number.isNaN(practicalMarks) || practicalMarks < 0 || practicalMarks > practicalMax) {
      throw new AppError(
        `Practical marks for student ${row?.student_id ?? row?.studentId} must be between 0 and ${practicalMax}`,
        400
      );
    }

    const totalMarks = theoryMarks + practicalMarks;
    if (totalMarks < 0 || totalMarks > maxMarks) {
      throw new AppError(
        `Total marks for student ${row?.student_id ?? row?.studentId} must be between 0 and ${maxMarks}`,
        400
      );
    }

    return { marks: totalMarks, theory_marks: theoryMarks, practical_marks: practicalMarks };
  }

  const marksValue = Number(row?.marks);
  if (Number.isNaN(marksValue) || marksValue < 0 || marksValue > maxMarks) {
    throw new AppError(
      `Marks for student ${row?.student_id ?? row?.studentId} must be between 0 and ${maxMarks}`,
      400
    );
  }

  return { marks: marksValue, theory_marks: null, practical_marks: null };
}

function normalizeMarksForComponent(row, component) {
  const pattern = String(component.mark_pattern || "single").trim().toLowerCase();
  const maxMarks = Number(component.max_marks || 0);

  if (pattern === "split") {
    const theoryMax = Number(component.theory_max ?? 0);
    const practicalMax = Number(component.practical_max ?? 0);
    const theoryMarks = Number(row?.theory_marks ?? row?.theoryMarks);
    const practicalMarks = Number(row?.practical_marks ?? row?.practicalMarks ?? 0);

    if (Number.isNaN(theoryMarks) || theoryMarks < 0 || theoryMarks > theoryMax) {
      throw new AppError(`${component.name} theory marks must be between 0 and ${theoryMax}`, 400);
    }

    if (Number.isNaN(practicalMarks) || practicalMarks < 0 || practicalMarks > practicalMax) {
      throw new AppError(`${component.name} practical marks must be between 0 and ${practicalMax}`, 400);
    }

    return {
      marks: theoryMarks + practicalMarks,
      theory_marks: theoryMarks,
      practical_marks: practicalMarks,
    };
  }

  const marksValue = Number(row?.marks);
  if (Number.isNaN(marksValue) || marksValue < 0 || marksValue > maxMarks) {
    throw new AppError(`${component.name} marks must be between 0 and ${maxMarks}`, 400);
  }

  return { marks: marksValue, theory_marks: null, practical_marks: null };
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

async function formatReport(rows, publication = null) {
  const total = rows.reduce((sum, row) => sum + Number(row.marks || 0), 0);
  const maxTotal = rows.reduce((sum, row) => sum + Number(row.max_marks || 0), 0);
  const percentage = maxTotal ? (total / maxTotal) * 100 : 0;
  const classScope = String(rows[0].class_scope || "school").trim().toLowerCase();
  const rowsWithComponents = await repo.attachComponentsToExamSubjects(rows);
  const componentMarksRows = rowsWithComponents.some((row) => row.components?.length)
    ? await Promise.all(
        rowsWithComponents.map((row) =>
          row.components?.length
            ? repo.getComponentMarksByStudentIds(row.exam_subject_id, [row.student_id])
            : []
        )
      )
    : [];
  const componentMarksBySubject = new Map();
  componentMarksRows.flat().forEach((row) => {
    componentMarksBySubject.set(Number(row.component_id), row);
  });

  return {
    student: {
      id: rows[0].student_id,
      name: rows[0].student_name,
      roll_number: rows[0].roll_number,
      guardian_name: rows[0].guardian_name,
    },
    exam: {
      id: rows[0].exam_id,
      name: rows[0].exam_name,
      class_name: rows[0].class_name,
      class_scope: classScope,
      section_name: rows[0].section_name,
      medium: rows[0].medium,
    },
    subjects: rowsWithComponents
      .map((row) => ({
        subject: row.subject_name,
        subject_group: String(row.subject_group || "zz").trim().toLowerCase(),
        mark_pattern: String(row.mark_pattern || "single").trim().toLowerCase(),
        marks: Number(row.marks || 0),
        mark_status: row.mark_status || "present",
        max_marks: Number(row.max_marks || 0),
        pass_marks: Number(row.pass_marks || 0),
        theory_marks: row.theory_marks === null ? null : Number(row.theory_marks),
        practical_marks: row.practical_marks === null ? null : Number(row.practical_marks),
        theory_max: row.theory_max === null ? null : Number(row.theory_max),
        theory_pass: row.theory_pass === null ? null : Number(row.theory_pass),
        practical_max: row.practical_max === null ? null : Number(row.practical_max),
        practical_pass: row.practical_pass === null ? null : Number(row.practical_pass),
        components: (row.components || []).map((component) => {
          const componentMarks = componentMarksBySubject.get(Number(component.id));
          return {
            name: component.name,
            mark_pattern: String(component.mark_pattern || "single").trim().toLowerCase(),
            marks: componentMarks ? Number(componentMarks.marks || 0) : null,
            max_marks: Number(component.max_marks || 0),
            theory_marks:
              componentMarks?.theory_marks === null || componentMarks?.theory_marks === undefined
                ? null
                : Number(componentMarks.theory_marks),
            practical_marks:
              componentMarks?.practical_marks === null || componentMarks?.practical_marks === undefined
                ? null
                : Number(componentMarks.practical_marks),
            theory_max: component.theory_max === null ? null : Number(component.theory_max),
            practical_max: component.practical_max === null ? null : Number(component.practical_max),
          };
        }),
      }))
      .sort((a, b) => {
        const groupCompare = subjectGroupOrder(a.subject_group) - subjectGroupOrder(b.subject_group);
        if (groupCompare) return groupCompare;
        return compareSubjectNamesForMarksheet(a.subject, b.subject);
      }),
    summary: {
      total,
      max_total: maxTotal,
      percentage: Number(percentage.toFixed(2)),
      grade: gradeForPercentage(percentage),
    },
    publication: publication
      ? {
          published_on: publication.published_on,
        }
      : null,
  };
}

function round2(value) {
  const numeric = Number(value || 0);
  return Number(numeric.toFixed(2));
}

function marksheetGradeForPercentage(percentage, settings = []) {
  return resolveGrade(percentage, settings, "") || gradeForPercentage(percentage);
}

function promotedClassName(className) {
  const order = ["Nursery", "LKG", "UKG", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  const normalized = String(className || "").trim().toUpperCase();
  const index = order.findIndex((item) => item.toUpperCase() === normalized);
  if (index < 0 || index >= order.length - 1) return "";
  return order[index + 1];
}

function subjectGroupOrder(group) {
  const normalized = String(group || "").trim().toLowerCase();
  if (normalized === "compulsory") return 1;
  if (normalized === "elective") return 2;
  if (normalized === "optional") return 3;
  return 9;
}

function normalizeSubjectNameForSort(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function languageSubjectOrder(name) {
  const normalized = normalizeSubjectNameForSort(name);
  if (!normalized) return 100;

  if (/^english\s*(i|1|first)?$/.test(normalized) || normalized === "english") return 1;
  if (/^english\s*(ii|2|second)$/.test(normalized)) return 2;
  if (normalized.startsWith("english")) return 3;
  if (normalized === "assamese" || normalized.startsWith("assamese ")) return 4;
  if ((normalized === "hindi" || normalized.startsWith("hindi ")) && !normalized.includes("mil")) return 5;
  if (normalized.includes("mil") && normalized.includes("hindi")) return 6;
  if (normalized.includes("mil") && normalized.includes("bengali")) return 7;
  if (normalized.includes("mil") && normalized.includes("assamese")) return 8;

  return 100;
}

function compareSubjectNamesForMarksheet(aName, bName) {
  const aLanguageOrder = languageSubjectOrder(aName);
  const bLanguageOrder = languageSubjectOrder(bName);
  if (aLanguageOrder !== bLanguageOrder) return aLanguageOrder - bLanguageOrder;
  return String(aName || "").localeCompare(String(bName || ""));
}

function weightedContribution(marks, maxMarks, weight) {
  const max = Number(maxMarks || 0);
  if (!max) return null;
  return round2((Number(marks || 0) / max) * weight);
}

async function formatFinalReport(scope, rows) {
  const rowsWithComponents = await repo.attachComponentsToExamSubjects(rows);
  const examSubjectIds = [
    ...new Set(
      rowsWithComponents
        .filter((row) => row.components?.length)
        .map((row) => Number(row.exam_subject_id))
        .filter(Boolean)
    ),
  ];
  const componentMarksRows = examSubjectIds.length
    ? await Promise.all(
        examSubjectIds.map((examSubjectId) =>
          repo.getComponentMarksByStudentIds(examSubjectId, [Number(scope.student_id)])
        )
      )
    : [];
  const componentMarksBySubject = new Map();
  componentMarksRows.flat().forEach((row) => {
    componentMarksBySubject.set(`${Number(row.exam_subject_id)}:${Number(row.component_id)}`, row);
  });

  const displayRows = rowsWithComponents.filter(
    (row) => !FINAL_MARKSHEET_EXCLUDED_TYPES.has(String(row.final_calculation_type || "").trim().toLowerCase())
  );
  const examMap = new Map();
  const subjectMap = new Map();
  const groupOrder = {
    compulsory: 1,
    elective: 2,
    optional: 3,
  };

  displayRows.forEach((row) => {
    const examId = String(row.exam_id);
    const subjectKey = row.subject_offering_id
      ? `offering:${row.subject_offering_id}`
      : `subject:${row.subject_id}`;
    const marks = Number(row.marks || 0);
    const maxMarks = Number(row.max_marks || 0);

    if (!examMap.has(examId)) {
      examMap.set(examId, {
        id: examId,
        name: row.exam_name,
        published_on: row.published_on,
        final_calculation_type: row.final_calculation_type || "display_only",
        max_marks: 0,
        display_max_marks: 0,
      });
    }
    const exam = examMap.get(examId);
    exam.max_marks += maxMarks;
    exam.display_max_marks = Math.max(Number(exam.display_max_marks || 0), maxMarks);

    if (!subjectMap.has(subjectKey)) {
      const subjectGroup = String(row.subject_group || "zz").trim().toLowerCase();
      subjectMap.set(subjectKey, {
        key: subjectKey,
        name: row.subject_name,
        group: subjectGroup,
        order: groupOrder[subjectGroup] || 9,
        exams: {},
        total: 0,
        max_total: 0,
      });
    }

    const subject = subjectMap.get(subjectKey);
    subject.exams[examId] = {
      marks,
      mark_status: row.mark_status || "present",
      max_marks: maxMarks,
      mark_pattern: String(row.mark_pattern || "single").trim().toLowerCase(),
      theory_marks:
        row.theory_marks === null || row.theory_marks === undefined
          ? null
          : Number(row.theory_marks),
      practical_marks:
        row.practical_marks === null || row.practical_marks === undefined
          ? null
          : Number(row.practical_marks),
      theory_max: row.theory_max === null ? null : Number(row.theory_max),
      practical_max: row.practical_max === null ? null : Number(row.practical_max),
      components: (row.components || []).map((component) => {
        const componentMarks = componentMarksBySubject.get(
          `${Number(row.exam_subject_id)}:${Number(component.id)}`
        );
        return {
          name: component.name,
          mark_pattern: String(component.mark_pattern || "single").trim().toLowerCase(),
          marks: componentMarks ? Number(componentMarks.marks || 0) : null,
          max_marks: Number(component.max_marks || 0),
          theory_marks:
            componentMarks?.theory_marks === null || componentMarks?.theory_marks === undefined
              ? null
              : Number(componentMarks.theory_marks),
          practical_marks:
            componentMarks?.practical_marks === null || componentMarks?.practical_marks === undefined
              ? null
              : Number(componentMarks.practical_marks),
          theory_max: component.theory_max === null ? null : Number(component.theory_max),
          practical_max: component.practical_max === null ? null : Number(component.practical_max),
        };
      }),
    };
    subject.total += marks;
    subject.max_total += maxMarks;
  });

  const exams = [...examMap.values()].sort((a, b) => {
    const dateCompare = String(a.published_on || "").localeCompare(String(b.published_on || ""));
    if (dateCompare) return dateCompare;
    return Number(a.id) - Number(b.id);
  });

  const subjects = [...subjectMap.values()].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return compareSubjectNamesForMarksheet(a.name, b.name);
  });

  const examTotals = {};
  exams.forEach((exam) => {
    const marks = subjects.reduce((sum, subject) => sum + Number(subject.exams[exam.id]?.marks || 0), 0);
    const maxMarks = subjects.reduce((sum, subject) => sum + Number(subject.exams[exam.id]?.max_marks || 0), 0);
    const percentage = maxMarks ? Number(((marks / maxMarks) * 100).toFixed(2)) : 0;
    examTotals[exam.id] = {
      marks,
      max_marks: maxMarks,
      percentage,
    };
    exam.max_marks = maxMarks;
    exam.display_max_marks = subjects.reduce(
      (highest, subject) => Math.max(highest, Number(subject.exams[exam.id]?.max_marks || 0)),
      0
    );
  });

  const percentageGrades = await marksheetRepo.listGradeSettings("percentage");
  const activityGrades = await marksheetRepo.listGradeSettings("activity");
  const activityRows = await marksheetRepo.getStudentActivityRows({
    studentId: Number(scope.student_id),
    sessionId: Number(scope.session_id),
    classId: Number(scope.class_id),
    sectionId: Number(scope.section_id),
    className: scope.class_name,
  });

  const criteria = {
    unit_test: { label: "Unit Test", weight: 20 },
    half_yearly: { label: "Half Yearly", weight: 30 },
    annual: { label: "Annual Exam", weight: 50 },
  };

  subjects.forEach((subject) => {
    const byType = {
      unit_test: { marks: 0, max_marks: 0, has: false },
      half_yearly: { marks: 0, max_marks: 0, has: false },
      annual: { marks: 0, max_marks: 0, has: false },
    };

    exams.forEach((exam) => {
      const type = exam.final_calculation_type;
      const cell = subject.exams?.[exam.id];
      if (!criteria[type] || !cell) return;
      byType[type].marks += Number(cell.marks || 0);
      byType[type].max_marks += Number(cell.max_marks || 0);
      byType[type].has = true;
    });

    subject.criteria = {};
    Object.entries(criteria).forEach(([type, meta]) => {
      const bucket = byType[type];
      subject.criteria[type] = bucket.has
        ? weightedContribution(bucket.marks, bucket.max_marks, meta.weight)
        : null;
    });
    subject.criteria.unit_test_total = byType.unit_test.has ? round2(byType.unit_test.marks) : null;
    subject.criteria.unit_test_max_total = byType.unit_test.has ? round2(byType.unit_test.max_marks) : null;
    const criteriaValues = Object.keys(criteria)
      .map((type) => subject.criteria[type])
      .filter((value) => value !== null);
    subject.final_total = criteriaValues.length
      ? round2(criteriaValues.reduce((sum, value) => sum + Number(value || 0), 0))
      : null;
  });

  const subjectsWithFinal = subjects.filter((subject) => subject.final_total !== null);
  const total = round2(subjectsWithFinal.reduce((sum, subject) => sum + Number(subject.final_total || 0), 0));
  const maxTotal = subjects.length * 100;
  const percentage = maxTotal ? round2((total / maxTotal) * 100) : 0;
  const requiredTypes = Object.keys(criteria).filter((type) =>
    exams.some((exam) => exam.final_calculation_type === type)
  );
  const isComplete = subjects.length > 0 && subjects.every((subject) =>
    requiredTypes.every((type) => subject.criteria?.[type] !== null)
  );
  const finalGrade = subjectsWithFinal.length
    ? marksheetGradeForPercentage(percentage, percentageGrades)
    : "";

  const mockGrades = exams
    .filter((exam) => exam.final_calculation_type === "mock")
    .map((exam) => {
      const summary = examTotals[exam.id];
      return {
        exam_id: exam.id,
        name: exam.name,
        marks: summary?.marks ?? null,
        max_marks: summary?.max_marks ?? null,
        percentage: summary?.percentage ?? null,
        grade: summary ? marksheetGradeForPercentage(summary.percentage, percentageGrades) : "-",
      };
    });

  const activities = activityRows.map((activity) => ({
    id: Number(activity.activity_id),
    name: activity.name,
    marks: activity.marks,
    max_marks: activity.max_marks,
    grade: activity.marks === null || activity.marks === undefined
      ? ""
      : resolveGrade(activity.marks, activityGrades, ""),
  }));

  return {
    student: {
      id: Number(scope.student_id),
      name: scope.student_name,
      roll_number: scope.roll_number,
      session_id: Number(scope.session_id),
      session_name: scope.session_name,
      class_id: Number(scope.class_id),
      class_name: scope.class_name,
      class_scope: displayRows[0]?.class_scope || rows[0]?.class_scope || "school",
      section_id: Number(scope.section_id),
      section_name: scope.section_name,
      medium: scope.medium,
      stream_name: scope.stream_name,
      guardian_name: scope.guardian_name || "",
      promoted_class_name: isComplete ? promotedClassName(scope.class_name) : "",
    },
    exams,
    subjects,
    exam_totals: examTotals,
    mock_grades: mockGrades,
    activities,
    summary: {
      total,
      max_total: maxTotal,
      percentage,
      grade: finalGrade,
      is_complete: isComplete,
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
    subjectId,
  });

  const marks = await repo.getMarksByExamSubjectStudentIds(
    examId,
    subjectId,
    students.map((student) => student.student_id)
  );

  const marksByStudent = new Map(marks.map((row) => [Number(row.student_id), row]));
  const components = Array.isArray(examSubject.components) ? examSubject.components : [];
  const componentMarks = components.length
    ? await repo.getComponentMarksByStudentIds(
        examSubject.id,
        students.map((student) => student.student_id)
      )
    : [];
  const componentMarksByStudent = new Map();
  componentMarks.forEach((row) => {
    const studentId = Number(row.student_id);
    const marksByComponent = componentMarksByStudent.get(studentId) || new Map();
    marksByComponent.set(Number(row.component_id), row);
    componentMarksByStudent.set(studentId, marksByComponent);
  });

  let rows = students.map((student) => {
    const entry = marksByStudent.get(Number(student.student_id));
    const studentComponentMarks = componentMarksByStudent.get(Number(student.student_id)) || new Map();
    return {
      mark_id: entry?.mark_id || null,
      student_id: Number(student.student_id),
      roll_number: student.roll_number,
      student_name: student.student_name,
      medium: student.medium,
      marks:
        entry?.marks === null || entry?.marks === undefined
          ? null
          : Number(entry.marks),
      theory_marks:
        entry?.theory_marks === null || entry?.theory_marks === undefined
          ? null
          : Number(entry.theory_marks),
      practical_marks:
        entry?.practical_marks === null || entry?.practical_marks === undefined
          ? null
          : Number(entry.practical_marks),
      approval_status: entry?.approval_status || "draft",
      mark_status: entry?.mark_status || (entry ? "present" : "pending"),
      has_entry: Boolean(entry),
      components: components.map((component) => {
        const componentEntry = studentComponentMarks.get(Number(component.id));
        return {
          component_id: Number(component.id),
          name: component.name,
          mark_pattern: String(component.mark_pattern || "single").trim().toLowerCase(),
          max_marks: Number(component.max_marks || 0),
          pass_marks: Number(component.pass_marks || 0),
          theory_max: component.theory_max === null ? null : Number(component.theory_max),
          theory_pass: component.theory_pass === null ? null : Number(component.theory_pass),
          practical_max: component.practical_max === null ? null : Number(component.practical_max),
          practical_pass: component.practical_pass === null ? null : Number(component.practical_pass),
          marks:
            componentEntry?.marks === null || componentEntry?.marks === undefined
              ? null
              : Number(componentEntry.marks),
          theory_marks:
            componentEntry?.theory_marks === null || componentEntry?.theory_marks === undefined
              ? null
              : Number(componentEntry.theory_marks),
          practical_marks:
            componentEntry?.practical_marks === null || componentEntry?.practical_marks === undefined
              ? null
              : Number(componentEntry.practical_marks),
        };
      }),
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
      mark_pattern: String(examSubject.mark_pattern || "single").trim().toLowerCase(),
      max_marks: Number(examSubject.max_marks || 0),
      pass_marks: Number(examSubject.pass_marks || 0),
      theory_max: examSubject.theory_max === null ? null : Number(examSubject.theory_max),
      theory_pass: examSubject.theory_pass === null ? null : Number(examSubject.theory_pass),
      practical_max: examSubject.practical_max === null ? null : Number(examSubject.practical_max),
      practical_pass: examSubject.practical_pass === null ? null : Number(examSubject.practical_pass),
      components: components.map((component) => ({
        id: Number(component.id),
        name: component.name,
        mark_pattern: String(component.mark_pattern || "single").trim().toLowerCase(),
        max_marks: Number(component.max_marks || 0),
        pass_marks: Number(component.pass_marks || 0),
        theory_max: component.theory_max === null ? null : Number(component.theory_max),
        theory_pass: component.theory_pass === null ? null : Number(component.theory_pass),
        practical_max: component.practical_max === null ? null : Number(component.practical_max),
        practical_pass: component.practical_pass === null ? null : Number(component.practical_pass),
      })),
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
      class_scope: row.class_scope || "school",
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

function filterSubjectsByTeacherScopes(subjects, scopes) {
  const allowedSubjectIds = new Set(
    (scopes || []).map((scope) => String(scope.subject_id || "")).filter(Boolean)
  );
  if (!allowedSubjectIds.size) return subjects;
  return (subjects || []).filter((subject) =>
    allowedSubjectIds.has(String(subject.subject_id || subject.id || ""))
  );
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
    userCtx.isTeacher ? repo.getAllowedTeacherScopes(userId, examId) : repo.getExamScopes(examId),
  ]);
  return {
    ...exam,
    subjects: userCtx.isTeacher ? filterSubjectsByTeacherScopes(subjects, scopes) : subjects,
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

  const markPattern = String(examSubject.mark_pattern || "single").trim().toLowerCase();
  const components = Array.isArray(examSubject.components) ? examSubject.components : [];
  if (markPattern === "split" || components.length) {
    const marksSchema = await repo.getMarksEntrySplitSchemaStatus();
    if (!(marksSchema.hasTheoryMarks && marksSchema.hasPracticalMarks)) {
      throw new AppError(
        "Marks component columns are missing. Apply migration 20260419_exam_marks_split_components.sql.",
        500
      );
    }
  }

  if (components.length && !(await repo.supportsExamSubjectComponentsTable())) {
    throw new AppError(
      "Exam subject branch component schema is missing. Apply migration 20260625_exam_subject_branch_components.sql.",
      500
    );
  }

  const students = await repo.getStudentsForScope({ examId, classId, sectionId, medium, subjectId });
  const studentIds = new Set(students.map((student) => Number(student.student_id)));

  const componentById = new Map(components.map((component) => [Number(component.id), component]));
  const componentRows = [];
  const clearComponentStudentIds = [];

  const rows = marks.map((item) => {
    const studentId = Number(item.student_id ?? item.studentId);

    if (!studentIds.has(studentId)) {
      throw new AppError(`Student ${studentId} is not part of the selected scope`, 400);
    }

    if (components.length) {
      const entryStatus = resolveEntryStatus(item, rowHasComponentMarks(item));
      if (entryStatus !== "present") {
        clearComponentStudentIds.push(studentId);
        return {
          student_id: studentId,
          exam_id: examId,
          subject_id: subjectId,
          marks: null,
          theory_marks: null,
          practical_marks: null,
          mark_status: entryStatus,
          entered_by: userId,
        };
      }

      const rawComponentMarks = Array.isArray(item.component_marks)
        ? item.component_marks
        : Array.isArray(item.componentMarks)
          ? item.componentMarks
          : [];
      if (!rawComponentMarks.length) {
        throw new AppError(`Component marks are required for student ${studentId}`, 400);
      }

      let totalMarks = 0;
      let theoryMarks = 0;
      let practicalMarks = 0;
      const seenComponents = new Set();

      rawComponentMarks.forEach((componentMark) => {
        const componentId = Number(componentMark.component_id ?? componentMark.componentId);
        const component = componentById.get(componentId);
        if (!component) {
          throw new AppError(`Invalid component for student ${studentId}`, 400);
        }

        const normalizedComponent = normalizeMarksForComponent(componentMark, component);
        totalMarks += normalizedComponent.marks;
        theoryMarks += Number(normalizedComponent.theory_marks || 0);
        practicalMarks += Number(normalizedComponent.practical_marks || 0);
        seenComponents.add(componentId);
        componentRows.push({
          student_id: studentId,
          component_id: componentId,
          marks: normalizedComponent.marks,
          theory_marks: normalizedComponent.theory_marks,
          practical_marks: normalizedComponent.practical_marks,
          entered_by: userId,
        });
      });

      if (seenComponents.size !== componentById.size) {
        throw new AppError(`All subject components are required for student ${studentId}`, 400);
      }

      if (totalMarks > Number(examSubject.max_marks || 0)) {
        throw new AppError(`Total marks for student ${studentId} exceed subject maximum`, 400);
      }

      return {
        student_id: studentId,
        exam_id: examId,
          subject_id: subjectId,
          marks: totalMarks,
          theory_marks: theoryMarks,
          practical_marks: practicalMarks,
          mark_status: "present",
          entered_by: userId,
        };
      }

    const entryStatus = resolveEntryStatus(item, rowHasSubjectMarks(item, examSubject));
    if (entryStatus !== "present") {
      return {
        student_id: studentId,
        exam_id: examId,
        subject_id: subjectId,
        marks: null,
        theory_marks: null,
        practical_marks: null,
        mark_status: entryStatus,
        entered_by: userId,
      };
    }

    const normalizedMarks = normalizeMarksForSubject(item, examSubject);

    return {
      student_id: studentId,
      exam_id: examId,
      subject_id: subjectId,
      marks: normalizedMarks.marks,
      theory_marks: normalizedMarks.theory_marks,
      practical_marks: normalizedMarks.practical_marks,
      mark_status: "present",
      entered_by: userId,
    };
  });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await repo.deleteComponentMarksForStudents(conn, examSubject.id, clearComponentStudentIds);
    await repo.upsertComponentMarks(conn, componentRows);
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
    if (options.blockMarkStatuses?.length) {
      const statusCounts = await repo.countMarkStatusesBySelection(conn, {
        examId,
        classId,
        sectionId,
        subjectId,
        medium,
        studentIds: applyToAll ? [] : studentIds,
        currentStatuses: options.currentStatuses,
      });
      const blockedCount = options.blockMarkStatuses.reduce(
        (sum, status) => sum + Number(statusCounts[status] || 0),
        0
      );
      if (blockedCount > 0) {
        throw new AppError(
          `${blockedCount} student mark ${blockedCount === 1 ? "row is" : "rows are"} still pending. Mark them Present or Absent before continuing.`,
          400
        );
      }
    }
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
      excludeMarkStatuses: options.excludeMarkStatuses || [],
    });
    if (!affected) {
      throw new AppError(options.emptyMessage || "No matching marks found for this action", 400);
    }
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
    excludeMarkStatuses: ["pending"],
    blockMarkStatuses: ["pending"],
    emptyMessage: "No draft marks are available to submit. Submitted marks are locked until an admin rejects them.",
  });
}

export async function approveMarks(payload, userId) {
  return changeSelectionStatus(payload, userId, {
    teacherOnly: false,
    currentStatuses: ["pending"],
    nextStatus: "approved",
    excludeMarkStatuses: ["pending"],
    blockMarkStatuses: ["pending"],
    emptyMessage: "No pending marks are available to approve.",
  });
}

export async function rejectMarks(payload, userId) {
  return changeSelectionStatus(payload, userId, {
    teacherOnly: false,
    currentStatuses: ["pending", "approved"],
    nextStatus: "draft",
    emptyMessage: "No submitted marks are available to reject.",
  });
}

export async function getStudentReport(examIdValue, studentIdValue, userId) {
  const examId = normalizeNumber(examIdValue, "exam_id");
  const studentId = normalizeNumber(studentIdValue, "student_id");
  const userCtx = await getUserContext(userId);

  const scope = await repo.getStudentScopeForExam(studentId, examId);
  if (!scope) throw new AppError("Student is not part of the selected exam scope", 404);
  const publication = await repo.getReportPublication(
    examId,
    Number(scope.class_id),
    Number(scope.section_id),
    scope.medium
  );

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

  const isParentOwnedStudent = userCtx.isParent && userCtx.parentStudentIds.includes(studentId);

  if (userCtx.isParent && !isParentOwnedStudent) {
    throw new AppError("Not authorized to view this student's marksheet", 403);
  }

  if (!isParentOwnedStudent && userCtx.isStudent && userCtx.studentId !== studentId) {
    throw new AppError("Students can only view their own marksheet", 403);
  }

  const canBypassPublication = canManageExamCatalog(userCtx) || userCtx.isTeacher;
  if (!canBypassPublication && !userCtx.isParent && !userCtx.isStudent) {
    throw new AppError("Not authorized to view this student's marksheet", 403);
  }

  if (!canBypassPublication && !isPublishedForStudent(publication)) {
    throw new AppError("This marksheet has not been published for students yet", 404);
  }

  const rows = await repo.getStudentReportRows(examId, studentId, true);
  if (!rows.length) {
    throw new AppError("No approved marks found for this student in this exam", 404);
  }

  return await formatReport(rows, publication);
}

export async function getReportPublication(query, userId) {
  const userCtx = await getUserContext(userId);
  if (userCtx.isParent || userCtx.isStudent) {
    throw new AppError("Not authorized to manage report publication", 403);
  }

  const examId = normalizeNumber(query.exam_id ?? query.examId, "exam_id");
  const classId = normalizeNumber(query.class_id ?? query.classId, "class_id");
  const sectionId = normalizeNumber(query.section_id ?? query.sectionId, "section_id");
  const medium = String(query.medium || "").trim().toLowerCase() || null;

  return repo.getReportPublication(examId, classId, sectionId, medium);
}

export async function listPublishedReportScopes(query, userId) {
  const userCtx = await getUserContext(userId);
  if (userCtx.isParent || userCtx.isStudent) {
    throw new AppError("Not authorized to view published report scopes", 403);
  }

  return repo.listPublishedReportScopes(query || {});
}

export async function listApprovedMarkRecords(query, userId) {
  const userCtx = await getUserContext(userId);
  if (userCtx.isParent || userCtx.isStudent) {
    throw new AppError("Not authorized to view approved mark records", 403);
  }

  return repo.listApprovedMarkRecords(query || {});
}

export async function saveReportPublication(payload, userId) {
  const userCtx = await getUserContext(userId);
  if (userCtx.isParent || userCtx.isStudent) {
    throw new AppError("Not authorized to publish report cards", 403);
  }

  if (!(await repo.supportsReportPublicationsTable())) {
    throw new AppError("Report publication table is missing. Run the latest database migration.", 500);
  }

  const examId = normalizeNumber(payload.exam_id ?? payload.examId, "exam_id");
  const classId = normalizeNumber(payload.class_id ?? payload.classId, "class_id");
  const sectionId = normalizeNumber(payload.section_id ?? payload.sectionId, "section_id");
  const medium = String(payload.medium || "").trim().toLowerCase() || null;
  const publishedOn = normalizeDateString(
    payload.published_on ?? payload.publishedOn,
    "published_on"
  );

  const approvedCount = await repo.countApprovedMarksForReportScope(
    examId,
    classId,
    sectionId,
    medium
  );
  if (!approvedCount) {
    throw new AppError("Approve marks for this exam scope before publishing the marksheet", 400);
  }

  await repo.upsertReportPublication({
    examId,
    classId,
    sectionId,
    medium,
    publishedOn,
    userId,
  });

  return repo.getReportPublication(examId, classId, sectionId, medium);
}

function resolveOwnedStudentId(query, userCtx) {
  const requestedStudentId = query.student_id ? Number(query.student_id) : null;

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

  if (userCtx.isStudent) {
    if (requestedStudentId && requestedStudentId !== userCtx.studentId) {
      throw new AppError("Students can only view their own results", 403);
    }
    return userCtx.studentId;
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

export async function downloadFinalMarksheet(query, userId) {
  const userCtx = await getUserContext(userId);
  const canBypassPublication = canManageExamCatalog(userCtx);
  const requestedStudentId = query.student_id ? Number(query.student_id) : null;
  let studentId = requestedStudentId;

  if (userCtx.isStudent || userCtx.isParent) {
    studentId = resolveOwnedStudentId(query, userCtx);
  } else if (!canBypassPublication) {
    throw new AppError("Not authorized to download this final marksheet", 403);
  }

  if (!studentId) {
    throw new AppError("student_id is required", 400);
  }

  const sessionId = query.session_id ? normalizeNumber(query.session_id, "session_id") : null;
  const classId = query.class_id ? normalizeNumber(query.class_id, "class_id") : null;
  const sectionId = query.section_id ? normalizeNumber(query.section_id, "section_id") : null;

  const scope = await repo.getStudentFinalReportScope({
    studentId,
    sessionId,
    classId,
    sectionId,
  });
  if (!scope) {
    throw new AppError("Student is not part of the selected final report scope", 404);
  }

  const rows = await repo.getFinalReportRows({
    studentId,
    sessionId: Number(scope.session_id),
    classId: Number(scope.class_id),
    sectionId: Number(scope.section_id),
    medium: scope.medium,
    visibleOnly: !canBypassPublication,
  });

  if (!rows.length) {
    throw new AppError("No published approved marks found for this final marksheet", 404);
  }

  const hasDisplayableFinalMarks = rows.some(
    (row) => !FINAL_MARKSHEET_EXCLUDED_TYPES.has(String(row.final_calculation_type || "").trim().toLowerCase())
  );
  if (!hasDisplayableFinalMarks) {
    throw new AppError("No approved marks are configured to display in this final marksheet", 404);
  }

  const report = await formatFinalReport(scope, rows);
  const buffer = await generateFinalMarksheetPdf(report);
  return {
    buffer,
    fileName: `final-marksheet-student-${studentId}-session-${scope.session_id}.pdf`,
  };
}

export async function downloadMarkStatement(query, userId) {
  const { examId, classId, sectionId, subjectId, medium, exam, examSubject, userCtx } =
    await getValidatedScope(query, userId);

  if (!userCtx.roles.includes("super_admin") && !userCtx.roles.includes("admin") && !canManageExamCatalog(userCtx)) {
    throw new AppError("Not authorized to download marks statements", 403);
  }

  const [scope, students] = await Promise.all([
    repo.getClassSectionScope(classId, sectionId),
    repo.getStudentsForScope({
      examId,
      classId,
      sectionId,
      medium,
      subjectId,
    }),
  ]);

  if (!scope) throw new AppError("Class section not found", 404);

  const buffer = await generateMarkStatementPdf({
    exam,
    subject: examSubject,
    scope,
    students,
    statementDate: query.statement_date,
  });

  return {
    buffer,
    fileName: `marks-statement-exam-${examId}-class-${classId}-section-${sectionId}-subject-${subjectId}.pdf`,
  };
}

export async function downloadAdmitCards(query, userId) {
  const examId = normalizeNumber(query.exam_id ?? query.examId, "exam_id");
  const classId = normalizeNumber(query.class_id ?? query.classId, "class_id");
  const sectionId = normalizeNumber(query.section_id ?? query.sectionId, "section_id");
  const medium = String(query.medium || "").trim().toLowerCase() || null;
  const [exam, userCtx] = await Promise.all([
    repo.getExamById(examId),
    getUserContext(userId),
  ]);

  if (!exam) throw new AppError("Exam not found", 404);
  if (!userCtx.roles.includes("super_admin") && !userCtx.roles.includes("admin") && !canManageExamCatalog(userCtx)) {
    throw new AppError("Not authorized to download admit cards", 403);
  }

  const [scope, students] = await Promise.all([
    repo.getClassSectionScope(classId, sectionId),
    repo.getStudentsForScope({
      examId,
      classId,
      sectionId,
      medium,
    }),
  ]);

  if (!scope) throw new AppError("Class section not found", 404);

  const buffer = await generateAdmitCardPdf({
    exam,
    scope,
    students,
  });

  return {
    buffer,
    fileName: `admit-cards-exam-${examId}-class-${classId}-section-${sectionId}.pdf`,
  };
}

export async function getMyStudents(userId) {
  const userCtx = await getUserContext(userId);

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

import AppError from "../../core/errors/AppError.js";
import * as repo from "./marksheet.repository.js";

const GRADE_TYPES = new Set(["percentage", "activity"]);
const SCOPE_KEYS = new Set(["nursery_ukg", "i_v", "vi_vii", "viii", "ix", "x"]);

function numberValue(value, label, { allowNull = false } = {}) {
  if (allowNull && (value === null || value === undefined || String(value).trim() === "")) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new AppError(`${label} must be a number`, 400);
  return parsed;
}

function normalizeGradeSetting(payload = {}) {
  const scaleType = String(payload.scale_type || payload.scaleType || "").trim().toLowerCase();
  if (!GRADE_TYPES.has(scaleType)) throw new AppError("Invalid grade scale type", 400);
  const gradeLabel = String(payload.grade_label || payload.gradeLabel || "").trim();
  if (!gradeLabel) throw new AppError("Grade label is required", 400);

  const minValue = numberValue(payload.min_value ?? payload.minValue, "Minimum value");
  const maxValue = numberValue(payload.max_value ?? payload.maxValue, "Maximum value");
  if (minValue > maxValue) throw new AppError("Minimum value cannot exceed maximum value", 400);

  return {
    scale_type: scaleType,
    grade_label: gradeLabel,
    qualitative_value: String(payload.qualitative_value || payload.qualitativeValue || "").trim(),
    min_value: minValue,
    max_value: maxValue,
    mark_value: numberValue(payload.mark_value ?? payload.markValue, "Mark value", { allowNull: true }),
    sort_order: Number(payload.sort_order ?? payload.sortOrder ?? 0) || 0,
    is_active: payload.is_active ?? payload.isActive ?? true,
  };
}

function normalizeActivity(payload = {}) {
  const name = String(payload.name || "").trim();
  if (!name) throw new AppError("Activity name is required", 400);
  const rawScopeKey = String(payload.scope_key || payload.scopeKey || "").trim().toLowerCase();
  const scopeKey = rawScopeKey || null;
  if (scopeKey && !SCOPE_KEYS.has(scopeKey)) throw new AppError("Invalid activity class scope", 400);
  const classId = Number(payload.class_id ?? payload.classId ?? 0) || null;
  const sectionId = Number(payload.section_id ?? payload.sectionId ?? 0) || null;
  if (sectionId && !classId) throw new AppError("Select class before section", 400);

  return {
    name,
    scope_key: scopeKey,
    class_id: classId,
    section_id: sectionId,
    sort_order: Number(payload.sort_order ?? payload.sortOrder ?? 0) || 0,
    max_marks: numberValue(payload.max_marks ?? payload.maxMarks ?? 10, "Maximum marks"),
    is_active: payload.is_active ?? payload.isActive ?? true,
  };
}

export function resolveGrade(value, settings, fallback = "-") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const match = (settings || []).find(
    (setting) =>
      Number(setting.is_active) !== 0 &&
      numeric >= Number(setting.min_value) &&
      numeric <= Number(setting.max_value)
  );
  return match?.grade_label || fallback;
}

export async function listGradeSettings(query) {
  const scaleType = query?.scale_type || query?.scaleType || null;
  if (scaleType && !GRADE_TYPES.has(String(scaleType).trim().toLowerCase())) {
    throw new AppError("Invalid grade scale type", 400);
  }
  return repo.listGradeSettings(scaleType ? String(scaleType).trim().toLowerCase() : null);
}

export async function createGradeSetting(payload) {
  const data = normalizeGradeSetting(payload);
  const id = await repo.createGradeSetting(data);
  return { id };
}

export async function updateGradeSetting(id, payload) {
  const data = normalizeGradeSetting(payload);
  await repo.updateGradeSetting(Number(id), data);
  return { updated: true };
}

export async function deleteGradeSetting(id) {
  await repo.deleteGradeSetting(Number(id));
  return { deleted: true };
}

export async function listActivities(query = {}) {
  const scopeKey = query.scope_key || query.scopeKey || null;
  if (scopeKey && !SCOPE_KEYS.has(String(scopeKey).trim().toLowerCase())) {
    throw new AppError("Invalid activity class scope", 400);
  }
  return repo.listActivities({
    scope_key: scopeKey ? String(scopeKey).trim().toLowerCase() : null,
    class_id: query.class_id ?? query.classId,
    section_id: query.section_id ?? query.sectionId,
  });
}

export async function createActivity(payload) {
  const data = normalizeActivity(payload);
  if ((data.class_id || data.section_id) && !(await repo.supportsActivityClassScopes())) {
    throw new AppError(
      "Activity class/section selection is not enabled on this database. Apply migration 20260628_marksheet_activity_class_scope_repair.sql.",
      500
    );
  }
  const id = await repo.createActivity(data);
  return { id };
}

export async function updateActivity(id, payload) {
  const data = normalizeActivity(payload);
  if ((data.class_id || data.section_id) && !(await repo.supportsActivityClassScopes())) {
    throw new AppError(
      "Activity class/section selection is not enabled on this database. Apply migration 20260628_marksheet_activity_class_scope_repair.sql.",
      500
    );
  }
  await repo.updateActivity(Number(id), data);
  return { updated: true };
}

export async function deleteActivity(id) {
  await repo.deleteActivity(Number(id));
  return { deleted: true };
}

export async function getActivityMarkGrid(query = {}) {
  const sessionId = numberValue(query.session_id ?? query.sessionId, "Session");
  const classId = numberValue(query.class_id ?? query.classId, "Class");
  const sectionId = numberValue(query.section_id ?? query.sectionId, "Section");
  return repo.getActivityMarkGrid({ sessionId, classId, sectionId });
}

export async function saveActivityMarks(activityId, payload = {}, userId) {
  const sessionId = numberValue(payload.session_id ?? payload.sessionId, "Session");
  const classId = numberValue(payload.class_id ?? payload.classId, "Class");
  const sectionId = numberValue(payload.section_id ?? payload.sectionId, "Section");
  const rows = (Array.isArray(payload.rows) ? payload.rows : [])
    .map((row) => {
      const studentId = Number(row.student_id ?? row.studentId);
      if (!studentId) return null;
      const rawMarks = row.marks;
      const marks =
        rawMarks === null || rawMarks === undefined || String(rawMarks).trim() === ""
          ? null
          : numberValue(rawMarks, "Marks");
      return { student_id: studentId, marks };
    })
    .filter(Boolean);

  await repo.saveActivityMarks({
    activityId: Number(activityId),
    sessionId,
    classId,
    sectionId,
    rows,
    userId,
  });
  return { saved: rows.length };
}

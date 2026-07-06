import { pool } from "../../database/pool.js";
import * as repo from "./subjects.repository.js";
import * as studentRepo from "../students/student.repository.js";
import AppError from "../../core/errors/AppError.js";

export async function createSubject(data) {
  if (!data.name) {
    throw new Error("Subject name required");
  }

  return repo.createSubject(data.name, data.code);
}

export async function getSubjects() {
  return repo.getSubjects();
}

export async function updateSubject(id, data) {
  if (!data.name) {
    throw new Error("Subject name required");
  }

  return repo.updateSubject(id, data.name, data.code);
}

export async function deleteSubject(id) {
  try {
    return await repo.deleteSubject(id);
  } catch (err) {
    if (err?.code === "ER_ROW_IS_REFERENCED_2" || err?.code === "ER_ROW_IS_REFERENCED") {
      throw new AppError("Subject cannot be deleted because it is already used in marks or class records", 400);
    }

    throw err;
  }
}



export async function assignSubjects(classId, subjectIds, subjectGroups = {}) {

  if (!Array.isArray(subjectIds)) {
    throw new Error("subjectIds must be an array");
  }

  return repo.assignSubjects(classId, subjectIds, subjectGroups);
}
export async function getClassSubjects(classId) {

  const conn = await pool.getConnection();

  try {
    return await repo.getClassSubjects(classId);
  } finally {
    conn.release();
  }
}

function normalizePositiveInteger(value, fieldName) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new AppError(`${fieldName} must be a positive integer`, 400);
  }

  return numberValue;
}

function normalizeOptionalPositiveInteger(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return normalizePositiveInteger(value, fieldName);
}

export async function getSubjectOfferings(filters) {
  return repo.getSubjectOfferings(filters);
}

export async function replaceSubjectOfferings(data) {
  const classId = normalizePositiveInteger(data.class_id ?? data.classId, "class_id");
  const sectionId = normalizeOptionalPositiveInteger(data.section_id ?? data.sectionId, "section_id");
  const streamId = normalizeOptionalPositiveInteger(data.stream_id ?? data.streamId, "stream_id");
  const rawOfferings = Array.isArray(data.offerings) ? data.offerings : [];

  const offerings = rawOfferings.map((offering) => ({
    subject_id: normalizePositiveInteger(offering.subject_id ?? offering.subjectId, "subject_id"),
    subject_group: ["compulsory", "elective", "optional"].includes(offering.subject_group)
      ? offering.subject_group
      : "compulsory",
  }));

  return repo.replaceSubjectOfferings(
    { class_id: classId, section_id: sectionId, stream_id: streamId },
    offerings,
  );
}

export async function getStudentSubjectRegistrations(studentId, user = null) {
  const normalizedStudentId = normalizePositiveInteger(studentId, "student_id");
  const isParent = Array.isArray(user?.roles) && user.roles.includes("parent");
  const parentStudentIds = user?.userId
    ? await studentRepo.getParentStudentIdsByUser(user.userId)
    : [];

  if (isParent && !parentStudentIds.includes(normalizedStudentId)) {
    throw new AppError("Not authorized to view this student's subjects", 403);
  }

  const data = await repo.getStudentSubjectRegistrations(normalizedStudentId);

  if (isParent) {
    return {
      ...data,
      offerings: (data.offerings || []).filter(
        (offering) => offering.auto_required || offering.registration_id,
      ),
    };
  }

  return data;
}

export async function replaceStudentSubjectRegistrations(studentId, data) {
  const normalizedStudentId = normalizePositiveInteger(studentId, "student_id");
  const offeringIds = Array.isArray(data.offering_ids)
    ? data.offering_ids
    : Array.isArray(data.offeringIds)
      ? data.offeringIds
      : [];

  return repo.replaceStudentSubjectRegistrations(normalizedStudentId, offeringIds);
}



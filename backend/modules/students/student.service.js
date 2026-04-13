import * as repo from "./student.repository.js";
import bcrypt from "bcrypt";
import { pool } from "../../database/pool.js";
import AppError from "../../core/errors/AppError.js";

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

function hasParentDetails(parent = {}) {
  return Boolean(
    String(parent?.name || "").trim() ||
      String(parent?.email || "").trim() ||
      String(parent?.occupation || "").trim() ||
      String(parent?.qualification || "").trim()
  );
}

function normalizeRelationship(value) {
  return String(value || "").trim().toLowerCase();
}

function expandGuardianParentRows(student) {
  const parents = Array.isArray(student?.parents) ? student.parents : [];
  if (!parents.length) return student;

  const hasFather = parents.some((parent) => normalizeRelationship(parent.relationship) === "father");
  const hasMother = parents.some((parent) => normalizeRelationship(parent.relationship) === "mother");

  const expandedParents = [];

  for (const parent of parents) {
    const relationship = normalizeRelationship(parent.relationship);
    if (relationship !== "guardian") {
      expandedParents.push(parent);
      continue;
    }

    const fatherName = String(parent?.father_name || "").trim();
    const motherName = String(parent?.mother_name || "").trim();

    if (!hasFather && (fatherName || motherName)) {
      expandedParents.push({
        ...parent,
        relationship: "father",
        name: fatherName || parent.name,
      });
    }

    if (!hasMother && (fatherName || motherName)) {
      expandedParents.push({
        ...parent,
        relationship: "mother",
        name: motherName || parent.name,
      });
    }

    if (!fatherName && !motherName) {
      expandedParents.push(parent);
    }
  }

  return {
    ...student,
    parents: expandedParents,
  };
}

function normalizeDateInput(value, fieldLabel) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new AppError(`${fieldLabel} must be a valid date`, 400);
    }

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  throw new AppError(`${fieldLabel} must be in YYYY-MM-DD or DD/MM/YYYY format`, 400);
}

async function resolveEnrollmentScope(enrollment = {}) {
  const classId = Number(enrollment.class_id || 0);
  if (!classId) {
    throw new AppError("Class is required", 400);
  }

  const classRow = await repo.getClassById(classId);
  if (!classRow) {
    throw new AppError("Invalid class selected", 400);
  }

  const classScope = String(classRow.class_scope || "school").trim().toLowerCase();
  let streamId = enrollment.stream_id ?? null;

  if (classScope === "hs") {
    if (!streamId && enrollment.stream) {
      const streamRowByName = await repo.getStreamByName(String(enrollment.stream).trim());
      streamId = streamRowByName?.id || null;
    }

    if (!streamId) {
      throw new AppError("Stream is required for higher secondary classes", 400);
    }

    const streamRow = await repo.getStreamById(Number(streamId));
    if (!streamRow) {
      throw new AppError("Invalid stream selected", 400);
    }

    streamId = Number(streamRow.id);
  } else {
    streamId = null;
  }

  return {
    class_scope: classScope,
    stream_id: streamId,
  };
}

function validateCreatePayload(payload) {
  if (!payload?.student?.name) {
    throw new AppError("Student name is required", 400);
  }
  if (payload?.student?.mobile && !/^\d{10}$/.test(String(payload.student.mobile))) {
    throw new AppError("Student phone must be 10 digits", 400);
  }
  if (!payload?.student?.gender) {
    throw new AppError("Student gender is required", 400);
  }
  if (!payload?.student?.dob) {
    throw new AppError("Student DOB is required", 400);
  }
  if (!payload?.student?.date_of_admission) {
    throw new AppError("Date of admission is required", 400);
  }
  if (!payload?.enrollment?.session_id) {
    throw new AppError("Session is required", 400);
  }
  if (!payload?.enrollment?.class_id) {
    throw new AppError("Class is required", 400);
  }
  if (!payload?.enrollment?.section_id) {
    throw new AppError("Section is required", 400);
  }
  if (!payload?.enrollment?.roll_number) {
    throw new AppError("Roll number is required", 400);
  }

  const fatherMobile = String(payload?.father?.mobile || "").trim();
  const motherMobile = String(payload?.mother?.mobile || "").trim();
  const fatherHasDetails = hasParentDetails(payload?.father);
  const motherHasDetails = hasParentDetails(payload?.mother);

  const fatherEmail = String(payload?.father?.email || "").trim();
  const motherEmail = String(payload?.mother?.email || "").trim();

  if (!fatherMobile && !motherMobile) {
    throw new AppError("At least one parent phone is required", 400);
  }

  if (fatherHasDetails && !fatherMobile) {
    throw new AppError("Father phone is required when father details are provided", 400);
  }

  if (motherHasDetails && !motherMobile) {
    throw new AppError("Mother phone is required when mother details are provided", 400);
  }

  if (fatherMobile && !/^\d{10}$/.test(fatherMobile)) {
    throw new AppError("Father phone must be 10 digits", 400);
  }

  if (motherMobile && !/^\d{10}$/.test(motherMobile)) {
    throw new AppError("Mother phone must be 10 digits", 400);
  }

  if (fatherMobile && !String(payload?.father?.name || "").trim()) {
    throw new AppError("Father name is required when father phone is provided", 400);
  }

  if (motherMobile && !String(payload?.mother?.name || "").trim()) {
    throw new AppError("Mother name is required when mother phone is provided", 400);
  }

  if (fatherEmail && !EMAIL_REGEX.test(fatherEmail)) {
    throw new AppError("Father email is invalid", 400);
  }

  if (motherEmail && !EMAIL_REGEX.test(motherEmail)) {
    throw new AppError("Mother email is invalid", 400);
  }
}

export async function createStudent(payload) {
  validateCreatePayload(payload);

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const { student, enrollment, father, mother } = payload;
    const normalizedStudent = {
      ...student,
      dob: normalizeDateInput(student?.dob, "Student DOB"),
      date_of_admission: normalizeDateInput(student?.date_of_admission, "Date of admission"),
    };
    const enrollmentMeta = await resolveEnrollmentScope(enrollment);

    const studentId = await repo.insertStudent(conn, normalizedStudent);

    const fatherId = await resolveParent(conn, father);
    const motherId = await resolveParent(conn, mother);

    // student_parents has PK (student_id, parent_id). If both guardians resolve
    // to the same parent (e.g. same phone), link once as guardian.
    if (fatherId && motherId && fatherId === motherId) {
      await repo.linkParent(conn, studentId, fatherId, "guardian", {
        father_name: father?.name ?? null,
        mother_name: mother?.name ?? null,
      });
    } else {
      if (fatherId) {
        await repo.linkParent(conn, studentId, fatherId, "father");
      }

      if (motherId) {
        await repo.linkParent(conn, studentId, motherId, "mother");
      }
    }

    await repo.insertEnrollment(conn, {
      student_id: studentId,
      session_id: enrollment.session_id,
      class_id: enrollment.class_id,
      section_id: enrollment.section_id,
      stream_id: enrollmentMeta.stream_id,
      roll_number: enrollment.roll_number,
    });

    await conn.commit();

    return { studentId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function resolveParent(conn, parent) {
  const normalizedMobile = String(parent?.mobile || "").trim();
  if (!normalizedMobile) {
    return null; // no parent provided
  }

  const normalizedEmail = String(parent.email || "").trim() || null;

  const existingUser = await repo.findUserByPhone(conn, normalizedMobile);

  if (existingUser) {
    if (normalizedEmail) {
      await repo.updateUserEmailIfEmpty(conn, existingUser.id, normalizedEmail);
    }

    await repo.assignParentRole(conn, existingUser.id);

    const parentProfile = await repo.findParentByUser(conn, existingUser.id);
    if (parentProfile?.id) {
      await repo.updateParentProfileIfMissing(conn, parentProfile.id, {
        name: parent.name ?? null,
        qualification: parent.qualification ?? null,
        occupation: parent.occupation ?? null,
        mobile: normalizedMobile,
        email: normalizedEmail,
      });

      return parentProfile.id;
    }

    return repo.createParent(conn, {
      user_id: existingUser.id,
      name: parent.name ?? null,
      qualification: parent.qualification ?? null,
      occupation: parent.occupation ?? null,
      mobile: normalizedMobile,
      email: normalizedEmail,
    });
  }

  const passwordHash = await bcrypt.hash("2025-26", 10);

  const userId = await repo.createUser(conn, {
    phone: normalizedMobile,
    email: normalizedEmail,
    password_hash: passwordHash,
  });

  await repo.assignParentRole(conn, userId);

  const parentId = await repo.createParent(conn, {
    user_id: userId,
    name: parent.name ?? null,
    qualification: parent.qualification ?? null,
    occupation: parent.occupation ?? null,
    mobile: normalizedMobile,
    email: normalizedEmail,
  });

  return parentId;
}
export async function getStudents(filters = {}) {
  return repo.getStudents(filters);
}

export async function getStudentById(id) {
  const student = await repo.getStudentById(id);
  if (!student) return null;
  return expandGuardianParentRows(student);
}

export async function getStudentsForActor(filters = {}, actorUserId) {
  const parentStudentIds = actorUserId
    ? await repo.getParentStudentIdsByUser(actorUserId)
    : [];

  if (!parentStudentIds.length) {
    return getStudents(filters);
  }

  return repo.getStudents({
    ...filters,
    student_ids: parentStudentIds,
  });
}

export async function getStudentByIdForActor(id, actorUserId) {
  const studentId = Number(id);
  const parentStudentIds = actorUserId
    ? await repo.getParentStudentIdsByUser(actorUserId)
    : [];

  if (parentStudentIds.length && !parentStudentIds.includes(studentId)) {
    throw new AppError("Not authorized to view this student", 403);
  }

  return getStudentById(studentId);
}

export async function updateStudent(id, data) {
  const existing = await repo.getStudentById(id);
  if (!existing) {
    throw new AppError("Student not found", 404);
  }

  await repo.updateStudent(id, {    
    admission_no: data.admission_no ?? existing.admission_no ?? null,
    name: data.name ?? existing.name ?? null,
    mobile: data.mobile ?? data.phone ?? existing.mobile ?? existing.phone ?? null,
    gender: data.gender ?? existing.gender ?? null,
    dob: normalizeDateInput(data.dob ?? existing.dob ?? null, "Student DOB"),
    date_of_admission: normalizeDateInput(data.date_of_admission ?? existing.date_of_admission ?? null, "Date of admission"),
    photo_url: data.photo_url ?? null,
  });

  const hasEnrollmentUpdate =
    data.session_id !== undefined ||
    data.class_id !== undefined ||
    data.section_id !== undefined ||
    data.roll_number !== undefined ||
    data.stream_id !== undefined ||
    data.stream !== undefined;

  if (hasEnrollmentUpdate) {
    const enrollmentData = {
      session_id: data.session_id ?? existing.session_id,
      class_id: data.class_id ?? existing.class_id,
      section_id: data.section_id ?? existing.section_id,
      roll_number: data.roll_number ?? existing.roll_number,
      stream_id: data.stream_id ?? existing.stream_id ?? null,
      stream: data.stream,
    };

    const enrollmentMeta = await resolveEnrollmentScope(enrollmentData);

    await repo.updateActiveEnrollment(id, {
      ...enrollmentData,
      stream_id: enrollmentMeta.stream_id,
    });
  }

  return { message: "updated" };
}

export async function deleteStudent(id) {
  const studentId = Number(id);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    throw new AppError("Invalid student id", 400);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const result = await repo.deleteStudentExclusive(conn, studentId);
    if (!result?.deleted) {
      throw new AppError("Student not found", 404);
    }

    await conn.commit();
    return { message: "deleted" };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function searchParent(phone) {
  return repo.searchParent(phone);
}

export async function bulkCreateStudents(rows = []) {
  const successes = [];
  const failures = [];

  for (const row of rows) {
    const meta = row?._meta || {};

    try {
      const result = await createStudent(row);
      successes.push({
        rowNo: meta.rowNo ?? null,
        studentId: result.studentId,
        admissionNo: meta.admissionNo || row?.student?.admission_no || null,
        name: meta.studentName || row?.student?.name || null,
      });
    } catch (err) {
      failures.push({
        rowNo: meta.rowNo ?? null,
        admissionNo: meta.admissionNo || row?.student?.admission_no || null,
        name: meta.studentName || row?.student?.name || null,
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

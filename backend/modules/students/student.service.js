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

function normalizeParentInput(parent = {}) {
  return {
    name: String(parent?.name || "").trim(),
    mobile: String(parent?.mobile || "").trim(),
    email: String(parent?.email || "").trim(),
    occupation: String(parent?.occupation || "").trim(),
    qualification: String(parent?.qualification || "").trim(),
  };
}

function mergeParentInput(base = {}, patch = {}) {
  const next = {
    name: base?.name ?? "",
    mobile: base?.mobile ?? "",
    email: base?.email ?? "",
    occupation: base?.occupation ?? "",
    qualification: base?.qualification ?? "",
  };

  if (!patch || typeof patch !== "object") {
    return normalizeParentInput(next);
  }

  const keys = ["name", "mobile", "email", "occupation", "qualification"];
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      next[key] = patch[key];
    }
  }

  return normalizeParentInput(next);
}

function getParentByRelationship(student, relationship) {
  const rel = String(relationship || "").trim().toLowerCase();
  return (
    student?.parents?.find(
      (parent) => String(parent?.relationship || "").trim().toLowerCase() === rel
    ) || null
  );
}

function getParentDisplay(student, relationship) {
  const exact = getParentByRelationship(student, relationship);
  if (exact) return exact;
  return getParentByRelationship(student, "guardian");
}

function buildParentSnapshot(student, relationship) {
  const parent = getParentDisplay(student, relationship);
  if (!parent) {
    return normalizeParentInput({});
  }

  return normalizeParentInput({
    name: parent?.name ?? "",
    mobile: parent?.mobile ?? "",
    email: parent?.email ?? "",
    occupation: parent?.occupation ?? "",
    qualification: parent?.qualification ?? "",
  });
}

function validateParentUpdatePayload(father, mother) {
  const fatherHasDetails = hasParentDetails(father);
  const motherHasDetails = hasParentDetails(mother);

  if (!father.mobile && !mother.mobile) {
    throw new AppError("At least one parent phone is required", 400);
  }

  if (fatherHasDetails && !father.mobile) {
    throw new AppError("Father phone is required when father details are provided", 400);
  }

  if (motherHasDetails && !mother.mobile) {
    throw new AppError("Mother phone is required when mother details are provided", 400);
  }

  if (father.mobile && !/^\d{10}$/.test(father.mobile)) {
    throw new AppError("Father phone must be 10 digits", 400);
  }

  if (mother.mobile && !/^\d{10}$/.test(mother.mobile)) {
    throw new AppError("Mother phone must be 10 digits", 400);
  }

  if (father.mobile && !father.name) {
    throw new AppError("Father name is required when father phone is provided", 400);
  }

  if (mother.mobile && !mother.name) {
    throw new AppError("Mother name is required when mother phone is provided", 400);
  }

  if (father.email && !EMAIL_REGEX.test(father.email)) {
    throw new AppError("Father email is invalid", 400);
  }

  if (mother.email && !EMAIL_REGEX.test(mother.email)) {
    throw new AppError("Mother email is invalid", 400);
  }
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

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  // Accept datetime-like payloads (e.g. 2026-04-12T00:00:00.000Z / 2026-04-12 00:00:00)
  const ymdPrefix = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (ymdPrefix) {
    return ymdPrefix[1];
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

function normalizeOptionalText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalId(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function normalizeRequiredId(value, label) {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(`${label} is required`, 400);
  }
  return parsed;
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
    const normalizedEnrollment = {
      ...enrollment,
      session_id: normalizeRequiredId(enrollment?.session_id, "Session"),
      class_id: normalizeRequiredId(enrollment?.class_id, "Class"),
      section_id: normalizeOptionalId(enrollment?.section_id),
      stream_id: normalizeOptionalId(enrollment?.stream_id),
      stream: normalizeOptionalText(enrollment?.stream),
      roll_number: normalizeOptionalText(enrollment?.roll_number),
    };
    const enrollmentMeta = await resolveEnrollmentScope(normalizedEnrollment);

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
      session_id: normalizedEnrollment.session_id,
      class_id: normalizedEnrollment.class_id,
      section_id: normalizedEnrollment.section_id,
      stream_id: enrollmentMeta.stream_id,
      roll_number: normalizedEnrollment.roll_number,
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

async function resolveParent(conn, parent, options = {}) {
  const { overwriteProfile = false, overwriteEmail = false } = options;
  const normalizedMobile = String(parent?.mobile || "").trim();
  if (!normalizedMobile) {
    return null; // no parent provided
  }

  const normalizedEmail = String(parent.email || "").trim() || null;

  const existingUser = await repo.findUserByPhone(conn, normalizedMobile);

  if (existingUser) {
    if (normalizedEmail) {
      if (overwriteEmail) {
        await repo.updateUserEmail(conn, existingUser.id, normalizedEmail);
      } else {
        await repo.updateUserEmailIfEmpty(conn, existingUser.id, normalizedEmail);
      }
    }

    await repo.assignParentRole(conn, existingUser.id);

    const parentProfile = await repo.findParentByUser(conn, existingUser.id);
    if (parentProfile?.id) {
      const parentUpdatePayload = {
        name: parent.name ?? null,
        qualification: parent.qualification ?? null,
        occupation: parent.occupation ?? null,
        mobile: normalizedMobile,
        email: normalizedEmail,
      };

      if (overwriteProfile) {
        await repo.updateParentProfile(conn, parentProfile.id, parentUpdatePayload);
      } else {
        await repo.updateParentProfileIfMissing(conn, parentProfile.id, parentUpdatePayload);
      }

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

  const passwordHash = await bcrypt.hash("ABCDEF", 10);

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

async function replaceStudentParentLinks(studentId, father, mother) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await repo.deleteStudentParentLinks(conn, studentId);

    if (father.mobile && mother.mobile && father.mobile === mother.mobile) {
      const sharedParent = {
        mobile: father.mobile,
        name: father.name || mother.name || null,
        email: father.email || mother.email || null,
        occupation: father.occupation || mother.occupation || null,
        qualification: father.qualification || mother.qualification || null,
      };

      const sharedParentId = await resolveParent(conn, sharedParent, {
        overwriteProfile: true,
        overwriteEmail: true,
      });

      if (sharedParentId) {
        await repo.linkParent(conn, studentId, sharedParentId, "guardian", {
          father_name: father.name || null,
          mother_name: mother.name || null,
        });
      }
    } else {
      const fatherId = await resolveParent(conn, father, {
        overwriteProfile: true,
        overwriteEmail: true,
      });
      const motherId = await resolveParent(conn, mother, {
        overwriteProfile: true,
        overwriteEmail: true,
      });

      if (fatherId) {
        await repo.linkParent(conn, studentId, fatherId, "father");
      }
      if (motherId) {
        await repo.linkParent(conn, studentId, motherId, "mother");
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
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
      session_id:
        data.session_id !== undefined
          ? normalizeRequiredId(data.session_id, "Session")
          : existing.session_id,
      class_id:
        data.class_id !== undefined
          ? normalizeRequiredId(data.class_id, "Class")
          : existing.class_id,
      section_id:
        data.section_id !== undefined
          ? normalizeOptionalId(data.section_id)
          : existing.section_id,
      roll_number:
        data.roll_number !== undefined
          ? normalizeOptionalText(data.roll_number)
          : existing.roll_number,
      stream_id:
        data.stream_id !== undefined
          ? normalizeOptionalId(data.stream_id)
          : existing.stream_id ?? null,
      stream: data.stream !== undefined ? normalizeOptionalText(data.stream) : existing.stream,
    };

    const enrollmentMeta = await resolveEnrollmentScope(enrollmentData);

    await repo.updateActiveEnrollment(id, {
      ...enrollmentData,
      stream_id: enrollmentMeta.stream_id,
    });
  }

  const hasParentUpdate =
    Object.prototype.hasOwnProperty.call(data || {}, "father") ||
    Object.prototype.hasOwnProperty.call(data || {}, "mother");

  if (hasParentUpdate) {
    const existingFather = buildParentSnapshot(existing, "father");
    const existingMother = buildParentSnapshot(existing, "mother");

    const father = mergeParentInput(existingFather, data?.father || {});
    const mother = mergeParentInput(existingMother, data?.mother || {});

    validateParentUpdatePayload(father, mother);
    await replaceStudentParentLinks(Number(id), father, mother);
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
    const normalizedRow = {
      ...row,
      enrollment: {
        ...(row?.enrollment || {}),
        section_id: normalizeOptionalId(row?.enrollment?.section_id),
        stream_id: normalizeOptionalId(row?.enrollment?.stream_id),
      },
    };

    try {
      const result = await createStudent(normalizedRow);
      successes.push({
        rowNo: meta.rowNo ?? null,
        studentId: result.studentId,
        admissionNo: meta.admissionNo || row?.student?.admission_no || null,
        name: meta.studentName || row?.student?.name || null,
      });
    } catch (err) {
      const errorMessage = String(err?.message || "");
      const canRetryWithoutSection =
        Boolean(normalizedRow?.enrollment?.section_id) &&
        /(section|section_id|foreign key|child row)/i.test(errorMessage);

      if (canRetryWithoutSection) {
        try {
          const retryResult = await createStudent({
            ...normalizedRow,
            enrollment: {
              ...(normalizedRow.enrollment || {}),
              section_id: null,
            },
          });

          successes.push({
            rowNo: meta.rowNo ?? null,
            studentId: retryResult.studentId,
            admissionNo: meta.admissionNo || row?.student?.admission_no || null,
            name: meta.studentName || row?.student?.name || null,
          });
          continue;
        } catch (retryErr) {
          failures.push({
            rowNo: meta.rowNo ?? null,
            admissionNo: meta.admissionNo || row?.student?.admission_no || null,
            name: meta.studentName || row?.student?.name || null,
            message: retryErr?.message || "Unknown error",
          });
          continue;
        }
      }

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

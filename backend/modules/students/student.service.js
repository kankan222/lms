import * as repo from "./student.repository.js";
import bcrypt from "bcrypt";
import { pool } from "../../database/pool.js";
import AppError from "../../core/errors/AppError.js";

function validateCreatePayload(payload) {
  if (!payload?.student?.name) {
    throw new AppError("Student name is required", 400);
  }
  if (!payload?.student?.mobile) {
    throw new AppError("Student phone is required", 400);
  }
  if (!/^\d{10}$/.test(String(payload.student.mobile))) {
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
}

export async function createStudent(payload) {
  validateCreatePayload(payload);

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const { student, enrollment, father, mother } = payload;

    const studentId = await repo.insertStudent(conn, student);

    const fatherId = await resolveParent(conn, father);
    const motherId = await resolveParent(conn, mother);

    if (fatherId) {
      await repo.linkParent(conn, studentId, fatherId, "father");
    }

    if (motherId) {
      await repo.linkParent(conn, studentId, motherId, "mother");
    }

    await repo.insertEnrollment(conn, {
      student_id: studentId,
      session_id: enrollment.session_id,
      class_id: enrollment.class_id,
      section_id: enrollment.section_id,
      stream_id: enrollment.stream_id,
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
  if (!parent || !parent.mobile) {
    return null; // no parent provided
  }

  const existingUser = await repo.findUserByPhone(conn, parent.mobile);

  if (existingUser) {
    await repo.assignParentRole(conn, existingUser.id);

    const parentProfile = await repo.findParentByUser(conn, existingUser.id);
    if (parentProfile?.id) {
      return parentProfile.id;
    }

    return repo.createParent(conn, {
      user_id: existingUser.id,
      name: parent.name ?? null,
      qualification: parent.qualification ?? null,
      occupation: parent.occupation ?? null,
    });
  }

  const passwordHash = await bcrypt.hash("parent123", 10);

  const userId = await repo.createUser(conn, {
    phone: parent.mobile,
    email: parent.email ?? null,
    password_hash: passwordHash,
  });

  await repo.assignParentRole(conn, userId);

  const parentId = await repo.createParent(conn, {
    user_id: userId,
    name: parent.name ?? null,
    qualification: parent.qualification ?? null,
    occupation: parent.occupation ?? null,
  });

  return parentId;
}
export async function getStudents(filters = {}) {
  return repo.getStudents(filters);
}

export async function getStudentById(id) {
  return repo.getStudentById(id);
}

export async function updateStudent(id, data) {
  return repo.updateStudent(id, data);
}

export async function deleteStudent(id) {
  return repo.deleteStudent(id);
}

export async function searchParent(phone) {
  return repo.searchParent(phone);
}

export async function bulkCreateStudents(rows = []) {
  const createdIds = [];

  for (const row of rows) {
    const result = await createStudent(row);
    createdIds.push(result.studentId);
  }

  return {
    createdCount: createdIds.length,
    studentIds: createdIds
  };
}

import * as repo from "./fee.repository.js";
import { generateReceiptPdf } from "./feePdf.service.js";
import AppError from "../../core/errors/AppError.js";

const ALLOWED_SCOPES = new Set(["school", "hs"]);

function normalizeScope(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const scope = String(value).trim().toLowerCase();
  if (!ALLOWED_SCOPES.has(scope)) {
    throw new AppError("Invalid scope. Allowed values: school, hs", 400);
  }
  return scope;
}

function normalizeDate(value, fieldName) {
  if (!value) return undefined;
  const date = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError(`Invalid ${fieldName}. Use YYYY-MM-DD format`, 400);
  }
  return date;
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/"/g, "\"\"")}"`;
  }
  return str;
}

function buildPaymentQueryFilters(filters = {}) {
  const queryFilters = { ...(filters || {}) };
  const userId = queryFilters.userId;
  delete queryFilters.userId;

  queryFilters.scope = normalizeScope(queryFilters.scope);
  queryFilters.payment_date = normalizeDate(queryFilters.payment_date, "payment_date");
  queryFilters.date_from = normalizeDate(queryFilters.date_from, "date_from");
  queryFilters.date_to = normalizeDate(queryFilters.date_to, "date_to");

  if (queryFilters.payment_date) {
    queryFilters.date_from = queryFilters.payment_date;
    queryFilters.date_to = queryFilters.payment_date;
  }

  if (queryFilters.date_from && queryFilters.date_to && queryFilters.date_from > queryFilters.date_to) {
    throw new AppError("date_from cannot be after date_to", 400);
  }

  return { userId, queryFilters };
}

async function getUserFlags(userId) {
  const roles = await repo.getUserRoleNames(userId);
  return {
    isAdmin: roles.includes("super_admin"),
    isTeacher: roles.includes("teacher"),
    isParent: roles.includes("parent"),
  };
}

async function assertTeacherScopeAccess(userId, enrollment) {
  const flags = await getUserFlags(userId);
  if (flags.isAdmin || !flags.isTeacher) return;

  const allowed = await repo.isTeacherAssignedToScope(
    userId,
    Number(enrollment.class_id),
    Number(enrollment.section_id),
    Number(enrollment.session_id)
  );

  if (!allowed) {
    throw new AppError("Not authorized for this class/section/session", 403);
  }
}

export async function createFeeStructure(data) {
  return repo.insertFeeStructure(data);
}

export async function updateFeeStructure(id, data) {
  const existing = await repo.getFeeStructureById(id);
  if (!existing) throw new AppError("Fee structure not found", 404);

  const next = {
    class_id: Number(data.class_id ?? existing.class_id),
    session_id: Number(data.session_id ?? existing.session_id),
    admission_fee: Number(data.admission_fee ?? existing.admission_fee)
  };

  if (!next.class_id || !next.session_id || !next.admission_fee || next.admission_fee <= 0) {
    throw new AppError("class_id, session_id and valid admission_fee are required", 400);
  }

  await repo.updateFeeStructure(id, next);
  return { message: "Fee structure updated" };
}

export async function deleteFeeStructure(id) {
  const existing = await repo.getFeeStructureById(id);
  if (!existing) throw new AppError("Fee structure not found", 404);

  await repo.deleteFeeStructure(id);
  return { message: "Fee structure deleted" };
}

export async function getFeeStructure(classId, sessionId) {
  return repo.getFeeStructure(classId, sessionId);
}

export async function getAllFeeStructures() {
  return repo.getAllFeeStructuresWithInstallments();
}

export async function createInstallment(data) {
  return repo.insertInstallment(data);
}

export async function updateInstallment(id, data) {
  const existing = await repo.getInstallmentById(id);
  if (!existing) throw new AppError("Installment not found", 404);

  const next = {
    installment_name: String(data.installment_name ?? existing.installment_name).trim(),
    amount: Number(data.amount ?? existing.amount),
    due_date: data.due_date ?? existing.due_date ?? null
  };

  if (!next.installment_name) {
    throw new AppError("installment_name is required", 400);
  }
  if (!next.amount || next.amount <= 0) {
    throw new AppError("amount must be greater than zero", 400);
  }

  await repo.updateInstallment(id, next);
  return { message: "Installment updated" };
}

export async function deleteInstallment(id) {
  const existing = await repo.getInstallmentById(id);
  if (!existing) throw new AppError("Installment not found", 404);

  await repo.deleteInstallment(id);
  return { message: "Installment deleted" };
}

export async function generateStudentLedger(enrollmentId) {
  const structure = await repo.getStructureByEnrollment(enrollmentId);
  if (!structure) {
    const enrollment = await repo.getEnrollmentSummary(enrollmentId);
    const context = enrollment
      ? `${enrollment.class_name} / ${enrollment.session_name}`
      : `enrollment ${enrollmentId}`;
    throw new AppError(`Fee structure not found for ${context}`, 404);
  }

  const installments = await repo.getInstallments(structure.id);

  await repo.insertAdmissionFee(enrollmentId, structure.admission_fee);

  for (const inst of installments) {
    await repo.insertStudentInstallment(enrollmentId, inst.id, inst.amount);
  }

  return { message: "Ledger generated" };
}

export async function getStudentLedger(enrollmentId) {
  return repo.getStudentLedger(enrollmentId);
}

export async function createPayment(data, user) {
  if (!data.student_fee_id) {
    throw new AppError("student_fee_id required", 400);
  }

  if (!data.amount_paid || data.amount_paid <= 0) {
    throw new AppError("invalid payment amount", 400);
  }

  const enrollment = await repo.getEnrollmentByStudentFeeId(data.student_fee_id);
  if (!enrollment) throw new AppError("Invalid student_fee_id", 400);
  await assertTeacherScopeAccess(user.userId, enrollment);

  const result = await repo.insertPayment({
    student_fee_id: data.student_fee_id,
    amount_paid: data.amount_paid,
    remarks: data.remarks,
    created_by: user.userId,
  });

  await repo.recalculateStudentFeeStatus(data.student_fee_id);

  return {
    message: "Payment recorded successfully",
    payment_id: result?.insertId || null
  };
}

export async function approvePayment(paymentId, user) {
  const existing = await repo.getPaymentById(paymentId);
  if (!existing) throw new AppError("Payment not found", 404);
  return { message: "Approval no longer required. Payment is already final." };
}

export async function getPendingPayments() {
  return [];
}

export async function generateReceipt(paymentId) {
  return generateReceiptPdf(paymentId);
}

export async function getPayments(filters = {}) {
  const { userId, queryFilters } = buildPaymentQueryFilters(filters);

  if (userId) {
    const flags = await getUserFlags(userId);
    if (flags.isTeacher && !flags.isAdmin) {
      queryFilters.teacher_user_id = userId;
    }
  }

  return repo.getPayments(queryFilters);
}

export async function exportPaymentsCsv(filters = {}) {
  const rows = await getPayments(filters);

  const headers = [
    "payment_id",
    "payment_date",
    "student_name",
    "class_name",
    "class_scope",
    "section_name",
    "medium",
    "fee_type",
    "fee_amount",
    "amount_paid",
    "fee_status",
    "payment_status",
    "remarks",
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.id,
        row.payment_date || (row.created_at ? String(row.created_at).slice(0, 10) : ""),
        row.student_name,
        row.class_name,
        row.class_scope,
        row.section_name,
        row.medium,
        row.fee_type,
        row.fee_amount,
        row.amount_paid,
        row.fee_status,
        row.status,
        row.remarks,
      ]
        .map(csvEscape)
        .join(",")
    ),
  ];

  return lines.join("\n");
}

export async function getStudentFeeOptions(studentId, user) {
  const enrollment = await repo.getActiveEnrollmentByStudent(studentId);
  if (!enrollment) {
    throw new AppError("Active enrollment not found for student", 404);
  }

  if (user?.userId) {
    await assertTeacherScopeAccess(user.userId, enrollment);
  }

  const existingCount = await repo.countStudentFees(enrollment.id);
  if (existingCount === 0) {
    await generateStudentLedger(enrollment.id);
  }

  return repo.getStudentFeeOptions(enrollment.id);
}

async function assertParentOwnsStudent(userId, studentId) {
  const studentIds = await repo.getParentStudentIdsByUser(userId);
  if (!studentIds.includes(Number(studentId))) {
    throw new AppError("Not authorized to view this student's fee data", 403);
  }
}

export async function getMyStudents(user) {
  const flags = await getUserFlags(user?.userId);
  if (!flags.isParent) {
    throw new AppError("Only parents can use this endpoint", 403);
  }

  const studentIds = await repo.getParentStudentIdsByUser(user.userId);
  return repo.getStudentsByIds(studentIds);
}

export async function getMyStudentFeeOptions(studentId, user) {
  const flags = await getUserFlags(user?.userId);
  if (!flags.isParent) {
    throw new AppError("Only parents can use this endpoint", 403);
  }

  await assertParentOwnsStudent(user.userId, studentId);
  const enrollment = await repo.getActiveEnrollmentByStudent(studentId);
  if (!enrollment) {
    throw new AppError("Active enrollment not found for student", 404);
  }

  const existingCount = await repo.countStudentFees(enrollment.id);
  if (existingCount === 0) {
    await generateStudentLedger(enrollment.id);
  }

  return repo.getStudentFeeOptions(enrollment.id);
}

export async function getMyPayments(filters = {}, user) {
  const flags = await getUserFlags(user?.userId);
  if (!flags.isParent) {
    throw new AppError("Only parents can use this endpoint", 403);
  }

  const studentId = Number(filters.student_id);
  if (!studentId) {
    throw new AppError("student_id is required", 400);
  }

  await assertParentOwnsStudent(user.userId, studentId);
  return repo.getPayments({ student_id: studentId });
}

export async function getStudentsForPayment(filters = {}, user) {
  const classId = Number(filters.class_id);
  const sectionId = Number(filters.section_id);

  if (!classId || !sectionId) {
    throw new AppError("class_id and section_id are required", 400);
  }

  const queryFilters = {
    class_id: classId,
    section_id: sectionId,
  };

  if (user?.userId) {
    const flags = await getUserFlags(user.userId);
    if (flags.isTeacher && !flags.isAdmin) {
      queryFilters.teacher_user_id = user.userId;
    }
  }

  return repo.getStudentsForPayment(queryFilters);
}

export async function updatePayment(paymentId, data, user) {
  if (!data.amount_paid || Number(data.amount_paid) <= 0) {
    throw new AppError("invalid payment amount", 400);
  }

  const existing = await repo.getPaymentById(paymentId);
  if (!existing) throw new AppError("Payment not found", 404);

  const enrollment = await repo.getEnrollmentByPaymentId(paymentId);
  if (!enrollment) throw new AppError("Enrollment not found for payment", 404);
  await assertTeacherScopeAccess(user.userId, enrollment);

  await repo.updatePayment(paymentId, {
    ...data
  });
  await repo.recalculateStudentFeeStatus(existing.student_fee_id);

  return { message: "Payment updated successfully" };
}

export async function deletePayment(paymentId, user) {
  const existing = await repo.getPaymentById(paymentId);
  if (!existing) throw new AppError("Payment not found", 404);

  const enrollment = await repo.getEnrollmentByPaymentId(paymentId);
  if (!enrollment) throw new AppError("Enrollment not found for payment", 404);
  await assertTeacherScopeAccess(user.userId, enrollment);

  await repo.deletePayment(paymentId);
  await repo.recalculateStudentFeeStatus(existing.student_fee_id);

  return { message: "Payment deleted" };
}

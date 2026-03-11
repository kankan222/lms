import * as repo from "./fee.repository.js";
import { generateReceiptPdf } from "./feePdf.service.js";
import AppError from "../../core/errors/AppError.js";

async function getUserFlags(userId) {
  const roles = await repo.getUserRoleNames(userId);
  return {
    isAdmin: roles.includes("super_admin"),
    isTeacher: roles.includes("teacher")
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
  if (!structure) throw new Error("Fee structure not found");

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
  const queryFilters = { ...(filters || {}) };
  const userId = queryFilters.userId;
  delete queryFilters.userId;

  if (userId) {
    const flags = await getUserFlags(userId);
    if (flags.isTeacher && !flags.isAdmin) {
      queryFilters.teacher_user_id = userId;
    }
  }

  return repo.getPayments(queryFilters);
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

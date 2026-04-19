import * as repo from "./fee.repository.js";
import { generateReceiptPdf } from "./feePdf.service.js";
import AppError from "../../core/errors/AppError.js";

const ALLOWED_SCOPES = new Set(["school", "hs"]);
const STREAM_SCOPE = "hs";
const HS_STREAM_MIGRATION_PATH = "backend/database/migrations/20260417_fee_structures_stream_scope.sql";

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

function parsePositiveInt(value) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

function normalizeClassScopeValue(value) {
  return String(value || "school").trim().toLowerCase();
}

function isHsStreamSchemaReady(status) {
  return Boolean(
    status?.hasStreamId &&
      status?.hasStreamIdDedupe &&
      status?.hasUniqueClassSessionStream &&
      !status?.hasLegacyUniqueClassSession
  );
}

async function assertHsStreamSchemaSupport(classScope) {
  if (normalizeClassScopeValue(classScope) !== STREAM_SCOPE) return;

  const schemaStatus = await repo.getFeeStructuresStreamSchemaStatus();
  if (isHsStreamSchemaReady(schemaStatus)) return;

  throw new AppError(
    `Higher secondary fees require full stream-aware schema migration. Run: ${HS_STREAM_MIGRATION_PATH}`,
    500
  );
}

async function resolveFeeStructurePayload(data = {}, existing = null) {
  const classId = parsePositiveInt(data.class_id ?? existing?.class_id);
  const sessionId = parsePositiveInt(data.session_id ?? existing?.session_id);
  const admissionFee = Number(data.admission_fee ?? existing?.admission_fee);

  if (!classId || !sessionId || !Number.isFinite(admissionFee) || admissionFee <= 0) {
    throw new AppError("class_id, session_id and valid admission_fee are required", 400);
  }

  const classRow = await repo.getClassById(classId);
  if (!classRow) {
    throw new AppError("Invalid class_id", 400);
  }

  const classScope = normalizeClassScopeValue(classRow.class_scope);
  await assertHsStreamSchemaSupport(classScope);
  let streamIdRaw = data.stream_id ?? existing?.stream_id ?? null;
  let streamId = null;

  if (classScope === STREAM_SCOPE) {
    streamId = parsePositiveInt(streamIdRaw);
    if (!streamId) {
      throw new AppError("stream_id is required for higher secondary classes", 400);
    }

    const streamRow = await repo.getStreamById(streamId);
    if (!streamRow) {
      throw new AppError("Invalid stream_id", 400);
    }
  }

  return {
    class_id: classId,
    session_id: sessionId,
    stream_id: streamId,
    admission_fee: admissionFee,
  };
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

  if (queryFilters.stream_id !== undefined && queryFilters.stream_id !== null && queryFilters.stream_id !== "") {
    const parsedStreamId = parsePositiveInt(queryFilters.stream_id);
    if (!parsedStreamId) {
      throw new AppError("stream_id must be a positive integer when provided", 400);
    }
    queryFilters.stream_id = parsedStreamId;
  } else {
    delete queryFilters.stream_id;
  }

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

async function syncStudentLedgerForEnrollment(enrollmentId) {
  const enrollment = await repo.getEnrollmentSummary(enrollmentId);
  if (!enrollment) {
    return { synced: false };
  }

  await assertHsStreamSchemaSupport(enrollment.class_scope);

  const structure = await repo.getStructureByEnrollment(enrollmentId);
  if (!structure) {
    return { synced: false };
  }

  const installments = await repo.getInstallments(structure.id);
  const existingRows = await repo.getStudentFeeSyncRows(enrollmentId);
  const activeInstallmentIds = new Set(
    installments
      .map((row) => Number(row.id))
      .filter((value) => Number.isInteger(value) && value > 0)
  );

  // Remove stale installment rows only when no payment is attached.
  for (const row of existingRows) {
    if (row.fee_type !== "installment") continue;
    const installmentId = Number(row.installment_id || 0);
    const isLinkedToActiveInstallment = activeInstallmentIds.has(installmentId);
    const hasPayment = Number(row.paid || 0) > 0;

    if (!isLinkedToActiveInstallment && !hasPayment) {
      await repo.deleteStudentFee(row.id);
    }
  }

  const activeRows = existingRows.filter((row) => {
    if (row.fee_type !== "installment") return true;
    const installmentId = Number(row.installment_id || 0);
    const isLinkedToActiveInstallment = activeInstallmentIds.has(installmentId);
    const hasPayment = Number(row.paid || 0) > 0;
    return isLinkedToActiveInstallment || hasPayment;
  });

  const admissionRow = activeRows.find((row) => row.fee_type === "admission");
  const installmentMap = new Map(
    activeRows
      .filter((row) => row.fee_type === "installment" && row.installment_id)
      .map((row) => [Number(row.installment_id), row])
  );

  if (!admissionRow) {
    await repo.insertAdmissionFee(enrollmentId, structure.admission_fee);
  } else if (Number(admissionRow.paid || 0) === 0) {
    const nextAmount = Number(structure.admission_fee || 0);
    const currentAmount = Number(admissionRow.amount || 0);
    if (nextAmount > 0 && currentAmount !== nextAmount) {
      await repo.updateStudentFeeAmount(admissionRow.id, nextAmount);
    }
  }

  for (const installment of installments) {
    const current = installmentMap.get(Number(installment.id));
    if (!current) {
      await repo.insertStudentInstallment(enrollmentId, installment.id, installment.amount);
      continue;
    }

    if (Number(current.paid || 0) !== 0) {
      continue;
    }

    const nextAmount = Number(installment.amount || 0);
    const currentAmount = Number(current.amount || 0);
    if (nextAmount > 0 && currentAmount !== nextAmount) {
      await repo.updateStudentFeeAmount(current.id, nextAmount);
    }
  }

  return { synced: true };
}

async function syncStudentLedgersForStructure(structureId) {
  const enrollmentIds = await repo.getActiveEnrollmentIdsForStructure(structureId);
  for (const enrollmentId of enrollmentIds) {
    await syncStudentLedgerForEnrollment(enrollmentId);
  }
}

async function tryConvertLegacyHsNullStreamStructure(payload, error) {
  if (error?.code !== "ER_DUP_ENTRY") return null;
  if (!payload?.stream_id) return null;

  const legacy = await repo.getLegacyHsNullStreamStructure(payload.class_id, payload.session_id);
  if (!legacy) return null;

  try {
    await repo.assignLegacyStructureToStream(legacy.id, payload.stream_id, payload.admission_fee);
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY") {
      throw error;
    }
    throw err;
  }

  const next = await repo.getFeeStructure(payload.class_id, payload.session_id, payload.stream_id);
  if (!next?.id) {
    throw new AppError("Failed to resolve converted fee structure", 500);
  }

  return next;
}

export async function createFeeStructure(data) {
  const payload = await resolveFeeStructurePayload(data);
  try {
    const result = await repo.insertFeeStructure(payload);
    const structureId = Number(result?.insertId || 0);
    if (structureId > 0) {
      await syncStudentLedgersForStructure(structureId);
    }
    return result;
  } catch (err) {
    const converted = await tryConvertLegacyHsNullStreamStructure(payload, err);
    if (converted) {
      await syncStudentLedgersForStructure(Number(converted.id));
      return {
        insertId: Number(converted.id),
        converted_legacy_hs_structure: true,
      };
    }

    if (err?.code === "ER_DUP_ENTRY") {
      const schemaStatus = await repo.getFeeStructuresStreamSchemaStatus();
      if (payload?.stream_id && !isHsStreamSchemaReady(schemaStatus)) {
        throw new AppError(
          `Higher secondary stream fee schema is incomplete. Run: ${HS_STREAM_MIGRATION_PATH}`,
          500
        );
      }

      const existing = await repo.getFeeStructure(
        payload.class_id,
        payload.session_id,
        payload.stream_id ?? null
      );

      if (existing?.id) {
        throw new AppError(
          "Fee structure already exists for this class, session, and stream",
          400
        );
      }
    }

    throw err;
  }
}

export async function updateFeeStructure(id, data) {
  const existing = await repo.getFeeStructureById(id);
  if (!existing) throw new AppError("Fee structure not found", 404);

  const next = await resolveFeeStructurePayload(data, existing);

  await repo.updateFeeStructure(id, next);
  await syncStudentLedgersForStructure(id);
  return { message: "Fee structure updated" };
}

export async function deleteFeeStructure(id) {
  const existing = await repo.getFeeStructureById(id);
  if (!existing) throw new AppError("Fee structure not found", 404);

  await repo.deleteUnpaidStudentFeesForStructure(id);
  await repo.deleteFeeStructure(id);
  return { message: "Fee structure deleted" };
}

export async function getFeeStructure(classId, sessionId, streamId = null) {
  const normalizedClassId = parsePositiveInt(classId);
  const normalizedSessionId = parsePositiveInt(sessionId);
  const normalizedStreamId =
    streamId === null || streamId === undefined || String(streamId).trim() === ""
      ? null
      : parsePositiveInt(streamId);

  if (!normalizedClassId || !normalizedSessionId) {
    throw new AppError("class_id and session_id are required", 400);
  }
  if (streamId !== null && streamId !== undefined && String(streamId).trim() !== "" && !normalizedStreamId) {
    throw new AppError("stream_id must be a positive integer when provided", 400);
  }

  const classRow = await repo.getClassById(normalizedClassId);
  if (!classRow) {
    throw new AppError("Invalid class_id", 400);
  }

  const classScope = normalizeClassScopeValue(classRow.class_scope);
  await assertHsStreamSchemaSupport(classScope);

  if (classScope === STREAM_SCOPE && !normalizedStreamId) {
    throw new AppError("stream_id is required for higher secondary classes", 400);
  }

  return repo.getFeeStructure(normalizedClassId, normalizedSessionId, normalizedStreamId);
}

export async function getAllFeeStructures() {
  return repo.getAllFeeStructuresWithInstallments();
}

export async function createInstallment(data) {
  const result = await repo.insertInstallment(data);
  await syncStudentLedgersForStructure(Number(data.fee_structure_id));
  return result;
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
  await syncStudentLedgersForStructure(Number(existing.fee_structure_id));
  return { message: "Installment updated" };
}

export async function deleteInstallment(id) {
  const existing = await repo.getInstallmentById(id);
  if (!existing) throw new AppError("Installment not found", 404);

  await repo.deleteUnpaidStudentFeesForInstallment(id);
  await repo.deleteInstallment(id);
  await syncStudentLedgersForStructure(Number(existing.fee_structure_id));
  return { message: "Installment deleted" };
}

export async function generateStudentLedger(enrollmentId) {
  const enrollment = await repo.getEnrollmentSummary(enrollmentId);
  if (!enrollment) {
    throw new AppError(`Enrollment ${enrollmentId} not found`, 404);
  }

  await assertHsStreamSchemaSupport(enrollment.class_scope);

  const structure = await repo.getStructureByEnrollment(enrollmentId);
  if (!structure) {
    const streamContext = enrollment.stream_name ? ` / ${enrollment.stream_name}` : "";
    const context = `${enrollment.class_name}${streamContext} / ${enrollment.session_name}`;
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

export async function generateReceipt(paymentId, user) {
  const receipt = await repo.getPaymentReceipt(paymentId);
  if (!receipt) {
    throw new AppError("Payment not found", 404);
  }

  if (user?.userId) {
    const flags = await getUserFlags(user.userId);

    if (flags.isParent) {
      await assertParentOwnsStudent(user.userId, receipt.student_id);
    } else if (flags.isTeacher && !flags.isAdmin) {
      const enrollment = await repo.getEnrollmentByPaymentId(paymentId);
      if (!enrollment) {
        throw new AppError("Payment enrollment not found", 404);
      }
      await assertTeacherScopeAccess(user.userId, enrollment);
    }
  }

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
    try {
      await generateStudentLedger(enrollment.id);
    } catch (err) {
      if (
        err?.statusCode === 404 &&
        String(err?.message || "").toLowerCase().includes("fee structure not found")
      ) {
        return [];
      }
      throw err;
    }
  } else {
    await syncStudentLedgerForEnrollment(enrollment.id);
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
    try {
      await generateStudentLedger(enrollment.id);
    } catch (err) {
      if (
        err?.statusCode === 404 &&
        String(err?.message || "").toLowerCase().includes("fee structure not found")
      ) {
        return [];
      }
      throw err;
    }
  } else {
    await syncStudentLedgerForEnrollment(enrollment.id);
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
  const streamIdRaw = filters.stream_id;
  const streamId =
    streamIdRaw === undefined || streamIdRaw === null || String(streamIdRaw).trim() === ""
      ? null
      : Number(streamIdRaw);

  if (!classId || !sectionId) {
    throw new AppError("class_id and section_id are required", 400);
  }
  if (streamId !== null && (!Number.isInteger(streamId) || streamId <= 0)) {
    throw new AppError("stream_id must be a positive integer when provided", 400);
  }

  const queryFilters = {
    class_id: classId,
    section_id: sectionId,
    stream_id: streamId,
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

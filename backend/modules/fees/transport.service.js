import PDFDocument from "pdfkit";
import AppError from "../../core/errors/AppError.js";
import { pool } from "../../database/pool.js";
import * as repo from "./transport.repository.js";

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parsePositiveInt(value, fieldName) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError(`${fieldName} must be a positive integer`, 400);
  }
  return num;
}

function parseOptionalPositiveInt(value, fieldName) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text || text === "null" || text === "undefined") return null;
  return parsePositiveInt(value, fieldName);
}

function parseMoney(value, fieldName) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError(`${fieldName} must be greater than zero`, 400);
  }
  return amount;
}

function parseOptionalDecimal(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError(`${fieldName} must be a valid number`, 400);
  }
  return amount;
}

function parseMonth(value, fieldName) {
  const month = parsePositiveInt(value, fieldName);
  if (month < 1 || month > 12) {
    throw new AppError(`${fieldName} must be between 1 and 12`, 400);
  }
  return month;
}

function parseYear(value, fieldName) {
  const year = parsePositiveInt(value, fieldName);
  if (year < 2000 || year > 2100) {
    throw new AppError(`${fieldName} is invalid`, 400);
  }
  return year;
}

function monthIndex(year, month) {
  return year * 12 + month;
}

function normalizeBool(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "active"].includes(String(value).toLowerCase());
}

function normalizeSessionMonthBounds(session) {
  const start = new Date(session.start_date);
  const end = new Date(session.end_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError("Academic session dates are invalid", 500);
  }

  let endYear = end.getUTCFullYear();
  let endMonth = end.getUTCMonth() + 1;
  if (end.getUTCDate() <= 1) {
    endMonth -= 1;
    if (endMonth < 1) {
      endMonth = 12;
      endYear -= 1;
    }
  }

  return {
    startMonth: start.getUTCMonth() + 1,
    startYear: start.getUTCFullYear(),
    endMonth,
    endYear,
  };
}

function buildDueMonths(session, assignment) {
  const bounds = normalizeSessionMonthBounds(session);
  const sessionStart = monthIndex(bounds.startYear, bounds.startMonth);
  const sessionEnd = monthIndex(bounds.endYear, bounds.endMonth);
  const start = monthIndex(assignment.start_year, assignment.start_month);
  const end =
    assignment.end_month && assignment.end_year
      ? monthIndex(assignment.end_year, assignment.end_month)
      : sessionEnd;

  if (start < sessionStart || start > sessionEnd) {
    throw new AppError("Start month must be inside the selected academic session", 400);
  }
  if (end < start || end > sessionEnd) {
    throw new AppError("End month must be after start month and inside the session", 400);
  }

  const months = [];
  for (let cursor = start; cursor <= end; cursor += 1) {
    const zeroBased = cursor - 1;
    months.push({
      year: Math.floor(zeroBased / 12),
      month: (zeroBased % 12) + 1,
    });
  }
  return months;
}

function normalizeRoutePayload(data = {}, existing = null) {
  const name = String(data.name ?? existing?.name ?? "").trim();
  if (!name) throw new AppError("Route name is required", 400);
  return {
    name,
    description: String(data.description ?? existing?.description ?? "").trim() || null,
    is_active: normalizeBool(data.is_active, existing ? Boolean(existing.is_active) : true),
  };
}

function normalizeStopPayload(data = {}, existing = null) {
  const routeId = parsePositiveInt(data.route_id ?? existing?.route_id, "route_id");
  const name = String(data.name ?? existing?.name ?? "").trim();
  if (!name) throw new AppError("Stop name is required", 400);
  return {
    route_id: routeId,
    name,
    distance_km: parseOptionalDecimal(data.distance_km ?? existing?.distance_km, "distance_km"),
    monthly_fee: parseMoney(data.monthly_fee ?? existing?.monthly_fee, "monthly_fee"),
    is_active: normalizeBool(data.is_active, existing ? Boolean(existing.is_active) : true),
  };
}

export function formatTransportMonth(month, year) {
  return `${MONTH_NAMES[Number(month)] || month} ${year}`;
}

export async function listRoutes() {
  return repo.listRoutes();
}

export async function createRoute(data) {
  const payload = normalizeRoutePayload(data);
  const result = await repo.createRoute(payload);
  return { message: "Route created", id: result.insertId };
}

export async function updateRoute(id, data) {
  const routeId = parsePositiveInt(id, "route_id");
  const existing = await repo.getRouteById(routeId);
  if (!existing) throw new AppError("Route not found", 404);
  await repo.updateRoute(routeId, normalizeRoutePayload(data, existing));
  return { message: "Route updated" };
}

export async function listStops(routeId = null) {
  return repo.listStops(routeId ? parsePositiveInt(routeId, "route_id") : null);
}

export async function createStop(data) {
  const payload = normalizeStopPayload(data);
  const route = await repo.getRouteById(payload.route_id);
  if (!route) throw new AppError("Route not found", 404);
  const result = await repo.createStop(payload);
  return { message: "Stop created", id: result.insertId };
}

export async function updateStop(id, data) {
  const stopId = parsePositiveInt(id, "stop_id");
  const existing = await repo.getStopById(stopId);
  if (!existing) throw new AppError("Stop not found", 404);
  const payload = normalizeStopPayload(data, existing);
  const route = await repo.getRouteById(payload.route_id);
  if (!route) throw new AppError("Route not found", 404);
  await repo.updateStop(stopId, payload);
  return { message: "Stop updated" };
}

export async function searchStudents(filters = {}) {
  return repo.searchStudents({
    search: filters.search || "",
    session_id: filters.session_id ? parsePositiveInt(filters.session_id, "session_id") : null,
    class_id: filters.class_id ? parsePositiveInt(filters.class_id, "class_id") : null,
    section_id: filters.section_id ? parsePositiveInt(filters.section_id, "section_id") : null,
    stream_id: filters.stream_id ? parsePositiveInt(filters.stream_id, "stream_id") : null,
    medium: filters.medium ? String(filters.medium).trim() : null,
  });
}

export async function createAssignment(data, user) {
  const studentId = parsePositiveInt(data.student_id, "student_id");
  const sessionId = parsePositiveInt(data.session_id, "session_id");
  const stopId = parseOptionalPositiveInt(data.stop_id, "stop_id");
  const startMonth = parseMonth(data.start_month, "start_month");
  const startYear = parseYear(data.start_year, "start_year");
  const endMonth = data.end_month ? parseMonth(data.end_month, "end_month") : null;
  const endYear = data.end_year ? parseYear(data.end_year, "end_year") : null;
  const directMonthlyFee = data.monthly_fee ? parseMoney(data.monthly_fee, "monthly_fee") : null;

  if ((endMonth && !endYear) || (!endMonth && endYear)) {
    throw new AppError("Both end_month and end_year are required when ending service", 400);
  }

  const [student, session, stop] = await Promise.all([
    repo.getStudentById(studentId),
    repo.getSessionById(sessionId),
    stopId ? repo.getStopById(stopId) : null,
  ]);
  if (!student) throw new AppError("Student not found", 404);
  if (!session) throw new AppError("Academic session not found", 404);
  if (stopId && (!stop || !stop.is_active || !stop.route_is_active)) {
    throw new AppError("Active route and stop are required", 400);
  }
  if (!stopId && !directMonthlyFee) {
    throw new AppError("monthly_fee is required for student-specific transportation", 400);
  }

  const assignment = {
    student_id: studentId,
    session_id: sessionId,
    route_id: stop ? Number(stop.route_id) : null,
    stop_id: stopId,
    monthly_fee: stop ? Number(stop.monthly_fee) : directMonthlyFee,
    start_month: startMonth,
    start_year: startYear,
    end_month: endMonth,
    end_year: endYear,
    remarks: String(data.remarks || "").trim() || null,
    created_by: user?.userId ?? null,
  };
  const dueMonths = buildDueMonths(session, assignment);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await repo.deactivateActiveAssignments(conn, studentId, sessionId);
    const result = await repo.createAssignment(conn, assignment);
    const assignmentId = Number(result.insertId);
    for (const item of dueMonths) {
      await repo.insertDue(conn, {
        assignment_id: assignmentId,
        student_id: studentId,
        session_id: sessionId,
        due_month: item.month,
        due_year: item.year,
        amount: assignment.monthly_fee,
      });
    }
    await conn.commit();
    return { message: "Transport assignment created", id: assignmentId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listAssignments(filters = {}) {
  return repo.listAssignments({
    student_id: filters.student_id ? parsePositiveInt(filters.student_id, "student_id") : null,
    session_id: filters.session_id ? parsePositiveInt(filters.session_id, "session_id") : null,
    status: filters.status ? String(filters.status) : null,
  });
}

export async function endAssignment(id, data) {
  const assignmentId = parsePositiveInt(id, "assignment_id");
  const endMonth = parseMonth(data.end_month, "end_month");
  const endYear = parseYear(data.end_year, "end_year");
  await repo.endAssignment(assignmentId, { end_month: endMonth, end_year: endYear });
  return { message: "Transport assignment ended" };
}

export async function listDues(filters = {}) {
  return repo.listDues({
    student_id: filters.student_id ? parsePositiveInt(filters.student_id, "student_id") : null,
    session_id: filters.session_id ? parsePositiveInt(filters.session_id, "session_id") : null,
    month: filters.month ? parseMonth(filters.month, "month") : null,
    year: filters.year ? parseYear(filters.year, "year") : null,
    route_id: filters.route_id ? parsePositiveInt(filters.route_id, "route_id") : null,
    stop_id: filters.stop_id ? parsePositiveInt(filters.stop_id, "stop_id") : null,
    status: filters.status ? String(filters.status) : null,
  });
}

export async function createPayment(data, user) {
  const dueIds = Array.isArray(data.due_ids)
    ? data.due_ids.map((id) => parsePositiveInt(id, "due_id"))
    : [];
  if (!dueIds.length) throw new AppError("Select at least one transport due", 400);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const dues = await repo.getDuesForPayment(conn, dueIds);
    if (dues.length !== dueIds.length) {
      throw new AppError("One or more selected dues were not found", 400);
    }

    const studentIds = new Set(dues.map((due) => Number(due.student_id)));
    const sessionIds = new Set(dues.map((due) => Number(due.session_id)));
    if (studentIds.size !== 1 || sessionIds.size !== 1) {
      throw new AppError("Selected dues must belong to one student and one session", 400);
    }

    const payableDues = dues.map((due) => ({
      ...due,
      remaining: Number(due.remaining || 0),
    }));
    if (payableDues.some((due) => due.remaining <= 0)) {
      throw new AppError("Selected dues are already paid", 400);
    }

    const total = payableDues.reduce((sum, due) => sum + due.remaining, 0);
    const result = await repo.createPayment(conn, {
      student_id: Number([...studentIds][0]),
      session_id: Number([...sessionIds][0]),
      amount_paid: total,
      payment_method: String(data.payment_method || "").trim() || null,
      remarks: String(data.remarks || "").trim() || null,
      created_by: user?.userId ?? null,
    });
    const paymentId = Number(result.insertId);

    for (const due of payableDues) {
      await repo.createAllocation(conn, {
        payment_id: paymentId,
        transport_due_id: Number(due.id),
        amount_applied: due.remaining,
      });
      await repo.updateDueStatus(conn, Number(due.id));
    }

    const receiptNo = await repo.createReceipt(conn, paymentId);
    await conn.commit();
    return {
      message: "Transportation payment recorded",
      payment_id: paymentId,
      receipt_no: receiptNo,
      amount_paid: total,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listPayments(filters = {}) {
  return repo.listPayments({
    student_id: filters.student_id ? parsePositiveInt(filters.student_id, "student_id") : null,
    session_id: filters.session_id ? parsePositiveInt(filters.session_id, "session_id") : null,
  });
}

export async function getSummary() {
  return repo.getSummary();
}

export async function generateReceipt(paymentId) {
  const receipt = await repo.getPaymentReceipt(parsePositiveInt(paymentId, "payment_id"));
  if (!receipt) throw new AppError("Transportation payment not found", 404);

  const doc = new PDFDocument({ margin: 48 });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  doc.fontSize(16).font("Helvetica-Bold").text("KALONG KAPILI VIDYAPITH", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(13).text("Transportation Fee Receipt", { align: "center" });
  doc.moveDown(1);

  doc.font("Helvetica").fontSize(10);
  doc.text(`Receipt No: ${receipt.receipt_no || `TR-${String(receipt.id).padStart(6, "0")}`}`);
  doc.text(`Date: ${new Date(receipt.created_at).toLocaleDateString("en-IN")}`);
  doc.moveDown(0.8);

  doc.text(`Student: ${receipt.student_name}`);
  doc.text(`Admission No: ${receipt.admission_no || "-"}`);
  doc.text(`Session: ${receipt.session_name}`);
  doc.text(`Route: ${receipt.route_name || "-"}`);
  doc.text(`Pickup Point: ${receipt.stop_name || "-"}`);
  doc.moveDown(1);

  doc.font("Helvetica-Bold").text("Covered Months");
  doc.moveDown(0.4);
  doc.font("Helvetica");
  for (const allocation of receipt.allocations || []) {
    doc.text(
      `${formatTransportMonth(allocation.due_month, allocation.due_year)} - Rs ${Number(allocation.amount_applied).toFixed(2)}`
    );
  }

  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(12).text(`Total Paid: Rs ${Number(receipt.amount_paid).toFixed(2)}`);
  if (receipt.payment_method) {
    doc.font("Helvetica").fontSize(10).text(`Payment Method: ${receipt.payment_method}`);
  }
  if (receipt.remarks) {
    doc.text(`Remarks: ${receipt.remarks}`);
  }

  doc.moveDown(3);
  doc.text("Authorized Signature", { align: "right" });
  const done = new Promise((resolve) => doc.on("end", resolve));
  doc.end();

  await done;
  return Buffer.concat(chunks);
}

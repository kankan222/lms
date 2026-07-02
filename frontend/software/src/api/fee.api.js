import { apiRequest } from "../../../shared/api/client.js";


// CREATE FEE STRUCTURE
export function createFeeStructure(data) {
  return apiRequest("/fees/structure", {
    method: "POST",
    body: JSON.stringify(data),
  });
}


// GET FEE STRUCTURE
export function getFeeStructure(classId, sessionId, streamId = null) {
  const query =
    streamId === null || streamId === undefined || streamId === ""
      ? ""
      : `?stream_id=${encodeURIComponent(streamId)}`;
  return apiRequest(`/fees/structure/${classId}/${sessionId}${query}`);
}

export function getAllFeeStructure() {
  return apiRequest("/fees/structure");
}
export function updateFeeStructure(id, data) {
  return apiRequest(`/fees/structure/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
export function deleteFeeStructure(id) {
  return apiRequest(`/fees/structure/${id}`, {
    method: "DELETE",
  });
}
// CREATE INSTALLMENT
export function createInstallment(data) {
  return apiRequest("/fees/installment", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
export function updateInstallment(id, data) {
  return apiRequest(`/fees/installment/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
export function deleteInstallment(id) {
  return apiRequest(`/fees/installment/${id}`, {
    method: "DELETE",
  });
}


// GENERATE STUDENT LEDGER
export function generateStudentLedger(enrollmentId) {
  return apiRequest(`/fees/generate-ledger/${enrollmentId}`, {
    method: "POST",
  });
}


// GET STUDENT LEDGER
export function getStudentLedger(enrollmentId) {
  return apiRequest(`/fees/ledger/${enrollmentId}`);
}


// CREATE PAYMENT
export function createPayment(data) {
  return apiRequest("/fees/payment", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function bulkUploadPayments(file) {
  const form = new FormData();
  form.append("file", file);

  return apiRequest("/fees/payments/bulk-upload", {
    method: "POST",
    body: form,
  });
}

export function getPayments(params = {}) {
  const query = new URLSearchParams();
  if (params.class_id) query.set("class_id", params.class_id);
  if (params.section_id) query.set("section_id", params.section_id);
  if (params.stream_id) query.set("stream_id", params.stream_id);
  if (params.student_id) query.set("student_id", params.student_id);
  if (params.scope) query.set("scope", params.scope);
  if (params.payment_date) query.set("payment_date", params.payment_date);
  if (params.date_from) query.set("date_from", params.date_from);
  if (params.date_to) query.set("date_to", params.date_to);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/fees/payments${suffix}`);
}

export async function exportPaymentsCsv(params = {}) {
  const query = new URLSearchParams();
  if (params.class_id) query.set("class_id", params.class_id);
  if (params.section_id) query.set("section_id", params.section_id);
  if (params.stream_id) query.set("stream_id", params.stream_id);
  if (params.student_id) query.set("student_id", params.student_id);
  if (params.scope) query.set("scope", params.scope);
  if (params.payment_date) query.set("payment_date", params.payment_date);
  if (params.date_from) query.set("date_from", params.date_from);
  if (params.date_to) query.set("date_to", params.date_to);

  const token = localStorage.getItem("accessToken");
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
  const response = await fetch(`${baseUrl}/fees/payments/export${suffix}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    let message = "Failed to export payments.";
    try {
      const data = await response.json();
      message = data?.message || message;
    } catch {
      // Ignore JSON parse failures and surface the default error instead.
    }
    throw new Error(message);
  }

  return response.blob();
}

export function getStudentFeeOptions(studentId) {
  return apiRequest(`/fees/student-fees/${studentId}`);
}

export function getMyStudentsForFees() {
  return apiRequest("/fees/my-students");
}

export function getMyStudentFeeOptions(studentId) {
  return apiRequest(`/fees/my-student-fees/${studentId}`);
}

export function getMyPayments(params = {}) {
  const query = new URLSearchParams();
  if (params.student_id) query.set("student_id", params.student_id);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/fees/my-payments${suffix}`);
}

export function getStudentsForPayment(params = {}) {
  const query = new URLSearchParams();
  if (params.class_id) query.set("class_id", params.class_id);
  if (params.section_id) query.set("section_id", params.section_id);
  if (params.stream_id) query.set("stream_id", params.stream_id);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/fees/students${suffix}`);
}

export function updatePayment(paymentId, data) {
  return apiRequest(`/fees/payment/${paymentId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deletePayment(paymentId) {
  return apiRequest(`/fees/payment/${paymentId}`, {
    method: "DELETE",
  });
}

export function getTransportSummary() {
  return apiRequest("/fees/transport/summary");
}

export function getTransportRoutes() {
  return apiRequest("/fees/transport/routes");
}

export function createTransportRoute(data) {
  return apiRequest("/fees/transport/routes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTransportRoute(id, data) {
  return apiRequest(`/fees/transport/routes/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function getTransportStops(params = {}) {
  const query = new URLSearchParams();
  if (params.route_id) query.set("route_id", params.route_id);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/fees/transport/stops${suffix}`);
}

export function createTransportStop(data) {
  return apiRequest("/fees/transport/stops", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTransportStop(id, data) {
  return apiRequest(`/fees/transport/stops/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function searchTransportStudents(params = "") {
  const query = new URLSearchParams();
  if (typeof params === "string") {
    if (params) query.set("search", params);
  } else {
    if (params.search) query.set("search", params.search);
    if (params.session_id) query.set("session_id", params.session_id);
    if (params.class_id) query.set("class_id", params.class_id);
    if (params.section_id) query.set("section_id", params.section_id);
    if (params.stream_id) query.set("stream_id", params.stream_id);
    if (params.medium) query.set("medium", params.medium);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/fees/transport/students${suffix}`);
}

export function getTransportAssignments(params = {}) {
  const query = new URLSearchParams();
  if (params.student_id) query.set("student_id", params.student_id);
  if (params.session_id) query.set("session_id", params.session_id);
  if (params.status) query.set("status", params.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/fees/transport/assignments${suffix}`);
}

export function createTransportAssignment(data) {
  return apiRequest("/fees/transport/assignments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function endTransportAssignment(id, data) {
  return apiRequest(`/fees/transport/assignments/${id}/end`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function getTransportDues(params = {}) {
  const query = new URLSearchParams();
  if (params.student_id) query.set("student_id", params.student_id);
  if (params.session_id) query.set("session_id", params.session_id);
  if (params.status) query.set("status", params.status);
  if (params.month) query.set("month", params.month);
  if (params.year) query.set("year", params.year);
  if (params.route_id) query.set("route_id", params.route_id);
  if (params.stop_id) query.set("stop_id", params.stop_id);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/fees/transport/dues${suffix}`);
}

export function createTransportPayment(data) {
  return apiRequest("/fees/transport/payments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getTransportPayments(params = {}) {
  const query = new URLSearchParams();
  if (params.student_id) query.set("student_id", params.student_id);
  if (params.session_id) query.set("session_id", params.session_id);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/fees/transport/payments${suffix}`);
}

export async function downloadTransportReceipt(paymentId) {
  const token = localStorage.getItem("accessToken");
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
  const response = await fetch(`${baseUrl}/fees/transport/receipt/${paymentId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    let message = "Failed to download transportation receipt.";
    try {
      const data = await response.json();
      message = data?.message || message;
    } catch {
      // Keep the fallback message.
    }
    throw new Error(message);
  }

  return response.blob();
}

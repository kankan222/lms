import { apiRequest } from "../../../shared/api/client.js";


// CREATE FEE STRUCTURE
export function createFeeStructure(data) {
  return apiRequest("/fees/structure", {
    method: "POST",
    body: JSON.stringify(data),
  });
}


// GET FEE STRUCTURE
export function getFeeStructure(classId, sessionId) {
  return apiRequest(`/fees/structure/${classId}/${sessionId}`);
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

export function getPayments(params = {}) {
  const query = new URLSearchParams();
  if (params.class_id) query.set("class_id", params.class_id);
  if (params.section_id) query.set("section_id", params.section_id);
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

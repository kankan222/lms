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
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/fees/payments${suffix}`);
}

export function getStudentFeeOptions(studentId) {
  return apiRequest(`/fees/student-fees/${studentId}`);
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

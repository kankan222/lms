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
// CREATE INSTALLMENT
export function createInstallment(data) {
  return apiRequest("/fees/installment", {
    method: "POST",
    body: JSON.stringify(data),
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


// APPROVE PAYMENT
export function approvePayment(paymentId) {
  return apiRequest(`/fees/payment/${paymentId}/approve`, {
    method: "POST",
  });
}


// GET PENDING PAYMENTS
export function getPendingPayments() {
  return apiRequest("/fees/payments/pending");
}
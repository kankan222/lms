import * as repo from "./fee.repository.js";
import PDFDocument from "pdfkit";

export async function createFeeStructure(data) {
  return repo.insertFeeStructure(data);
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
  const existing = await repo.getStudentLedger(enrollmentId);
}

export async function createPayment(data, user){

   if(!data.student_fee_id){
    throw new Error("student_fee_id required");
  }

  if(!data.amount_paid || data.amount_paid <= 0){
    throw new Error("invalid payment amount");
  }

  return repo.insertPayment({
    student_fee_id: data.student_fee_id,
    amount_paid: data.amount_paid,
    remarks: data.remarks,
    status: user.role === "admin" ? "approved" : "pending",
    created_by: user.id
  });

}
export async function approvePayment(paymentId, user) {
  if (user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await repo.approvePayment(paymentId, user.id);

  const studentFeeId = await repo.getStudentFeeId(paymentId);

  await repo.updateFeeStatus(studentFeeId);

  return { message: "Payment approved" };
}

export async function getPendingPayments() {
  return repo.getPendingPayments();
}
export async function generateReceipt(paymentId){

  const payment = await repo.getPaymentReceipt(paymentId);
  if(!payment) throw new Error("Payment not found");

  const doc = new PDFDocument();

  const buffers = [];
  doc.on("data", buffers.push.bind(buffers));

  doc.fontSize(20).text("School Fee Receipt",{align:"center"});
  doc.moveDown();

  doc.fontSize(12).text(`Receipt ID: ${payment.id}`);
  doc.text(`Student: ${payment.first_name} ${payment.last_name}`);
  doc.text(`Class: ${payment.class_name}`);
  doc.text(`Amount Paid: ₹${payment.amount_paid}`);
  doc.text(`Date: ${new Date(payment.created_at).toLocaleDateString()}`);
  doc.text(`Remarks: ${payment.remarks || "-"}`);

  doc.end();

  return new Promise(resolve=>{
    doc.on("end",()=>{
      resolve(Buffer.concat(buffers));
    });
  });
}
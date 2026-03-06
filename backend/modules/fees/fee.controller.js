import * as feeService from "./fee.service.js";

export async function createFeeStructure(req, res) {
  try {

    const result = await feeService.createFeeStructure(req.body);

    res.json(result);

  } catch (err) {

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        message: "Fee structure already exists for this class and session"
      });
    }

    console.error(err);

    res.status(500).json({
      message: "Internal server error"
    });

  }
}

export async function getFeeStructure(req, res) {

  const { classId, sessionId } = req.params;

  if (!classId || !sessionId) {
    return res.status(400).json({
      message: "classId and sessionId required"
    });
  }

  try {

    const data = await feeService.getFeeStructure(classId, sessionId);

    res.json(data);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Internal error"
    });

  }

}
export async function getAllFeeStructures(req, res) {
  try {

    const fees = await feeService.getAllFeeStructures();

    res.json({ data: fees });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Failed to fetch fee structures"
    });

  }
}
export async function createInstallment(req, res) {
  const result = await feeService.createInstallment(req.body);
  res.json(result);
}

export async function generateStudentLedger(req, res) {
  const { enrollmentId } = req.params;
  const result = await feeService.generateStudentLedger(enrollmentId);
  res.json(result);
}

export async function getStudentLedger(req, res) {
  const result = await feeService.getStudentLedger(req.params.enrollmentId);
  res.json(result);
}

export async function createPayment(req, res) {
  console.log("PAYMENT BODY:", req.body);
  console.log("USER:", req.user);
  const result = await feeService.createPayment(req.body, req.user);
  res.json(result);
}

export async function approvePayment(req, res) {
  const result = await feeService.approvePayment(req.params.id, req.user);
  res.json(result);
}

export async function getPendingPayments(req, res) {
  const result = await feeService.getPendingPayments();
  res.json(result);
}

export async function downloadReceipt(req,res){
  const { paymentId } = req.params;

  const pdfBuffer = await feeService.generateReceipt(paymentId);

  res.setHeader("Content-Type","application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=receipt-${paymentId}.pdf`
  );

  res.send(pdfBuffer);
}
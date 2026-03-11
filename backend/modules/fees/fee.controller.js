import * as feeService from "./fee.service.js";

function mapFeeError(err, res) {
  if (err?.code === "ER_DUP_ENTRY") {
    return res.status(400).json({
      message: "Fee structure already exists for this class and session"
    });
  }
  if (err?.code === "ER_ROW_IS_REFERENCED_2") {
    return res.status(400).json({
      message: "Cannot delete record because it is already used in student fees/payments"
    });
  }
  if (typeof err?.statusCode === "number") {
    return res.status(err.statusCode).json({ message: err.message });
  }
  console.error(err);
  return res.status(500).json({ message: "Internal server error" });
}

export async function createFeeStructure(req, res) {
  try {

    const result = await feeService.createFeeStructure(req.body);

    res.json(result);

  } catch (err) {
    return mapFeeError(err, res);
  }
}

export async function updateFeeStructure(req, res) {
  try {
    const result = await feeService.updateFeeStructure(req.params.id, req.body || {});
    res.json(result);
  } catch (err) {
    return mapFeeError(err, res);
  }
}

export async function deleteFeeStructure(req, res) {
  try {
    const result = await feeService.deleteFeeStructure(req.params.id);
    res.json(result);
  } catch (err) {
    return mapFeeError(err, res);
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
  try {
    const result = await feeService.createInstallment(req.body);
    res.json(result);
  } catch (err) {
    return mapFeeError(err, res);
  }
}

export async function updateInstallment(req, res) {
  try {
    const result = await feeService.updateInstallment(req.params.id, req.body || {});
    res.json(result);
  } catch (err) {
    return mapFeeError(err, res);
  }
}

export async function deleteInstallment(req, res) {
  try {
    const result = await feeService.deleteInstallment(req.params.id);
    res.json(result);
  } catch (err) {
    return mapFeeError(err, res);
  }
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

export async function getPayments(req, res) {
  const result = await feeService.getPayments({
    ...(req.query || {}),
    userId: req.user?.userId
  });
  res.json({ data: result });
}

export async function getStudentFeeOptions(req, res) {
  const result = await feeService.getStudentFeeOptions(req.params.studentId, req.user);
  res.json({ data: result });
}

export async function updatePayment(req, res) {
  const result = await feeService.updatePayment(req.params.id, req.body, req.user);
  res.json(result);
}

export async function deletePayment(req, res) {
  const result = await feeService.deletePayment(req.params.id, req.user);
  res.json(result);
}

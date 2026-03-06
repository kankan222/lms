import express from "express";
import * as feeController from "./fee.controller.js";
import { requirePermission }
from "../../core/rbac/rbac.middleware.js";



const router = express.Router();

router.post("/structure", feeController.createFeeStructure);
router.get("/structure", feeController.getAllFeeStructures);
router.get("/structure/:classId/:sessionId", feeController.getFeeStructure);
router.get("/receipt/:paymentId", feeController.downloadReceipt);
router.post("/installment", feeController.createInstallment);

router.post("/generate-ledger/:enrollmentId", feeController.generateStudentLedger);

router.get("/ledger/:enrollmentId", feeController.getStudentLedger);

router.post("/payment", feeController.createPayment);

router.post("/payment/:id/approve", feeController.approvePayment);

router.get("/payments/pending", feeController.getPendingPayments);

export default router;
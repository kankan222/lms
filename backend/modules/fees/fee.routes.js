import express from "express";
import * as feeController from "./fee.controller.js";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.post(
  "/structure",
  requirePermission("fee.create"),
  feeController.createFeeStructure,
);
router.put(
  "/structure/:id",
  requirePermission("fee.create"),
  feeController.updateFeeStructure,
);
router.delete(
  "/structure/:id",
  requirePermission("fee.create"),
  feeController.deleteFeeStructure,
);
router.get(
  "/structure",
  requirePermission("fee.view"),
  feeController.getAllFeeStructures,
);
router.get(
  "/structure/:classId/:sessionId",
  requirePermission("fee.view"),
  feeController.getFeeStructure,
);
router.get(
  "/receipt/:paymentId",
  requirePermission("payment.view"),
  feeController.downloadReceipt,
);
router.post(
  "/installment",
  requirePermission("fee.create"),
  feeController.createInstallment,
);
router.put(
  "/installment/:id",
  requirePermission("fee.create"),
  feeController.updateInstallment,
);
router.delete(
  "/installment/:id",
  requirePermission("fee.create"),
  feeController.deleteInstallment,
);

router.post(
  "/generate-ledger/:enrollmentId",
  requirePermission("fee.create"),
  feeController.generateStudentLedger,
);

router.get(
  "/ledger/:enrollmentId",
  requirePermission("fee.view"),
  feeController.getStudentLedger,
);

router.post(
  "/payment",
  requirePermission("payment.create"),
  feeController.createPayment,
);
router.get(
  "/payments",
  requirePermission("payment.view"),
  feeController.getPayments,
);
router.get(
  "/payments/export",
  requirePermission("payment.view"),
  feeController.exportPaymentsCsv,
);
router.get(
  "/student-fees/:studentId",
  requirePermission("payment.view"),
  feeController.getStudentFeeOptions,
);
router.put(
  "/payment/:id",
  requirePermission("payment.update"),
  feeController.updatePayment,
);
router.delete(
  "/payment/:id",
  requirePermission("payment.delete"),
  feeController.deletePayment,
);

router.post(
  "/payment/:id/approve",
  requirePermission("payment.update"),
  feeController.approvePayment,
);

router.get(
  "/payments/pending",
  requirePermission("payment.view"),
  feeController.getPendingPayments,
);

export default router;

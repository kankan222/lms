import express from "express";
import * as feeController from "./fee.controller.js";
import * as transportController from "./transport.controller.js";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";
import { uploadPaymentFile } from "./fee.middleware.js";

const router = express.Router();

function requireAnyPermission(permissions) {
  return (req, res, next) => {
    const granted = req.user?.permissions || [];

    if (permissions.some((permission) => granted.includes(permission))) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "Forbidden",
    });
  };
}

router.get(
  "/transport/summary",
  requirePermission("fee.view"),
  transportController.getSummary,
);
router.get(
  "/transport/routes",
  requirePermission("fee.view"),
  transportController.listRoutes,
);
router.post(
  "/transport/routes",
  requirePermission("fee.create"),
  transportController.createRoute,
);
router.put(
  "/transport/routes/:id",
  requirePermission("fee.create"),
  transportController.updateRoute,
);
router.get(
  "/transport/stops",
  requirePermission("fee.view"),
  transportController.listStops,
);
router.post(
  "/transport/stops",
  requirePermission("fee.create"),
  transportController.createStop,
);
router.put(
  "/transport/stops/:id",
  requirePermission("fee.create"),
  transportController.updateStop,
);
router.get(
  "/transport/students",
  requirePermission("payment.view"),
  transportController.searchStudents,
);
router.get(
  "/transport/assignments",
  requirePermission("fee.view"),
  transportController.listAssignments,
);
router.post(
  "/transport/assignments",
  requirePermission("fee.create"),
  transportController.createAssignment,
);
router.put(
  "/transport/assignments/:id/end",
  requirePermission("fee.create"),
  transportController.endAssignment,
);
router.get(
  "/transport/dues",
  requirePermission("fee.view"),
  transportController.listDues,
);
router.post(
  "/transport/payments",
  requirePermission("payment.create"),
  transportController.createPayment,
);
router.get(
  "/transport/payments",
  requirePermission("payment.view"),
  transportController.listPayments,
);
router.get(
  "/transport/receipt/:paymentId",
  requireAnyPermission(["payment.view", "fee.view"]),
  transportController.downloadReceipt,
);

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
  requireAnyPermission(["payment.view", "fee.view"]),
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
router.get(
  "/my-students",
  requirePermission("fee.view"),
  feeController.getMyStudents,
);
router.get(
  "/my-student-fees/:studentId",
  requirePermission("fee.view"),
  feeController.getMyStudentFeeOptions,
);
router.get(
  "/my-payments",
  requirePermission("fee.view"),
  feeController.getMyPayments,
);

router.post(
  "/payment",
  requirePermission("payment.create"),
  feeController.createPayment,
);
router.post(
  "/payments/bulk-upload",
  requirePermission("payment.create"),
  uploadPaymentFile.single("file"),
  feeController.bulkUploadPayments,
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
router.get(
  "/students",
  requirePermission("payment.view"),
  feeController.getStudentsForPayment,
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

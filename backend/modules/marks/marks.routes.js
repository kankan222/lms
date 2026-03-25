import express from "express";
import * as controller from "./marks.controller.js";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.get("/exams", requirePermission("marks.view"), controller.getAccessibleExams);
router.get("/exams/:examId", requirePermission("marks.view"), controller.getAccessibleExamById);
router.get("/grid", requirePermission("marks.view"), controller.getMarksGrid);
router.get("/pending-queue", requirePermission("marks.approve"), controller.getPendingApprovalQueue);
router.get("/summary", requirePermission("marks.approve"), controller.getApprovalStatusSummary);
router.post("/save", requirePermission("marks.enter"), controller.saveMarks);
router.post("/submit", requirePermission("marks.enter"), controller.submitMarksForApproval);

router.post("/approve", requirePermission("marks.approve"), controller.approveMarks);
router.post("/reject", requirePermission("marks.approve"), controller.rejectMarks);

router.get(
  "/reports/:examId/student/:studentId",
  requirePermission("marks.view"),
  controller.getStudentReport
);
router.get(
  "/reports/:examId/student/:studentId/pdf",
  requirePermission("marks.view"),
  controller.downloadStudentReport
);

router.get("/my-results", requirePermission("marks.view"), controller.getMyApprovedResults);
router.get("/my-students", requirePermission("marks.view"), controller.getMyStudents);
router.get(
  "/my-results/pdf",
  requirePermission("marks.view"),
  controller.downloadMyApprovedMarksheet
);

export default router;

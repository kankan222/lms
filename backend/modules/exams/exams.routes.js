import express from "express";
import * as controller from "./exams.controller.js";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.get("/", requirePermission("exams.view"), controller.listExams);
router.post("/", requirePermission("exams.create"), controller.createExam);
router.get("/:id", requirePermission("exams.view"), controller.getExamById);
router.put("/:id", requirePermission("exams.update"), controller.updateExam);
router.delete("/:id", requirePermission("exams.delete"), controller.deleteExam);

router.get("/:id/marks-grid", requirePermission("marks.view"), controller.getMarksGrid);
router.get("/:id/students", requirePermission("marks.view"), controller.getMarksGrid);
router.post("/:id/marks", requirePermission("marks.enter"), controller.submitMarks);
router.patch("/marks/:markId", requirePermission("marks.enter"), controller.updateMark);
router.delete("/marks/:markId", requirePermission("marks.enter"), controller.deleteMark);

router.post("/:id/approve", requirePermission("marks.approve"), controller.approveMarks);

router.get("/:id/report/:studentId", requirePermission("marks.view"), controller.getStudentReport);
router.get("/:id/report/:studentId/pdf", requirePermission("marks.view"), controller.downloadStudentReport);

export default router;

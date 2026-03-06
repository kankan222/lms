import express from "express";
import * as controller from "./reports.controller.js";
import { requirePermission }
from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.get(
  "/student/:studentId/exam/:examId",
  requirePermission("marks.view"),
  controller.getReport
);
router.get(
  "/student/:studentId/exam/:examId/pdf",
  requirePermission("marks.view"),
  controller.downloadReport
);
export default router;
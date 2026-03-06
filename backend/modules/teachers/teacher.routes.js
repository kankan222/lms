import express from "express";
import * as controller from "./teacher.controller.js";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.post(
  "/",
  requirePermission("teacher.create"),
  controller.createTeacher
);
router.get(
  "/",
  requirePermission("teacher.view"),
  controller.getTeachers
);

router.put(
  "/:id",
  requirePermission("teacher.update"),
  controller.updateTeacher
);

router.delete(
  "/:id",
  requirePermission("teacher.delete"),
  controller.deleteTeacher
);
router.post(
  "/:id/assignments",
  requirePermission("teacher.assign"),
  controller.assignTeacher
);

router.get(
  "/:id/assignments",
  requirePermission("teacher.view"),
  controller.getAssignments
);

export default router;
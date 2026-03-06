import express from "express";
import * as controller from "./student.controller.js";

import { authenticate }
from "../auth/auth.middleware.js";

import {
  attachPermissions,
  requirePermission
} from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.get(
  "/",
  authenticate,
  attachPermissions,
  requirePermission("student.view"),
  controller.getStudents
);
router.get(
  "/by-class-section",
  authenticate,
  attachPermissions,
  requirePermission("sectionStudent.view"),
  controller.getStudentsByClassSection
);

router.post(
  "/",
  authenticate,
  attachPermissions,
  requirePermission("student.create"),
  controller.createStudent
);


router.put(
  "/:id",
  authenticate,
  attachPermissions,
  requirePermission("student.update"),
  controller.updateStudent
);
router.delete(
  "/:id",
  authenticate,
  attachPermissions,
  requirePermission("student.delete"),
  controller.deleteStudent
);

export default router;
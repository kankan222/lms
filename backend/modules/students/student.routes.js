import express from "express";
import * as controller from "./student.controller.js";
import {
  requirePermission,
} from "../../core/rbac/rbac.middleware.js";
import { uploadStudentFile } from "./student.middleware.js";

const router = express.Router();

router.post(
  "/",
  requirePermission("student.create"),
  uploadStudentFile.single("photo"),
  controller.createStudent,
);
router.post(
  "/bulk-upload",
  requirePermission("student.create"),
  uploadStudentFile.single("file"),
  controller.bulkUploadStudents,
);
router.get(
  "/",
  requirePermission("student.view"),
  controller.getStudents,
);

router.get(
  "/parents/search",
  requirePermission("student.view"),
  controller.searchParent,
);
router.get(
  "/:id",
  requirePermission("student.view"),
  controller.getStudentById,
);

router.patch(
  "/:id",
  requirePermission("student.update"),
  controller.updateStudent,
);
router.delete(
  "/:id",
  requirePermission("student.delete"),
  controller.deleteStudent,
);

export default router;

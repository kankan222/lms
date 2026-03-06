import express from "express";
import * as controller from "./subjects.controller.js";
import {
  attachPermissions,
  requirePermission,
} from "../../core/rbac/rbac.middleware.js";
import { authenticate } from "../auth/auth.middleware.js";

const router = express.Router();

router.get(
  "/",
  authenticate,
  attachPermissions,
  requirePermission("subjects.view"),
  controller.getSubjects
);
router.post(
  "/",
  authenticate,
  attachPermissions,
  requirePermission("subjects.create"),
  controller.createSubject
);
router.put(
  "/:id",
  authenticate,
  attachPermissions,
  requirePermission("subjects.update"),
  controller.updateSubject
);
router.delete(
  "/:id",
  authenticate,
  attachPermissions,
  requirePermission("subjects.delete"),
  controller.deleteSubject,
);


router.post(
  "/assign",
  authenticate,
  attachPermissions,
  requirePermission("subjects.assign"),
  controller.assignSubject,
);
router.get(
  "/class/:classId",
  authenticate,
  attachPermissions,
  requirePermission("classSubjects.view"),
  controller.getClassSubjects,
);

export default router;

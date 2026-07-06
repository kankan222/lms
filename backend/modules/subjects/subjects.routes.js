import express from "express";
import * as controller from "./subjects.controller.js";
import {
  attachPermissions,
  requirePermission,
} from "../../core/rbac/rbac.middleware.js";
import { authenticate } from "../auth/auth.middleware.js";

const router = express.Router();

function requireAnyPermission(permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const granted = permissions.some((permission) => req.user.permissions?.includes(permission));
    const parentSubjectRead = req.user.roles?.includes("parent") && permissions.includes("student.view");
    if (!granted && !parentSubjectRead) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
}

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
router.post(
  "/assign",
  authenticate,
  attachPermissions,
  requirePermission("subjects.assign"),
  controller.assignSubject,
);
router.get(
  "/offerings",
  authenticate,
  attachPermissions,
  requirePermission("subjects.view"),
  controller.getSubjectOfferings,
);
router.put(
  "/offerings",
  authenticate,
  attachPermissions,
  requirePermission("subjects.assign"),
  controller.replaceSubjectOfferings,
);
router.get(
  "/student-registrations/:studentId",
  authenticate,
  attachPermissions,
  requireAnyPermission(["subjects.view", "student.view"]),
  controller.getStudentSubjectRegistrations,
);
router.put(
  "/student-registrations/:studentId",
  authenticate,
  attachPermissions,
  requirePermission("subjects.assign"),
  controller.replaceStudentSubjectRegistrations,
);
router.get(
  "/class/:classId",
  authenticate,
  attachPermissions,
  requirePermission("subjects.view"),
  controller.getClassSubjects,
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

export default router;

import express from "express";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";
import * as controller from "./attendance.controller.js";

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

router.post(
  "/students",
  requireAnyPermission(["attendance.take", "student_attendance.take"]),
  controller.takeStudentAttendance
);

router.get(
  "/students",
  requireAnyPermission(["student_attendance.view", "student_attendance.review"]),
  controller.listStudentAttendanceSessions
);

router.get(
  "/students/entry-scopes",
  requireAnyPermission(["attendance.take", "student_attendance.take"]),
  controller.getStudentAttendanceEntryScopes
);

router.get(
  "/students/roster",
  requireAnyPermission(["attendance.take", "student_attendance.take"]),
  controller.getStudentAttendanceRoster
);

router.get(
  "/students/pending",
  requirePermission("student_attendance.review"),
  controller.getPendingStudentAttendance
);

router.get(
  "/students/templates",
  requireAnyPermission([
    "student_attendance.view",
    "student_attendance.review",
    "student_attendance.notify",
  ]),
  controller.getAbsenceMessageTemplates
);

router.get(
  "/students/:sessionId",
  requireAnyPermission(["student_attendance.view", "student_attendance.review"]),
  controller.getStudentAttendanceSession
);

router.post(
  "/students/review",
  requirePermission("student_attendance.review"),
  controller.reviewStudentAttendance
);

router.post(
  "/students/:sessionId/notify-parents",
  requirePermission("student_attendance.notify"),
  controller.notifyAbsentParents
);

export default router;

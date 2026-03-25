import express from "express";
import * as controller from "./teacher.controller.js";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";
import { uploadTeacherPhoto } from "./teacher.middleware.js";

const router = express.Router();

/* ---------- TEACHERS ---------- */

router.post(
  "/",
  requirePermission("teacher.create"),
  uploadTeacherPhoto.single("photo"),
  controller.createTeacher
);

router.get(
  "/",
  requirePermission("teacher.view"),
  controller.getTeachers
);

/* ---------- ASSIGNMENTS ---------- */

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

router.delete(
  "/assignments/:assignmentId",
  requirePermission("teacher.assign"),
  controller.removeAssignment
);

/* ---------- ATTENDANCE DEVICES ---------- */

router.post(
  "/attendance/devices",
  requirePermission("teacher.assign"),
  controller.createAttendanceDevice
);

router.get(
  "/attendance/devices",
  requirePermission("teacher.view"),
  controller.getAttendanceDevices
);

/* ---------- DEVICE ATTENDANCE LOG ---------- */

router.post(
  "/attendance/log",
  controller.logTeacherAttendance
);

/* ---------- TEACHER ATTENDANCE ---------- */
router.get(
  "/attendance/all",
  requirePermission("teacher.view"),
  controller.getAllTeacherAttendance
);
router.get(
  "/:id/attendance",
  requirePermission("teacher.view"),
  controller.getTeacherAttendance
);

router.post(
  "/attendance/generate",
  requirePermission("teacher.view"),
  controller.generateDailyAttendance
);

/* ---------- SINGLE TEACHER (LAST) ---------- */

router.get(
  "/:id",
  requirePermission("teacher.view"),
  controller.getTeacherById
);

router.put(
  "/:id",
  requirePermission("teacher.update"),
  uploadTeacherPhoto.single("photo"),
  controller.updateTeacher
);

router.delete(
  "/:id",
  requirePermission("teacher.delete"),
  controller.deleteTeacher
);

export default router;

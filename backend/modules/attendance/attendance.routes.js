import express from "express";
import { requirePermission }
from "../../core/rbac/rbac.middleware.js";
import * as controller from "./attendance.controller.js";

const router = express.Router();

router.post(
  "/",
  requirePermission("attendance.take"),
  controller.takeAttendance
);

export default router;

// INSERT INTO permissions(name)
// VALUES ('attendance.take');

// INSERT IGNORE INTO role_permissions(role_id, permission_id)
// SELECT 1, id FROM permissions WHERE name='attendance.take';
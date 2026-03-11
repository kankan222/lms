import express from "express";
import * as controller from "./user.controller.js";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.get(
  "/",
  requirePermission("teacher.update"),
  controller.listUsers
);
router.post(
  "/change-password",
  requirePermission("teacher.update"),
  controller.changePassword
);
router.post(
  "/admin-reset-password",
  requirePermission("teacher.update"),
  controller.adminResetPassword
);
router.patch(
  "/:id/status",
  requirePermission("teacher.update"),
  controller.updateUserStatus
);

export default router;

import express from "express";
import * as controller from "./user.controller.js";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.get(
  "/me",
  controller.getMyAccount
);
router.post(
  "/me/change-password",
  controller.changeMyPassword
);
router.get(
  "/",
  requirePermission("teacher.update"),
  controller.listUsers
);
router.get(
  "/roles",
  requirePermission("teacher.update"),
  controller.getRoles
);
router.get(
  "/permissions",
  requirePermission("teacher.update"),
  controller.getPermissions
);
router.post(
  "/",
  requirePermission("teacher.update"),
  controller.createUser
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
router.get(
  "/:id/permissions",
  requirePermission("teacher.update"),
  controller.getUserPermissions
);
router.post(
  "/:id/permissions",
  requirePermission("teacher.update"),
  controller.grantUserPermissions
);

export default router;

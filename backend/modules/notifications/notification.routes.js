import express from "express";
import * as controller from "./notification.controller.js";
import { requirePermission }
from "../../core/rbac/rbac.middleware.js";

const router = express.Router();
router.get(
  "/stream",
  requirePermission("notifications.view"),
  controller.streamNotifications
);

router.get(
  "/me",
  requirePermission("notifications.view"),
  controller.myNotifications
);

router.patch(
  "/read-all",
  requirePermission("notifications.view"),
  controller.markAllRead
);

router.patch(
  "/:id/read",
  requirePermission("notifications.view"),
  controller.markRead
);

router.post(
  "/devices",
  requirePermission("notifications.view"),
  controller.registerDevice
);

router.delete(
  "/devices",
  requirePermission("notifications.view"),
  controller.unregisterDevice
);

export default router;

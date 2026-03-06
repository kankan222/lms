import express from "express";
import * as controller from "./notification.controller.js";
import { requirePermission }
from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.get(
  "/me",
  requirePermission("notifications.view"),
  controller.myNotifications
);

router.patch(
  "/:id/read",
  requirePermission("notifications.view"),
  controller.markRead
);

export default router;
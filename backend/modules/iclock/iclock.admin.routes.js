import express from "express";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";
import * as controller from "./iclock.admin.controller.js";

const router = express.Router();

router.post(
  "/devices/:id/pull-command",
  requirePermission("teacher.assign"),
  controller.queuePullCommandForDevice
);

router.post(
  "/devices/pull-command",
  requirePermission("teacher.assign"),
  controller.queuePullCommandsForAllDevices
);

export default router;

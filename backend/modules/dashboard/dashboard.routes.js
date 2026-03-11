import express from "express";
import * as controller from "./dashboard.controller.js";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.get(
  "/summary",
  requirePermission("dashboard.view"),
  controller.getSummary
);

// Keep root for backward compatibility.
router.get(
  "/",
  requirePermission("dashboard.view"),
  controller.getSummary
);

export default router;

import express from "express";
import * as controller from "./approvals.controller.js";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.get(
  "/pending",
  requirePermission("marks.approve"),
  controller.getPending
);

router.post(
  "/review",
  requirePermission("marks.approve"),
  controller.review
);

export default router;
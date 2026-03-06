import express from "express";
import * as controller from "./dashboard.controller.js";
import { requirePermission }
from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.get(
  "/parent",
  requirePermission("dashboard.view"),
  controller.parentDashboard
);
console.log("dashboard routes loaded")
export default router;
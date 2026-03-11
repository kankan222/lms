import express from "express";
import * as controller from "./staff.controller.js";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.get("/", requirePermission("dashboard.view"), controller.listStaff);
router.get("/:id", requirePermission("dashboard.view"), controller.getStaffById);
router.post("/", requirePermission("dashboard.view"), controller.createStaff);
router.put("/:id", requirePermission("dashboard.view"), controller.updateStaff);
router.delete("/:id", requirePermission("dashboard.view"), controller.deleteStaff);

export default router;

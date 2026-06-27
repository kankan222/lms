import express from "express";
import * as controller from "./marksheet.controller.js";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.get("/grade-settings", requirePermission("dashboard.view"), controller.listGradeSettings);
router.post("/grade-settings", requirePermission("dashboard.view"), controller.createGradeSetting);
router.put("/grade-settings/:id", requirePermission("dashboard.view"), controller.updateGradeSetting);
router.delete("/grade-settings/:id", requirePermission("dashboard.view"), controller.deleteGradeSetting);

router.get("/activities", requirePermission("academic.view"), controller.listActivities);
router.post("/activities", requirePermission("academic.create"), controller.createActivity);
router.put("/activities/:id", requirePermission("academic.update"), controller.updateActivity);
router.delete("/activities/:id", requirePermission("academic.delete"), controller.deleteActivity);
router.get("/activities/marks", requirePermission("academic.view"), controller.getActivityMarkGrid);
router.put("/activities/:id/marks", requirePermission("academic.update"), controller.saveActivityMarks);

export default router;

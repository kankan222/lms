import express from "express";
import * as controller from "./staff.controller.js";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.get("/college/staff", requirePermission("dashboard.view"), (req, res, next) => {
  req.params.campus = "college";
  return controller.listWebsiteStaff(req, res, next);
});
router.get("/school/staff", requirePermission("dashboard.view"), (req, res, next) => {
  req.params.campus = "school";
  return controller.listWebsiteStaff(req, res, next);
});

router.post("/college/staff", requirePermission("dashboard.view"), (req, res, next) => {
  req.params.campus = "college";
  return controller.createWebsiteStaff(req, res, next);
});
router.post("/school/staff", requirePermission("dashboard.view"), (req, res, next) => {
  req.params.campus = "school";
  return controller.createWebsiteStaff(req, res, next);
});

export default router;

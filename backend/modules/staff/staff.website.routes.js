import express from "express";
import * as controller from "./staff.controller.js";
import * as contactController from "../contact/contact.controller.js";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";
import { uploadBulkStaffPhotos, uploadSingleStaffPhoto } from "./staff.middleware.js";

const router = express.Router();

router.get("/contact/submissions", requirePermission("dashboard.view"), contactController.listContactSubmissions);

router.get("/school/staff", requirePermission("dashboard.view"), (req, res, next) => {
  req.params.campus = "school";
  return controller.listWebsiteStaff(req, res, next);
});
router.get("/college/staff", requirePermission("dashboard.view"), (req, res, next) => {
  req.params.campus = "college";
  return controller.listWebsiteStaff(req, res, next);
});

router.post("/school/staff", requirePermission("dashboard.view"), uploadSingleStaffPhoto, (req, res, next) => {
  req.params.campus = "school";
  return controller.createWebsiteStaff(req, res, next);
});
router.post("/college/staff", requirePermission("dashboard.view"), uploadSingleStaffPhoto, (req, res, next) => {
  req.params.campus = "college";
  return controller.createWebsiteStaff(req, res, next);
});

router.post("/school/staff/bulk", requirePermission("dashboard.view"), uploadBulkStaffPhotos, (req, res, next) => {
  req.params.campus = "school";
  return controller.bulkCreateWebsiteStaff(req, res, next);
});
router.post("/college/staff/bulk", requirePermission("dashboard.view"), uploadBulkStaffPhotos, (req, res, next) => {
  req.params.campus = "college";
  return controller.bulkCreateWebsiteStaff(req, res, next);
});

router.put("/school/staff/:id", requirePermission("dashboard.view"), uploadSingleStaffPhoto, (req, res, next) => {
  req.params.campus = "school";
  return controller.updateWebsiteStaff(req, res, next);
});
router.put("/college/staff/:id", requirePermission("dashboard.view"), uploadSingleStaffPhoto, (req, res, next) => {
  req.params.campus = "college";
  return controller.updateWebsiteStaff(req, res, next);
});

router.delete("/school/staff/:id", requirePermission("dashboard.view"), (req, res, next) => {
  req.params.campus = "school";
  return controller.deleteWebsiteStaff(req, res, next);
});
router.delete("/college/staff/:id", requirePermission("dashboard.view"), (req, res, next) => {
  req.params.campus = "college";
  return controller.deleteWebsiteStaff(req, res, next);
});

export default router;
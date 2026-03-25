import express from "express";
import * as controller from "./staff.controller.js";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";
import { uploadBulkStaffPhotos, uploadSingleStaffPhoto } from "./staff.middleware.js";

const router = express.Router();

router.get("/", controller.listStaff);
router.get("/:id", controller.getStaffById);
router.post("/", requirePermission("dashboard.view"), uploadSingleStaffPhoto, controller.createStaff);
router.post("/bulk", requirePermission("dashboard.view"), uploadBulkStaffPhotos, controller.bulkCreateStaff);
router.put("/:id", requirePermission("dashboard.view"), uploadSingleStaffPhoto, controller.updateStaff);
router.delete("/:id", requirePermission("dashboard.view"), controller.deleteStaff);

export default router;

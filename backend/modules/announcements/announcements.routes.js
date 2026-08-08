import express from "express";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";
import * as controller from "./announcements.controller.js";
import { uploadAnnouncementFile } from "./announcements.upload.js";

const router = express.Router();

router.get("/categories", requirePermission("announcements.view"), controller.listCategories);
router.post("/categories", requirePermission("announcements.manage"), controller.createCategory);

router.get("/sms-templates", requirePermission("announcements.view"), controller.listSmsTemplates);
router.post(
  "/sms-templates/import",
  requirePermission("announcement_templates.manage"),
  uploadAnnouncementFile.single("file"),
  controller.importSmsTemplates
);
router.post("/sms-templates", requirePermission("announcement_templates.manage"), controller.createSmsTemplate);
router.put("/sms-templates/:id", requirePermission("announcement_templates.manage"), controller.updateSmsTemplate);

router.get("/sms-jobs", requirePermission("announcements.sms.send"), controller.listSmsJobs);
router.post("/sms-jobs/dispatch", requirePermission("announcements.sms.send"), controller.dispatchDueSmsJobs);
router.post("/sms-jobs/:id/dispatch", requirePermission("announcements.sms.send"), controller.dispatchSmsJob);
router.post("/sms-jobs/:id/refresh-status", requirePermission("announcements.sms.send"), controller.refreshSmsJobDeliveryStatus);
router.get("/holidays", requirePermission("announcements.view"), controller.listHolidays);
router.get("/mobile", controller.listMobileAnnouncements);
router.get("/mobile/:id", controller.getMobileAnnouncement);

router.get("/", requirePermission("announcements.view"), controller.listAnnouncements);
router.post("/", requirePermission("announcements.manage"), controller.createAnnouncement);
router.get("/:id", requirePermission("announcements.view"), controller.getAnnouncement);
router.put("/:id", requirePermission("announcements.manage"), controller.updateAnnouncement);
router.post("/:id/publish", requirePermission("announcements.publish"), controller.publishAnnouncement);
router.post("/:id/cancel", requirePermission("announcements.manage"), controller.cancelAnnouncement);

export default router;

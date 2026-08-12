import express from "express";
import * as controller from "./appNotice.controller.js";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.get("/active", controller.active);
router.get("/", requirePermission("notifications.manage"), controller.list);
router.post("/", requirePermission("notifications.manage"), controller.create);
router.put("/:id", requirePermission("notifications.manage"), controller.update);
router.delete("/:id", requirePermission("notifications.manage"), controller.remove);

export default router;

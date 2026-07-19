import express from "express";
import * as controller from "./appUpdate.controller.js";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.get("/check", controller.check);
router.get("/policies", requirePermission("notifications.manage"), controller.list);
router.put("/policies", requirePermission("notifications.manage"), controller.save);
router.post("/notify", requirePermission("notifications.send"), controller.notify);

export default router;

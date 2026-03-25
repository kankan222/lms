import express from "express";
import * as controller from "./messaging.controller.js";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.get(
  "/conversations",
  requirePermission("messages.view"),
  controller.getConversations
);
router.get(
  "/targets",
  requirePermission("messages.view"),
  controller.getTargets
);
router.get(
  "/unread/count",
  requirePermission("messages.view"),
  controller.unreadMessages
);
router.get(
  "/stream",
  controller.streamMessages
);
router.post(
  "/",
  requirePermission("messages.send"),
  controller.sendMessage
);
router.post(
  "/read",
  requirePermission("messages.view"),
  controller.markAsRead
);

router.get(
  "/:conversationId",
  requirePermission("messages.view"),
  controller.getMessages
);

export default router;

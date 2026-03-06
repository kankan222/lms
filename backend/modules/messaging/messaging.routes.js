import express from "express";
import * as controller from "./messaging.controller.js";

const router = express.Router();

router.post("/", controller.sendMessage);

router.get("/conversations", controller.getConversations);

router.get("/:conversationId", controller.getMessages);

router.post("/read", controller.markAsRead);

router.get("/unread/count", controller.unreadMessages);

export default router;
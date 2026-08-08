import express from "express";
import { receiveSmsDeliveryWebhook } from "./announcements.controller.js";

const router = express.Router();

router.post("/sms-delivery", receiveSmsDeliveryWebhook);

export default router;

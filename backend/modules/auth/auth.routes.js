import express from "express";
import * as controller from "./auth.controller.js";
import { authenticate } from "./auth.middleware.js";

const router = express.Router();

router.post("/login", controller.login);
router.post("/refresh", controller.refresh);
router.post("/verify-otp", controller.verifyOtp);
router.post("/resend-otp", controller.resendOtp);

router.post(
  "/logout",
  authenticate,
  controller.logout
);

router.post(
  "/logout-all",
  authenticate,
  controller.logoutAll
);

export default router;

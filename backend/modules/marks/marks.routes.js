import express from "express";
import * as controller from "./marks.controller.js";

import { authenticate }
from "../auth/auth.middleware.js";

import {
  attachPermissions,
  requirePermission
} from "../../core/rbac/rbac.middleware.js";

const router = express.Router();


router.post(
  "/",
  requirePermission("marks.enter"),
  controller.submitMarks
);

export default router
import express from "express";
import * as controller from "./parent.controller.js";

import { authenticate }
from "../auth/auth.middleware.js";

import {
  attachPermissions,
  requirePermission
} from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.post(
  "/",
  authenticate,
  attachPermissions,
  requirePermission("parent.create"),
  controller.createParent
);

router.get(
  "/",
  authenticate,
  attachPermissions,
  requirePermission("parent.view"),
  controller.getParents
);

router.get("/test", (req,res)=>{
  res.send("Parents working");
});
export default router;
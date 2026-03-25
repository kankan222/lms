import express from "express";
import * as controller from "./academic.controller.js";

import { authenticate }
from "../auth/auth.middleware.js";

import {
  attachPermissions,
  requirePermission
} from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.post(
  "/sessions",
  authenticate,
  attachPermissions,
  requirePermission("academic.create"),
  controller.createSession
);

router.get(
  "/sessions",
  authenticate,
  attachPermissions,
  controller.getSessions
);
router.put(
  "/sessions/:id",
  authenticate,
  attachPermissions,
  requirePermission("academic.update"),
  controller.updateSession
);
router.delete(
  "/sessions/:id",
  authenticate,
  attachPermissions,
  requirePermission("academic.delete"),
  controller.deleteSession
);
router.get(
  "/streams",
  authenticate,
  attachPermissions,
  controller.getStreams
);
router.post(
  "/streams",
  authenticate,
  attachPermissions,
  requirePermission("academic.create"),
  controller.createStream
);
router.put(
  "/streams/:id",
  authenticate,
  attachPermissions,
  requirePermission("academic.update"),
  controller.updateStream
);
router.delete(
  "/streams/:id",
  authenticate,
  attachPermissions,
  requirePermission("academic.delete"),
  controller.deleteStream
);

router.get(
  "/classes",
  authenticate,
  attachPermissions,
  requirePermission("academic.view"),
  controller.getClasses
);
router.get(
  "/classes/structure", 
  authenticate,
  attachPermissions,
  controller.getClassStructure
);
router.post(
  "/classes",
  authenticate,
  attachPermissions,
  requirePermission("academic.create"),
  controller.createClass
);


router.put(
  "/classes/:id",
  authenticate,
  attachPermissions,
  requirePermission("academic.update"),
  controller.updateClass
);

router.delete(
  "/classes/:id",
  authenticate,
  attachPermissions,
  requirePermission("academic.delete"),
  controller.deleteClass
);
export default router

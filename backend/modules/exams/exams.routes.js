import express from "express";
import * as controller from "./exams.controller.js";
import { requirePermission, attachPermissions } from "../../core/rbac/rbac.middleware.js";

const router = express.Router();

router.post("/", attachPermissions, requirePermission("exam.create"), controller.createExam);
router.get("/", attachPermissions,requirePermission("exam.view"), controller.getExam);

export default router;

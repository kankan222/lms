import express from "express";
import * as controller from "./teacherAttendanceSync.controller.js";

const router = express.Router();

router.post("/teacher-attendance/logs", controller.ingestTeacherAttendanceLogs);

export default router;


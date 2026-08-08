import express from "express";
import { requirePermission } from "../../core/rbac/rbac.middleware.js";
import * as controller from "./routines.controller.js";
import { uploadRoutineFile } from "./routines.upload.js";

const router = express.Router();

router.get("/time-slot-templates", requirePermission("routines.view"), controller.listTimeSlotTemplates);
router.get("/time-slot-templates/:id", requirePermission("routines.view"), controller.getTimeSlotTemplate);
router.post("/time-slot-templates", requirePermission("routines.manage"), controller.createTimeSlotTemplate);
router.put("/time-slot-templates/:id", requirePermission("routines.manage"), controller.updateTimeSlotTemplate);

router.get("/class-routines/effective", requirePermission("routines.view"), controller.effectiveClassRoutine);
router.get("/class-routines/board", requirePermission("routines.view"), controller.classRoutineBoard);
router.get("/class-routines", requirePermission("routines.view"), controller.listClassRoutines);
router.post(
  "/class-routines/import",
  requirePermission("routines.manage"),
  uploadRoutineFile.single("file"),
  controller.importClassRoutine
);
router.get("/class-routines/:id", requirePermission("routines.view"), controller.getClassRoutine);
router.post("/class-routines", requirePermission("routines.manage"), controller.createClassRoutine);
router.put("/class-routines/:id/slot", requirePermission("routines.manage"), controller.updateClassRoutineSlot);
router.put("/class-routines/:id", requirePermission("routines.manage"), controller.updateClassRoutine);
router.post("/class-routines/:id/draft", requirePermission("routines.manage"), controller.draftClassRoutine);
router.post("/class-routines/:id/publish", requirePermission("routines.publish"), controller.publishClassRoutine);
router.delete("/class-routines/:id", requirePermission("routines.manage"), controller.deleteClassRoutineDraft);
router.get("/class-routines/:id/pdf", requirePermission("routines.view"), controller.classRoutinePdf);

router.get("/exam-routines", requirePermission("routines.view"), controller.listExamRoutines);
router.post(
  "/exam-routines/import",
  requirePermission("exam_routines.manage"),
  uploadRoutineFile.single("file"),
  controller.importExamRoutine
);
router.get("/exam-routines/:id", requirePermission("routines.view"), controller.getExamRoutine);
router.post("/exam-routines", requirePermission("exam_routines.manage"), controller.createExamRoutine);
router.put("/exam-routines/:id", requirePermission("exam_routines.manage"), controller.updateExamRoutine);
router.post("/exam-routines/:id/draft", requirePermission("exam_routines.manage"), controller.draftExamRoutine);
router.delete("/exam-routines/:id", requirePermission("exam_routines.manage"), controller.deleteExamRoutine);
router.post("/exam-routines/:id/publish", requirePermission("routines.publish"), controller.publishExamRoutine);
router.get("/exam-routines/:id/pdf", requirePermission("routines.view"), controller.examRoutinePdf);

router.get("/substitutions", requirePermission("routines.view"), controller.listSubstitutions);
router.get("/substitutions/:id", requirePermission("routines.view"), controller.getSubstitution);
router.post("/substitutions", requirePermission("routine_substitutions.manage"), controller.createSubstitution);
router.put("/substitutions/:id", requirePermission("routine_substitutions.manage"), controller.updateSubstitution);
router.post("/substitutions/:id/publish", requirePermission("routine_substitutions.manage"), controller.publishSubstitution);
router.post("/substitutions/:id/cancel", requirePermission("routine_substitutions.manage"), controller.cancelSubstitution);

router.get("/teacher/me", requirePermission("routines.view"), controller.myTeacherRoutine);
router.get("/students/:studentId", requirePermission("routines.view"), controller.studentRoutine);

export default router;

import * as service from "./routines.service.js";

function sendPdf(res, payload) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${payload.fileName}`);
  res.send(payload.buffer);
}

export async function listTimeSlotTemplates(req, res, next) {
  try {
    res.json({ success: true, data: await service.listTimeSlotTemplates(req.query) });
  } catch (err) {
    next(err);
  }
}

export async function getTimeSlotTemplate(req, res, next) {
  try {
    res.json({ success: true, data: await service.getTimeSlotTemplate(req.params.id) });
  } catch (err) {
    next(err);
  }
}

export async function createTimeSlotTemplate(req, res, next) {
  try {
    res.status(201).json({ success: true, data: await service.createTimeSlotTemplate(req.body, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function updateTimeSlotTemplate(req, res, next) {
  try {
    res.json({ success: true, data: await service.updateTimeSlotTemplate(req.params.id, req.body, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function listClassRoutines(req, res, next) {
  try {
    res.json({ success: true, data: await service.listClassRoutines(req.query) });
  } catch (err) {
    next(err);
  }
}

export async function classRoutineBoard(req, res, next) {
  try {
    res.json({ success: true, data: await service.getClassRoutineBoard(req.query) });
  } catch (err) {
    next(err);
  }
}

export async function getClassRoutine(req, res, next) {
  try {
    res.json({ success: true, data: await service.getClassRoutine(req.params.id) });
  } catch (err) {
    next(err);
  }
}

export async function createClassRoutine(req, res, next) {
  try {
    res.status(201).json({ success: true, data: await service.createClassRoutine(req.body, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function importClassRoutine(req, res, next) {
  try {
    res.json({ success: true, data: await service.importClassRoutine(req.file, req.body, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function updateClassRoutine(req, res, next) {
  try {
    res.json({ success: true, data: await service.updateClassRoutine(req.params.id, req.body, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function updateClassRoutineSlot(req, res, next) {
  try {
    res.json({ success: true, data: await service.updateClassRoutineSlot(req.params.id, req.body, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function draftClassRoutine(req, res, next) {
  try {
    res.status(201).json({ success: true, data: await service.createClassRoutineDraftFromPublished(req.params.id, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function publishClassRoutine(req, res, next) {
  try {
    res.json({ success: true, data: await service.publishClassRoutine(req.params.id, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function deleteClassRoutineDraft(req, res, next) {
  try {
    res.json({ success: true, data: await service.deleteClassRoutineDraft(req.params.id) });
  } catch (err) {
    next(err);
  }
}

export async function effectiveClassRoutine(req, res, next) {
  try {
    res.json({ success: true, data: await service.getEffectiveClassRoutine(req.query) });
  } catch (err) {
    next(err);
  }
}

export async function studentRoutine(req, res, next) {
  try {
    res.json({ success: true, data: await service.getStudentRoutine(req.params.studentId, req.user.userId, req.query) });
  } catch (err) {
    next(err);
  }
}

export async function myTeacherRoutine(req, res, next) {
  try {
    res.json({ success: true, data: await service.getMyTeacherRoutine(req.user.userId, req.query) });
  } catch (err) {
    next(err);
  }
}

export async function listExamRoutines(req, res, next) {
  try {
    res.json({ success: true, data: await service.listExamRoutines(req.query) });
  } catch (err) {
    next(err);
  }
}

export async function getExamRoutine(req, res, next) {
  try {
    res.json({ success: true, data: await service.getExamRoutine(req.params.id) });
  } catch (err) {
    next(err);
  }
}

export async function createExamRoutine(req, res, next) {
  try {
    res.status(201).json({ success: true, data: await service.createExamRoutine(req.body, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function importExamRoutine(req, res, next) {
  try {
    res.json({ success: true, data: await service.importExamRoutine(req.file, req.body, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function updateExamRoutine(req, res, next) {
  try {
    res.json({ success: true, data: await service.updateExamRoutine(req.params.id, req.body, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function draftExamRoutine(req, res, next) {
  try {
    res.status(201).json({ success: true, data: await service.createExamRoutineDraftFromPublished(req.params.id, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function deleteExamRoutine(req, res, next) {
  try {
    res.json({ success: true, data: await service.deleteExamRoutine(req.params.id) });
  } catch (err) {
    next(err);
  }
}

export async function publishExamRoutine(req, res, next) {
  try {
    res.json({ success: true, data: await service.publishExamRoutine(req.params.id, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function listSubstitutions(req, res, next) {
  try {
    res.json({ success: true, data: await service.listSubstitutions(req.query) });
  } catch (err) {
    next(err);
  }
}

export async function getSubstitution(req, res, next) {
  try {
    res.json({ success: true, data: await service.getSubstitution(req.params.id) });
  } catch (err) {
    next(err);
  }
}

export async function createSubstitution(req, res, next) {
  try {
    res.status(201).json({ success: true, data: await service.createSubstitution(req.body, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function updateSubstitution(req, res, next) {
  try {
    res.json({ success: true, data: await service.updateSubstitution(req.params.id, req.body, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function publishSubstitution(req, res, next) {
  try {
    res.json({ success: true, data: await service.publishSubstitution(req.params.id, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function cancelSubstitution(req, res, next) {
  try {
    res.json({ success: true, data: await service.cancelSubstitution(req.params.id, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function classRoutinePdf(req, res, next) {
  try {
    sendPdf(res, await service.downloadClassRoutinePdf(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function examRoutinePdf(req, res, next) {
  try {
    sendPdf(res, await service.downloadExamRoutinePdf(req.params.id));
  } catch (err) {
    next(err);
  }
}

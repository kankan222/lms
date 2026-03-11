import * as service from "./exams.service.js";

export async function createExam(req, res, next) {
  try {
    const data = await service.createExam(req.body, req.user.userId);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listExams(req, res, next) {
  try {
    const data = await service.listExams(req.query, req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getExamById(req, res, next) {
  try {
    const data = await service.getExamById(req.params.id, req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateExam(req, res, next) {
  try {
    const data = await service.updateExam(req.params.id, req.body, req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteExam(req, res, next) {
  try {
    const data = await service.deleteExam(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getMarksGrid(req, res, next) {
  try {
    const data = await service.getMarksGrid(
      req.params.id,
      req.query,
      req.user.userId
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function submitMarks(req, res, next) {
  try {
    const data = await service.submitMarks(req.params.id, req.body, req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateMark(req, res, next) {
  try {
    const data = await service.updateMark(req.params.markId, req.body, req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteMark(req, res, next) {
  try {
    const data = await service.deleteMark(req.params.markId, req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function approveMarks(req, res, next) {
  try {
    const data = await service.approveMarks(req.params.id, req.body, req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getStudentReport(req, res, next) {
  try {
    const data = await service.getStudentReport(
      req.params.id,
      req.params.studentId,
      req.user.userId
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function downloadStudentReport(req, res, next) {
  try {
    const { buffer, fileName } = await service.downloadStudentReport(
      req.params.id,
      req.params.studentId,
      req.user.userId
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

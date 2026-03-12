import * as service from "./marks.service.js";

export async function getMarksGrid(req, res, next) {
  try {
    const result = await service.getMarksGrid(req.query || {}, req.user.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function saveMarks(req, res, next) {
  try {
    const result = await service.saveMarks(req.body || {}, req.user.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function submitMarksForApproval(req, res, next) {
  try {
    const result = await service.submitMarksForApproval(req.body || {}, req.user.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function approveMarks(req, res, next) {
  try {
    const result = await service.approveMarks(req.body || {}, req.user.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function rejectMarks(req, res, next) {
  try {
    const result = await service.rejectMarks(req.body || {}, req.user.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getStudentReport(req, res, next) {
  try {
    const result = await service.getStudentReport(
      req.params.examId,
      req.params.studentId,
      req.user.userId
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function downloadStudentReport(req, res, next) {
  try {
    const { buffer, fileName } = await service.downloadStudentReport(
      req.params.examId,
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

export async function getMyApprovedResults(req, res, next) {
  try {
    const result = await service.getMyApprovedResults(req.query || {}, req.user.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getMyStudents(req, res, next) {
  try {
    const result = await service.getMyStudents(req.user.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function downloadMyApprovedMarksheet(req, res, next) {
  try {
    const { buffer, fileName } = await service.downloadMyApprovedMarksheet(
      req.query || {},
      req.user.userId
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

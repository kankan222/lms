import * as service from "./attendance.service.js";

export async function takeStudentAttendance(req, res, next) {
  try {
    const result = await service.takeStudentAttendance(req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function listStudentAttendanceSessions(req, res, next) {
  try {
    const result = await service.listStudentAttendanceSessions(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getStudentAttendanceRoster(req, res, next) {
  try {
    const result = await service.getStudentAttendanceRoster(req.query, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getStudentAttendanceEntryScopes(req, res, next) {
  try {
    const result = await service.getStudentAttendanceEntryScopes(req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getPendingStudentAttendance(req, res, next) {
  try {
    const result = await service.getPendingStudentAttendance(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getStudentAttendanceSession(req, res, next) {
  try {
    const result = await service.getStudentAttendanceSession(req.params.sessionId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function reviewStudentAttendance(req, res, next) {
  try {
    const result = await service.reviewStudentAttendance(req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getAbsenceMessageTemplates(req, res, next) {
  try {
    const result = service.getAbsenceMessageTemplates();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function notifyAbsentParents(req, res, next) {
  try {
    const result = await service.notifyAbsentParents(req.params.sessionId, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

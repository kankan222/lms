import * as service from "./marksheet.service.js";

export async function listGradeSettings(req, res, next) {
  try {
    const data = await service.listGradeSettings(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createGradeSetting(req, res, next) {
  try {
    const data = await service.createGradeSetting(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateGradeSetting(req, res, next) {
  try {
    const data = await service.updateGradeSetting(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteGradeSetting(req, res, next) {
  try {
    const data = await service.deleteGradeSetting(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listActivities(req, res, next) {
  try {
    const data = await service.listActivities(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createActivity(req, res, next) {
  try {
    const data = await service.createActivity(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateActivity(req, res, next) {
  try {
    const data = await service.updateActivity(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteActivity(req, res, next) {
  try {
    const data = await service.deleteActivity(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getActivityMarkGrid(req, res, next) {
  try {
    const data = await service.getActivityMarkGrid(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function saveActivityMarks(req, res, next) {
  try {
    const data = await service.saveActivityMarks(req.params.id, req.body, req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

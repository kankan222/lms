import * as service from "./staff.service.js";

export async function listStaff(req, res, next) {
  try {
    const data = await service.listStaff();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listPublicStaff(req, res, next) {
  try {
    const data = await service.listStaffByCampus(req.query.type);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listWebsiteStaff(req, res, next) {
  try {
    const data = await service.listStaffByCampus(req.params.campus);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getStaffById(req, res, next) {
  try {
    const data = await service.getStaffById(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createStaff(req, res, next) {
  try {
    const data = await service.createStaff(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createWebsiteStaff(req, res, next) {
  try {
    const data = await service.createStaff({
      ...req.body,
      type: req.params.campus,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateStaff(req, res, next) {
  try {
    const data = await service.updateStaff(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteStaff(req, res, next) {
  try {
    const data = await service.deleteStaff(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

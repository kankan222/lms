import * as service from "./appNotice.service.js";

export async function active(req, res, next) {
  try {
    res.json({ success: true, data: await service.getActiveNotice(req.query) });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    res.json({ success: true, data: await service.listNotices() });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    res.status(201).json({ success: true, data: await service.createNotice(req.body, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    res.json({ success: true, data: await service.updateNotice(req.params.id, req.body, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    res.json({ success: true, data: await service.deleteNotice(req.params.id) });
  } catch (err) {
    next(err);
  }
}

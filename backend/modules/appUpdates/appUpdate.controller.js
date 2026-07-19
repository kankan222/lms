import * as service from "./appUpdate.service.js";

export async function check(req, res, next) {
  try {
    const data = await service.checkUpdate(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const data = await service.listPolicies();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function save(req, res, next) {
  try {
    const data = await service.savePolicy(req.user, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function notify(req, res, next) {
  try {
    const data = await service.notifyAvailableUpdate(req.user, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

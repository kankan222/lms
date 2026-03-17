import * as service from "./staff.service.js";

function getStoredImagePath(file, fallbackPath) {
  if (file?.path) {
    return `/${String(file.path).replace(/\\/g, "/")}`;
  }
  return fallbackPath || null;
}

export async function listStaff(req, res, next) {
  try {
    const data = await service.listStaffForActor({
      actorUserId: req.user?.userId,
      actorPermissions: req.user?.permissions || [],
      filters: req.query || {},
    });
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
    const data = await service.listStaff({
      ...(req.query || {}),
      type: req.params.campus,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getStaffById(req, res, next) {
  try {
    const data = await service.getStaffForActor({
      staffId: req.params.id,
      actorUserId: req.user?.userId,
      actorPermissions: req.user?.permissions || [],
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createStaff(req, res, next) {
  try {
    const image_url = getStoredImagePath(req.file, req.body?.image_url);
    const data = await service.createStaff({
      ...req.body,
      image_url,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function bulkCreateStaff(req, res, next) {
  try {
    const data = await service.bulkCreateStaff({
      ...req.body,
      files: req.files || [],
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createWebsiteStaff(req, res, next) {
  try {
    const image_url = getStoredImagePath(req.file, req.body?.image_url);
    const data = await service.createStaff({
      ...req.body,
      type: req.params.campus,
      image_url,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function bulkCreateWebsiteStaff(req, res, next) {
  try {
    const data = await service.bulkCreateStaff({
      ...req.body,
      type: req.params.campus,
      files: req.files || [],
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateStaff(req, res, next) {
  try {
    const image_url = getStoredImagePath(req.file, req.body?.image_url);
    const data = await service.updateStaff(req.params.id, {
      ...req.body,
      image_url,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateWebsiteStaff(req, res, next) {
  try {
    const image_url = getStoredImagePath(req.file, req.body?.image_url);
    const data = await service.updateStaff(req.params.id, {
      ...req.body,
      type: req.params.campus,
      image_url,
    });
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

export async function deleteWebsiteStaff(req, res, next) {
  try {
    const data = await service.deleteStaff(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

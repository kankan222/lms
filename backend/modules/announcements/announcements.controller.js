import * as service from "./announcements.service.js";

export async function listCategories(req, res, next) {
  try {
    res.json({ success: true, data: await service.listCategories() });
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req, res, next) {
  try {
    res.status(201).json({ success: true, data: await service.createCategory(req.body, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function listSmsTemplates(req, res, next) {
  try {
    res.json({ success: true, data: await service.listSmsTemplates(req.query) });
  } catch (err) {
    next(err);
  }
}

export async function createSmsTemplate(req, res, next) {
  try {
    res.status(201).json({ success: true, data: await service.createSmsTemplate(req.body, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function updateSmsTemplate(req, res, next) {
  try {
    res.json({ success: true, data: await service.updateSmsTemplate(req.params.id, req.body, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function importSmsTemplates(req, res, next) {
  try {
    res.json({ success: true, data: await service.importSmsTemplates(req.file, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function listAnnouncements(req, res, next) {
  try {
    res.json({ success: true, data: await service.listAnnouncements(req.query, req.user) });
  } catch (err) {
    next(err);
  }
}

export async function getAnnouncement(req, res, next) {
  try {
    res.json({ success: true, data: await service.getAnnouncement(req.params.id) });
  } catch (err) {
    next(err);
  }
}

export async function listMobileAnnouncements(req, res, next) {
  try {
    res.json({ success: true, data: await service.listMobileAnnouncements(req.query, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function getMobileAnnouncement(req, res, next) {
  try {
    res.json({ success: true, data: await service.getMobileAnnouncement(req.params.id, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function createAnnouncement(req, res, next) {
  try {
    res.status(201).json({ success: true, data: await service.createAnnouncement(req.body, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function updateAnnouncement(req, res, next) {
  try {
    res.json({ success: true, data: await service.updateAnnouncement(req.params.id, req.body, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function publishAnnouncement(req, res, next) {
  try {
    res.json({ success: true, data: await service.publishAnnouncement(req.params.id, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function cancelAnnouncement(req, res, next) {
  try {
    res.json({ success: true, data: await service.cancelAnnouncement(req.params.id, req.user.userId) });
  } catch (err) {
    next(err);
  }
}

export async function listSmsJobs(req, res, next) {
  try {
    res.json({ success: true, data: await service.listSmsJobs(req.query) });
  } catch (err) {
    next(err);
  }
}

export async function dispatchDueSmsJobs(req, res, next) {
  try {
    res.json({ success: true, data: await service.dispatchDueSmsJobs(req.body || {}) });
  } catch (err) {
    next(err);
  }
}

export async function dispatchSmsJob(req, res, next) {
  try {
    res.json({ success: true, data: await service.dispatchSmsJob(req.params.id, { ...(req.body || {}), force: true }) });
  } catch (err) {
    next(err);
  }
}

export async function refreshSmsJobDeliveryStatus(req, res, next) {
  try {
    res.json({ success: true, data: await service.refreshSmsJobDeliveryStatus(req.params.id, req.body || {}) });
  } catch (err) {
    next(err);
  }
}

export async function receiveSmsDeliveryWebhook(req, res, next) {
  try {
    service.assertSmsDeliveryWebhookSecret({ headers: req.headers, query: req.query });
    res.json({ success: true, data: await service.applySmsDeliveryStatus(req.body || {}) });
  } catch (err) {
    next(err);
  }
}

export async function listHolidays(req, res, next) {
  try {
    res.json({ success: true, data: await service.listHolidays(req.query) });
  } catch (err) {
    next(err);
  }
}

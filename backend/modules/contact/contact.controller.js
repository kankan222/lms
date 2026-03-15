import * as service from "./contact.service.js";

export async function createContactSubmission(req, res, next) {
  try {
    const data = await service.createContactSubmission(req.body || {});
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listContactSubmissions(req, res, next) {
  try {
    const data = await service.listContactSubmissions(req.query || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
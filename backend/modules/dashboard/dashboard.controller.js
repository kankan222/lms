import * as service from "./dashboard.service.js";

export async function getSummary(req, res, next) {
  try {
    const data = await service.getDashboardSummary();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

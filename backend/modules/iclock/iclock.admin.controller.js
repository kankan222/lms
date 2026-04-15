import AppError from "../../core/errors/AppError.js";
import * as service from "./iclock.service.js";

export async function queuePullCommandForDevice(req, res, next) {
  try {
    const result = await service.queuePullCommandForDevice({
      deviceId: req.params.id,
      commandTemplate: req.body?.commandTemplate,
      fromTime: req.body?.fromTime || req.body?.from,
      toTime: req.body?.toTime || req.body?.to,
    });

    if (!result.success) {
      if (result.reason === "device_not_found") {
        throw new AppError("Attendance device not found", 404);
      }
      if (result.reason === "missing_template") {
        throw new AppError("Pull command template is required", 400);
      }
      throw new AppError("Unable to queue pull command", 400);
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function queuePullCommandsForAllDevices(req, res, next) {
  try {
    const result = await service.queuePullCommandsForAllDevices();
    if (result.reason === "missing_template") {
      throw new AppError("Set ICLOCK_PULL_COMMAND_TEMPLATE before queueing", 400);
    }
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

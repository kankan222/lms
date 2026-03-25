import * as service from "./notification.service.js";
import { registerNotificationClient } from "./notification.realtime.js";

export async function myNotifications(req,res,next){
  try{
    const data =
      await service.getMyNotifications(req.user.userId, {
        limit: req.query.limit,
      });

    res.json({ success:true, data });
  }catch(err){ next(err); }
}

export async function markRead(req,res,next){
  try{
    const result =
      await service.markNotification(req.params.id, req.user.userId);

    res.json({ success:true, data:result });
  }catch(err){ next(err); }
}

export async function markAllRead(req, res, next) {
  try {
    const result = await service.markAllNotifications(req.user.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function registerDevice(req, res, next) {
  try {
    const result = await service.registerDevice(req.user.userId, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function unregisterDevice(req, res, next) {
  try {
    const result = await service.unregisterDevice(req.user.userId, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export function streamNotifications(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const cleanup = registerNotificationClient(req.user.userId, res);

  req.on("close", cleanup);
  res.on("close", cleanup);
}

import { pool } from "../../database/pool.js";
import * as repo from "./notification.repository.js";
import { publishNotificationEvent } from "./notification.realtime.js";
import { sendPushNotifications } from "./notification.push.js";
import AppError from "../../core/errors/AppError.js";

function normalizeUserIds(input) {
  if (Array.isArray(input)) {
    return [...new Set(input.map((value) => Number(value)).filter(Boolean))];
  }

  const single = Number(input);
  return single ? [single] : [];
}

function buildRealtimePayload(payload = {}) {
  return {
    event: "notification:new",
    type: payload.type || "general",
    entityType: payload.entityType || null,
    entityId: payload.entityId || null,
    title: payload.title,
    body: payload.body,
    created_at: new Date().toISOString(),
  };
}

function isMissingNotificationDevicesTable(err) {
  return (
    err?.code === "ER_NO_SUCH_TABLE" &&
    typeof err?.sqlMessage === "string" &&
    err.sqlMessage.includes("notification_devices")
  );
}

export async function dispatchNotificationUpdate(userIds = [], payload = {}) {
  const normalizedUserIds = normalizeUserIds(userIds);
  if (!normalizedUserIds.length) return;

  publishNotificationEvent(normalizedUserIds, buildRealtimePayload(payload));

  const conn = await pool.getConnection();
  try {
    let devices = [];
    try {
      devices = await repo.listActivePushDevices(conn, normalizedUserIds);
    } catch (err) {
      if (isMissingNotificationDevicesTable(err)) {
        console.warn(
          "notification_devices table is missing; skipping push notification dispatch."
        );
        return;
      }
      throw err;
    }
    await sendPushNotifications(devices, payload);
  } finally {
    conn.release();
  }
}

export async function notify(data){
  const targetUserIds = normalizeUserIds(data.userIds ?? data.userId);
  if (!targetUserIds.length) {
    throw new AppError("Notification target user is required", 400);
  }

  const conn = await pool.getConnection();

  try{
    await conn.beginTransaction();

    if(Array.isArray(data.userIds)){
      await repo.createBulk(conn,targetUserIds,data);
    }else{
      await repo.createNotification(conn,{
        ...data,
        userId: targetUserIds[0],
      });
    }

    await conn.commit();
    await dispatchNotificationUpdate(targetUserIds, data);

  }catch(err){
    await conn.rollback();
    throw err;
  }finally{
    conn.release();
  }
}

export async function getMyNotifications(userId, options = {}){

  const conn = await pool.getConnection();

  try{
    const list =
      await repo.getUserNotifications(conn,userId, options);

    const unread =
      await repo.getUnreadCount(conn,userId);

    return { list, unread };

  }finally{
    conn.release();
  }
}

export async function markNotification(notificationId, userId){
  const notificationIdValue = Number(notificationId);
  if (!notificationIdValue) {
    throw new AppError("Notification id is required", 400);
  }

  const conn = await pool.getConnection();

  try{
    await repo.markAsRead(conn,notificationIdValue, userId);
    publishNotificationEvent([userId], {
      event: "notification:read",
      notification_id: notificationIdValue,
    });
    return { updated:true };
  }finally{
    conn.release();
  }
}

export async function markAllNotifications(userId) {
  const conn = await pool.getConnection();

  try {
    await repo.markAllAsRead(conn, userId);
    publishNotificationEvent([userId], {
      event: "notification:read-all",
      updated: true,
    });
    return { updated: true };
  } finally {
    conn.release();
  }
}

export async function registerDevice(userId, data = {}) {
  const deviceToken = String(data.device_token || data.deviceToken || "").trim();
  const platform = String(data.platform || "").trim().toLowerCase();
  const pushToken = String(data.push_token || data.pushToken || "").trim();

  if (!deviceToken || !platform) {
    throw new AppError("device_token and platform are required", 400);
  }

  const conn = await pool.getConnection();
  try {
    await repo.upsertDevice(conn, {
      userId,
      platform,
      deviceToken,
      pushToken: pushToken || null,
      pushProvider: pushToken ? String(data.push_provider || data.pushProvider || "expo") : null,
      deviceName: data.device_name || data.deviceName || null,
    });
    return { registered: true };
  } finally {
    conn.release();
  }
}

export async function unregisterDevice(userId, data = {}) {
  const deviceToken = String(data.device_token || data.deviceToken || "").trim();
  const pushToken = String(data.push_token || data.pushToken || "").trim();

  if (!deviceToken && !pushToken) {
    throw new AppError("device_token or push_token is required", 400);
  }

  const conn = await pool.getConnection();
  try {
    await repo.deactivateDevice(conn, {
      userId,
      deviceToken,
      pushToken,
    });
    return { removed: true };
  } finally {
    conn.release();
  }
}

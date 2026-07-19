import { pool } from "../../database/pool.js";
import * as repo from "./notification.repository.js";
import { publishNotificationEvent } from "./notification.realtime.js";
import { sendPushNotifications } from "./notification.push.js";
import AppError from "../../core/errors/AppError.js";

const CATEGORY_BY_TYPE = {
  message: "message",
  student_attendance_absent: "attendance",
  fee_overdue: "fee",
  fee_due: "fee",
  payment_received: "fee",
  marksheet_published: "marksheet",
  marks_rejected: "marksheet",
  account_security: "account",
};

const ALLOWED_CATEGORIES = new Set([
  "message",
  "attendance",
  "marksheet",
  "fee",
  "account",
  "system",
]);

function normalizeUserIds(input) {
  if (Array.isArray(input)) {
    return [...new Set(input.map((value) => Number(value)).filter(Boolean))];
  }

  const single = Number(input);
  return single ? [single] : [];
}

function normalizeCategory(payload = {}) {
  const explicit = String(payload.category || "").trim().toLowerCase();
  if (ALLOWED_CATEGORIES.has(explicit)) return explicit;

  const type = String(payload.type || "").trim().toLowerCase();
  if (CATEGORY_BY_TYPE[type]) return CATEGORY_BY_TYPE[type];
  if (type.startsWith("student_attendance")) return "attendance";
  if (type.startsWith("marks") || type.startsWith("marksheet")) return "marksheet";
  if (type.startsWith("fee") || type.startsWith("payment")) return "fee";
  if (type.startsWith("account") || type.startsWith("security") || type.startsWith("otp")) return "account";
  return "system";
}

function normalizeNotificationPayload(data = {}) {
  return {
    ...data,
    category: normalizeCategory(data),
    type: String(data.type || "general").trim() || "general",
    title: String(data.title || "").trim(),
    body: String(data.body || "").trim(),
    actionUrl: data.actionUrl || data.action_url || null,
    deepLink: data.deepLink || data.deep_link || null,
  };
}

function buildRealtimePayload(payload = {}) {
  return {
    event: "notification:new",
    category: payload.category || normalizeCategory(payload),
    type: payload.type || "general",
    entityType: payload.entityType || null,
    entityId: payload.entityId || null,
    title: payload.title,
    body: payload.body,
    actionUrl: payload.actionUrl || null,
    deepLink: payload.deepLink || null,
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
  const normalizedPayload = normalizeNotificationPayload(payload);

  publishNotificationEvent(normalizedUserIds, buildRealtimePayload(normalizedPayload));

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
    await sendPushNotifications(devices, normalizedPayload);
  } finally {
    conn.release();
  }
}

export async function notify(data){
  const targetUserIds = normalizeUserIds(data.userIds ?? data.userId);
  if (!targetUserIds.length) {
    throw new AppError("Notification target user is required", 400);
  }

  const payload = normalizeNotificationPayload(data);
  if (!payload.title || !payload.body) {
    throw new AppError("Notification title and body are required", 400);
  }

  const conn = await pool.getConnection();

  try{
    await conn.beginTransaction();

    let notificationIds = [];
    if(Array.isArray(data.userIds)){
      notificationIds = await repo.createBulk(conn,targetUserIds,payload);
    }else{
      const notificationId = await repo.createNotification(conn,{
        ...payload,
        userId: targetUserIds[0],
      });
      notificationIds = [notificationId];
    }

    await conn.commit();
    await dispatchNotificationUpdate(targetUserIds, payload);
    return { notification_ids: notificationIds };

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

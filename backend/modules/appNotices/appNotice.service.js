import AppError from "../../core/errors/AppError.js";
import * as repo from "./appNotice.repository.js";

const PLATFORMS = new Set(["all", "android", "ios"]);
const SEVERITIES = new Set(["info", "warning", "critical"]);

function optionalString(value) {
  const text = String(value || "").trim();
  return text || null;
}

function requiredString(value, field) {
  const text = optionalString(value);
  if (!text) throw new AppError(`${field} is required`, 400);
  return text;
}

function boolValue(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return Boolean(value);
}

function intValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function dateTimeValue(value, field) {
  const text = optionalString(value);
  if (!text) return null;
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) throw new AppError(`${field} must be YYYY-MM-DD HH:mm`, 400);
  const [, yearText, monthText, dayText, hourText = "0", minuteText = "0", secondText = "0"] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    throw new AppError(`${field} must be a valid date/time`, 400);
  }
  return `${yearText}-${monthText}-${dayText} ${String(hour).padStart(2, "0")}:${minuteText}:${String(second).padStart(2, "0")}`;
}

function compareVersions(left, right) {
  const a = String(left || "0").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const b = String(right || "0").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] || 0) - (b[index] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function normalizePlatform(value, fallback = "all") {
  const platform = String(value || fallback).trim().toLowerCase();
  return PLATFORMS.has(platform) ? platform : fallback;
}

function normalizeNoticeInput(input = {}, userId) {
  const severity = String(input.severity || "info").trim().toLowerCase();
  if (!SEVERITIES.has(severity)) throw new AppError("Invalid notice severity", 400);
  const platform = normalizePlatform(input.platform, "all");
  const startsAt = dateTimeValue(input.starts_at || input.startsAt, "starts_at");
  const endsAt = dateTimeValue(input.ends_at || input.endsAt, "ends_at");
  if (startsAt && endsAt && startsAt > endsAt) throw new AppError("starts_at must be before ends_at", 400);
  return {
    title: requiredString(input.title, "title"),
    message: requiredString(input.message, "message"),
    severity,
    platform,
    starts_at: startsAt,
    ends_at: endsAt,
    min_app_version: optionalString(input.min_app_version || input.minAppVersion),
    max_app_version: optionalString(input.max_app_version || input.maxAppVersion),
    min_build: intValue(input.min_build ?? input.minBuild),
    max_build: intValue(input.max_build ?? input.maxBuild),
    dismissible: boolValue(input.dismissible, true),
    action_label: optionalString(input.action_label || input.actionLabel),
    action_url: optionalString(input.action_url || input.actionUrl),
    is_active: boolValue(input.is_active, true),
    user_id: userId || null,
  };
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    title: row.title,
    message: row.message,
    severity: row.severity,
    platform: row.platform,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    min_app_version: row.min_app_version,
    max_app_version: row.max_app_version,
    min_build: row.min_build === null || row.min_build === undefined ? null : Number(row.min_build),
    max_build: row.max_build === null || row.max_build === undefined ? null : Number(row.max_build),
    dismissible: Boolean(row.dismissible),
    action_label: row.action_label,
    action_url: row.action_url,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function matchesAppVersion(row, input = {}) {
  const version = String(input.current_version || input.currentVersion || "");
  const build = Number(input.current_build || input.currentBuild || 0);
  if (row.min_app_version && version && compareVersions(version, row.min_app_version) < 0) return false;
  if (row.max_app_version && version && compareVersions(version, row.max_app_version) > 0) return false;
  if (row.min_build && build > 0 && build < Number(row.min_build)) return false;
  if (row.max_build && build > 0 && build > Number(row.max_build)) return false;
  return true;
}

export async function listNotices() {
  const rows = await repo.listNotices();
  return rows.map(normalizeRow);
}

export async function getActiveNotice(query = {}) {
  const platform = normalizePlatform(query.platform, "android");
  const rows = await repo.listActiveNotices(platform);
  return rows.map(normalizeRow).find((row) => matchesAppVersion(row, query)) || null;
}

export async function createNotice(body, userId) {
  return normalizeRow(await repo.createNotice(normalizeNoticeInput(body, userId)));
}

export async function updateNotice(id, body, userId) {
  const noticeId = Number(id);
  if (!Number.isInteger(noticeId) || noticeId <= 0) throw new AppError("Invalid notice id", 400);
  const existing = await repo.getNoticeById(noticeId);
  if (!existing) throw new AppError("Notice not found", 404);
  return normalizeRow(await repo.updateNotice(noticeId, normalizeNoticeInput(body, userId)));
}

export async function deleteNotice(id) {
  const noticeId = Number(id);
  if (!Number.isInteger(noticeId) || noticeId <= 0) throw new AppError("Invalid notice id", 400);
  const deleted = await repo.deleteNotice(noticeId);
  if (!deleted) throw new AppError("Notice not found", 404);
  return { deleted: true };
}

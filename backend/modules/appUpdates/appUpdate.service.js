import * as notificationService from "../notifications/notification.service.js";
import { query } from "../../core/db/query.js";
import AppError from "../../core/errors/AppError.js";
import * as repo from "./appUpdate.repository.js";

const SUPPORTED_PLATFORMS = new Set(["android", "ios"]);

function normalizePlatform(value) {
  const platform = String(value || "").trim().toLowerCase();
  if (SUPPORTED_PLATFORMS.has(platform)) return platform;
  return "android";
}

function parseVersion(value) {
  return String(value || "0")
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] || 0) - (b[index] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function envKey(platform, suffix) {
  return `MOBILE_${platform.toUpperCase()}_${suffix}`;
}

function resolvePolicy(platform) {
  const keyPrefix = platform.toUpperCase();
  const latestVersion =
    process.env[envKey(platform, "LATEST_VERSION")] ||
    process.env.MOBILE_LATEST_VERSION ||
    "1.1.4";
  const minimumVersion =
    process.env[envKey(platform, "MINIMUM_VERSION")] ||
    process.env.MOBILE_MINIMUM_VERSION ||
    latestVersion;
  const latestBuild = Number(
    process.env[envKey(platform, "LATEST_BUILD")] ||
    process.env[envKey(platform, "LATEST_VERSION_CODE")] ||
    process.env.MOBILE_LATEST_BUILD ||
    0
  );
  const minimumBuild = Number(
    process.env[envKey(platform, "MINIMUM_BUILD")] ||
    process.env[envKey(platform, "MINIMUM_VERSION_CODE")] ||
    process.env.MOBILE_MINIMUM_BUILD ||
    0
  );

  return {
    platform,
    latest_version: latestVersion,
    minimum_version: minimumVersion,
    latest_build: Number.isFinite(latestBuild) ? latestBuild : 0,
    minimum_build: Number.isFinite(minimumBuild) ? minimumBuild : 0,
    store_url:
      process.env[envKey(platform, "STORE_URL")] ||
      process.env[`MOBILE_${keyPrefix}_URL`] ||
      process.env.MOBILE_STORE_URL ||
      null,
    title: process.env.MOBILE_UPDATE_TITLE || "App update available",
    message:
      process.env[envKey(platform, "UPDATE_MESSAGE")] ||
      process.env.MOBILE_UPDATE_MESSAGE ||
      "A newer version of the app is available.",
  };
}

function normalizePolicyRow(row, platform) {
  if (!row) return resolvePolicy(platform);
  return {
    platform: row.platform,
    latest_version: row.latest_version,
    minimum_version: row.minimum_version,
    latest_build: Number(row.latest_build || 0),
    minimum_build: Number(row.minimum_build || 0),
    store_url: row.store_url || null,
    title: row.title || "App update available",
    message: row.message || "A newer version of the app is available.",
    is_active: Boolean(row.is_active),
  };
}

export async function checkUpdate(input = {}) {
  const platform = normalizePlatform(input.platform);
  const policy = normalizePolicyRow(await repo.getPolicy(platform), platform);
  const currentVersion = String(input.current_version || input.currentVersion || "0");
  const currentBuild = Number(input.current_build || input.currentBuild || 0);
  const versionBehindLatest = compareVersions(currentVersion, policy.latest_version) < 0;
  const versionBehindMinimum = compareVersions(currentVersion, policy.minimum_version) < 0;
  const buildBehindLatest = policy.latest_build > 0 && currentBuild > 0 && currentBuild < policy.latest_build;
  const buildBehindMinimum = policy.minimum_build > 0 && currentBuild > 0 && currentBuild < policy.minimum_build;
  const updateAvailable = versionBehindLatest || buildBehindLatest;
  const required = versionBehindMinimum || buildBehindMinimum;

  return {
    update_available: updateAvailable,
    required,
    platform,
    current_version: currentVersion,
    current_build: currentBuild || null,
    latest_version: policy.latest_version,
    latest_build: policy.latest_build || null,
    minimum_version: policy.minimum_version,
    minimum_build: policy.minimum_build || null,
    store_url: policy.store_url,
    title: policy.title,
    message: policy.message,
  };
}

export async function listPolicies() {
  const rows = await repo.listPolicies();
  const byPlatform = new Map(rows.map((row) => [row.platform, row]));
  return ["android", "ios"].map((platform) => normalizePolicyRow(byPlatform.get(platform), platform));
}

export async function savePolicy(actor, input = {}) {
  if (!actor?.roles?.includes("super_admin") && !actor?.permissions?.includes("notifications.manage")) {
    throw new AppError("Forbidden", 403);
  }

  const platform = normalizePlatform(input.platform);
  const latestVersion = String(input.latest_version || input.latestVersion || "").trim();
  const minimumVersion = String(input.minimum_version || input.minimumVersion || "").trim();
  if (!latestVersion || !minimumVersion) {
    throw new AppError("Latest version and minimum version are required", 400);
  }

  const latestBuild = Number(input.latest_build ?? input.latestBuild ?? 0);
  const minimumBuild = Number(input.minimum_build ?? input.minimumBuild ?? 0);
  const saved = await repo.upsertPolicy({
    platform,
    latestVersion,
    latestBuild: Number.isFinite(latestBuild) && latestBuild > 0 ? latestBuild : null,
    minimumVersion,
    minimumBuild: Number.isFinite(minimumBuild) && minimumBuild > 0 ? minimumBuild : null,
    storeUrl: String(input.store_url || input.storeUrl || "").trim() || null,
    title: String(input.title || "App update available").trim() || "App update available",
    message: String(input.message || "A newer version of the app is available.").trim(),
    isActive: input.is_active === undefined ? true : Boolean(input.is_active),
  });
  return normalizePolicyRow(saved, platform);
}

export async function notifyAvailableUpdate(actor, input = {}) {
  if (!actor?.roles?.includes("super_admin") && !actor?.permissions?.includes("notifications.send")) {
    throw new AppError("Forbidden", 403);
  }

  const platform = normalizePlatform(input.platform);
  const policy = normalizePolicyRow(await repo.getPolicy(platform), platform);
  const rows = await query(
    `SELECT DISTINCT u.id
     FROM users u
     WHERE u.status = 'active'
       AND (
         EXISTS (
           SELECT 1
           FROM user_roles ur
           JOIN role_permissions rp ON rp.role_id = ur.role_id
           JOIN permissions p ON p.id = rp.permission_id
           WHERE ur.user_id = u.id
             AND p.name IN ('notifications.view', 'notifications.push.receive')
         )
         OR EXISTS (
           SELECT 1
           FROM user_permissions up
           JOIN permissions p ON p.id = up.permission_id
           WHERE up.user_id = u.id
             AND p.name IN ('notifications.view', 'notifications.push.receive')
         )
       )`
  );
  const userIds = rows.map((row) => Number(row.id)).filter(Boolean);
  if (!userIds.length) return { notified: 0 };

  await notificationService.notify({
    userIds,
    category: "system",
    type: "app_update_available",
    entityType: "mobile_app",
    title: policy.title,
    body: policy.message,
    actionUrl: policy.store_url,
    deepLink: "app://profile/app-update",
  });

  return { notified: userIds.length };
}

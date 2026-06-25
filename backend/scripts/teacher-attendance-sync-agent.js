import fs from "node:fs/promises";
import path from "node:path";
import { query } from "../core/db/query.js";

const MIN_INTERVAL_SECONDS = 30;
const MAX_INTERVAL_SECONDS = 60;
const DEFAULT_INTERVAL_SECONDS = 30;
const DEFAULT_BATCH_SIZE = 200;
const MAX_BATCH_SIZE = 1000;
const REQUEST_TIMEOUT_MS = 15000;

let running = false;

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function toBoundedIntervalSeconds(value) {
  const parsed = toPositiveInt(value, DEFAULT_INTERVAL_SECONDS);
  return Math.max(MIN_INTERVAL_SECONDS, Math.min(MAX_INTERVAL_SECONDS, parsed));
}

function normalizeBatchSize(value) {
  const parsed = toPositiveInt(value, DEFAULT_BATCH_SIZE);
  return Math.max(1, Math.min(MAX_BATCH_SIZE, parsed));
}

function buildEndpoint(baseUrl, endpointPath) {
  const normalizedBaseUrl = String(baseUrl || "").trim();
  if (!normalizedBaseUrl) {
    throw new Error("ATTENDANCE_SYNC_VPS_BASE_URL is required");
  }

  const normalizedPath = String(
    endpointPath || "/api/v1/sync/teacher-attendance/logs"
  ).trim();
  return new URL(normalizedPath, normalizedBaseUrl).toString();
}

function getStateFilePath() {
  const configured = String(process.env.ATTENDANCE_SYNC_STATE_FILE || "").trim();
  if (configured) return configured;
  return path.resolve(process.cwd(), ".attendance-sync-state.json");
}

async function loadState(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const lastSyncedId = toPositiveInt(parsed?.lastSyncedId, 0);
    return { lastSyncedId };
  } catch {
    return { lastSyncedId: 0 };
  }
}

async function saveState(filePath, state) {
  const payload = JSON.stringify(
    {
      lastSyncedId: toPositiveInt(state?.lastSyncedId, 0),
      updatedAt: new Date().toISOString(),
    },
    null,
    2
  );
  await fs.writeFile(filePath, payload, "utf8");
}

async function fetchPendingLogs({ afterId, batchSize }) {
  const rows = await query(
    `
      SELECT
        l.id AS source_log_id,
        l.teacher_id,
        t.employee_id AS teacher_employee_id,
        d.device_code,
        DATE_FORMAT(l.punch_time, '%Y-%m-%d %H:%i:%s') AS punch_time,
        l.punch_type
      FROM teacher_attendance_logs l
      LEFT JOIN teachers t ON t.id = l.teacher_id
      LEFT JOIN attendance_devices d ON d.id = l.device_id
      WHERE l.id > ?
      ORDER BY l.id ASC
      LIMIT ?
    `,
    [afterId, batchSize]
  );

  return rows.map((row) => ({
    source_log_id: Number(row.source_log_id),
    teacher_id: row.teacher_id === null ? null : Number(row.teacher_id),
    teacher_employee_id: row.teacher_employee_id || null,
    device_code: row.device_code || null,
    punch_time: String(row.punch_time || "").trim(),
    punch_type: String(row.punch_type || "unknown").trim().toLowerCase() || "unknown",
  }));
}

async function pushBatch({ endpoint, syncKey, siteId, records }) {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available in this Node runtime");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-key": syncKey,
      },
      body: JSON.stringify({
        siteId,
        records,
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }

    if (!response.ok || !data?.success) {
      const message = data?.message || `Sync request failed (${response.status})`;
      throw new Error(message);
    }

    return data?.data || {};
  } finally {
    clearTimeout(timeout);
  }
}

async function runSyncCycle(config) {
  if (running) return;
  running = true;

  const state = await loadState(config.stateFilePath);
  let cursor = state.lastSyncedId;
  let syncedRows = 0;

  try {
    while (true) {
      const records = await fetchPendingLogs({
        afterId: cursor,
        batchSize: config.batchSize,
      });

      if (!records.length) break;

      const result = await pushBatch({
        endpoint: config.endpoint,
        syncKey: config.syncKey,
        siteId: config.siteId,
        records,
      });

      const maxInBatch = Math.max(...records.map((item) => Number(item.source_log_id)));
      cursor = Math.max(cursor, maxInBatch);
      syncedRows += records.length;

      await saveState(config.stateFilePath, { lastSyncedId: cursor });

      console.log("ATTENDANCE SYNC BATCH:", {
        siteId: config.siteId,
        sentCount: records.length,
        cursor,
        storedCount: result?.storedCount ?? null,
        duplicateCount: result?.duplicateCount ?? null,
        unmappedTeacherCount: result?.unmappedTeacherCount ?? null,
      });

      if (records.length < config.batchSize) break;
    }

    if (!syncedRows) {
      console.log("ATTENDANCE SYNC IDLE:", {
        siteId: config.siteId,
        cursor,
      });
    }
  } catch (error) {
    console.error("ATTENDANCE SYNC ERROR:", error?.message || error);
  } finally {
    running = false;
  }
}

function isEnabled() {
  const raw = String(process.env.ATTENDANCE_SYNC_ENABLED || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export async function startTeacherAttendanceSyncAgent() {
  if (!isEnabled()) {
    console.log("ATTENDANCE SYNC AGENT DISABLED");
    return;
  }

  const siteId = String(process.env.ATTENDANCE_SYNC_SITE_ID || "").trim();
  if (!siteId) {
    throw new Error("ATTENDANCE_SYNC_SITE_ID is required");
  }

  const syncKey = String(process.env.ATTENDANCE_SYNC_SHARED_KEY || "").trim();
  if (!syncKey) {
    throw new Error("ATTENDANCE_SYNC_SHARED_KEY is required");
  }

  const endpoint = buildEndpoint(
    process.env.ATTENDANCE_SYNC_VPS_BASE_URL,
    process.env.ATTENDANCE_SYNC_ENDPOINT_PATH
  );
  const intervalSeconds = toBoundedIntervalSeconds(process.env.ATTENDANCE_SYNC_INTERVAL_SECONDS);
  const batchSize = normalizeBatchSize(process.env.ATTENDANCE_SYNC_BATCH_SIZE);
  const stateFilePath = getStateFilePath();

  const config = {
    siteId,
    syncKey,
    endpoint,
    intervalSeconds,
    batchSize,
    stateFilePath,
  };

  console.log("ATTENDANCE SYNC AGENT STARTED:", {
    siteId: config.siteId,
    endpoint: config.endpoint,
    intervalSeconds: config.intervalSeconds,
    batchSize: config.batchSize,
    stateFilePath: config.stateFilePath,
  });

  await runSyncCycle(config);
  setInterval(() => {
    runSyncCycle(config);
  }, intervalSeconds * 1000);
}

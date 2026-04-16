import fs from "node:fs/promises";
import path from "node:path";
import mssql from "mssql";

const MIN_INTERVAL_SECONDS = 30;
const MAX_INTERVAL_SECONDS = 60;
const DEFAULT_INTERVAL_SECONDS = 30;
const DEFAULT_BATCH_SIZE = 200;
const MAX_BATCH_SIZE = 1000;
const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_SOURCE_TABLE = "dbo.Tran_MachineRawPunch";

const DEFAULT_IN_PAYCODES = new Set(["in", "checkin", "check_in", "i", "0", "1"]);
const DEFAULT_OUT_PAYCODES = new Set(["out", "checkout", "check_out", "o", "2"]);

let running = false;
let pool = null;

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

function toBoolean(value, fallback = false) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function parseCommaSet(value, fallbackSet) {
  const items = String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (!items.length) return new Set(fallbackSet);
  return new Set(items);
}

function buildEndpoint(baseUrl, endpointPath) {
  const normalizedBaseUrl = String(baseUrl || "").trim();
  if (!normalizedBaseUrl) {
    throw new Error("ATTENDANCE_SYNC_VPS_BASE_URL is required");
  }

  const normalizedPath = String(endpointPath || "/sync/teacher-attendance/logs").trim();
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

function formatDateTime(value) {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{14}$/.test(raw)) {
    const yyyy = raw.slice(0, 4);
    const mm = raw.slice(4, 6);
    const dd = raw.slice(6, 8);
    const hh = raw.slice(8, 10);
    const mi = raw.slice(10, 12);
    const ss = raw.slice(12, 14);
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  }

  if (/^\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return raw.replaceAll("/", "-").replace("T", " ");
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;

  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const hh = String(parsed.getHours()).padStart(2, "0");
  const mi = String(parsed.getMinutes()).padStart(2, "0");
  const ss = String(parsed.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function parseSourceTable(value) {
  const raw = String(value || DEFAULT_SOURCE_TABLE).trim();
  if (!/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)?$/.test(raw)) {
    throw new Error("MSSQL_SOURCE_TABLE must be schema.table (alphanumeric/underscore only)");
  }

  const [schema, table] = raw.includes(".") ? raw.split(".") : ["dbo", raw];
  return {
    schema,
    table,
    qualifiedName: `[${schema}].[${table}]`,
  };
}

function parseServerAndInstance(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    throw new Error("MSSQL_SOURCE_SERVER is required");
  }

  if (!raw.includes("\\")) {
    return {
      server: raw,
      instanceName: undefined,
    };
  }

  const [server, instanceName] = raw.split("\\", 2);
  return {
    server: String(server || "").trim(),
    instanceName: String(instanceName || "").trim() || undefined,
  };
}

function createMssqlConfig() {
  const serverAndInstance = parseServerAndInstance(process.env.MSSQL_SOURCE_SERVER);
  const database = String(process.env.MSSQL_SOURCE_DATABASE || "").trim();
  const user = String(process.env.MSSQL_SOURCE_USER || "").trim();
  const password = String(process.env.MSSQL_SOURCE_PASSWORD || "").trim();

  if (!database) throw new Error("MSSQL_SOURCE_DATABASE is required");
  if (!user) throw new Error("MSSQL_SOURCE_USER is required");
  if (!password) throw new Error("MSSQL_SOURCE_PASSWORD is required");

  return {
    user,
    password,
    server: serverAndInstance.server,
    database,
    port: toPositiveInt(process.env.MSSQL_SOURCE_PORT, 1433),
    options: {
      encrypt: toBoolean(process.env.MSSQL_SOURCE_ENCRYPT, false),
      trustServerCertificate: toBoolean(
        process.env.MSSQL_SOURCE_TRUST_SERVER_CERTIFICATE,
        true
      ),
      enableArithAbort: true,
      instanceName: serverAndInstance.instanceName,
      useUTC: false,
    },
    pool: {
      max: toPositiveInt(process.env.MSSQL_SOURCE_POOL_MAX, 5),
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

async function getPool(config) {
  if (pool?.connected) return pool;

  if (pool) {
    try {
      await pool.close();
    } catch {
      // Ignore close errors and recreate pool.
    }
    pool = null;
  }

  pool = await new mssql.ConnectionPool(config).connect();
  return pool;
}

async function closePool() {
  if (!pool) return;
  try {
    await pool.close();
  } catch {
    // Ignore close errors during shutdown/reconnect.
  } finally {
    pool = null;
  }
}

function normalizePunchType(payCode, inPaycodes, outPaycodes) {
  const raw = String(payCode || "").trim().toLowerCase();
  if (!raw) return "unknown";
  if (inPaycodes.has(raw)) return "in";
  if (outPaycodes.has(raw)) return "out";
  return "unknown";
}

function normalizeRows(rows, config) {
  return rows
    .map((row) => {
      const sourceLogId = Number(row?.Tran_MachineRawPunchId);
      if (!Number.isInteger(sourceLogId) || sourceLogId <= 0) return null;

      const punchTime = formatDateTime(row?.PunchDateTime || row?.DateTime);
      if (!punchTime) return null;

      const teacherEmployeeId = String(row?.CardNo || "").trim() || null;
      const deviceCode = String(row?.MachineNo ?? "").trim() || null;
      const punchType = normalizePunchType(
        row?.PayCode,
        config.inPaycodes,
        config.outPaycodes
      );

      return {
        source_log_id: sourceLogId,
        teacher_employee_id: teacherEmployeeId,
        device_code: deviceCode,
        punch_time: punchTime,
        punch_type: punchType,
      };
    })
    .filter(Boolean);
}

async function fetchPendingRows({ afterId, batchSize, sourceTable, mssqlConfig }) {
  const connectedPool = await getPool(mssqlConfig);
  const request = connectedPool.request();
  request.input("afterId", mssql.BigInt, afterId);
  request.input("batchSize", mssql.Int, batchSize);

  const result = await request.query(`
    SELECT TOP (@batchSize)
      [Tran_MachineRawPunchId],
      [CardNo],
      [PunchDateTime],
      [PayCode],
      [MachineNo],
      [DateTime]
    FROM ${sourceTable.qualifiedName}
    WHERE [Tran_MachineRawPunchId] > @afterId
    ORDER BY [Tran_MachineRawPunchId] ASC
  `);

  return Array.isArray(result?.recordset) ? result.recordset : [];
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
      const sourceRows = await fetchPendingRows({
        afterId: cursor,
        batchSize: config.batchSize,
        sourceTable: config.sourceTable,
        mssqlConfig: config.mssqlConfig,
      });

      if (!sourceRows.length) break;

      const maxInBatch = Math.max(
        ...sourceRows.map((row) => Number(row.Tran_MachineRawPunchId || 0))
      );
      const records = normalizeRows(sourceRows, config);

      if (records.length) {
        const result = await pushBatch({
          endpoint: config.endpoint,
          syncKey: config.syncKey,
          siteId: config.siteId,
          records,
        });

        console.log("MSSQL ATTENDANCE SYNC BATCH:", {
          siteId: config.siteId,
          sourceCount: sourceRows.length,
          sentCount: records.length,
          cursor: maxInBatch,
          storedCount: result?.storedCount ?? null,
          duplicateCount: result?.duplicateCount ?? null,
          unmappedTeacherCount: result?.unmappedTeacherCount ?? null,
          invalidCount: result?.invalidCount ?? null,
        });

        syncedRows += records.length;
      } else {
        console.log("MSSQL ATTENDANCE SYNC SKIP BATCH:", {
          siteId: config.siteId,
          sourceCount: sourceRows.length,
          reason: "all_rows_invalid_after_normalization",
        });
      }

      cursor = Math.max(cursor, maxInBatch);
      await saveState(config.stateFilePath, { lastSyncedId: cursor });

      if (sourceRows.length < config.batchSize) break;
    }

    if (!syncedRows) {
      console.log("MSSQL ATTENDANCE SYNC IDLE:", {
        siteId: config.siteId,
        cursor,
      });
    }
  } catch (error) {
    console.error("MSSQL ATTENDANCE SYNC ERROR:", error?.message || error);
    await closePool();
  } finally {
    running = false;
  }
}

function isEnabled() {
  const raw = String(process.env.ATTENDANCE_SYNC_ENABLED || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export async function startMssqlTeacherAttendanceSyncAgent() {
  if (!isEnabled()) {
    console.log("MSSQL ATTENDANCE SYNC AGENT DISABLED");
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
  const sourceTable = parseSourceTable(process.env.MSSQL_SOURCE_TABLE);
  const mssqlConfig = createMssqlConfig();
  const inPaycodes = parseCommaSet(process.env.MSSQL_SOURCE_IN_PAYCODES, DEFAULT_IN_PAYCODES);
  const outPaycodes = parseCommaSet(process.env.MSSQL_SOURCE_OUT_PAYCODES, DEFAULT_OUT_PAYCODES);

  const config = {
    siteId,
    syncKey,
    endpoint,
    intervalSeconds,
    batchSize,
    stateFilePath,
    sourceTable,
    mssqlConfig,
    inPaycodes,
    outPaycodes,
  };

  console.log("MSSQL ATTENDANCE SYNC AGENT STARTED:", {
    siteId: config.siteId,
    endpoint: config.endpoint,
    intervalSeconds: config.intervalSeconds,
    batchSize: config.batchSize,
    stateFilePath: config.stateFilePath,
    sourceTable: `${sourceTable.schema}.${sourceTable.table}`,
    mssqlServer: mssqlConfig.server,
    mssqlDatabase: mssqlConfig.database,
    mssqlInstance: mssqlConfig.options.instanceName || null,
  });

  await runSyncCycle(config);
  setInterval(() => {
    runSyncCycle(config);
  }, intervalSeconds * 1000);
}


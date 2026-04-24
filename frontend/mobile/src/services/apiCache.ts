import * as FileSystem from "expo-file-system/legacy";

export type ApiCacheEntry = {
  storedAt: number;
  expiresAt: number;
  status: number;
  statusText: string;
  data: unknown;
  headers: Record<string, string>;
};

type CacheFilePayload = {
  version: number;
  entries: Record<string, ApiCacheEntry>;
};

const CACHE_VERSION = 1;
const CACHE_FILE_NAME = "lms-api-cache-v1.json";
const MAX_CACHE_ENTRIES = 200;
const PERSIST_DEBOUNCE_MS = 250;

const CACHE_FILE_PATH = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}${CACHE_FILE_NAME}`
  : null;

const cache = new Map<string, ApiCacheEntry>();
let isHydrated = false;
let hydratePromise: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((a, b) => a.localeCompare(b));
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
  }

  return JSON.stringify(String(value));
}

function cleanupExpired(now = Date.now()) {
  let removed = false;
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
      removed = true;
    }
  }
  return removed;
}

function enforceSizeLimit() {
  if (cache.size <= MAX_CACHE_ENTRIES) return false;

  const entries = Array.from(cache.entries()).sort((a, b) => a[1].storedAt - b[1].storedAt);
  let removed = false;
  while (entries.length && cache.size > MAX_CACHE_ENTRIES) {
    const oldest = entries.shift();
    if (oldest) {
      cache.delete(oldest[0]);
      removed = true;
    }
  }
  return removed;
}

async function persistNow() {
  if (!CACHE_FILE_PATH) return;

  const payload: CacheFilePayload = {
    version: CACHE_VERSION,
    entries: Object.fromEntries(cache.entries()),
  };

  try {
    await FileSystem.writeAsStringAsync(CACHE_FILE_PATH, JSON.stringify(payload), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch {
    // Ignore persistence errors and keep memory cache available.
  }
}

function schedulePersist() {
  if (!CACHE_FILE_PATH || persistTimer) return;

  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistNow();
  }, PERSIST_DEBOUNCE_MS);
}

async function ensureHydrated() {
  if (isHydrated) return;
  if (hydratePromise) {
    await hydratePromise;
    return;
  }

  hydratePromise = (async () => {
    if (!CACHE_FILE_PATH) {
      isHydrated = true;
      return;
    }

    try {
      const info = await FileSystem.getInfoAsync(CACHE_FILE_PATH);
      if (!info.exists) {
        isHydrated = true;
        return;
      }

      const raw = await FileSystem.readAsStringAsync(CACHE_FILE_PATH);
      if (!raw) {
        isHydrated = true;
        return;
      }

      const parsed = JSON.parse(raw) as CacheFilePayload;
      if (parsed.version !== CACHE_VERSION || typeof parsed.entries !== "object" || !parsed.entries) {
        isHydrated = true;
        return;
      }

      for (const [key, entry] of Object.entries(parsed.entries)) {
        if (
          entry &&
          typeof entry === "object" &&
          typeof entry.storedAt === "number" &&
          typeof entry.expiresAt === "number" &&
          typeof entry.status === "number" &&
          typeof entry.statusText === "string"
        ) {
          cache.set(key, entry);
        }
      }

      if (cleanupExpired() || enforceSizeLimit()) {
        schedulePersist();
      }
    } catch {
      // Ignore corrupted cache payloads.
    } finally {
      isHydrated = true;
    }
  })();

  await hydratePromise;
}

export function createApiCacheKey(input: { userScope: string; url: string; params?: unknown }) {
  return `${input.userScope}|${input.url}|${stableSerialize(input.params ?? null)}`;
}

export async function getApiCacheEntry(key: string, options?: { allowExpired?: boolean }) {
  await ensureHydrated();
  const entry = cache.get(key);
  if (!entry) return null;

  const allowExpired = options?.allowExpired ?? false;
  const now = Date.now();
  if (!allowExpired && entry.expiresAt <= now) {
    cache.delete(key);
    schedulePersist();
    return null;
  }

  return entry;
}

export async function setApiCacheEntry(key: string, entry: ApiCacheEntry) {
  await ensureHydrated();
  cache.set(key, entry);

  const didChange = cleanupExpired() || enforceSizeLimit();
  if (didChange || cache.has(key)) {
    schedulePersist();
  }
}

export async function clearApiCache() {
  await ensureHydrated();
  cache.clear();

  if (!CACHE_FILE_PATH) return;

  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }

  try {
    await FileSystem.deleteAsync(CACHE_FILE_PATH, { idempotent: true });
  } catch {
    // Ignore cleanup failures.
  }
}

export async function clearApiCacheByUserScope(userScope: string) {
  await ensureHydrated();

  let changed = false;
  for (const key of cache.keys()) {
    if (key.startsWith(`${userScope}|`)) {
      cache.delete(key);
      changed = true;
    }
  }

  if (changed) {
    schedulePersist();
  }
}

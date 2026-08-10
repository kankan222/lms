import cron from "node-cron";

function nowMs() {
  return Date.now();
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(raw).trim().toLowerCase());
}

export function startGuardedCronJob({
  name,
  cronExpr,
  enabled = true,
  run,
  runOnStartDelayMs = null,
}) {
  if (!enabled) {
    console.log(`${name} disabled`);
    return null;
  }

  if (!cron.validate(cronExpr)) {
    console.error(`${name} invalid cron expression: ${cronExpr}`);
    return null;
  }

  let running = false;

  const guardedRun = async () => {
    if (running) {
      console.warn(`${name} skipped because previous run is still active`);
      return;
    }

    running = true;
    const startedAt = nowMs();
    console.log(`${name} started`);
    try {
      await run();
      console.log(`${name} completed in ${formatDuration(nowMs() - startedAt)}`);
    } catch (err) {
      console.error(`${name} failed after ${formatDuration(nowMs() - startedAt)}:`, err);
    } finally {
      running = false;
    }
  };

  if (Number.isFinite(Number(runOnStartDelayMs))) {
    setTimeout(guardedRun, Number(runOnStartDelayMs));
  }

  const task = cron.schedule(cronExpr, guardedRun);
  console.log(`${name} scheduled`, { cron: cronExpr });
  return task;
}

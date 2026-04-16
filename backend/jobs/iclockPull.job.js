import cron from "node-cron";
import { queuePullCommandsForAllDevices } from "../modules/iclock/iclock.service.js";

let running = false;

function isEnabled() {
  const raw = String(process.env.ICLOCK_PULL_ENABLED || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function startIclockPullJob() {
  if (!isEnabled()) {
    console.log("ICLOCK PULL JOB DISABLED:", {
      ICLOCK_PULL_ENABLED: String(process.env.ICLOCK_PULL_ENABLED || ""),
    });
    return;
  }

  const cronExpr = String(process.env.ICLOCK_PULL_CRON || "*/2 * * * *").trim();
  if (!cron.validate(cronExpr)) {
    console.error("ICLOCK PULL JOB ERROR: invalid cron expression:", cronExpr);
    return;
  }

  const runPullCycle = async () => {
    if (running) return;
    running = true;
    try {
      const result = await queuePullCommandsForAllDevices();
      if (result.reason === "missing_template") {
        console.log("ICLOCK PULL JOB SKIPPED: set ICLOCK_PULL_COMMAND_TEMPLATE.");
      } else {
        console.log("ICLOCK PULL JOB RESULT:", {
          queuedCount: result.queuedCount,
          skippedCount: result.skippedCount,
        });
      }
    } catch (error) {
      console.error("ICLOCK PULL JOB ERROR:", error?.message || error);
    } finally {
      running = false;
    }
  };

  // Trigger one pull cycle immediately at startup,
  // then continue on cron cadence.
  runPullCycle();
  cron.schedule(cronExpr, runPullCycle);

  console.log("ICLOCK PULL JOB STARTED:", { cron: cronExpr });
}

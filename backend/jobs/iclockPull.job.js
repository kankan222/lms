import { queuePullCommandsForAllDevices } from "../modules/iclock/iclock.service.js";
import { startGuardedCronJob } from "./cronRunner.js";

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

  const task = startGuardedCronJob({
    name: "ICLOCK pull worker",
    enabled: true,
    cronExpr,
    runOnStartDelayMs: 0,
    run: async () => {
      const result = await queuePullCommandsForAllDevices();
      if (result.reason === "missing_template") {
        console.log("ICLOCK PULL JOB SKIPPED: set ICLOCK_PULL_COMMAND_TEMPLATE.");
      } else {
        console.log("ICLOCK PULL JOB RESULT:", {
          queuedCount: result.queuedCount,
          skippedCount: result.skippedCount,
        });
      }
    },
  });

  console.log("ICLOCK PULL JOB STARTED:", { cron: cronExpr });
  return task;
}

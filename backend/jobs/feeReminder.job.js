import { runFeeReminder } from "../modules/fees/feeReminder.service.js";
import { envFlag, startGuardedCronJob } from "./cronRunner.js";

export function startFeeReminderJob() {
  const enabled = envFlag("FEE_REMINDER_WORKER_ENABLED", true);
  const cronExpr = process.env.FEE_REMINDER_WORKER_CRON || "0 2 * * *";

  return startGuardedCronJob({
    name: "Fee reminder worker",
    enabled,
    cronExpr,
    run: async () => {
      await runFeeReminder();
    },
  });
}

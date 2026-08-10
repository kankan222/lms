import { dispatchDueSmsJobs } from "../modules/announcements/announcements.service.js";
import { envFlag, startGuardedCronJob } from "./cronRunner.js";

export function startAnnouncementSmsDispatchJob() {
  const enabled = envFlag("ANNOUNCEMENT_SMS_WORKER_ENABLED", true);
  const cronExpr = process.env.ANNOUNCEMENT_SMS_WORKER_CRON || "*/1 * * * *";

  return startGuardedCronJob({
    name: "Announcement SMS dispatch worker",
    enabled,
    cronExpr,
    runOnStartDelayMs: 10000,
    run: async () => {
      const result = await dispatchDueSmsJobs();
      if (result.attempted) {
        console.log(
          `Announcement SMS dispatch processed ${result.attempted} recipient(s): ${result.sent} sent, ${result.failed} failed`
        );
      }
    },
  });
}

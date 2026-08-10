import { publishDueScheduledAnnouncements } from "../modules/announcements/announcements.service.js";
import { envFlag, startGuardedCronJob } from "./cronRunner.js";

export function startAnnouncementPublishJob() {
  const enabled = envFlag("ANNOUNCEMENT_PUBLISH_WORKER_ENABLED", true);
  const cronExpr = process.env.ANNOUNCEMENT_PUBLISH_WORKER_CRON || "*/1 * * * *";

  return startGuardedCronJob({
    name: "Announcement publish worker",
    enabled,
    cronExpr,
    runOnStartDelayMs: 8000,
    run: async () => {
      const result = await publishDueScheduledAnnouncements();
      if (result.checked) {
        console.log(
          `Announcement publish worker processed ${result.checked} scheduled announcement(s): ${result.published} published, ${result.failed} failed`
        );
      }
    },
  });
}

import cron from "node-cron";
import { publishDueScheduledAnnouncements } from "../modules/announcements/announcements.service.js";

let running = false;

export function startAnnouncementPublishJob() {
  const enabled = String(process.env.ANNOUNCEMENT_PUBLISH_WORKER_ENABLED || "true").toLowerCase() === "true";
  if (!enabled) return;

  const cronExpr = process.env.ANNOUNCEMENT_PUBLISH_WORKER_CRON || "*/1 * * * *";

  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await publishDueScheduledAnnouncements();
      if (result.checked) {
        console.log(
          `Announcement publish worker processed ${result.checked} scheduled announcement(s): ${result.published} published, ${result.failed} failed`
        );
      }
    } catch (err) {
      console.error("Announcement publish worker failed:", err);
    } finally {
      running = false;
    }
  };

  setTimeout(run, 8000);
  cron.schedule(cronExpr, run);
}

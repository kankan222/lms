import cron from "node-cron";
import { dispatchDueSmsJobs } from "../modules/announcements/announcements.service.js";

let running = false;

export function startAnnouncementSmsDispatchJob() {
  const enabled = String(process.env.ANNOUNCEMENT_SMS_WORKER_ENABLED || "true").toLowerCase() === "true";
  if (!enabled) return;

  const cronExpr = process.env.ANNOUNCEMENT_SMS_WORKER_CRON || "*/1 * * * *";

  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await dispatchDueSmsJobs();
      if (result.attempted) {
        console.log(
          `Announcement SMS dispatch processed ${result.attempted} recipient(s): ${result.sent} sent, ${result.failed} failed`
        );
      }
    } catch (err) {
      console.error("Announcement SMS dispatch failed:", err);
    } finally {
      running = false;
    }
  };

  setTimeout(run, 10000);
  cron.schedule(cronExpr, run);
}

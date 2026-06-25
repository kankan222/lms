import cron from "node-cron";
import { purgeExpiredAttachments } from "../modules/messaging/messaging.media.service.js";

export function startMessagingCleanupJob() {
  const enabled =
    String(process.env.MESSAGING_CLEANUP_ENABLED || "true").toLowerCase() === "true";
  if (!enabled) return;

  const run = async () => {
    try {
      const result = await purgeExpiredAttachments(200);
      if (result.purged) {
        console.log(`Messaging cleanup purged ${result.purged} attachment(s)`);
      }
    } catch (err) {
      console.error("Messaging cleanup failed:", err);
    }
  };

  setTimeout(run, 5000);
  cron.schedule("30 3 * * *", run);
}

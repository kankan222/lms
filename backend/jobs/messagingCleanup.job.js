import { purgeExpiredAttachments } from "../modules/messaging/messaging.media.service.js";
import { envFlag, startGuardedCronJob } from "./cronRunner.js";

export function startMessagingCleanupJob() {
  const enabled = envFlag("MESSAGING_CLEANUP_ENABLED", true);
  const cronExpr = process.env.MESSAGING_CLEANUP_CRON || "30 3 * * *";

  return startGuardedCronJob({
    name: "Messaging cleanup worker",
    enabled,
    cronExpr,
    runOnStartDelayMs: 5000,
    run: async () => {
      const result = await purgeExpiredAttachments(200);
      if (result.purged) {
        console.log(`Messaging cleanup purged ${result.purged} attachment(s)`);
      }
    },
  });
}

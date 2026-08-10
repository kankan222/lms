import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
dotenv.config();

import { query } from "../core/db/query.js";
import { startAnnouncementPublishJob } from "./announcementPublish.job.js";
import { startAnnouncementSmsDispatchJob } from "./announcementSmsDispatch.job.js";
import { startFeeReminderJob } from "./feeReminder.job.js";
import { startIclockPullJob } from "./iclockPull.job.js";
import { startMessagingCleanupJob } from "./messagingCleanup.job.js";

export function startCronJobs() {
  startMessagingCleanupJob();
  startAnnouncementPublishJob();
  startAnnouncementSmsDispatchJob();
  startFeeReminderJob();
  startIclockPullJob();
}

async function startCronWorker() {
  try {
    await query("SELECT 1");
    console.log("Cron worker DB connected");
    startCronJobs();
    console.log("Cron worker started");
  } catch (err) {
    console.error("Cron worker failed to start:", err);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  startCronWorker();
}

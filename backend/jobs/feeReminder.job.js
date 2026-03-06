import cron from "node-cron";
import { runFeeReminder } from "../modules/fees/feeReminder.service.js";

export function startFeeReminderJob() {

  cron.schedule("0 2 * * *", async () => {

    console.log("Running fee reminder job...");

    try {
      await runFeeReminder();
      console.log("Fee reminder job completed");
    } catch (err) {
      console.error("Fee reminder job failed:", err);
    }

  });

}
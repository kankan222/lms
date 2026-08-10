import dotenv from 'dotenv';
dotenv.config();

import app from "./app.js";
import { query } from "./core/db/query.js";
import { startCronJobs } from "./jobs/cronWorker.js";

const PORT = process.env.PORT || 5000;

function shouldRunCronInApi() {
  return ["1", "true", "yes", "on"].includes(String(process.env.RUN_CRON_IN_API || "").trim().toLowerCase());
}

async function startServer() {
  try {
    await query("SELECT 1");
    console.log("✅ DB Connected");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      if (shouldRunCronInApi()) {
        console.warn("RUN_CRON_IN_API is enabled; cron jobs will share the API process event loop.");
        startCronJobs();
      } else {
        console.log("Cron jobs are disabled in API process. Start `npm run worker:cron` separately.");
      }
    });
  } catch (err) {
    console.error("DB Connection Failed:", err);
    process.exit(1);
  }
}

startServer();

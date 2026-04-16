import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { startMssqlTeacherAttendanceSyncAgent } from "./mssql-teacher-attendance-sync-agent.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "..", ".env.development"),
  override: false,
});

await startMssqlTeacherAttendanceSyncAgent();


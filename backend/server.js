import dotenv from 'dotenv';
dotenv.config();

import app from "./app.js";
import { query } from "./core/db/query.js";

const PORT = process.env.PORT || 5000;


async function startServer() {
  try {
    await query("SELECT 1");
    console.log("✅ DB Connected");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("DB Connection Failed:", err);
    process.exit(1);
  }
}

startServer();

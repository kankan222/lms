import { execute, query } from "../../core/db/query.js";

let tableReadyPromise = null;

export function ensureContactSubmissionsTable() {
  if (!tableReadyPromise) {
    tableReadyPromise = execute(
      `CREATE TABLE IF NOT EXISTS website_contact_submissions (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(150) NOT NULL,
        contact_number VARCHAR(20) NOT NULL,
        message TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ).catch((err) => {
      tableReadyPromise = null;
      throw err;
    });
  }

  return tableReadyPromise;
}

export function createContactSubmission(data) {
  return execute(
    `INSERT INTO website_contact_submissions (name, contact_number, message)
     VALUES (?, ?, ?)`,
    [data.name, data.contact_number, data.message ?? null]
  );
}

export function listContactSubmissions(filters = {}) {
  const parsedLimit = Number(filters.limit);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 500) : 100;

  return query(
    `SELECT id, name, contact_number, message, created_at
     FROM website_contact_submissions
     ORDER BY created_at DESC, id DESC
     LIMIT ${limit}`
  );
}

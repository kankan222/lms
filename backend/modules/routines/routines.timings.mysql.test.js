import test from "node:test";
import assert from "node:assert/strict";
import { dbConfig } from "../../config/database.js";
import { pool } from "../../database/pool.js";
import { previewClassRoutineTimings, applyClassRoutineTimings } from "./routines.service.js";

// Opt-in SQL integration check. Every table used by the operation is shadowed
// on one dedicated connection by a temporary table; real records are untouched.
test("MySQL timing update preserves content, audits changes, and rolls back every write on failure", {
  skip: process.env.RUN_ROUTINE_TIMING_MYSQL_TEST !== "1",
}, async (t) => {
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(dbConfig.host), "Only a local MySQL instance may run this test");
  const conn = await pool.getConnection();
  const originalGetConnection = pool.getConnection;
  const originalRelease = conn.release;
  const originalExecute = conn.execute;
  pool.getConnection = async () => conn;
  conn.release = () => {};
  t.after(async () => {
    pool.getConnection = originalGetConnection;
    conn.release = originalRelease;
    conn.execute = originalExecute;
    conn.release();
    await pool.end();
  });
  const definitions = [
    "classes (id INT PRIMARY KEY, name VARCHAR(100))",
    "sections (id INT PRIMARY KEY, name VARCHAR(100))",
    "academic_sessions (id INT PRIMARY KEY, name VARCHAR(100))",
    "subjects (id INT PRIMARY KEY, name VARCHAR(100))",
    "teachers (id BIGINT PRIMARY KEY, name VARCHAR(100))",
    `routine_time_slot_templates (id BIGINT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(160), scope_level VARCHAR(40),
      session_id INT NULL, class_id INT NULL, section_id INT NULL, medium VARCHAR(40) NULL, stream_id INT NULL,
      description TEXT, is_active TINYINT, created_by BIGINT NULL)`,
    `routine_time_slots (id BIGINT PRIMARY KEY AUTO_INCREMENT, template_id BIGINT, weekday TINYINT NULL,
      period_number INT, label VARCHAR(80), start_time TIME, end_time TIME, default_entry_type VARCHAR(40), is_break TINYINT, sort_order INT)`,
    `class_routine_versions (id BIGINT PRIMARY KEY, session_id INT, class_id INT, section_id INT NULL, medium VARCHAR(40),
      stream_id INT NULL, layout_mode VARCHAR(40), status VARCHAR(40), time_slot_template_id BIGINT, updated_by BIGINT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
    `class_routine_entries (id BIGINT PRIMARY KEY, routine_version_id BIGINT, weekday TINYINT, period_number INT,
      start_time TIME, end_time TIME, time_slot_id BIGINT NULL, entry_type VARCHAR(40), subject_id INT NULL,
      title VARCHAR(160) NULL, applies_medium VARCHAR(40), combined_group_key VARCHAR(120))`,
    "class_routine_entry_teachers (id BIGINT PRIMARY KEY, routine_entry_id BIGINT, teacher_id BIGINT, teacher_role VARCHAR(40))",
    "class_routine_entry_sections (routine_entry_id BIGINT, section_id INT)",
    `class_routine_timing_audits (id BIGINT PRIMARY KEY AUTO_INCREMENT, changed_by BIGINT NULL, scope VARCHAR(40),
      source_template_id BIGINT NULL, target_template_id BIGINT NULL, details JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  ];
  for (const definition of definitions) await conn.query(`CREATE TEMPORARY TABLE ${definition} ENGINE=InnoDB`);
  await conn.query("INSERT INTO classes VALUES (1, 'HS I'), (2, 'HS II')");
  await conn.query("INSERT INTO sections VALUES (1, 'Science')");
  await conn.query("INSERT INTO academic_sessions VALUES (1, '2026')");
  await conn.query("INSERT INTO subjects VALUES (1, 'Biology'), (2, 'English')");
  await conn.query("INSERT INTO teachers VALUES (1, 'Teacher A'), (2, 'Teacher B')");
  await conn.query("INSERT INTO routine_time_slot_templates (id, name, scope_level, is_active) VALUES (1, 'HS timing', 'higher_secondary', 1)");
  await conn.query(`INSERT INTO routine_time_slots VALUES
    (1, 1, NULL, 1, 'Period 1', '09:00:00', '09:40:00', 'subject', 0, 0),
    (2, 1, NULL, 2, 'Break', '09:40:00', '10:00:00', 'break', 1, 1)`);
  await conn.query(`INSERT INTO class_routine_versions
    (id, session_id, class_id, section_id, medium, layout_mode, status, time_slot_template_id) VALUES
    (1, 1, 1, NULL, NULL, 'packed_hs', 'published', 1),
    (2, 1, 2, 1, 'English', 'standard', 'published', 1)`);
  await conn.query(`INSERT INTO class_routine_entries VALUES
    (11, 1, 1, 1, '08:00:00', '08:40:00', NULL, 'subject', 1, 'Botany', 'English', 'combined'),
    (12, 1, 1, 1, '08:00:00', '08:40:00', NULL, 'subject', 2, NULL, 'Assamese', NULL),
    (13, 1, 6, 1, '08:00:00', '08:40:00', NULL, 'subject', 1, 'Zoology', 'English', NULL),
    (21, 2, 1, 1, '10:00:00', '10:40:00', NULL, 'subject', 1, NULL, 'English', NULL)`);
  await conn.query(`INSERT INTO class_routine_entry_teachers VALUES (1, 11, 1, 'primary'), (2, 12, 2, 'primary'), (3, 13, 1, 'primary'), (4, 21, 1, 'primary')`);
  await conn.query("INSERT INTO class_routine_entry_sections VALUES (11, 1), (12, 1)");
  const [teachersBefore] = await conn.query("SELECT * FROM class_routine_entry_teachers ORDER BY id");
  const [sectionsBefore] = await conn.query("SELECT * FROM class_routine_entry_sections ORDER BY routine_entry_id");
  const body = { routine_id: 1, time_slot_template_id: 1, scope: "routine" };
  let preview = await previewClassRoutineTimings(body);
  assert.equal(preview.can_apply, true);
  const applied = await applyClassRoutineTimings({ ...body, preview_token: preview.preview_token }, 1);
  assert.equal(applied.changed_count, 3);
  const [rows] = await conn.query("SELECT * FROM class_routine_entries WHERE routine_version_id = 1 ORDER BY id");
  assert.ok(rows.every((entry) => entry.start_time === "09:00:00" && entry.time_slot_id === 1));
  assert.deepEqual(rows.map((entry) => [entry.id, entry.subject_id, entry.title, entry.applies_medium]), [
    [11, 1, "Botany", "English"], [12, 2, null, "Assamese"], [13, 1, "Zoology", "English"],
  ]);
  assert.deepEqual((await conn.query("SELECT * FROM class_routine_entry_teachers ORDER BY id"))[0], teachersBefore);
  assert.deepEqual((await conn.query("SELECT * FROM class_routine_entry_sections ORDER BY routine_entry_id"))[0], sectionsBefore);
  assert.equal((await conn.query("SELECT status FROM class_routine_versions WHERE id = 1"))[0][0].status, "published");
  let [audits] = await conn.query("SELECT * FROM class_routine_timing_audits");
  assert.equal(audits.length, 1);
  const details = typeof audits[0].details === "string" ? JSON.parse(audits[0].details) : audits[0].details;
  assert.equal(details.changes[0].old_start_time, "08:00:00");

  // Reuse the actual SQL path for a custom template copy and a forced audit failure.
  const customBody = { ...body, slots: preview.slots.map((slot) => ({ ...slot, start_time: slot.period_number === 1 ? "09:05:00" : slot.start_time })) };
  preview = await previewClassRoutineTimings(customBody);
  assert.equal(preview.custom_timings, true);
  conn.execute = async function (sql, params) {
    if (sql.includes("INSERT INTO class_routine_timing_audits")) throw new Error("forced audit failure");
    return originalExecute.call(this, sql, params);
  };
  await assert.rejects(applyClassRoutineTimings({ ...customBody, preview_token: preview.preview_token }, 1), /forced audit failure/);
  assert.equal((await conn.query("SELECT start_time FROM class_routine_entries WHERE id = 11"))[0][0].start_time, "09:00:00");
  assert.equal((await conn.query("SELECT COUNT(*) AS count FROM routine_time_slot_templates"))[0][0].count, 1);
  assert.equal((await conn.query("SELECT COUNT(*) AS count FROM class_routine_timing_audits"))[0][0].count, 1);
  conn.execute = originalExecute;
  const customApplied = await applyClassRoutineTimings({ ...customBody, preview_token: preview.preview_token }, 1);
  assert.notEqual(customApplied.time_slot_template_id, 1);
  assert.equal((await conn.query("SELECT COUNT(*) AS count FROM routine_time_slots WHERE template_id = ?", [customApplied.time_slot_template_id]))[0][0].count, 2);
  assert.equal((await conn.query("SELECT start_time FROM class_routine_entries WHERE id = 11"))[0][0].start_time, "09:05:00");
});

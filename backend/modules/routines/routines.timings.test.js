import test from "node:test";
import assert from "node:assert/strict";
import { buildClassRoutineTimingPlan } from "./routines.timings.js";
import { previewClassRoutineTimings, applyClassRoutineTimings } from "./routines.service.js";
import { pool } from "../../database/pool.js";

function fixture() {
  return {
    templates: [{ id: 10, name: "School", scope_level: "school", session_id: null, class_id: null, section_id: null, medium: null, stream_id: null }],
    slots: [
      { id: 101, template_id: 10, weekday: null, period_number: 1, label: "Period 1", start_time: "09:00:00", end_time: "09:40:00", default_entry_type: "subject", is_break: 0, sort_order: 0 },
      { id: 102, template_id: 10, weekday: null, period_number: 2, label: "Break", start_time: "09:40:00", end_time: "10:00:00", default_entry_type: "break", is_break: 1, sort_order: 1 },
    ],
    routines: [
      { id: 1, session_id: 1, class_id: 1, section_id: 1, medium: "English", time_slot_template_id: 10, status: "published", class_name: "Class I", section_name: "A", session_name: "2026", layout_mode: "standard" },
      { id: 2, session_id: 1, class_id: 2, section_id: 2, medium: "English", time_slot_template_id: 10, status: "published", class_name: "Class II", section_name: "A", session_name: "2026", layout_mode: "standard" },
    ],
    entries: [
      { id: 11, routine_version_id: 1, weekday: 1, period_number: 1, start_time: "08:00:00", end_time: "08:40:00", entry_type: "subject", subject_id: 3 },
      { id: 12, routine_version_id: 1, weekday: 6, period_number: 1, start_time: "08:00:00", end_time: "08:40:00", entry_type: "subject", subject_id: 3 },
      { id: 21, routine_version_id: 2, weekday: 1, period_number: 1, start_time: "10:00:00", end_time: "10:40:00", entry_type: "subject", subject_id: 4 },
    ],
    teachers: [
      { id: 1, routine_entry_id: 11, teacher_id: 5, teacher_name: "Teacher A" },
      { id: 2, routine_entry_id: 12, teacher_id: 5, teacher_name: "Teacher A" },
      { id: 3, routine_entry_id: 21, teacher_id: 6, teacher_name: "Teacher B" },
    ],
  };
}
const request = { routine_id: 1, time_slot_template_id: 10, scope: "routine" };

test("repair all weekdays without changing subjects, teacher splits, HS applicability, or source data", () => {
  const snapshot = fixture();
  snapshot.routines[0].layout_mode = "packed_hs";
  snapshot.entries.push({ ...snapshot.entries[0], id: 13, subject_id: 7, applies_medium: "Assamese", combined_group_key: "combined" });
  snapshot.teachers.push({ id: 4, routine_entry_id: 13, teacher_id: 7, teacher_name: "Teacher C" });
  const before = structuredClone(snapshot);
  const plan = buildClassRoutineTimingPlan(snapshot, request);
  assert.equal(plan.can_apply, true);
  assert.equal(plan.changed_count, 3);
  assert.deepEqual(plan.changes.map((item) => item.entry_id), [11, 12, 13]);
  assert.ok(plan.changes.every((item) => item.start_time === "09:00:00"));
  assert.deepEqual(snapshot, before);
});

test("weekday-specific timing overrides the every-day slot", () => {
  const snapshot = fixture();
  snapshot.slots.push({ ...snapshot.slots[0], id: 103, weekday: 6, start_time: "08:30:00", end_time: "09:10:00" });
  const plan = buildClassRoutineTimingPlan(snapshot, request);
  assert.equal(plan.can_apply, true);
  assert.equal(plan.changes.find((item) => item.entry_id === 12).start_time, "08:30:00");
});

test("all-template update includes both affected routines", () => {
  const plan = buildClassRoutineTimingPlan(fixture(), { ...request, scope: "template" });
  assert.equal(plan.routines.length, 2);
  assert.equal(plan.changed_count, 3);
});

test("detect conflict between two routines in the same bulk update", () => {
  const snapshot = fixture();
  snapshot.teachers[2].teacher_id = 5;
  const plan = buildClassRoutineTimingPlan(snapshot, { ...request, scope: "template" });
  assert.equal(plan.can_apply, false);
  assert.equal(plan.conflicts.length, 1);
  assert.match(plan.conflicts[0], /Class I.*overlaps Class II/);
});

test("check unchanged published routines, but allow adjacent times and shared combined groups", () => {
  const snapshot = fixture();
  snapshot.teachers[2].teacher_id = 5;
  snapshot.entries[2].start_time = "09:20:00";
  assert.equal(buildClassRoutineTimingPlan(snapshot, request).can_apply, false);
  snapshot.entries[2].start_time = "09:40:00";
  assert.equal(buildClassRoutineTimingPlan(snapshot, request).can_apply, true);
  snapshot.entries[2].start_time = "09:20:00";
  snapshot.entries[0].combined_group_key = "shared";
  snapshot.entries[2].combined_group_key = "shared";
  assert.equal(buildClassRoutineTimingPlan(snapshot, request).can_apply, true);
});

test("block overlapping entries within a single routine", () => {
  const snapshot = fixture();
  snapshot.entries.push({ ...snapshot.entries[0], id: 14 });
  snapshot.teachers.push({ id: 4, routine_entry_id: 14, teacher_id: 5, teacher_name: "Teacher A" });
  assert.equal(buildClassRoutineTimingPlan(snapshot, request).can_apply, false);
});

test("block missing mappings and changed break types instead of dropping entries", () => {
  const snapshot = fixture();
  snapshot.entries[0].period_number = 3;
  let plan = buildClassRoutineTimingPlan(snapshot, request);
  assert.equal(plan.can_apply, false);
  assert.match(plan.errors.join(" "), /no matching template slot/);
  snapshot.entries[0].period_number = 2;
  plan = buildClassRoutineTimingPlan(snapshot, request);
  assert.match(plan.errors.join(" "), /break\/class type changed/);
});

test("validate clocks, duplicate mapping, and overlapping periods", () => {
  const snapshot = fixture();
  const slots = structuredClone(snapshot.slots);
  slots[0].start_time = "25:00";
  assert.throws(() => buildClassRoutineTimingPlan(snapshot, { ...request, slots }), /valid HH:mm/);
  assert.throws(() => buildClassRoutineTimingPlan(snapshot, { ...request, slots: [snapshot.slots[0], snapshot.slots[0]] }), /exactly once/);
  slots[0].start_time = "09:30";
  slots[0].end_time = "09:50";
  const plan = buildClassRoutineTimingPlan(snapshot, { ...request, slots });
  assert.equal(plan.can_apply, false);
  assert.match(plan.errors.join(" "), /periods 1 and 2 overlap/);
});

test("custom timing changes create an override plan; already aligned entries are a no-op", () => {
  const snapshot = fixture();
  const slots = structuredClone(snapshot.slots);
  slots[0].start_time = "09:05";
  const plan = buildClassRoutineTimingPlan(snapshot, { ...request, slots });
  assert.equal(plan.custom_timings, true);
  snapshot.entries.filter((item) => item.routine_version_id === 1).forEach((item) => { item.start_time = "09:00:00"; item.end_time = "09:40:00"; });
  assert.equal(buildClassRoutineTimingPlan(snapshot, request).can_apply, false);
});

test("preview tokens change when a teacher assignment or template changes", () => {
  const snapshot = fixture();
  const before = buildClassRoutineTimingPlan(snapshot, request).preview_token;
  snapshot.teachers[0].teacher_id = 99;
  assert.notEqual(buildClassRoutineTimingPlan(snapshot, request).preview_token, before);
  snapshot.slots[0].start_time = "09:10:00";
  assert.notEqual(buildClassRoutineTimingPlan(snapshot, request).preview_token, before);
});

// Exercise real service/repository transaction orchestration using an isolated
// connection double. No local or production database is contacted by these tests.
test("apply is atomic, audited, and rejects stale/conflicting previews", async (t) => {
  let snapshot = fixture();
  let failAudit = false;
  const events = [];
  const original = pool.getConnection;
  pool.getConnection = async () => ({
    beginTransaction: async () => { events.push("begin"); },
    commit: async () => { events.push("commit"); },
    rollback: async () => { events.push("rollback"); },
    release: () => { events.push("release"); },
    query: async (sql) => {
      if (sql.includes("SELECT * FROM routine_time_slot_templates")) return [structuredClone(snapshot.templates)];
      if (sql.includes("SELECT * FROM routine_time_slots")) return [structuredClone(snapshot.slots)];
      if (sql.includes("SELECT v.*")) return [structuredClone(snapshot.routines)];
      if (sql.includes("SELECT e.*")) return [structuredClone(snapshot.entries)];
      if (sql.includes("SELECT et.*")) return [structuredClone(snapshot.teachers)];
      throw new Error("Unexpected snapshot query");
    },
    execute: async (sql, params) => {
      events.push({ sql, params });
      if (failAudit && sql.includes("INSERT INTO class_routine_timing_audits")) throw new Error("audit write failed");
      return [{ insertId: 900, affectedRows: 1 }];
    },
  });
  t.after(() => { pool.getConnection = original; });
  const preview = await previewClassRoutineTimings(request);
  events.length = 0;
  const result = await applyClassRoutineTimings({ ...request, preview_token: preview.preview_token }, 42);
  assert.equal(result.changed_count, 2);
  const writes = events.filter((item) => typeof item === "object");
  assert.equal(writes.filter((item) => item.sql.includes("UPDATE class_routine_entries")).length, 2);
  assert.ok(writes.every((item) => !/DELETE FROM|INSERT INTO class_routine_entries|UPDATE class_routine_entry_teachers/.test(item.sql)));
  assert.equal(writes.find((item) => item.sql.includes("timing_audits")).params[0], 42);
  assert.deepEqual(events.slice(-2), ["commit", "release"]);

  events.length = 0;
  snapshot.entries[0].start_time = "08:10:00";
  await assert.rejects(applyClassRoutineTimings({ ...request, preview_token: preview.preview_token }, 42), /changed since your preview/);
  assert.deepEqual(events, ["begin", "rollback", "release"]);

  events.length = 0;
  snapshot = fixture();
  failAudit = true;
  await assert.rejects(applyClassRoutineTimings({ ...request, preview_token: preview.preview_token }, 42), /audit write failed/);
  assert.ok(!events.includes("commit"));
  assert.deepEqual(events.slice(-2), ["rollback", "release"]);

  failAudit = false;
  snapshot.teachers[2].teacher_id = 5;
  const bulkRequest = { ...request, scope: "template" };
  const conflictPreview = await previewClassRoutineTimings(bulkRequest);
  events.length = 0;
  await assert.rejects(applyClassRoutineTimings({ ...bulkRequest, preview_token: conflictPreview.preview_token }, 42), /overlaps/);
  assert.deepEqual(events, ["begin", "rollback", "release"]);
});

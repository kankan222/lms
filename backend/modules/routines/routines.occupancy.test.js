import test from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../database/pool.js";
import { getClassRoutine, getClassRoutineBoard } from "./routines.service.js";

function fixture() {
  return {
    routines: [1, 2].map((id) => ({ id, session_id: 1, class_id: id, section_id: id, class_scope: "school",
      class_name: `Class ${id}`, section_name: "A", medium: "English", time_slot_template_id: 10, layout_mode: "standard", status: "published" })),
    entries: [{ id: 11, routine_version_id: 1, weekday: 1, period_number: 1, start_time: "09:25:00", end_time: "10:00:00",
      entry_type: "subject", subject_id: 8, subject_name: "Science", teacher_ids: "7", teacher_names: "Example Teacher", teacher_assignments: "7:primary" }],
    slots: [
      { time_slot_id: 101, template_id: 10, weekday: null, period_number: 1, start_time: "09:00:00", end_time: "09:40:00", label: "Period 1", default_entry_type: "subject" },
      { time_slot_id: 102, template_id: 10, weekday: null, period_number: 2, start_time: "09:40:00", end_time: "10:00:00", label: "Break", default_entry_type: "break", is_break: 1 },
      { time_slot_id: 103, template_id: 10, weekday: null, period_number: 3, start_time: "10:00:00", end_time: "10:40:00", label: "Period 2", default_entry_type: "subject" },
    ],
  };
}

// Exercise the public detail/board services and their real repository mapping.
// Only SQL reads are doubled; no local or production database is contacted.
test("class routine occupancy after template timing changes", async (t) => {
  let data;
  const queries = [];
  const originalExecute = pool.execute;
  pool.execute = async (sql, params) => {
    queries.push(sql);
    assert.match(sql, /^\s*SELECT\b/i, "Routine reads must never repair or rewrite saved records");
    if (sql.includes("information_schema.COLUMNS")) return [[{ has_sections: 1, has_medium: 1, count: 1 }]];
    if (sql.includes("id AS time_slot_id")) return [structuredClone(data.slots)];
    if (sql.includes("v.id AS routine_version_id")) {
      return [data.entries.map((entry) => {
        const routine = data.routines.find((item) => item.id === entry.routine_version_id);
        return { ...routine, ...entry, routine_version_id: routine.id, entry_id: entry.id, entry_title: entry.title };
      })];
    }
    if (sql.includes("WHERE v.id = ?")) return [structuredClone(data.routines.filter((item) => item.id === params[0]))];
    if (sql.includes("WHERE e.routine_version_id = ?")) return [structuredClone(data.entries.filter((item) => item.routine_version_id === params[0]))];
    throw new Error("Unexpected routine query");
  };
  t.after(() => { pool.execute = originalExecute; });

  async function detailAndBoard(id = 1, weekday = 1) {
    const detail = await getClassRoutine(id);
    const board = await getClassRoutineBoard();
    const card = board.scopes.flatMap((scope) => scope.weekdays).find((day) => day.weekday === weekday)
      ?.routines.find((routine) => routine.routine_version_id === id);
    return [detail.entries.filter((entry) => Number(entry.weekday) === weekday), card?.entries || []];
  }

  await t.test("timing mismatch keeps the Science assignment without generating Free in the same period", async () => {
    data = fixture();
    for (const entries of await detailAndBoard()) {
      const slot = entries.filter((entry) => Number(entry.period_number) === 1);
      assert.equal(slot.length, 1);
      assert.equal(slot[0].subject_name, "Science");
      assert.deepEqual(slot[0].teacher_ids, [7]);
      assert.equal(slot[0].start_time, "09:25:00", "Saved timing overrides remain intact");
    }
  });

  await t.test("genuinely missing slots still produce one Break and one Free", async () => {
    data = fixture();
    for (const entries of await detailAndBoard()) {
      assert.equal(entries.filter((entry) => entry.entry_type === "break").length, 1);
      assert.equal(entries.filter((entry) => entry.entry_type === "free").length, 1);
      assert.equal(entries.find((entry) => entry.entry_type === "free").period_number, 3);
    }
  });

  await t.test("packed HS parallel subjects and applicability stay intact", async () => {
    data = fixture();
    data.routines[0].layout_mode = "packed_hs";
    data.entries[0].applies_medium = "English";
    data.entries[0].applies_section_ids = "1,2";
    data.entries.push({ ...data.entries[0], id: 12, subject_id: 9, subject_name: "Accountancy", applies_medium: "Assamese" });
    for (const entries of await detailAndBoard()) {
      const slot = entries.filter((entry) => Number(entry.period_number) === 1);
      assert.equal(slot.length, 2);
      assert.ok(slot.every((entry) => entry.entry_type === "subject"));
      assert.deepEqual(slot.map((entry) => entry.applies_medium).sort(), ["Assamese", "English"]);
      assert.deepEqual(slot[0].applies_section_ids, [1, 2]);
    }
  });

  await t.test("occupancy is isolated by routine and weekday", async () => {
    data = fixture();
    data.entries.push({ ...data.entries[0], id: 21, routine_version_id: 2, period_number: 3 });
    data.entries.push({ ...data.entries[0], id: 12, weekday: 2, period_number: 3 });
    for (const entries of await detailAndBoard(2)) {
      assert.equal(entries.find((entry) => Number(entry.period_number) === 1).entry_type, "free");
      assert.equal(entries.filter((entry) => Number(entry.period_number) === 3).length, 1);
    }
    for (const entries of await detailAndBoard(1, 2)) {
      assert.equal(entries.find((entry) => Number(entry.period_number) === 1).entry_type, "free");
    }
  });

  await t.test("weekday-specific times override everyday slots for generated Free/Break rows", async () => {
    data = fixture();
    data.slots.push({ ...data.slots[2], time_slot_id: 104, weekday: 1, start_time: "11:00:00", end_time: "11:40:00" });
    for (const entries of await detailAndBoard()) {
      const slot = entries.filter((entry) => Number(entry.period_number) === 3);
      assert.equal(slot.length, 1);
      assert.equal(slot[0].start_time, "11:00:00");
    }
  });

  await t.test("an explicit saved Free entry remains intact even if its time differs", async () => {
    data = fixture();
    data.entries[0] = { ...data.entries[0], entry_type: "free", subject_id: null, subject_name: null, teacher_ids: null, teacher_names: null, teacher_assignments: null };
    for (const entries of await detailAndBoard()) {
      const slot = entries.filter((entry) => Number(entry.period_number) === 1);
      assert.equal(slot.length, 1);
      assert.equal(slot[0].id, 11);
      assert.equal(slot[0].entry_type, "free");
    }
    assert.ok(queries.length > 0);
  });
});

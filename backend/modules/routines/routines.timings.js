import { createHash } from "node:crypto";
import AppError from "../../core/errors/AppError.js";

const DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function positiveId(value, name) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new AppError(`${name} is required`, 400);
  return id;
}

function clock(value) {
  const match = String(value || "").match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) throw new AppError("Timings must use valid HH:mm or HH:mm:ss values", 400);
  return `${match[1]}:${match[2]}:${match[3] || "00"}`;
}

function scopeKey(routine) {
  return [routine.session_id, routine.class_id, routine.section_id || 0, routine.medium || "", routine.stream_id || 0, routine.layout_mode || "standard"].join("|");
}

function routineLabel(routine) {
  return [routine.class_name, routine.section_name, routine.medium, routine.session_name].filter(Boolean).join(" / ");
}

function slotFor(slots, entry) {
  const matches = slots.filter((slot) => Number(slot.period_number) === Number(entry.period_number));
  return matches.find((slot) => Number(slot.weekday) === Number(entry.weekday)) || matches.find((slot) => !slot.weekday);
}

export function buildClassRoutineTimingPlan(snapshot, body) {
  const templateId = positiveId(body.time_slot_template_id, "Time-slot template");
  const template = snapshot.templates.find((item) => Number(item.id) === templateId);
  if (!template) throw new AppError("Time-slot template not found", 404);
  const scope = body.scope || "routine";
  if (!["routine", "template"].includes(scope)) throw new AppError("Choose this routine or all routines using the template", 400);
  const source = body.routine_id ? snapshot.routines.find((item) => Number(item.id) === positiveId(body.routine_id, "Routine")) : null;
  if (body.routine_id && !source) throw new AppError("Only draft or published routines can change timings", 404);
  const sourceTemplateId = scope === "template"
    ? positiveId(source?.time_slot_template_id || body.source_template_id, "Source template")
    : null;
  if (scope === "routine" && !source) throw new AppError("Select a routine", 400);
  const targets = scope === "routine" ? [source] : snapshot.routines.filter((item) => Number(item.time_slot_template_id) === sourceTemplateId);
  if (!targets.length) throw new AppError("No draft or published routines use this template", 400);

  const storedSlots = snapshot.slots.filter((slot) => Number(slot.template_id) === templateId);
  const inputSlots = body.slots === undefined ? storedSlots : body.slots;
  if (!Array.isArray(inputSlots) || !inputSlots.length) throw new AppError("At least one time slot is required", 400);
  const slots = inputSlots.map((slot, index) => {
    const weekday = slot.weekday === "" || slot.weekday == null ? null : Number(slot.weekday);
    if (weekday !== null && (!Number.isInteger(weekday) || weekday < 1 || weekday > 7)) throw new AppError("Invalid slot weekday", 400);
    const period = positiveId(slot.period_number, "Period number");
    const start = clock(slot.start_time);
    const end = clock(slot.end_time);
    if (start >= end) throw new AppError(`Period ${period}: start must be before end`, 400);
    const stored = storedSlots.find((item) => Number(item.period_number) === period && Number(item.weekday || 0) === Number(weekday || 0));
    if (!stored) throw new AppError("Adding or removing periods requires editing the time-slot template first", 400);
    return { ...stored, weekday, start_time: start, end_time: end, sort_order: stored.sort_order ?? index };
  });
  if (slots.length !== storedSlots.length || new Set(slots.map((slot) => `${slot.weekday || 0}|${slot.period_number}`)).size !== slots.length) {
    throw new AppError("Keep each template period exactly once; resolve added or removed periods in Time Slots first", 400);
  }
  const errors = [];
  for (let day = 1; day <= 7; day += 1) {
    const daySlots = [...new Set(slots.map((slot) => Number(slot.period_number)))].map((period) => slotFor(slots, { weekday: day, period_number: period })).filter(Boolean);
    for (let i = 0; i < daySlots.length; i += 1) {
      for (let j = i + 1; j < daySlots.length; j += 1) {
        const a = daySlots[i], b = daySlots[j];
        if (a.start_time < b.end_time && a.end_time > b.start_time) errors.push(`${DAYS[day]}: periods ${a.period_number} and ${b.period_number} overlap.`);
      }
    }
  }
  const targetIds = new Set(targets.map((item) => Number(item.id)));
  const routinesById = new Map(snapshot.routines.map((item) => [Number(item.id), item]));
  const changes = [];
  const proposedEntries = snapshot.entries.map((entry) => {
    if (!targetIds.has(Number(entry.routine_version_id))) return entry;
    const routine = routinesById.get(Number(entry.routine_version_id));
    const slot = slotFor(slots, entry);
    if (!slot) {
      errors.push(`${routineLabel(routine)}, ${DAYS[entry.weekday]} period ${entry.period_number}: no matching template slot. Resolve the period mapping in Time Slots first.`);
      return entry;
    }
    const slotIsBreak = slot.default_entry_type === "break" || Boolean(Number(slot.is_break));
    if ((entry.entry_type === "break") !== slotIsBreak) {
      errors.push(`${routineLabel(routine)}, ${DAYS[entry.weekday]} period ${entry.period_number}: break/class type changed. Resolve the period mapping first.`);
      return entry;
    }
    changes.push({
      entry_id: Number(entry.id), routine_id: Number(routine.id), routine_label: routineLabel(routine),
      weekday: Number(entry.weekday), weekday_label: DAYS[entry.weekday], period_number: Number(entry.period_number),
      title: entry.title || entry.subject_name || entry.entry_type,
      old_start_time: entry.start_time, old_end_time: entry.end_time,
      start_time: slot.start_time, end_time: slot.end_time, time_slot_id: Number(slot.id),
      changed: entry.start_time !== slot.start_time || entry.end_time !== slot.end_time,
    });
    return { ...entry, start_time: slot.start_time, end_time: slot.end_time };
  });

  // Validate the complete proposed schedule, including conflicts between two changed routines.
  const assignments = new Map();
  for (const teacher of snapshot.teachers) {
    const list = assignments.get(Number(teacher.routine_entry_id)) || [];
    list.push(teacher);
    assignments.set(Number(teacher.routine_entry_id), list);
  }
  const teacherDays = new Map();
  for (const entry of proposedEntries) {
    const routine = routinesById.get(Number(entry.routine_version_id));
    if (!targetIds.has(Number(routine.id)) && routine.status !== "published") continue;
    for (const teacher of assignments.get(Number(entry.id)) || []) {
      const key = `${routine.session_id}|${entry.weekday}|${teacher.teacher_id}`;
      const list = teacherDays.get(key) || [];
      if (!list.some((item) => Number(item.entry.id) === Number(entry.id))) list.push({ entry, routine, teacher });
      teacherDays.set(key, list);
    }
  }
  const conflicts = [];
  for (const list of teacherDays.values()) {
    list.sort((a, b) => a.entry.start_time.localeCompare(b.entry.start_time));
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length && list[j].entry.start_time < list[i].entry.end_time; j += 1) {
        const a = list[i], b = list[j];
        if (!targetIds.has(Number(a.routine.id)) && !targetIds.has(Number(b.routine.id))) continue;
        // A competing version of the same scope is not a concurrent class.
        if (a.routine.id !== b.routine.id && scopeKey(a.routine) === scopeKey(b.routine)) continue;
        if (a.entry.combined_group_key && a.entry.combined_group_key === b.entry.combined_group_key) continue;
        conflicts.push(`${a.teacher.teacher_name}: ${DAYS[a.entry.weekday]} ${routineLabel(a.routine)} period ${a.entry.period_number} (${a.entry.start_time.slice(0, 5)}–${a.entry.end_time.slice(0, 5)}) overlaps ${routineLabel(b.routine)} period ${b.entry.period_number} (${b.entry.start_time.slice(0, 5)}–${b.entry.end_time.slice(0, 5)}).`);
      }
    }
  }
  const customTimings = slots.some((slot) => {
    const stored = storedSlots.find((item) => Number(item.id) === Number(slot.id));
    return stored.start_time !== slot.start_time || stored.end_time !== slot.end_time;
  });
  const result = {
    scope, source_template_id: sourceTemplateId, time_slot_template_id: templateId,
    template_name: template.name, custom_timings: customTimings,
    routines: targets.map((item) => ({ id: Number(item.id), label: routineLabel(item), status: item.status, old_template_id: item.time_slot_template_id })),
    changes, changed_count: changes.filter((item) => item.changed).length,
    errors: [...new Set(errors)], conflicts: [...new Set(conflicts)],
  };
  const hasChanges = result.changed_count > 0 || customTimings || targets.some((item) => Number(item.time_slot_template_id) !== templateId);
  return {
    ...result, slots, can_apply: !errors.length && !conflicts.length && hasChanges,
    preview_token: createHash("sha256").update(JSON.stringify({ snapshot, result, slots })).digest("hex"),
  };
}

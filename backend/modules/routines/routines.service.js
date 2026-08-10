import AppError from "../../core/errors/AppError.js";
import { inflateRawSync } from "node:zlib";
import * as repo from "./routines.repository.js";
import { buildClassRoutinePdf, buildExamRoutinePdf } from "./routines.pdf.service.js";
import { buildClassRoutineXlsx, classRoutineXlsxFileName } from "./routines.excel.service.js";

const ROUTINE_ENTRY_TYPES = new Set([
  "subject",
  "break",
  "activity",
  "assembly",
  "games",
  "library",
  "remedial",
  "free",
  "custom",
]);
const EXAM_ENTRY_TYPES = new Set(["subject", "practical", "activity", "custom"]);
const ROUTINE_BOARD_STATUSES = new Set(["current", "published", "draft", "archived", "all"]);
const CLASS_ROUTINE_LAYOUT_MODES = new Set(["standard", "packed_hs"]);
const WEEKDAY_LABELS = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

function intValue(value, fieldName, { required = true } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new AppError(`${fieldName} is required`, 400);
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(`${fieldName} must be a positive integer`, 400);
  }
  return parsed;
}

function optionalString(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeClassScope(value, { required = false } = {}) {
  const raw = optionalString(value);
  if (!raw) {
    if (required) throw new AppError("class_scope is required", 400);
    return null;
  }
  const normalized = raw.toLowerCase();
  if (normalized === "higher_secondary" || normalized === "higher-secondary" || normalized === "college") return "hs";
  if (normalized === "hs" || normalized === "school") return normalized;
  throw new AppError("Invalid class_scope. Allowed: school, hs", 400);
}

function classScopeLabel(value) {
  return value === "hs" ? "Higher Secondary" : "School";
}

function uniqueCsv(value) {
  const seen = new Set();
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    })
    .join(", ");
}

function normalizeClassRoutineLayoutMode(value) {
  const raw = optionalString(value);
  if (!raw) return "standard";
  const normalized = raw.toLowerCase().replace(/[-\s]+/g, "_");
  if (normalized === "packed" || normalized === "hs_packed") return "packed_hs";
  if (CLASS_ROUTINE_LAYOUT_MODES.has(normalized)) return normalized;
  throw new AppError("Invalid routine layout mode. Allowed: standard, packed_hs", 400);
}

function isPackedClassRoutine(value) {
  return String(value?.layout_mode || "standard") === "packed_hs";
}

function requiredString(value, fieldName) {
  const normalized = optionalString(value);
  if (!normalized) throw new AppError(`${fieldName} is required`, 400);
  return normalized;
}

function normalizeTime(value, fieldName) {
  const normalized = requiredString(value, fieldName);
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(normalized)) {
    throw new AppError(`${fieldName} must be HH:mm or HH:mm:ss`, 400);
  }
  return normalized.length === 5 ? `${normalized}:00` : normalized;
}

function normalizeDate(value, fieldName) {
  const normalized = requiredString(value, fieldName);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new AppError(`${fieldName} must be YYYY-MM-DD`, 400);
  }
  return normalized;
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeLookupText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function decodeXml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function columnIndex(cellRef = "") {
  const letters = String(cellRef).match(/^[A-Z]+/i)?.[0] || "";
  return letters
    .toUpperCase()
    .split("")
    .reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function readZipEntries(buffer) {
  const entries = new Map();
  let eocdOffset = -1;
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocdOffset = index;
      break;
    }
  }
  if (eocdOffset < 0) throw new AppError("Invalid XLSX file", 400);

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  let offset = centralDirectoryOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.slice(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressed = buffer.slice(dataStart, dataStart + compressedSize);
    const data = compressionMethod === 0 ? compressed : compressionMethod === 8 ? inflateRawSync(compressed) : null;
    if (data) entries.set(fileName, data);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function readSharedStrings(entries) {
  const xml = entries.get("xl/sharedStrings.xml")?.toString("utf8");
  if (!xml) return [];
  return [...xml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((match) => {
    const textParts = [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1]));
    return textParts.join("");
  });
}

function readFirstWorksheet(entries) {
  const workbook = entries.get("xl/workbook.xml")?.toString("utf8") || "";
  const rels = entries.get("xl/_rels/workbook.xml.rels")?.toString("utf8") || "";
  const firstSheetRelId = workbook.match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1];
  if (firstSheetRelId) {
    const target = rels.match(new RegExp(`<Relationship[^>]*Id="${firstSheetRelId}"[^>]*Target="([^"]+)"`))?.[1];
    if (target) {
      const normalized = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\.\//, "")}`;
      const sheet = entries.get(normalized);
      if (sheet) return sheet.toString("utf8");
    }
  }
  const fallback = [...entries.keys()].find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  return fallback ? entries.get(fallback).toString("utf8") : "";
}

function parseSheetRows(file) {
  if (!file?.buffer) throw new AppError("XLSX or CSV file is required", 400);
  const name = String(file.originalname || "").toLowerCase();
  if (name.endsWith(".csv") || String(file.mimetype || "").includes("csv")) {
    const lines = file.buffer.toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) throw new AppError("Import file must include a header row and at least one data row", 400);
    const headers = splitCsvLine(lines[0]).map(normalizeHeader);
    return lines.slice(1).map((line, index) => ({
      row_number: index + 2,
      ...Object.fromEntries(headers.map((header, cellIndex) => [header, splitCsvLine(line)[cellIndex] || ""])),
    }));
  }
  if (!name.endsWith(".xlsx") && !String(file.mimetype || "").includes("spreadsheetml")) {
    throw new AppError("Upload an XLSX or CSV routine sheet", 400);
  }
  const entries = readZipEntries(file.buffer);
  const sharedStrings = readSharedStrings(entries);
  const sheetXml = readFirstWorksheet(entries);
  if (!sheetXml) throw new AppError("XLSX worksheet not found", 400);
  const sheetRows = [...sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const ref = attrs.match(/\br="([^"]+)"/)?.[1] || "";
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] || "";
      const raw = cellMatch[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] || cellMatch[2].match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] || "";
      const value = type === "s" ? sharedStrings[Number(raw)] || "" : decodeXml(raw);
      cells[columnIndex(ref)] = value;
    }
    return cells.map((cell) => String(cell || "").trim());
  }).filter((row) => row.some(Boolean));
  if (sheetRows.length < 2) throw new AppError("Import file must include a header row and at least one data row", 400);
  const headers = sheetRows[0].map(normalizeHeader);
  return sheetRows.slice(1).map((cells, index) => ({
    row_number: index + 2,
    ...Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] || ""])),
  }));
}

function pick(row, names) {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function maybeId(value) {
  const parsed = Number(String(value || "").trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function excelDateToIso(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dmy = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, "0")}-${String(dmy[1]).padStart(2, "0")}`;
  const serial = Number(raw);
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    const utc = Math.round((serial - 25569) * 86400 * 1000);
    return new Date(utc).toISOString().slice(0, 10);
  }
  return raw;
}

function excelTimeToClock(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(raw)) {
    const [hour, minute, second = "00"] = raw.split(":");
    return `${hour.padStart(2, "0")}:${minute}:${second}`;
  }
  const decimal = Number(raw);
  if (Number.isFinite(decimal) && decimal >= 0 && decimal < 1) {
    const totalMinutes = Math.round(decimal * 24 * 60);
    const hour = Math.floor(totalMinutes / 60) % 24;
    const minute = totalMinutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  }
  return raw;
}

function weekdayFromValue(value) {
  const text = normalizeLookupText(value);
  const numeric = maybeId(text);
  if (numeric) return numeric;
  const map = {
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
    sunday: 7,
    sun: 7,
  };
  return map[text] || null;
}

function buildLookupMaps(lookups) {
  const add = (map, key, row) => {
    const normalized = normalizeLookupText(key);
    if (normalized && !map.has(normalized)) map.set(normalized, row);
  };
  const sessions = new Map();
  const classes = new Map();
  const streams = new Map();
  const subjects = new Map();
  const teachers = new Map();
  const exams = new Map();
  const activities = new Map();
  for (const row of lookups.sessions) {
    add(sessions, row.id, row);
    add(sessions, row.name, row);
  }
  for (const row of lookups.classes) {
    add(classes, row.id, row);
    add(classes, row.name, row);
  }
  for (const row of lookups.streams) {
    add(streams, row.id, row);
    add(streams, row.name, row);
  }
  for (const row of lookups.subjects) {
    add(subjects, row.id, row);
    add(subjects, row.name, row);
    add(subjects, row.code, row);
  }
  for (const row of lookups.teachers) {
    add(teachers, row.id, row);
    add(teachers, row.name, row);
    add(teachers, row.employee_id, row);
    add(teachers, row.email, row);
    add(teachers, row.phone, row);
  }
  for (const row of lookups.exams) {
    add(exams, row.id, row);
    add(exams, row.name, row);
  }
  for (const row of lookups.activities || []) {
    add(activities, row.id, row);
    add(activities, row.name, row);
  }
  return { ...lookups, sessions, classes, streams, subjects, teachers, exams, activities };
}

function resolveLookup(map, value, field, rowNumber, required = true) {
  const text = String(value || "").trim();
  if (!text) {
    if (required) throw new AppError(`Row ${rowNumber}: ${field} is required`, 400);
    return null;
  }
  const match = map.get(normalizeLookupText(text));
  if (!match) throw new AppError(`Row ${rowNumber}: ${field} not found (${text})`, 400);
  return match;
}

function resolveSection(lookups, value, classId, medium, rowNumber, required = true) {
  const text = String(value || "").trim();
  if (!text) {
    if (required) throw new AppError(`Row ${rowNumber}: section is required`, 400);
    return null;
  }
  const normalized = normalizeLookupText(text);
  const matches = lookups.sections.filter((section) =>
    (String(section.id) === text || normalizeLookupText(section.name) === normalized) &&
    (!classId || Number(section.class_id) === Number(classId)) &&
    (!medium || normalizeLookupText(section.medium) === normalizeLookupText(medium))
  );
  if (!matches.length) throw new AppError(`Row ${rowNumber}: section not found (${text})`, 400);
  return matches[0];
}

function normalizeWeekday(value, fieldName = "weekday") {
  const weekday = intValue(value, fieldName);
  if (weekday < 1 || weekday > 7) {
    throw new AppError(`${fieldName} must be between 1 and 7`, 400);
  }
  return weekday;
}

function ensureTimeOrder(startTime, endTime) {
  if (startTime >= endTime) {
    throw new AppError("start_time must be before end_time", 400);
  }
}

function normalizeTeachers(input = [], fieldName = "teachers") {
  if (!Array.isArray(input)) return [];
  return input.map((teacher) => ({
    teacher_id: intValue(teacher.teacher_id ?? teacher.id, `${fieldName}.teacher_id`),
    teacher_role: optionalString(teacher.teacher_role) || "primary",
    assignment_role: optionalString(teacher.assignment_role) || "replacement",
    invigilation_role: optionalString(teacher.invigilation_role) || "invigilator",
  }));
}

function normalizeClassRoutineEntries(entries = []) {
  if (!Array.isArray(entries) || !entries.length) {
    return [];
  }
  return entries.map((entry, index) => {
    const entryType = optionalString(entry.entry_type) || "subject";
    if (!ROUTINE_ENTRY_TYPES.has(entryType)) {
      throw new AppError(`Invalid routine entry type: ${entryType}`, 400);
    }
    const startTime = normalizeTime(entry.start_time, "entry.start_time");
    const endTime = normalizeTime(entry.end_time, "entry.end_time");
    ensureTimeOrder(startTime, endTime);
    const subjectId = intValue(entry.subject_id, "entry.subject_id", { required: entryType === "subject" });
    const activityId = intValue(entry.activity_id, "entry.activity_id", { required: entryType === "activity" });
    const teachers = normalizeTeachers(entry.teachers);
    if (entryType === "subject" && !teachers.length) {
      throw new AppError("Subject routine entries require at least one teacher", 400);
    }
    if (entryType === "custom" && !optionalString(entry.title)) {
      throw new AppError("Custom routine entries require a title", 400);
    }
    const sectionIds = Array.isArray(entry.section_ids)
      ? entry.section_ids.map((sectionId) => intValue(sectionId, "entry.section_ids", { required: false })).filter(Boolean)
      : [];
    return {
      time_slot_id: intValue(entry.time_slot_id, "entry.time_slot_id", { required: false }),
      weekday: normalizeWeekday(entry.weekday, "entry.weekday"),
      period_number: intValue(entry.period_number ?? index + 1, "entry.period_number"),
      start_time: startTime,
      end_time: endTime,
      entry_type: entryType,
      subject_id: subjectId,
      activity_id: activityId,
      title: optionalString(entry.title),
      room: optionalString(entry.room),
      notes: optionalString(entry.notes),
      sort_order: Number.isInteger(Number(entry.sort_order)) ? Number(entry.sort_order) : index,
      applies_medium: optionalString(entry.applies_medium),
      section_ids: sectionIds,
      teachers,
    };
  });
}

function prepareClassRoutineEntriesForLayout(entries = [], layoutMode = "standard") {
  const packed = layoutMode === "packed_hs";
  const seenSlots = new Set();
  return entries.map((entry) => {
    const slotKey = `${entry.weekday}-${entry.period_number}`;
    if (!packed && seenSlots.has(slotKey)) {
      throw new AppError("Standard routines allow only one entry per day and period", 400);
    }
    seenSlots.add(slotKey);
    if (packed) return entry;
    return {
      ...entry,
      applies_medium: null,
      section_ids: [],
    };
  });
}

async function normalizeClassRoutinePayloadForCreate(body, userId) {
  const payload = normalizeClassRoutinePayload(body, userId);
  const classRow = await repo.getClassById(payload.class_id);
  if (!classRow) throw new AppError("Class not found", 404);
  payload.class_scope = classRow.class_scope || "school";
  payload.layout_mode = normalizeClassRoutineLayoutMode(body.layout_mode);
  if (payload.layout_mode === "packed_hs" && payload.class_scope !== "hs") {
    throw new AppError("Packed class routine mode is only available for Higher Secondary classes", 400);
  }
  if (payload.layout_mode !== "packed_hs") {
    if (!payload.section_id) throw new AppError("section_id is required for standard class routines", 400);
    if (!payload.medium) throw new AppError("medium is required for standard class routines", 400);
  }
  return payload;
}

function classRoutineEntryToPayload(entry) {
  return {
    time_slot_id: entry.time_slot_id,
    weekday: entry.weekday,
    period_number: entry.period_number,
    start_time: entry.start_time,
    end_time: entry.end_time,
    entry_type: entry.entry_type,
    subject_id: entry.subject_id,
    activity_id: entry.activity_id,
    title: entry.title,
    room: entry.room,
    notes: entry.notes,
    sort_order: entry.sort_order,
    applies_medium: entry.applies_medium,
    section_ids: entry.applies_section_ids || entry.section_ids || [],
    teachers: (entry.teacher_ids || []).map((teacherId, index) => ({
      teacher_id: teacherId,
      teacher_role: index === 0 ? "primary" : "co_teacher",
    })),
  };
}

function normalizeClassRoutinePayload(body, userId) {
  return {
    session_id: intValue(body.session_id, "session_id"),
    class_id: intValue(body.class_id, "class_id"),
    section_id: intValue(body.section_id, "section_id", { required: false }),
    medium: optionalString(body.medium),
    stream_id: intValue(body.stream_id, "stream_id", { required: false }),
    time_slot_template_id: intValue(body.time_slot_template_id, "time_slot_template_id", { required: false }),
    title: optionalString(body.title),
    source: optionalString(body.source) || "manual",
    parent_version_id: intValue(body.parent_version_id, "parent_version_id", { required: false }),
    layout_mode: normalizeClassRoutineLayoutMode(body.layout_mode),
    user_id: userId,
  };
}

export function listTimeSlotTemplates(filters) {
  return repo.listTimeSlotTemplates(filters);
}

export async function getTimeSlotTemplate(id) {
  const template = await repo.getTimeSlotTemplateWithSlots(intValue(id, "template id"));
  if (!template) throw new AppError("Time slot template not found", 404);
  return template;
}

function normalizeTemplatePayload(body, userId) {
  const slots = Array.isArray(body.slots)
    ? body.slots.map((slot, index) => {
        const startTime = normalizeTime(slot.start_time, "slot.start_time");
        const endTime = normalizeTime(slot.end_time, "slot.end_time");
        ensureTimeOrder(startTime, endTime);
        const defaultEntryType = optionalString(slot.default_entry_type) || "subject";
        if (!ROUTINE_ENTRY_TYPES.has(defaultEntryType)) {
          throw new AppError(`Invalid default entry type: ${defaultEntryType}`, 400);
        }
        return {
          weekday: slot.weekday ? normalizeWeekday(slot.weekday, "slot.weekday") : null,
          period_number: intValue(slot.period_number ?? index + 1, "slot.period_number"),
          label: optionalString(slot.label),
          start_time: startTime,
          end_time: endTime,
          default_entry_type: defaultEntryType,
          is_break: defaultEntryType === "break" || Boolean(slot.is_break) ? 1 : 0,
          sort_order: Number.isInteger(Number(slot.sort_order)) ? Number(slot.sort_order) : index,
        };
      })
    : [];

  return {
    data: {
      name: requiredString(body.name, "name"),
      scope_level: optionalString(body.scope_level) || "school",
      session_id: intValue(body.session_id, "session_id", { required: false }),
      class_id: intValue(body.class_id, "class_id", { required: false }),
      section_id: intValue(body.section_id, "section_id", { required: false }),
      medium: optionalString(body.medium),
      stream_id: intValue(body.stream_id, "stream_id", { required: false }),
      description: optionalString(body.description),
      is_active: body.is_active === undefined ? 1 : Boolean(body.is_active) ? 1 : 0,
      created_by: userId,
    },
    slots,
  };
}

export function createTimeSlotTemplate(body, userId) {
  const payload = normalizeTemplatePayload(body, userId);
  return repo.createTimeSlotTemplate(payload.data, payload.slots);
}

export async function updateTimeSlotTemplate(id, body, userId) {
  const payload = normalizeTemplatePayload(body, userId);
  const result = await repo.updateTimeSlotTemplate(intValue(id, "template id"), payload.data, payload.slots);
  if (!result) throw new AppError("Time slot template not found", 404);
  return result;
}

export async function deleteTimeSlotTemplate(id) {
  const templateId = intValue(id, "template id");
  const template = await repo.getTimeSlotTemplateById(templateId);
  if (!template) throw new AppError("Time slot template not found", 404);
  const usageCount = await repo.countClassRoutinesUsingTemplate(templateId);
  if (usageCount > 0) {
    throw new AppError(`Time slot template is used by ${usageCount} class routine${usageCount === 1 ? "" : "s"}. Remove it from those routines before deleting.`, 400);
  }
  await repo.deleteTimeSlotTemplate(templateId);
  return { id: templateId, deleted: true };
}

export function listClassRoutines(filters = {}) {
  return repo.listClassRoutineVersions({
    ...filters,
    status: normalizeBoardStatus(filters.status),
  });
}

function normalizeBoardStatus(value) {
  const status = optionalString(value) || "current";
  if (!ROUTINE_BOARD_STATUSES.has(status)) {
    throw new AppError("Invalid status. Allowed: current, published, draft, archived, all", 400);
  }
  return status;
}

function normalizeWeekdayFilter(value) {
  const weekday = intValue(value, "weekday", { required: false });
  if (weekday !== null && (weekday < 1 || weekday > 7)) {
    throw new AppError("weekday must be between 1 and 7", 400);
  }
  return weekday;
}

function routineCardKey(row) {
  return [
    row.routine_version_id,
    row.session_id,
    row.class_id,
    row.section_id,
    row.medium,
    row.stream_id || 0,
  ].join("|");
}

function mapRoutineBoardEntry(row) {
  const packed = row.layout_mode === "packed_hs";
  return {
    id: Number(row.entry_id),
    weekday: Number(row.weekday),
    weekday_label: WEEKDAY_LABELS[Number(row.weekday)] || String(row.weekday),
    period_number: Number(row.period_number),
    start_time: row.start_time,
    end_time: row.end_time,
    entry_type: row.entry_type,
    subject_id: row.subject_id ? Number(row.subject_id) : null,
    subject_name: row.subject_name,
    activity_id: row.activity_id ? Number(row.activity_id) : null,
    activity_name: row.activity_name,
    applies_medium: packed ? row.applies_medium : null,
    applies_section_ids: packed && row.applies_section_ids
      ? String(row.applies_section_ids).split(",").map((id) => Number(id)).filter(Boolean)
      : [],
    applies_section_names: packed ? row.applies_section_names || "" : "",
    title: row.entry_title,
    room: row.room,
    notes: row.notes,
    slot_label: row.slot_label,
    slot_default_entry_type: row.slot_default_entry_type,
    sort_order: Number(row.sort_order || 0),
    teacher_ids: row.teacher_ids
      ? String(row.teacher_ids).split(",").map((id) => Number(id)).filter(Boolean)
      : [],
    teacher_user_ids: row.teacher_user_ids
      ? String(row.teacher_user_ids).split(",").map((id) => Number(id)).filter(Boolean)
      : [],
    teacher_names: uniqueCsv(row.teacher_names),
  };
}

function mapRoutineBoardCard(row) {
  return {
    routine_version_id: Number(row.routine_version_id),
    session_id: Number(row.session_id),
    session_name: row.session_name,
    class_id: Number(row.class_id),
    class_name: row.class_name,
    class_display_order: row.class_display_order ?? null,
    class_scope: row.class_scope || "school",
    class_scope_label: classScopeLabel(row.class_scope || "school"),
    layout_mode: row.layout_mode || "standard",
    section_id: row.section_id ? Number(row.section_id) : null,
    section_name: row.section_name,
    medium: row.medium,
    stream_id: row.stream_id ? Number(row.stream_id) : null,
    stream_name: row.stream_name,
    time_slot_template_id: row.time_slot_template_id ? Number(row.time_slot_template_id) : null,
    version_number: Number(row.version_number),
    status: row.status,
    title: row.routine_title,
    source: row.source,
    published_at: row.published_at,
    updated_at: row.updated_at,
    entries: [],
  };
}

function rowMatchesTeacherAssignment(row, assignment) {
  if (Number(row.session_id) !== Number(assignment.session_id)) return false;
  if (Number(row.class_id) !== Number(assignment.class_id)) return false;
  const layoutMode = row.layout_mode || "standard";
  if (layoutMode !== "packed_hs") {
    return Number(row.section_id) === Number(assignment.section_id);
  }
  const sectionIds = row.applies_section_ids
    ? String(row.applies_section_ids).split(",").map((id) => Number(id)).filter(Boolean)
    : [];
  const sectionMatches = !sectionIds.length || sectionIds.includes(Number(assignment.section_id));
  const mediumMatches = !row.applies_medium || String(row.applies_medium) === String(assignment.medium || "");
  return sectionMatches && mediumMatches;
}

function breakSlotAppliesToWeekday(slot, weekday) {
  return !slot.weekday || Number(slot.weekday) === Number(weekday);
}

function routineEntrySlotKey(entry) {
  return [
    Number(entry.weekday || 0),
    Number(entry.period_number || 0),
    String(entry.start_time || ""),
    String(entry.end_time || ""),
  ].join("|");
}

function sortRoutineEntryLike(a, b) {
  return Number(a.weekday || 0) - Number(b.weekday || 0) ||
    Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
    Number(a.period_number || 0) - Number(b.period_number || 0) ||
    String(a.start_time || "").localeCompare(String(b.start_time || ""));
}

function missingBreakSlotKey(weekday, slot) {
  return [
    Number(weekday || 0),
    Number(slot.period_number || 0),
    String(slot.start_time || ""),
    String(slot.end_time || ""),
  ].join("|");
}

function syntheticBreakRowFromBoardRow(row, slot, weekday) {
  const syntheticId = -1 * (Number(slot.time_slot_id || 0) * 10 + Number(weekday || 0));
  return {
    ...row,
    entry_id: syntheticId,
    weekday: Number(weekday),
    period_number: Number(slot.period_number),
    start_time: slot.start_time,
    end_time: slot.end_time,
    entry_type: "break",
    subject_id: null,
    subject_name: null,
    activity_id: null,
    activity_name: null,
    entry_title: slot.label || "Break",
    room: null,
    notes: null,
    sort_order: Number(slot.sort_order || slot.period_number || 0),
    slot_label: slot.label || "Break",
    slot_default_entry_type: "break",
    teacher_ids: null,
    teacher_user_ids: null,
    teacher_names: null,
    applies_section_ids: null,
    applies_section_names: null,
  };
}

async function includeMissingBreakRows(rows = []) {
  const templateIds = rows.map((row) => row.time_slot_template_id).filter(Boolean);
  if (!templateIds.length) return rows;
  const breakSlots = await repo.listBreakTimeSlotsForTemplateIds(templateIds);
  if (!breakSlots.length) return rows;
  const slotsByTemplate = new Map();
  for (const slot of breakSlots) {
    const key = Number(slot.template_id);
    if (!slotsByTemplate.has(key)) slotsByTemplate.set(key, []);
    slotsByTemplate.get(key).push(slot);
  }

  const routineDays = new Map();
  const existingKeys = new Set();
  for (const row of rows) {
    const templateId = Number(row.time_slot_template_id || 0);
    if (!templateId) continue;
    const key = `${row.routine_version_id}|${row.weekday}`;
    if (!routineDays.has(key)) routineDays.set(key, row);
    existingKeys.add(`${row.routine_version_id}|${routineEntrySlotKey(row)}`);
  }

  const syntheticRows = [];
  for (const [key, sampleRow] of routineDays.entries()) {
    const [, weekdayValue] = key.split("|");
    const weekday = Number(weekdayValue);
    const slots = slotsByTemplate.get(Number(sampleRow.time_slot_template_id || 0)) || [];
    for (const slot of slots) {
      if (!breakSlotAppliesToWeekday(slot, weekday)) continue;
      const slotKey = `${sampleRow.routine_version_id}|${missingBreakSlotKey(weekday, slot)}`;
      if (existingKeys.has(slotKey)) continue;
      existingKeys.add(slotKey);
      syntheticRows.push(syntheticBreakRowFromBoardRow(sampleRow, slot, weekday));
    }
  }
  return [...rows, ...syntheticRows];
}

function syntheticBreakEntryFromRoutine(routine, slot, weekday) {
  const syntheticId = -1 * (Number(slot.time_slot_id || 0) * 10 + Number(weekday || 0));
  return {
    id: syntheticId,
    routine_version_id: Number(routine.id),
    time_slot_id: Number(slot.time_slot_id),
    weekday: Number(weekday),
    period_number: Number(slot.period_number),
    start_time: slot.start_time,
    end_time: slot.end_time,
    entry_type: "break",
    subject_id: null,
    subject_name: null,
    activity_id: null,
    activity_name: null,
    title: slot.label || "Break",
    room: null,
    notes: null,
    sort_order: Number(slot.sort_order || slot.period_number || 0),
    slot_label: slot.label || "Break",
    slot_default_entry_type: "break",
    teacher_ids: [],
    teacher_user_ids: [],
    teacher_names: "",
    applies_medium: null,
    applies_section_ids: [],
    applies_section_names: "",
  };
}

async function includeMissingBreakEntries(routine) {
  if (!routine?.time_slot_template_id || !Array.isArray(routine.entries)) return routine;
  const breakSlots = await repo.listBreakTimeSlotsForTemplateIds([routine.time_slot_template_id]);
  if (!breakSlots.length) return routine;
  const weekdays = [...new Set((routine.entries || []).map((entry) => Number(entry.weekday)).filter(Boolean))];
  if (!weekdays.length) return routine;
  const existingKeys = new Set(routine.entries.map(routineEntrySlotKey));
  const syntheticEntries = [];
  for (const weekday of weekdays) {
    for (const slot of breakSlots) {
      if (!breakSlotAppliesToWeekday(slot, weekday)) continue;
      const key = missingBreakSlotKey(weekday, slot);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      syntheticEntries.push(syntheticBreakEntryFromRoutine(routine, slot, weekday));
    }
  }
  return {
    ...routine,
    entries: [...routine.entries, ...syntheticEntries].sort((a, b) => sortRoutineEntryLike(a, b)),
  };
}

function examRoutineMatchesTeacherAssignment(routine, assignment) {
  if (Number(routine.session_id) !== Number(assignment.session_id)) return false;
  if (Number(routine.class_id) !== Number(assignment.class_id)) return false;
  if (routine.section_id && Number(routine.section_id) !== Number(assignment.section_id)) return false;
  if (routine.medium && String(routine.medium) !== String(assignment.medium || "")) return false;
  return true;
}

function buildClassRoutineBoardFromRows(rows, normalizedFilters = {}) {
  const scopes = new Map();

  for (const row of rows) {
    const scopeKey = row.class_scope || "school";
    if (!scopes.has(scopeKey)) {
      scopes.set(scopeKey, {
        class_scope: scopeKey,
        scope_label: classScopeLabel(scopeKey),
        weekdays: new Map(),
      });
    }
    const scope = scopes.get(scopeKey);
    const weekday = Number(row.weekday);
    if (!scope.weekdays.has(weekday)) {
      scope.weekdays.set(weekday, {
        weekday,
        label: WEEKDAY_LABELS[weekday] || String(weekday),
        routines: new Map(),
      });
    }
    const day = scope.weekdays.get(weekday);
    const cardKey = routineCardKey(row);
    if (!day.routines.has(cardKey)) {
      day.routines.set(cardKey, mapRoutineBoardCard(row));
    }
    day.routines.get(cardKey).entries.push(mapRoutineBoardEntry(row));
  }

  return {
    filters: normalizedFilters,
    weekdays: Object.entries(WEEKDAY_LABELS).map(([weekday, label]) => ({
      weekday: Number(weekday),
      label,
    })),
    scopes: [...scopes.values()].map((scope) => ({
      ...scope,
      weekdays: [...scope.weekdays.values()].map((day) => ({
        ...day,
        routines: [...day.routines.values()].map((routine) => ({
          ...routine,
          entry_count: routine.entries.length,
        })),
      })),
    })),
  };
}

export async function getClassRoutineBoard(filters = {}) {
  const normalizedFilters = {
    routine_version_id: intValue(filters.routine_version_id ?? filters.routineVersionId, "routine_version_id", { required: false }),
    session_id: intValue(filters.session_id, "session_id", { required: false }),
    class_id: intValue(filters.class_id, "class_id", { required: false }),
    section_id: intValue(filters.section_id, "section_id", { required: false }),
    medium: optionalString(filters.medium),
    stream_id: intValue(filters.stream_id, "stream_id", { required: false }),
    class_scope: normalizeClassScope(filters.class_scope || filters.scope),
    status: normalizeBoardStatus(filters.status),
    weekday: normalizeWeekdayFilter(filters.weekday),
  };
  const rows = await includeMissingBreakRows(await repo.listClassRoutineBoardRows(normalizedFilters));
  return buildClassRoutineBoardFromRows(rows, normalizedFilters);
}

export async function getMyTeacherClassRoutineBoard(userId, filters = {}) {
  const assignments = await repo.getTeacherRoutineAssignmentsByUserId(userId);
  if (!assignments.length) return buildClassRoutineBoardFromRows([], {});
  const normalizedFilters = {
    session_id: intValue(filters.session_id, "session_id", { required: false }),
    class_id: intValue(filters.class_id, "class_id", { required: false }),
    section_id: intValue(filters.section_id, "section_id", { required: false }),
    medium: optionalString(filters.medium),
    stream_id: intValue(filters.stream_id, "stream_id", { required: false }),
    class_scope: normalizeClassScope(filters.class_scope || filters.scope),
    status: "published",
    weekday: normalizeWeekdayFilter(filters.weekday),
  };
  const rows = await includeMissingBreakRows(await repo.listClassRoutineBoardRows(normalizedFilters));
  const visibleRows = rows.filter((row) => assignments.some((assignment) => rowMatchesTeacherAssignment(row, assignment)));
  return buildClassRoutineBoardFromRows(visibleRows, normalizedFilters);
}

function routineForResponse(routine) {
  if (!routine || isPackedClassRoutine(routine)) return routine;
  return {
    ...routine,
    layout_mode: routine.layout_mode || "standard",
    entries: (routine.entries || []).map((entry) => ({
      ...entry,
      applies_medium: null,
      applies_section_ids: [],
      applies_section_names: "",
    })),
  };
}

export async function getClassRoutine(id) {
  const routine = await includeMissingBreakEntries(await repo.getClassRoutineWithEntries(intValue(id, "routine id")));
  if (!routine) throw new AppError("Class routine not found", 404);
  return routineForResponse(routine);
}

export async function createClassRoutine(body, userId) {
  const payload = await normalizeClassRoutinePayloadForCreate(body, userId);
  const entries = prepareClassRoutineEntriesForLayout(
    normalizeClassRoutineEntries(body.entries),
    payload.layout_mode
  );
  return repo.upsertClassRoutineForScope(
    payload,
    entries
  );
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTextKey(value) {
  return String(value || "").trim().toLowerCase();
}

async function remapPackedRoutineSectionIds(sourceEntries, targetClassId) {
  const targetSections = await repo.listSectionsForClass(targetClassId);
  return sourceEntries.map((entry) => {
    const sectionNames = splitCsv(entry.applies_section_names);
    if (!sectionNames.length) return entry;

    const nextSectionIds = sectionNames.map((sectionName) => {
      const normalizedName = normalizeTextKey(sectionName);
      const normalizedMedium = normalizeTextKey(entry.applies_medium);
      const targetSection = targetSections.find((section) =>
        normalizeTextKey(section.name) === normalizedName &&
        (!normalizedMedium || normalizeTextKey(section.medium) === normalizedMedium)
      );
      if (!targetSection) {
        const mediumText = entry.applies_medium ? ` (${entry.applies_medium})` : "";
        throw new AppError(`Target class does not have section ${sectionName}${mediumText}. Create matching sections before duplicating this HS routine.`, 400);
      }
      return targetSection.id;
    });

    return {
      ...entry,
      section_ids: nextSectionIds,
    };
  });
}

export async function duplicateClassRoutine(id, body = {}, userId) {
  const source = await repo.getClassRoutineWithEntries(intValue(id, "routine id"));
  if (!source) throw new AppError("Class routine not found", 404);

  const payload = await normalizeClassRoutinePayloadForCreate({
    session_id: body.session_id ?? source.session_id,
    class_id: body.class_id ?? source.class_id,
    section_id: body.section_id ?? source.section_id,
    medium: body.medium ?? source.medium,
    stream_id: body.stream_id ?? source.stream_id,
    layout_mode: body.layout_mode ?? source.layout_mode ?? "standard",
    time_slot_template_id: body.time_slot_template_id ?? source.time_slot_template_id,
    title: body.title ?? source.title,
    source: "duplicate",
    parent_version_id: source.id,
  }, userId);

  const existingDraft = await repo.getDraftClassRoutineForScope(payload);
  if (existingDraft) {
    throw new AppError("A draft routine already exists for the selected target class/section. Edit that draft or delete it before duplicating.", 400);
  }

  const sourcePayloadEntries = (source.entries || []).map(classRoutineEntryToPayload);
  const copiedEntries = payload.layout_mode === "packed_hs"
    ? await remapPackedRoutineSectionIds(sourcePayloadEntries, payload.class_id)
    : sourcePayloadEntries;

  const entries = prepareClassRoutineEntriesForLayout(
    normalizeClassRoutineEntries(copiedEntries),
    payload.layout_mode
  );

  return repo.createClassRoutineVersion(
    {
      ...payload,
      title: payload.title || `${source.class_name || "Class"} Routine Copy`,
      source: "duplicate",
      parent_version_id: source.id,
    },
    entries
  );
}

function splitPeople(value) {
  return String(value || "")
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function rowValue(row, body, rowNames, bodyNames = rowNames) {
  return pick(row, rowNames) || pick(body, bodyNames);
}

function normalizeImportFile(file) {
  const rows = parseSheetRows(file);
  if (!rows.length) throw new AppError("Routine import file has no data rows", 400);
  return rows;
}

export async function importClassRoutine(file, body = {}, userId) {
  const rows = normalizeImportFile(file);
  const lookups = buildLookupMaps(await repo.getRoutineImportLookups());
  const groups = new Map();
  const errors = [];

  for (const row of rows) {
    try {
      const rowNumber = row.row_number;
      const session = resolveLookup(
        lookups.sessions,
        rowValue(row, body, ["session_id", "session", "academic_session"], ["session_id", "session"]),
        "session",
        rowNumber
      );
      const classRow = resolveLookup(lookups.classes, rowValue(row, body, ["class_id", "class", "class_name"], ["class_id", "class"]), "class", rowNumber);
      const medium = requiredString(rowValue(row, body, ["medium"], ["medium"]), `Row ${rowNumber}: medium`);
      const section = resolveSection(
        lookups,
        rowValue(row, body, ["section_id", "section", "section_name"], ["section_id", "section"]),
        classRow.id,
        medium,
        rowNumber
      );
      const streamValue = rowValue(row, body, ["stream_id", "stream", "stream_name"], ["stream_id", "stream"]);
      const stream = streamValue ? resolveLookup(lookups.streams, streamValue, "stream", rowNumber, false) : null;
      const title = rowValue(row, body, ["routine_title", "title"], ["title"]) || `${classRow.name} ${section.name} Routine`;
      const groupKey = [session.id, classRow.id, section.id, medium, stream?.id || 0, title].join("|");
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          data: {
            session_id: session.id,
            class_id: classRow.id,
            section_id: section.id,
            medium,
            stream_id: stream?.id || null,
            time_slot_template_id: intValue(body.time_slot_template_id, "time_slot_template_id", { required: false }),
            title,
            source: "import",
            parent_version_id: null,
            layout_mode: "standard",
            user_id: userId,
          },
          entries: [],
        });
      }

      const subjectValue = pick(row, ["subject_id", "subject", "subject_name", "subject_code"]);
      const titleValue = pick(row, ["entry_title", "title", "activity", "period_title"]);
      const explicitType = optionalString(pick(row, ["entry_type", "type"]));
      const inferredType = explicitType || (!subjectValue && /break|recess|tiffin/i.test(titleValue) ? "break" : "subject");
      const entryType = inferredType.toLowerCase();
      const subject = subjectValue ? resolveLookup(lookups.subjects, subjectValue, "subject", rowNumber, entryType === "subject") : null;
      const activityValue = pick(row, ["activity_id", "activity", "activity_name"]);
      const activity = entryType === "activity"
        ? resolveLookup(lookups.activities, activityValue || titleValue, "activity", rowNumber)
        : null;
      const teacherNames = splitPeople(pick(row, ["teacher_ids", "teacher_id", "teachers", "teacher", "teacher_name"]));
      const teachers = teacherNames.map((teacher, index) => ({
        teacher_id: resolveLookup(lookups.teachers, teacher, "teacher", rowNumber).id,
        teacher_role: index === 0 ? "primary" : "co_teacher",
      }));
      groups.get(groupKey).entries.push({
        weekday: weekdayFromValue(pick(row, ["weekday", "day", "day_name"])) || 1,
        period_number: maybeId(pick(row, ["period_number", "period", "period_no"])) || groups.get(groupKey).entries.length + 1,
        start_time: excelTimeToClock(pick(row, ["start_time", "start", "from"])),
        end_time: excelTimeToClock(pick(row, ["end_time", "end", "to"])),
        entry_type: entryType,
        subject_id: subject?.id || null,
        activity_id: activity?.id || null,
        title: titleValue || activity?.name || (entryType === "break" ? "Break" : null),
        room: optionalString(pick(row, ["room", "room_no", "classroom"])),
        notes: optionalString(pick(row, ["notes", "remarks"])),
        sort_order: groups.get(groupKey).entries.length,
        teachers,
      });
    } catch (err) {
      errors.push({ row: row.row_number, message: err.message || "Could not parse row" });
    }
  }

  const imported = [];
  for (const group of groups.values()) {
    try {
      imported.push(await repo.upsertClassRoutineForScope(
        group.data,
        prepareClassRoutineEntriesForLayout(normalizeClassRoutineEntries(group.entries), group.data.layout_mode)
      ));
    } catch (err) {
      errors.push({ row: null, message: err.message || "Could not create class routine draft" });
    }
  }
  return { imported_count: imported.length, failed_count: errors.length, routines: imported, errors };
}

export async function updateClassRoutine(id, body, userId) {
  const routineId = intValue(id, "routine id");
  const routine = await repo.getClassRoutineWithEntries(routineId);
  if (!routine) throw new AppError("Class routine not found", 404);
  const targetRoutine = await repo.getCanonicalClassRoutineForScope(routine) || routine;
  const layoutMode = targetRoutine.layout_mode || "standard";
  const result = await repo.updateClassRoutineDraft(
    targetRoutine.id,
    {
      title: optionalString(body.title),
      time_slot_template_id: intValue(body.time_slot_template_id, "time_slot_template_id", { required: false }),
      layout_mode: layoutMode,
      user_id: userId,
    },
    Array.isArray(body.entries)
      ? prepareClassRoutineEntriesForLayout(normalizeClassRoutineEntries(body.entries), layoutMode)
      : undefined
  );
  if (!result) throw new AppError("Class routine could not be updated", 400);
  return result;
}

export async function updateClassRoutineSlot(id, body, userId) {
  const routineId = intValue(id, "routine id");
  const routine = await repo.getClassRoutineWithEntries(routineId);
  if (!routine) throw new AppError("Class routine not found", 404);
  const targetRoutine = await repo.getCanonicalClassRoutineForScope(routine) || routine;
  const layoutMode = targetRoutine.layout_mode || "standard";
  const entries = prepareClassRoutineEntriesForLayout(
    normalizeClassRoutineEntries(Array.isArray(body.entries) ? body.entries : [body]),
    layoutMode
  );
  const [entry] = entries;
  if (!entry) throw new AppError("At least one routine slot entry is required", 400);
  const differentSlot = entries.some(
    (item) => item.weekday !== entry.weekday || Number(item.period_number) !== Number(entry.period_number)
  );
  if (differentSlot) {
    throw new AppError("All routine slot entries must belong to the same day and period", 400);
  }
  const result = await repo.upsertClassRoutineDraftSlot(targetRoutine.id, entries, userId);
  if (!result) throw new AppError("Could not update class routine slot", 400);
  return result;
}

export async function createClassRoutineDraftFromPublished(id, userId) {
  const routine = await repo.getClassRoutineWithEntries(intValue(id, "routine id"));
  if (!routine) throw new AppError("Class routine not found", 404);
  const result = await repo.getCanonicalClassRoutineForScope(routine) || await repo.createDraftFromClassRoutine(routine.id, userId);
  if (!result) throw new AppError("Class routine not found", 404);
  return result;
}

export async function publishClassRoutine(id, userId) {
  const routineId = intValue(id, "routine id");
  const routine = await repo.getClassRoutineWithEntries(routineId);
  if (!routine) throw new AppError("Class routine not found", 404);
  if (!routine.entries?.length) throw new AppError("Cannot publish an empty routine", 400);
  const canonical = await repo.getCanonicalClassRoutineForScope(routine);
  const targetRoutine = canonical && canonical.status === "published" && canonical.id !== routine.id
    ? await repo.updateClassRoutineDraft(
        canonical.id,
        {
          title: routine.title,
          time_slot_template_id: routine.time_slot_template_id,
          layout_mode: routine.layout_mode || "standard",
          user_id: userId,
        },
        prepareClassRoutineEntriesForLayout(
          normalizeClassRoutineEntries(routine.entries.map(classRoutineEntryToPayload)),
          routine.layout_mode || "standard"
        )
      )
    : routine;
  const targetRoutineId = Number(targetRoutine.id);
  const invalidAssignments = await repo.findInvalidClassRoutineTeacherAssignments(targetRoutineId);
  if (invalidAssignments.length) {
    throw new AppError("One or more teachers are not assigned to the selected class/section/subject", 400);
  }
  const conflicts = await repo.findClassRoutineTeacherConflicts(targetRoutineId);
  if (conflicts.length) {
    const details = summarizeClassRoutineTeacherConflicts(conflicts);
    throw new AppError(`Teacher time conflict found${details ? `: ${details}` : ""}. Resolve conflicts before publishing.`, 400);
  }
  const result = await repo.publishClassRoutineVersion(targetRoutineId, userId);
  if (!result) throw new AppError("Class routine not found", 404);
  if (targetRoutineId !== routineId && routine.status === "draft") {
    await repo.deleteClassRoutineVersion(routineId);
  }
  return result;
}

function summarizeClassRoutineTeacherConflicts(conflicts = []) {
  return conflicts
    .slice(0, 3)
    .map((item) => {
      const teacher = item.teacher_name || `Teacher #${item.teacher_id}`;
      const day = WEEKDAY_LABELS[Number(item.weekday)] || `Day ${item.weekday || ""}`.trim() || "selected day";
      const period = item.period_number ? `Period ${item.period_number}` : "selected period";
      const time = formatRoutineTimeRange(item.start_time, item.end_time);
      const targetScope = [item.class_name, item.section_name].filter(Boolean).join(" ");
      const conflictScope = [item.conflicting_class_name, item.conflicting_section_name].filter(Boolean).join(" ");
      const conflictPeriod = item.conflicting_period_number ? `Period ${item.conflicting_period_number}` : "selected period";
      const conflictTime = formatRoutineTimeRange(item.conflicting_start_time, item.conflicting_end_time);
      const slot = [day, targetScope, period, time].filter(Boolean).join("  ");
      const conflictingSlot = [conflictScope || "another class", conflictPeriod, conflictTime].filter(Boolean).join("  ");
      return `${teacher} has a scheduling conflict\nPublishing: ${slot}\nAlready teaching: ${conflictingSlot}.`;
    })
    .join("\n\n");
}

function formatRoutineTimeRange(startTime, endTime) {
  const start = formatRoutineClock(startTime);
  const end = formatRoutineClock(endTime);
  return [start, end].filter(Boolean).join(" - ");
}

function formatRoutineClock(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  const hour24 = Number(match[1]);
  const minute = match[2];
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

export async function deleteClassRoutineDraft(id) {
  const result = await repo.deleteClassRoutineVersion(intValue(id, "routine id"));
  if (!result.affectedRows) throw new AppError("Only draft or published class routines can be deleted", 400);
  return { deleted: true };
}

export async function getEffectiveClassRoutine(filters) {
  const scope = {
    session_id: intValue(filters.session_id, "session_id"),
    class_id: intValue(filters.class_id, "class_id"),
    section_id: intValue(filters.section_id, "section_id"),
    medium: requiredString(filters.medium, "medium"),
    stream_id: intValue(filters.stream_id, "stream_id", { required: false }),
  };
  const date = normalizeDate(filters.date, "date");
  const published = await repo.getPublishedClassRoutineForScope(scope);
  if (!published) throw new AppError("Published routine not found", 404);
  const routine = await includeMissingBreakEntries(await repo.getClassRoutineWithEntries(published.id));
  return { routine: routineForResponse(routine), substitutions: [], date };
}

function filterRoutineEntriesForStudent(entries = [], enrollment = {}, registeredSubjectIds = []) {
  const registeredSubjects = new Set(registeredSubjectIds.map((id) => Number(id)).filter(Boolean));
  const hasSubjectRegistrations = registeredSubjects.size > 0;
  return entries.filter((entry) => {
    const appliesMedium = optionalString(entry.applies_medium);
    if (appliesMedium && enrollment.medium && appliesMedium !== enrollment.medium) return false;

    const sectionIds = Array.isArray(entry.applies_section_ids) ? entry.applies_section_ids.map(Number).filter(Boolean) : [];
    if (sectionIds.length && enrollment.section_id && !sectionIds.includes(Number(enrollment.section_id))) return false;

    if (entry.entry_type === "subject" && hasSubjectRegistrations && entry.subject_id) {
      return registeredSubjects.has(Number(entry.subject_id));
    }
    return true;
  });
}

export async function getStudentRoutine(studentId, userId, query) {
  const enrollment = await repo.getStudentEnrollmentForUser(intValue(studentId, "student id"), userId);
  if (!enrollment) throw new AppError("Student routine not found", 404);
  const result = await getEffectiveClassRoutine({
    ...enrollment,
    date: query.date || new Date().toISOString().slice(0, 10),
  });
  if (!isPackedClassRoutine(result.routine)) {
    return result;
  }
  const registeredSubjectIds = await repo.getRegisteredSubjectIdsForStudent(enrollment.student_id);
  return {
    ...result,
    routine: {
      ...result.routine,
      entries: filterRoutineEntriesForStudent(result.routine?.entries || [], enrollment, registeredSubjectIds),
    },
  };
}

export async function getMyTeacherRoutine(userId, filters) {
  return repo.getTeacherClassRoutine(userId, filters);
}

function normalizeExamRoutineEntries(entries = []) {
  if (!Array.isArray(entries) || !entries.length) {
    throw new AppError("entries[] is required", 400);
  }
  return entries.map((entry, index) => {
    const entryType = optionalString(entry.entry_type) || "subject";
    if (!EXAM_ENTRY_TYPES.has(entryType)) {
      throw new AppError(`Invalid exam routine entry type: ${entryType}`, 400);
    }
    const startTime = normalizeTime(entry.start_time, "entry.start_time");
    const endTime = normalizeTime(entry.end_time, "entry.end_time");
    ensureTimeOrder(startTime, endTime);
    return {
      class_id: intValue(entry.class_id, "entry.class_id"),
      section_id: intValue(entry.section_id, "entry.section_id", { required: false }),
      medium: optionalString(entry.medium),
      stream_id: intValue(entry.stream_id, "entry.stream_id", { required: false }),
      subject_id: intValue(entry.subject_id, "entry.subject_id", { required: entryType === "subject" }),
      exam_subject_id: intValue(entry.exam_subject_id, "entry.exam_subject_id", { required: false }),
      entry_type: entryType,
      title: optionalString(entry.title),
      exam_date: normalizeDate(entry.exam_date, "entry.exam_date"),
      start_time: startTime,
      end_time: endTime,
      room: optionalString(entry.room),
      instructions: optionalString(entry.instructions),
      sort_order: Number.isInteger(Number(entry.sort_order)) ? Number(entry.sort_order) : index,
      invigilators: normalizeTeachers(entry.invigilators || [], "invigilators"),
    };
  });
}

function normalizeExamRoutinePayload(body, exam, userId) {
  return {
    exam_id: exam.id,
    session_id: exam.session_id,
    class_scope: normalizeClassScope(body.class_scope || body.scope || "school"),
    class_id: intValue(body.class_id, "class_id"),
    section_id: intValue(body.section_id, "section_id", { required: false }),
    medium: optionalString(body.medium),
    stream_id: intValue(body.stream_id, "stream_id", { required: false }),
    title: optionalString(body.title),
    source: optionalString(body.source) || "manual",
    parent_version_id: intValue(body.parent_version_id, "parent_version_id", { required: false }),
    publish_announcement_requested: Boolean(body.publish_announcement_requested) ? 1 : 0,
    user_id: userId,
  };
}

function applyExamRoutineScopeToEntries(entries, scope) {
  return entries.map((entry) => ({
    ...entry,
    class_id: scope.class_id,
    section_id: scope.section_id,
    medium: scope.medium,
    stream_id: scope.stream_id,
  }));
}

async function ensureExamRoutineSubjectsAllowed(examId, scope, entries) {
  const subjectEntries = entries.filter((entry) => entry.entry_type === "subject");
  if (!subjectEntries.length) return;
  const eligibility = await repo.getExamRoutineSubjectEligibility(examId, scope);
  const examSubjectsBySubject = new Map();
  const examSubjectsById = new Map();
  const offeredSubjectIds = new Set();
  eligibility.forEach((row) => {
    if (row.subject_id) examSubjectsBySubject.set(String(row.subject_id), row);
    if (row.exam_subject_id) examSubjectsById.set(String(row.exam_subject_id), row);
    if (row.offered_subject_id) offeredSubjectIds.add(String(row.offered_subject_id));
    if (row.class_subject_id) offeredSubjectIds.add(String(row.class_subject_id));
  });
  for (const entry of subjectEntries) {
    const subjectKey = String(entry.subject_id || "");
    const examSubjectKey = String(entry.exam_subject_id || "");
    if (!examSubjectsBySubject.has(subjectKey)) {
      throw new AppError("Selected subject is not configured for this exam", 400);
    }
    if (entry.exam_subject_id) {
      const examSubject = examSubjectsById.get(examSubjectKey);
      if (!examSubject || String(examSubject.subject_id) !== subjectKey) {
        throw new AppError("Selected exam subject does not match the selected subject", 400);
      }
    }
    if (offeredSubjectIds.size && !offeredSubjectIds.has(subjectKey)) {
      throw new AppError("Selected subject is not offered for this class or section", 400);
    }
  }
}

export function listExamRoutines(filters = {}) {
  return repo.listExamRoutineVersions({
    ...filters,
    status: normalizeBoardStatus(filters.status),
  });
}

export async function listMyTeacherExamRoutines(userId, filters = {}) {
  const assignments = await repo.getTeacherRoutineAssignmentsByUserId(userId);
  if (!assignments.length) return [];
  const rows = await repo.listExamRoutineVersions({
    ...filters,
    status: normalizeBoardStatus(filters.status || "published"),
  });
  return rows.filter((routine) => assignments.some((assignment) => examRoutineMatchesTeacherAssignment(routine, assignment)));
}

export async function getExamRoutine(id) {
  const routine = await repo.getExamRoutineWithEntries(intValue(id, "exam routine id"));
  if (!routine) throw new AppError("Exam routine not found", 404);
  return routine;
}

export async function createExamRoutine(body, userId) {
  const exam = await repo.getExamById(intValue(body.exam_id, "exam_id"));
  if (!exam) throw new AppError("Exam not found", 404);
  const payload = normalizeExamRoutinePayload(body, exam, userId);
  const entries = normalizeExamRoutineEntries(applyExamRoutineScopeToEntries(body.entries, payload));
  await ensureExamRoutineSubjectsAllowed(exam.id, payload, entries);
  return repo.upsertExamRoutineForScope(payload, entries);
}

export async function importExamRoutine(file, body = {}, userId) {
  const rows = normalizeImportFile(file);
  const lookups = buildLookupMaps(await repo.getRoutineImportLookups());
  const groups = new Map();
  const errors = [];

  for (const row of rows) {
    try {
      const rowNumber = row.row_number;
      const exam = resolveLookup(
        lookups.exams,
        rowValue(row, body, ["exam_id", "exam", "exam_name"], ["exam_id", "exam"]),
        "exam",
        rowNumber
      );
      const classRow = resolveLookup(lookups.classes, rowValue(row, body, ["class_id", "class", "class_name"], ["class_id", "class"]), "class", rowNumber);
      const medium = optionalString(rowValue(row, body, ["medium"], ["medium"]));
      const sectionValue = rowValue(row, body, ["section_id", "section", "section_name"], ["section_id", "section"]);
      const section = sectionValue ? resolveSection(lookups, sectionValue, classRow.id, medium, rowNumber, false) : null;
      const streamValue = rowValue(row, body, ["stream_id", "stream", "stream_name"], ["stream_id", "stream"]);
      const stream = streamValue ? resolveLookup(lookups.streams, streamValue, "stream", rowNumber, false) : null;
      const classScope = normalizeClassScope(classRow.class_scope || body.class_scope || body.scope || "school");
      const title = rowValue(row, body, ["routine_title", "title"], ["title"]) || `${exam.name} Routine`;
      const groupKey = [exam.id, classScope, classRow.id, section?.id || 0, medium || "", stream?.id || 0, title].join("|");
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          data: {
            exam_id: exam.id,
            session_id: exam.session_id,
            class_scope: classScope,
            class_id: classRow.id,
            section_id: section?.id || null,
            medium,
            stream_id: stream?.id || null,
            title,
            source: "import",
            parent_version_id: null,
            publish_announcement_requested: Boolean(body.publish_announcement_requested) ? 1 : 0,
            user_id: userId,
          },
          entries: [],
        });
      }

      const subjectValue = pick(row, ["subject_id", "subject", "subject_name", "subject_code"]);
      const explicitType = optionalString(pick(row, ["entry_type", "type"]));
      const entryType = (explicitType || "subject").toLowerCase();
      const subject = subjectValue ? resolveLookup(lookups.subjects, subjectValue, "subject", rowNumber, entryType === "subject") : null;
      const invigilators = splitPeople(pick(row, ["invigilator_ids", "invigilator_id", "invigilators", "invigilator", "teacher"]))
        .map((teacher) => ({
          teacher_id: resolveLookup(lookups.teachers, teacher, "invigilator", rowNumber).id,
          invigilation_role: "invigilator",
        }));
      groups.get(groupKey).entries.push({
        class_id: classRow.id,
        section_id: section?.id || null,
        medium,
        stream_id: stream?.id || null,
        subject_id: subject?.id || null,
        exam_subject_id: intValue(pick(row, ["exam_subject_id"]), "exam_subject_id", { required: false }),
        entry_type: entryType,
        title: optionalString(pick(row, ["entry_title", "title", "activity", "paper"])),
        exam_date: excelDateToIso(pick(row, ["exam_date", "date", "paper_date"])),
        start_time: excelTimeToClock(pick(row, ["start_time", "start", "from"])),
        end_time: excelTimeToClock(pick(row, ["end_time", "end", "to"])),
        room: optionalString(pick(row, ["room", "room_no", "hall"])),
        instructions: optionalString(pick(row, ["instructions", "notes", "remarks"])),
        sort_order: groups.get(groupKey).entries.length,
        invigilators,
      });
    } catch (err) {
      errors.push({ row: row.row_number, message: err.message || "Could not parse row" });
    }
  }

  const imported = [];
  for (const group of groups.values()) {
    try {
      imported.push(await repo.upsertExamRoutineForScope(group.data, normalizeExamRoutineEntries(group.entries)));
    } catch (err) {
      errors.push({ row: null, message: err.message || "Could not create exam routine" });
    }
  }
  return { imported_count: imported.length, failed_count: errors.length, routines: imported, errors };
}

export async function updateExamRoutine(id, body, userId) {
  const current = await repo.getExamRoutineWithEntries(intValue(id, "exam routine id"));
  if (!current) throw new AppError("Exam routine not found", 404);
  const exam = body.exam_id ? await repo.getExamById(intValue(body.exam_id, "exam_id")) : { id: current.exam_id, session_id: current.session_id };
  if (!exam) throw new AppError("Exam not found", 404);
  const payload = normalizeExamRoutinePayload(
    {
      ...body,
      class_scope: body.class_scope || current.class_scope,
      class_id: body.class_id || current.class_id,
      section_id: body.section_id !== undefined ? body.section_id : current.section_id,
      medium: body.medium !== undefined ? body.medium : current.medium,
      stream_id: body.stream_id ?? current.stream_id,
      source: current.source,
      parent_version_id: current.parent_version_id,
    },
    exam,
    userId
  );
  const entries = Array.isArray(body.entries)
    ? normalizeExamRoutineEntries(applyExamRoutineScopeToEntries(body.entries, payload))
    : undefined;
  if (entries) {
    await ensureExamRoutineSubjectsAllowed(exam.id, payload, entries);
  }
  const result = await repo.updateExamRoutineDraft(
    current.id,
    payload,
    entries
  );
  if (!result) throw new AppError("Exam routine could not be updated", 400);
  return result;
}

export async function createExamRoutineDraftFromPublished(id, userId) {
  const routine = await repo.getExamRoutineWithEntries(intValue(id, "exam routine id"));
  if (!routine) throw new AppError("Exam routine not found", 404);
  const result = await repo.getCanonicalExamRoutineForScope(routine) || await repo.createDraftFromExamRoutine(routine.id, userId);
  if (!result) throw new AppError("Exam routine not found", 404);
  return result;
}

export async function deleteExamRoutine(id) {
  const result = await repo.deleteExamRoutineVersion(intValue(id, "exam routine id"));
  if (!result.affectedRows) throw new AppError("Only draft or published exam routines can be deleted", 400);
  return { deleted: true };
}

export async function publishExamRoutine(id, userId) {
  const routineId = intValue(id, "exam routine id");
  const routine = await repo.getExamRoutineWithEntries(routineId);
  if (!routine) throw new AppError("Exam routine not found", 404);
  if (!routine.entries?.length) throw new AppError("Cannot publish an empty exam routine", 400);
  const canonical = await repo.getCanonicalExamRoutineForScope(routine);
  const targetRoutine = canonical && canonical.status === "published" && canonical.id !== routine.id
    ? await repo.updateExamRoutineDraft(
        canonical.id,
        {
          exam_id: routine.exam_id,
          session_id: routine.session_id,
          class_scope: routine.class_scope,
          class_id: routine.class_id,
          section_id: routine.section_id,
          medium: routine.medium,
          stream_id: routine.stream_id,
          title: routine.title,
          publish_announcement_requested: routine.publish_announcement_requested,
          user_id: userId,
        },
        normalizeExamRoutineEntries(applyExamRoutineScopeToEntries(routine.entries.map(examRoutineEntryToPayload), routine))
      )
    : routine;
  const targetRoutineId = Number(targetRoutine.id);
  const invalidSubjects = await repo.findInvalidExamSubjects(targetRoutineId);
  if (invalidSubjects.length) {
    throw new AppError("One or more exam routine subjects are not configured for the linked exam", 400);
  }
  const conflicts = await repo.findExamRoutineInvigilatorConflicts(targetRoutineId);
  if (conflicts.length) {
    throw new AppError("Invigilator time conflict found. Resolve conflicts before publishing.", 400);
  }
  const result = await repo.publishExamRoutineVersion(targetRoutineId, userId);
  if (!result) throw new AppError("Exam routine not found", 404);
  if (targetRoutineId !== routineId && routine.status === "draft") {
    await repo.deleteExamRoutineVersion(routineId);
  }
  return result;
}

function examRoutineEntryToPayload(entry) {
  return {
    class_id: entry.class_id,
    section_id: entry.section_id,
    medium: entry.medium,
    stream_id: entry.stream_id,
    subject_id: entry.subject_id,
    exam_subject_id: entry.exam_subject_id,
    entry_type: entry.entry_type,
    title: entry.title,
    exam_date: entry.exam_date,
    start_time: entry.start_time,
    end_time: entry.end_time,
    room: entry.room,
    instructions: entry.instructions,
    sort_order: entry.sort_order,
    invigilators: (entry.invigilator_ids || []).map((teacherId) => ({
      teacher_id: teacherId,
      invigilation_role: "invigilator",
    })),
  };
}

export async function downloadClassRoutinePdf(id) {
  const routine = await getClassRoutine(id);
  return {
    buffer: await buildClassRoutinePdf(routine),
    fileName: `class-routine-${routine.id}.pdf`,
  };
}

export async function downloadClassRoutineXlsx(id) {
  const routine = await getClassRoutine(id);
  return {
    buffer: buildClassRoutineXlsx(routine),
    fileName: classRoutineXlsxFileName(routine),
  };
}

export async function downloadExamRoutinePdf(id) {
  const routine = await getExamRoutine(id);
  return {
    buffer: await buildExamRoutinePdf(routine),
    fileName: `exam-routine-${routine.id}.pdf`,
  };
}

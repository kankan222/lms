import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import dotenv from "dotenv";
import { execute, query } from "../core/db/query.js";
import { pool } from "../database/pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

dotenv.config({ path: path.resolve(__dirname, "../.env.development") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const DEFAULT_FILES = [
  "New Eng  with new section.xlsx",
  "I To X Eng Med.xlsx",
];

const WEEKDAYS = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

function decodeXml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function lookupKey(value) {
  return normalizeText(value).toLowerCase().replace(/[\s._-]+/g, "");
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
  if (eocdOffset < 0) throw new Error("Invalid XLSX file");

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

function readSheets(entries) {
  const workbook = entries.get("xl/workbook.xml")?.toString("utf8") || "";
  const rels = entries.get("xl/_rels/workbook.xml.rels")?.toString("utf8") || "";
  return [...workbook.matchAll(/<sheet\b([^>]*)\/>/g)].map((match, index) => {
    const attrs = match[1];
    const name = decodeXml(attrs.match(/name="([^"]+)"/)?.[1] || `Sheet${index + 1}`);
    const relId = attrs.match(/r:id="([^"]+)"/)?.[1];
    const target = relId
      ? rels.match(new RegExp(`<Relationship[^>]*Id="${relId}"[^>]*Target="([^"]+)"`))?.[1]
      : null;
    const sheetPath = target
      ? target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\.\//, "")}`
      : `xl/worksheets/sheet${index + 1}.xml`;
    return { name, path: sheetPath };
  });
}

function readSheetRows(entries, sheetPath, sharedStrings) {
  const xml = entries.get(sheetPath)?.toString("utf8") || "";
  return [...xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const rowNumber = Number(rowMatch[1].match(/\br="(\d+)"/)?.[1] || 0);
    const cells = [];
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const ref = attrs.match(/\br="([^"]+)"/)?.[1] || "";
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] || "";
      const raw = cellMatch[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] || cellMatch[2].match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] || "";
      const value = type === "s" ? sharedStrings[Number(raw)] || "" : decodeXml(raw);
      cells[columnIndex(ref)] = normalizeText(value);
    }
    return { rowNumber, cells };
  }).filter((row) => row.cells.some(Boolean));
}

function readWorkbook(filePath) {
  const buffer = fs.readFileSync(filePath);
  const entries = readZipEntries(buffer);
  const sharedStrings = readSharedStrings(entries);
  return readSheets(entries).map((sheet) => ({
    name: sheet.name,
    rows: readSheetRows(entries, sheet.path, sharedStrings),
  }));
}

function parseTimePart(value, fallbackMeridiem = "") {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = String(match[3] || fallbackMeridiem || "").toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function parseTimeRange(value) {
  const normalized = normalizeText(value).replace(/([ap]m)\s*(\d)/gi, "$1 $2");
  const match = normalized.match(/(\d{1,2}:\d{2})\s*(am|pm)?\s+(\d{1,2}:\d{2})\s*(am|pm)?/i);
  if (!match) return null;
  const endMeridiem = match[4] || match[2] || "";
  const start = parseTimePart(`${match[1]}${match[2] || endMeridiem}`, endMeridiem);
  const end = parseTimePart(`${match[3]}${endMeridiem}`, endMeridiem);
  return start && end ? { start_time: start, end_time: end } : null;
}

function weekdayFromText(value) {
  const first = normalizeText(value).split(/\s+/)[0].toLowerCase();
  return WEEKDAYS[first] || null;
}

function normalizeSectionName(value) {
  const text = normalizeText(value).replace(/\s+/g, "");
  return text.replace(/^A-?(\d)$/i, "A$1").toUpperCase();
}

function parseClassLabel(value) {
  const text = normalizeText(value);
  if (/^nursery$/i.test(text)) {
    return { class_name: "Nursery", section_name: "A1", class_label: text };
  }
  const match = text.match(/^Class\s+(.+?)\s*\(([^)]+)\)/i);
  if (!match) return null;
  return {
    class_name: `Class ${normalizeText(match[1])}`,
    section_name: normalizeSectionName(match[2]),
    class_label: text,
  };
}

function canonicalSubject(value) {
  const text = normalizeText(value)
    .replace(/\bSeience\b/gi, "Science")
    .replace(/\bAaasmese\b/gi, "Assamese")
    .replace(/\bEgn\.?\s*I\b/gi, "Eng. I")
    .replace(/\bEngl\.?\s*I\b/gi, "Eng. I")
    .replace(/\bEng\s*I\b/gi, "Eng. I")
    .replace(/\bEnglish\s*I\b/gi, "Eng. I")
    .replace(/\bEnglish\s*II\b/gi, "Eng. II")
    .replace(/\bEng\.?\s*II\b/gi, "Eng. II")
    .replace(/\bEngII\b/gi, "Eng. II")
    .replace(/\bM\.?\s*Sci\.?\b/gi, "Moral Science")
    .replace(/\bMoral\s*Sci\.?\b/gi, "Moral Science")
    .replace(/\bMaths\b/gi, "Math")
    .replace(/\bEnglish\s*Conv\.?\b/gi, "Eng. Conversation")
    .replace(/\bConversation\b/gi, "Eng. Conversation")
    .replace(/\bAs,\s*Handwriting\b/gi, "As. Handwriting");
  return normalizeText(text);
}

function parsePeriodCell(value) {
  const text = normalizeText(value);
  if (!text) return null;
  if (/^break$/i.test(text)) {
    return { entry_type: "break", title: "Break", subject_name: null, teacher_name: null };
  }
  const parts = text.split(/\s{2,}/).map(normalizeText).filter(Boolean);
  const subject = canonicalSubject(parts[0] || text);
  const teacher = parts.length > 1 ? normalizeText(parts.slice(1).join(" ")) : null;
  return {
    entry_type: /^break$/i.test(subject) ? "break" : "subject",
    title: /^break$/i.test(subject) ? "Break" : subject,
    subject_name: /^break$/i.test(subject) ? null : subject,
    teacher_name: teacher,
  };
}

function appendClassDayEntries(records, context, row, classInfo, weekday, timeRanges) {
  for (let index = 1; index <= timeRanges.length; index += 1) {
    const time = parseTimeRange(timeRanges[index - 1]);
    const parsed = parsePeriodCell(row.cells[index]);
    if (!time || !parsed) continue;
    records.push({
      source_file: context.sourceFile,
      sheet_name: context.sheetName,
      row_number: row.rowNumber,
      class_label: classInfo.class_label,
      class_name: classInfo.class_name,
      section_name: classInfo.section_name,
      medium: "English",
      weekday,
      period_number: index,
      start_time: time.start_time,
      end_time: time.end_time,
      ...parsed,
      raw_value: row.cells[index] || "",
    });
  }
}

function parseRoutineWorkbook(filePath) {
  const sourceFile = path.basename(filePath);
  const sheets = readWorkbook(filePath);
  const records = [];

  for (const sheet of sheets) {
    let currentWeekday = null;
    let currentClass = null;
    let timeRanges = [];

    for (const row of sheet.rows) {
      const first = normalizeText(row.cells[0]);
      if (!first || /^class routine$/i.test(first) || /^time table$/i.test(first)) continue;

      const weekday = weekdayFromText(first);
      if (weekday) {
        currentWeekday = weekday;
        if (currentClass && timeRanges.length && row.cells.length > 1) {
          appendClassDayEntries(records, { sourceFile, sheetName: sheet.name }, row, currentClass, weekday, timeRanges);
        }
        continue;
      }

      if (/^class\s*&\s*time$/i.test(first)) {
        timeRanges = row.cells.slice(1).filter(Boolean);
        continue;
      }

      const classInfo = parseClassLabel(first);
      if (!classInfo) continue;

      if (currentWeekday && timeRanges.length && row.cells.length > 1) {
        appendClassDayEntries(records, { sourceFile, sheetName: sheet.name }, row, classInfo, currentWeekday, timeRanges);
      } else {
        currentClass = classInfo;
      }
    }
  }

  return records;
}

async function tableHasColumn(tableName, columnName) {
  const rows = await query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function ensureImportTables() {
  await execute(
    `CREATE TABLE IF NOT EXISTS routine_excel_import_runs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      source_file VARCHAR(255) NOT NULL,
      source_hash CHAR(64) NOT NULL,
      status ENUM('running','success','failed','skipped') NOT NULL DEFAULT 'running',
      imported_versions INT NOT NULL DEFAULT 0,
      imported_entries INT NOT NULL DEFAULT 0,
      skipped_rows INT NOT NULL DEFAULT 0,
      error_message TEXT NULL,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_routine_excel_import_source (source_file),
      KEY idx_routine_excel_import_status (status, started_at)
    )`
  );
  await execute(
    `CREATE TABLE IF NOT EXISTS routine_excel_import_row_errors (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      import_run_id BIGINT NOT NULL,
      source_file VARCHAR(255) NOT NULL,
      sheet_name VARCHAR(160) NULL,
      row_number INT NULL,
      class_label VARCHAR(120) NULL,
      weekday VARCHAR(20) NULL,
      period_number INT NULL,
      cell_value TEXT NULL,
      error_message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_routine_excel_import_errors_run (import_run_id),
      CONSTRAINT fk_routine_excel_import_errors_run
        FOREIGN KEY (import_run_id) REFERENCES routine_excel_import_runs(id)
        ON DELETE CASCADE
    )`
  );
  await execute(
    `CREATE TABLE IF NOT EXISTS routine_excel_import_rows (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      import_run_id BIGINT NOT NULL,
      source_file VARCHAR(255) NOT NULL,
      sheet_name VARCHAR(160) NULL,
      row_number INT NULL,
      class_label VARCHAR(120) NULL,
      class_name VARCHAR(80) NOT NULL,
      section_name VARCHAR(40) NOT NULL,
      medium VARCHAR(40) NOT NULL DEFAULT 'English',
      weekday TINYINT NOT NULL,
      period_number INT NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      entry_type VARCHAR(40) NOT NULL,
      subject_name VARCHAR(160) NULL,
      teacher_name VARCHAR(160) NULL,
      title VARCHAR(160) NULL,
      raw_value TEXT NULL,
      imported_entry_id BIGINT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_routine_excel_import_rows_run (import_run_id),
      KEY idx_routine_excel_import_rows_scope (class_name, section_name, weekday, period_number),
      CONSTRAINT fk_routine_excel_import_rows_run
        FOREIGN KEY (import_run_id) REFERENCES routine_excel_import_runs(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_routine_excel_import_rows_entry
        FOREIGN KEY (imported_entry_id) REFERENCES class_routine_entries(id)
        ON DELETE SET NULL
    )`
  );
}

async function getActiveSessionId() {
  const explicit = Number(process.env.ROUTINE_IMPORT_SESSION_ID || 0);
  if (Number.isInteger(explicit) && explicit > 0) return explicit;
  const rows = await query("SELECT id FROM academic_sessions WHERE is_active = 1 ORDER BY id DESC LIMIT 1");
  if (rows[0]?.id) return rows[0].id;
  const fallback = await query("SELECT id FROM academic_sessions ORDER BY id DESC LIMIT 1");
  if (fallback[0]?.id) return fallback[0].id;
  throw new Error("No academic session found. Create a session or set ROUTINE_IMPORT_SESSION_ID.");
}

async function loadLookup(tableName, columns = "id, name") {
  return query(`SELECT ${columns} FROM ${tableName}`);
}

async function findClassId(name) {
  const rows = await loadLookup("classes", "id, name");
  const wanted = lookupKey(name);
  const match = rows.find((row) => lookupKey(row.name) === wanted || lookupKey(row.name) === lookupKey(name.replace(/^Class\s+/i, "")));
  if (match) return match.id;

  const hasScope = await tableHasColumn("classes", "class_scope");
  const sql = hasScope
    ? "INSERT INTO classes(name, class_scope, medium, is_active) VALUES (?, 'school', 'English', 1)"
    : "INSERT INTO classes(name, medium, is_active) VALUES (?, 'English', 1)";
  const result = await execute(sql, [name]);
  return result.insertId;
}

async function findSectionId(classId, sectionName, medium) {
  const rows = await query("SELECT id, name, medium FROM sections WHERE class_id = ?", [classId]);
  const wanted = lookupKey(sectionName);
  const match = rows.find((row) => lookupKey(row.name) === wanted && (!row.medium || lookupKey(row.medium) === lookupKey(medium)));
  if (match) return match.id;
  const result = await execute(
    "INSERT INTO sections(class_id, name, medium) VALUES (?, ?, ?)",
    [classId, sectionName, medium]
  );
  return result.insertId;
}

async function findOrCreateSubjectId(name) {
  if (!name) return null;
  const rows = await loadLookup("subjects", "id, name");
  const match = rows.find((row) => lookupKey(row.name) === lookupKey(name));
  if (match) return match.id;
  const result = await execute("INSERT INTO subjects(name, code) VALUES (?, NULL)", [name]);
  return result.insertId;
}

async function findOrCreateTeacherId(name) {
  if (!name) return null;
  const rows = await loadLookup("teachers", "id, name");
  const match = rows.find((row) => lookupKey(row.name) === lookupKey(name));
  if (match) return match.id;
  const hasScope = await tableHasColumn("teachers", "class_scope");
  const result = await execute(
    hasScope ? "INSERT INTO teachers(name, class_scope) VALUES (?, 'school')" : "INSERT INTO teachers(name) VALUES (?)",
    [name]
  );
  return result.insertId;
}

async function ensureTeacherAssignment({ teacherId, classId, sectionId, subjectId, sessionId }) {
  if (!teacherId || !subjectId) return;
  await execute(
    `INSERT IGNORE INTO teacher_class_assignments
     (teacher_id, class_id, section_id, subject_id, session_id)
     VALUES (?, ?, ?, ?, ?)`,
    [teacherId, classId, sectionId, subjectId, sessionId]
  );
}

async function nextVersionNumber(conn, group) {
  const [rows] = await conn.execute(
    `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
     FROM class_routine_versions
     WHERE session_id = ?
       AND class_id = ?
       AND section_id = ?
       AND medium = ?
       AND stream_id_dedupe = COALESCE(?, 0)`,
    [group.sessionId, group.classId, group.sectionId, group.medium, null]
  );
  return Number(rows[0]?.next_version || 1);
}

async function insertRoutineGroup(conn, group, entries) {
  const versionNumber = await nextVersionNumber(conn, group);
  const [versionResult] = await conn.execute(
    `INSERT INTO class_routine_versions
     (session_id, class_id, section_id, medium, stream_id, time_slot_template_id,
      version_number, status, title, source, parent_version_id, created_by, updated_by)
     VALUES (?, ?, ?, ?, NULL, NULL, ?, 'draft', ?, 'import', NULL, NULL, NULL)`,
    [group.sessionId, group.classId, group.sectionId, group.medium, versionNumber, group.title]
  );
  const versionId = versionResult.insertId;

  for (const entry of entries) {
    const [entryResult] = await conn.execute(
      `INSERT INTO class_routine_entries
       (routine_version_id, time_slot_id, weekday, period_number, start_time, end_time,
        entry_type, subject_id, title, room, notes, sort_order)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [
        versionId,
        entry.weekday,
        entry.period_number,
        entry.start_time,
        entry.end_time,
        entry.entry_type,
        entry.subject_id,
        entry.title,
        `Imported from ${entry.source_file} (${entry.sheet_name} row ${entry.row_number})`,
        entry.sort_order,
      ]
    );
    if (entry.teacher_id) {
      await conn.execute(
        `INSERT IGNORE INTO class_routine_entry_teachers
         (routine_entry_id, teacher_id, teacher_role)
         VALUES (?, ?, 'primary')`,
        [entryResult.insertId, entry.teacher_id]
      );
    }
    await conn.execute(
      "UPDATE routine_excel_import_rows SET imported_entry_id = ? WHERE id = ?",
      [entryResult.insertId, entry.import_row_id]
    );
  }

  return { versionId, entryCount: entries.length };
}

async function insertSourceRow(runId, record) {
  const result = await execute(
    `INSERT INTO routine_excel_import_rows
     (import_run_id, source_file, sheet_name, row_number, class_label, class_name, section_name,
      medium, weekday, period_number, start_time, end_time, entry_type, subject_name, teacher_name,
      title, raw_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      runId,
      record.source_file,
      record.sheet_name || null,
      record.row_number || null,
      record.class_label || null,
      record.class_name,
      record.section_name,
      record.medium,
      record.weekday,
      record.period_number,
      record.start_time,
      record.end_time,
      record.entry_type,
      record.subject_name || null,
      record.teacher_name || null,
      record.title || null,
      record.raw_value || null,
    ]
  );
  return result.insertId;
}

async function recordRowError(runId, record, message) {
  await execute(
    `INSERT INTO routine_excel_import_row_errors
     (import_run_id, source_file, sheet_name, row_number, class_label, weekday, period_number, cell_value, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      runId,
      record.source_file,
      record.sheet_name || null,
      record.row_number || null,
      record.class_label || null,
      record.weekday || null,
      record.period_number || null,
      record.raw_value || null,
      String(message || "Could not import row").slice(0, 2000),
    ]
  );
}

async function startRun(sourceFile, hash, force) {
  const existing = await query("SELECT * FROM routine_excel_import_runs WHERE source_file = ? LIMIT 1", [sourceFile]);
  if (existing[0] && existing[0].source_hash === hash && existing[0].status === "success" && !force) {
    return { id: existing[0].id, skip: true };
  }
  if (existing[0]) {
    await execute(
      `UPDATE routine_excel_import_runs
       SET source_hash = ?, status = 'running', imported_versions = 0, imported_entries = 0,
           skipped_rows = 0, error_message = NULL, started_at = NOW(), finished_at = NULL
       WHERE id = ?`,
      [hash, existing[0].id]
    );
    await execute("DELETE FROM routine_excel_import_row_errors WHERE import_run_id = ?", [existing[0].id]);
    await execute("DELETE FROM routine_excel_import_rows WHERE import_run_id = ?", [existing[0].id]);
    return { id: existing[0].id, skip: false };
  }
  const result = await execute(
    "INSERT INTO routine_excel_import_runs(source_file, source_hash, status) VALUES (?, ?, 'running')",
    [sourceFile, hash]
  );
  return { id: result.insertId, skip: false };
}

async function finishRun(runId, status, payload = {}) {
  await execute(
    `UPDATE routine_excel_import_runs
     SET status = ?, imported_versions = ?, imported_entries = ?, skipped_rows = ?,
         error_message = ?, finished_at = NOW()
     WHERE id = ?`,
    [
      status,
      Number(payload.importedVersions || 0),
      Number(payload.importedEntries || 0),
      Number(payload.skippedRows || 0),
      payload.errorMessage ? String(payload.errorMessage).slice(0, 2000) : null,
      runId,
    ]
  );
}

async function importWorkbook(filePath, options) {
  const sourceFile = path.basename(filePath);
  const buffer = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const run = await startRun(sourceFile, hash, options.force);
  if (run.skip) {
    await finishRun(run.id, "skipped");
    return { sourceFile, skipped: true, importedVersions: 0, importedEntries: 0, skippedRows: 0 };
  }

  try {
    const sessionId = await getActiveSessionId();
    const rawRecords = parseRoutineWorkbook(filePath);
    const groups = new Map();
    let skippedRows = 0;

    for (const record of rawRecords) {
      try {
        const importRowId = await insertSourceRow(run.id, record);
        const classId = await findClassId(record.class_name);
        const sectionId = await findSectionId(classId, record.section_name, record.medium);
        const subjectId = record.subject_name ? await findOrCreateSubjectId(record.subject_name) : null;
        const teacherId = record.teacher_name ? await findOrCreateTeacherId(record.teacher_name) : null;
        await ensureTeacherAssignment({ teacherId, classId, sectionId, subjectId, sessionId });

        const groupKey = `${sourceFile}|${classId}|${sectionId}|${record.medium}`;
        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            sessionId,
            classId,
            sectionId,
            medium: record.medium,
            title: `${sourceFile.replace(/\.xlsx$/i, "")} - ${record.class_name} ${record.section_name}`.slice(0, 180),
            entries: [],
          });
        }
        const group = groups.get(groupKey);
        group.entries.push({
          ...record,
          import_row_id: importRowId,
          subject_id: subjectId,
          teacher_id: teacherId,
          sort_order: group.entries.length,
        });
      } catch (err) {
        skippedRows += 1;
        await recordRowError(run.id, record, err.message);
      }
    }

    const conn = await pool.getConnection();
    let importedVersions = 0;
    let importedEntries = 0;
    try {
      await conn.beginTransaction();
      for (const group of groups.values()) {
        const result = await insertRoutineGroup(conn, group, group.entries);
        importedVersions += result.versionId ? 1 : 0;
        importedEntries += result.entryCount;
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    await finishRun(run.id, "success", { importedVersions, importedEntries, skippedRows });
    return { sourceFile, skipped: false, importedVersions, importedEntries, skippedRows };
  } catch (err) {
    await finishRun(run.id, "failed", { errorMessage: err.message });
    throw err;
  }
}

function parseArgs(argv) {
  const force = argv.includes("--force");
  const dryRun = argv.includes("--dry-run");
  const explicitFiles = argv.filter((item) => !item.startsWith("--"));
  return { force, dryRun, files: explicitFiles.length ? explicitFiles : DEFAULT_FILES };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.dryRun) {
    for (const file of options.files) {
      const filePath = path.isAbsolute(file) ? file : path.resolve(repoRoot, file);
      if (!fs.existsSync(filePath)) throw new Error(`Routine workbook not found: ${filePath}`);
      const records = parseRoutineWorkbook(filePath);
      const classes = new Set(records.map((record) => `${record.class_name} ${record.section_name}`));
      console.log(`${path.basename(filePath)}: parsed ${records.length} entries for ${classes.size} class-section routine(s)`);
    }
    return;
  }

  await ensureImportTables();
  const results = [];

  for (const file of options.files) {
    const filePath = path.isAbsolute(file) ? file : path.resolve(repoRoot, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Routine workbook not found: ${filePath}`);
    }
    results.push(await importWorkbook(filePath, options));
  }

  for (const result of results) {
    console.log(
      `${result.sourceFile}: ${result.skipped ? "skipped" : "imported"} ` +
      `${result.importedVersions} routine version(s), ${result.importedEntries} entries, ${result.skippedRows} skipped row(s)`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

import fs from "node:fs/promises";
import PDFDocument from "pdfkit";

const WEEKDAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SCHOOL_NAME = "KALONG KAPILI VIDYAPITH";
const INK = "#253047";
const MUTED = "#475569";
const FILL = "#f1f5f9";
const MARGIN = 36;
const FONT_SIZE = 9;
const PADDING = 6;
const LINE_GAP = 2;

function text(value, fallback = "-") {
  return String(value ?? "").trim() || fallback;
}

function displayType(value) {
  return text(value).replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateText(value) {
  // Database DATE/DATETIME strings are school-local values, not UTC instants.
  const match = typeof value === "string" && value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" });
  }
  return text(value);
}

function timeText(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "--:--";
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

function dateKey(value) {
  return value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
    : text(value, "").slice(0, 10);
}

function weekdayText(value) {
  const day = new Date(`${dateKey(value)}T00:00:00Z`);
  return Number.isNaN(day.getTime()) ? "" : day.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
}

function timeRange(entry) {
  return `${timeText(entry.start_time)}\n${timeText(entry.end_time)}`;
}

function entryLabel(entry) {
  return text(entry.title || entry.subject_name || entry.activity_name || displayType(entry.entry_type));
}

function periodLabel(entry) {
  if (entry.entry_type === "break" || entry.slot_default_entry_type === "break") return text(entry.slot_label, "Break");
  return text(entry.slot_label, `Period ${text(entry.period_number)}`);
}

async function loadLogo() {
  const candidates = [
    "../../../frontend/website/public/assets/site/logo.png",
    "../../../frontend/software/public/assets/logobg.png",
    "../../../frontend/website/public/assets/site/logobg.png",
  ];
  for (const candidate of candidates) {
    try {
      return await fs.readFile(new URL(candidate, import.meta.url));
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }
  return null;
}

function collectBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

// Exact font metrics let oversized rows continue without ellipses or clipping.
function wrapLines(doc, value, width) {
  const lines = [];
  for (const paragraph of text(value).split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (doc.widthOfString(line ? `${line} ${word}` : word) <= width) {
        line = line ? `${line} ${word}` : word;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      for (const character of word) {
        if (line && doc.widthOfString(line + character) > width) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawLines(doc, lines, x, y, width, lineHeight, align = "left") {
  lines.forEach((line, index) => {
    const lineWidth = doc.widthOfString(line);
    const offset = align === "center" ? (width - lineWidth) / 2 : align === "right" ? width - lineWidth : 0;
    doc.text(line, x + offset, y + index * lineHeight, { lineBreak: false });
  });
}

function wrapCell(doc, value, width) {
  const blocks = Array.isArray(value) ? value : [{ text: text(value) }];
  return blocks.flatMap((block) => {
    doc.font(block.font || "Helvetica").fontSize(block.size || FONT_SIZE);
    const lines = block.text ? wrapLines(doc, block.text, width) : [""];
    return lines.map((line) => ({ ...block, text: line }));
  });
}

function drawCellLines(doc, lines, x, y, width, lineHeight, align) {
  lines.forEach((line, index) => {
    doc.font(line.font || "Helvetica").fontSize(line.size || FONT_SIZE).fillColor(line.color || INK);
    drawLines(doc, [line.text], x, y + index * lineHeight, width, lineHeight, align);
  });
}

function drawMetadata(doc, fields, y, width) {
  const cellWidth = width / 3;
  for (let offset = 0; offset < fields.length; offset += 3) {
    const row = fields.slice(offset, offset + 3);
    doc.font("Helvetica").fontSize(9);
    const values = row.map(([label, value]) => ({ label, lines: wrapLines(doc, value, cellWidth - 16) }));
    const height = 23 + Math.max(...values.map((value) => value.lines.length)) * 12;
    values.forEach((value, index) => {
      const x = MARGIN + index * cellWidth;
      doc.lineWidth(0.6).strokeColor(INK).rect(x, y, cellWidth, height).stroke();
      doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED);
      doc.text(value.label.toUpperCase(), x + 8, y + 6, { lineBreak: false });
      doc.font("Helvetica").fontSize(9).fillColor(INK);
      drawLines(doc, value.lines, x + 8, y + 20, cellWidth - 16, 12);
    });
    y += height;
  }
  return y;
}

function drawHeader(doc, { title, routine, fields, logo }) {
  const width = doc.page.width - MARGIN * 2;
  doc.lineWidth(0.9).strokeColor(INK).rect(24, 24, doc.page.width - 48, doc.page.height - 48).stroke();
  if (logo) doc.image(logo, MARGIN + 3, MARGIN + 1, { fit: [66, 66], align: "center", valign: "center" });
  const headingX = MARGIN + 78;
  const headingWidth = width - 156;
  doc.font("Times-Bold").fontSize(21).fillColor(INK);
  let y = MARGIN;
  const headingLines = wrapLines(doc, SCHOOL_NAME, headingWidth);
  drawLines(doc, headingLines, headingX, y, headingWidth, 24, "center");
  y += headingLines.length * 24;
  doc.font("Times-Roman").fontSize(10);
  drawLines(doc, ["Nagaon : Assam  |  Estd.- 2004"], headingX, y, headingWidth, 13, "center");
  y += 15;
  doc.font("Helvetica-Bold").fontSize(10);
  const isHs = routine.class_scope === "hs" || routine.layout_mode === "packed_hs" || (routine.entries || []).some((entry) => entry.class_scope === "hs");
  drawLines(doc, [isHs ? "(Higher Secondary Section)" : "(School Section)"], headingX, y, headingWidth, 13, "center");
  y += 18;
  doc.font("Helvetica-Bold").fontSize(13);
  drawLines(doc, [title], MARGIN, y, width, 16, "center");
  y += 23;
  if (routine.exam_name || routine.title) {
    doc.font("Helvetica-Bold").fontSize(10);
    const nameLines = wrapLines(doc, routine.exam_name || routine.title, width - 20);
    drawLines(doc, nameLines, MARGIN + 10, y, width - 20, 13, "center");
    y += nameLines.length * 13 + 7;
  }
  doc.lineWidth(1).moveTo(MARGIN, y).lineTo(MARGIN + width, y).stroke();
  return drawMetadata(doc, fields, y + 10, width) + 14;
}

function drawTableHeader(doc, columns, y, width) {
  doc.font("Helvetica-Bold").fontSize(9);
  const lineHeight = doc.currentLineHeight(true) + LINE_GAP;
  const lines = columns.map((column) => wrapLines(doc, column.label, width * column.fraction - PADDING * 2));
  const height = Math.max(...lines.map((items) => items.length)) * lineHeight + PADDING * 2;
  let x = MARGIN;
  columns.forEach((column, index) => {
    const cellWidth = width * column.fraction;
    doc.rect(x, y, cellWidth, height).fillAndStroke(FILL, INK);
    doc.fillColor(INK);
    drawLines(doc, lines[index], x + PADDING, y + PADDING, cellWidth - PADDING * 2, lineHeight, "center");
    x += cellWidth;
  });
  return y + height;
}

async function buildRoutinePdf({ title, routine, fields, columns, rows, pageSize = "A4" }) {
  const logoData = await loadLogo();
  const doc = new PDFDocument({ size: pageSize, layout: "landscape", margin: MARGIN, bufferPages: true,
    info: { Title: `${title} - ${text(routine.exam_name || routine.class_name, SCHOOL_NAME)}`, Author: SCHOOL_NAME } });
  const done = collectBuffer(doc);
  const logo = logoData ? doc.openImage(logoData) : null;
  const width = doc.page.width - MARGIN * 2;
  const bottom = doc.page.height - 72;
  let tableTop;
  const startPage = () => {
    tableTop = drawTableHeader(doc, columns, drawHeader(doc, { title, routine, fields, logo }), width);
    return tableTop;
  };
  let y = startPage();
  if (!rows.length) rows = [{ subject: "No routine entries found." }];
  for (const row of rows) {
    doc.font("Helvetica").fontSize(FONT_SIZE);
    const lineHeight = doc.currentLineHeight(true) + LINE_GAP;
    const cells = columns.map((column) => wrapCell(doc, row[column.key], width * column.fraction - PADDING * 2));
    const rowLines = Math.max(...cells.map((lines) => lines.length));
    let offset = 0;
    while (offset < rowLines) {
      if (bottom - y < PADDING * 2 + lineHeight) {
        doc.addPage();
        y = startPage();
      }
      const availableLines = Math.floor((bottom - y - PADDING * 2) / lineHeight);
      if (availableLines < 1) throw new Error("Routine PDF header is too large to leave room for the table");
      const remaining = rowLines - offset;
      const pageCapacity = Math.floor((bottom - tableTop - PADDING * 2) / lineHeight);
      // Keep normal rows together; split only rows taller than a fresh page.
      if (offset === 0 && remaining > availableLines && remaining <= pageCapacity) {
        doc.addPage();
        y = startPage();
        continue;
      }
      const count = Math.min(remaining, availableLines);
      const height = count * lineHeight + PADDING * 2;
      let x = MARGIN;
      doc.font("Helvetica").fontSize(FONT_SIZE);
      columns.forEach((column, index) => {
        const cellWidth = width * column.fraction;
        if (row.isBreak) doc.rect(x, y, cellWidth, height).fillAndStroke("#f8fafc", INK);
        else doc.rect(x, y, cellWidth, height).strokeColor(INK).stroke();
        doc.fillColor(INK);
        const lines = cells[index].slice(offset, offset + count);
        if (offset > 0 && index === 0 && !lines.length) lines.push({ text: row.continuationLabel || "Cont." });
        drawCellLines(doc, lines, x + PADDING, y + PADDING, cellWidth - PADDING * 2, lineHeight, column.align);
        x += cellWidth;
      });
      y += height;
      offset += count;
    }
  }
  const pages = doc.bufferedPageRange();
  for (let page = pages.start; page < pages.start + pages.count; page += 1) {
    doc.switchToPage(page);
    const footerY = doc.page.height - 51;
    doc.strokeColor(INK).lineWidth(0.6).moveTo(MARGIN, footerY - 6).lineTo(MARGIN + width, footerY - 6).stroke();
    doc.font("Helvetica").fontSize(8).fillColor(MUTED);
    drawLines(doc, ["Kalong Kapili Vidyapith, Nagaon (Assam)"], MARGIN, footerY, width, 10);
    drawLines(doc, [`Page ${page - pages.start + 1} of ${pages.count}`], MARGIN, footerY, width, 10, "right");
  }
  doc.end();
  return done;
}

function metadata(routine) {
  return [
    ["Session", text(routine.session_name)], ["Class", text(routine.class_name, "All classes")],
    ["Section", text(routine.section_name, "All sections")], ["Medium", text(routine.medium, "All mediums")],
    ["Stream", text(routine.stream_name, "All streams")],
    ["Status", `${displayType(routine.status)}${routine.published_at ? ` | ${dateText(routine.published_at)}` : ""}`],
  ];
}

export function buildClassRoutinePdf(routine) {
  const entries = [...(routine.entries || [])].sort((a, b) =>
    Number(a.weekday) - Number(b.weekday) || Number(a.period_number) - Number(b.period_number) ||
    String(a.start_time || "").localeCompare(String(b.start_time || "")) || Number(a.sort_order || 0) - Number(b.sort_order || 0)
  );
  const periodNumbers = [...new Set(entries.map((entry) => Number(entry.period_number)).filter(Boolean))].sort((a, b) => a - b);
  if (!periodNumbers.length) {
    return buildRoutinePdf({ title: "CLASS ROUTINE", routine, fields: metadata(routine),
      columns: [{ key: "subject", label: "Weekly Timetable", fraction: 1 }], rows: [] });
  }
  const packed = routine.layout_mode === "packed_hs";
  const pageSize = packed || periodNumbers.length > 7 ? "A3" : "A4";
  const pageWidth = pageSize === "A3" ? 1190.55 : 841.89;
  const dayFraction = 76 / (pageWidth - MARGIN * 2);
  const periodFraction = (1 - dayFraction) / periodNumbers.length;
  const byDayPeriod = new Map();
  for (const entry of entries) {
    const key = `${Number(entry.weekday)}|${Number(entry.period_number)}`;
    if (!byDayPeriod.has(key)) byDayPeriod.set(key, []);
    byDayPeriod.get(key).push(entry);
  }
  const periods = periodNumbers.map((number) => {
    const periodEntries = entries.filter((entry) => Number(entry.period_number) === number);
    const times = [...new Set(periodEntries.map((entry) => `${entry.start_time}|${entry.end_time}`))];
    const first = periodEntries[0];
    return { number, first, varies: times.length > 1,
      isBreak: periodEntries.every((entry) => entry.entry_type === "break" || entry.slot_default_entry_type === "break") };
  });
  const columns = [
    { key: "day", label: "Day", fraction: dayFraction, align: "center" },
    ...periods.map((period) => ({ key: `period_${period.number}`, fraction: periodFraction,
      label: `${periodLabel(period.first)}\n${period.varies ? "Varies by day" : `${timeText(period.first.start_time)} - ${timeText(period.first.end_time)}`}` })),
  ];
  const weekdays = [1, 2, 3, 4, 5, 6, ...(entries.some((entry) => Number(entry.weekday) === 7) ? [7] : [])];
  const rows = weekdays.map((weekday) => {
    const row = { day: WEEKDAYS[weekday], continuationLabel: `${WEEKDAYS[weekday].slice(0, 3)} (cont.)` };
    for (const period of periods) {
      const slotEntries = byDayPeriod.get(`${weekday}|${period.number}`) || [];
      const blocks = [];
      for (const [index, entry] of slotEntries.entries()) {
        if (index) blocks.push({ text: "" });
        if (period.varies) blocks.push({ text: `${timeText(entry.start_time)} - ${timeText(entry.end_time)}`, size: 8, color: MUTED });
        blocks.push({ text: entryLabel(entry), font: "Helvetica-Bold" });
        if (entry.teacher_names) blocks.push({ text: entry.teacher_names, size: 8, color: MUTED });
        if (packed && (entry.applies_medium || entry.applies_section_names)) {
          blocks.push({ text: [entry.applies_medium, entry.applies_section_names].filter(Boolean).join(" / "), size: 8, color: MUTED });
        }
        if (entry.room) blocks.push({ text: `Room: ${entry.room}`, size: 8, color: MUTED });
        if (entry.notes) blocks.push({ text: `Note: ${entry.notes}`, size: 8, color: MUTED });
      }
      row[`period_${period.number}`] = blocks.length ? blocks : [{ text: period.isBreak ? "Break" : "-", color: MUTED }];
    }
    return row;
  });
  return buildRoutinePdf({ title: "CLASS ROUTINE", routine, fields: metadata(routine), columns, rows, pageSize });
}

export function buildExamRoutinePdf(routine) {
  // Current routines have a common class scope printed in the metadata. Keep a
  // per-row scope column only for legacy or genuinely mixed-scope routines.
  const showEntryScope = (routine.entries || []).some((entry) =>
    ["class_name", "section_name", "medium", "stream_name"].some((key) => entry[key] && entry[key] !== routine[key])
  );
  const rows = [...(routine.entries || [])].sort((a, b) =>
    dateKey(a.exam_date).localeCompare(dateKey(b.exam_date)) ||
    String(a.start_time || "").localeCompare(String(b.start_time || "")) ||
    String(a.class_name || "").localeCompare(String(b.class_name || ""), undefined, { numeric: true })
  ).map((entry) => ({
    date: dateText(entry.exam_date), day: weekdayText(entry.exam_date), time: timeRange(entry),
    classScope: [entry.class_name || routine.class_name, entry.section_name || routine.section_name, entry.medium || routine.medium, entry.stream_name || routine.stream_name].filter(Boolean).join("\n"),
    subject: [entryLabel(entry), entry.instructions ? `Instructions: ${entry.instructions}` : ""].filter(Boolean).join("\n"),
    invigilator: text(entry.invigilator_names), room: text(entry.room),
  }));
  const columns = [
    { key: "date", label: "Date", fraction: .12, align: "center" },
    { key: "day", label: "Day", fraction: .07, align: "center" },
    { key: "time", label: "Time\nFrom / To", fraction: showEntryScope ? .14 : .16, align: "center" },
    ...(showEntryScope ? [{ key: "classScope", label: "Class / Section / Medium", fraction: .19 }] : []),
    { key: "subject", label: "Subject / Paper", fraction: showEntryScope ? .20 : .35 },
    { key: "invigilator", label: "Invigilator", fraction: showEntryScope ? .19 : .20 },
    { key: "room", label: "Room", fraction: showEntryScope ? .09 : .10, align: "center" },
  ];
  return buildRoutinePdf({ title: "EXAM ROUTINE", routine, fields: metadata(routine), columns, rows });
}

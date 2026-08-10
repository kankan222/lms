import PDFDocument from "pdfkit";

const WEEKDAYS = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

const SCHOOL_NAME = "KALONG KAPILI VIDYAPITH";
const PAGE_MARGIN = 32;
const HEADER_FILL = "#f3f4f6";
const BORDER = "#d1d5db";
const TEXT = "#111827";
const MUTED = "#4b5563";

function collectBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function text(value) {
  return value === undefined || value === null || value === "" ? "-" : String(value);
}

function clean(value) {
  return String(value ?? "").trim();
}

function timeRange(entry) {
  const start = String(entry.start_time || "").slice(0, 5) || "--:--";
  const end = String(entry.end_time || "").slice(0, 5) || "--:--";
  return `${start} - ${end}`;
}

function formatDate(value) {
  const raw = clean(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return raw || "-";
}

function weekdayFromDate(value) {
  const date = new Date(`${String(value || "").slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", { weekday: "short" });
}

function displayType(value) {
  return clean(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "-";
}

function entryLabel(entry) {
  return text(entry.title || entry.subject_name || entry.activity_name || displayType(entry.entry_type));
}

function periodLabel(entry) {
  const slotLabel = text(entry.slot_label);
  if (slotLabel !== "-") return slotLabel;
  if (entry.entry_type === "break" || entry.slot_default_entry_type === "break") return "Break";
  const customTitle = text(entry.title);
  if (entry.entry_type !== "subject" && customTitle !== "-") return customTitle;
  return `Period ${text(entry.period_number)}`;
}

function drawCenteredUnderlinedText(doc, value, x, y, width, options = {}) {
  const fontSize = options.fontSize || 13;
  doc.font(options.font || "Helvetica-Bold").fontSize(fontSize).fillColor(TEXT);
  const textWidth = doc.widthOfString(value);
  const textX = x + Math.max(0, (width - textWidth) / 2);
  doc.text(value, x, y, { width, align: "center" });
  doc
    .moveTo(textX, y + fontSize + 2)
    .lineTo(textX + textWidth, y + fontSize + 2)
    .strokeColor(TEXT)
    .stroke();
}

function drawHeader(doc, title, lines = []) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const top = doc.page.margins.top;

  doc.font("Helvetica-Bold").fontSize(17).fillColor(TEXT).text(SCHOOL_NAME, left, top, {
    width,
    align: "center",
  });
  drawCenteredUnderlinedText(doc, title, left, top + 25, width, { fontSize: 13 });

  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(MUTED);
  lines.forEach((line, index) => {
    doc.text(line, left, top + 52 + index * 15, { width, align: "center" });
  });

  return top + 52 + Math.max(lines.length, 1) * 15 + 14;
}

function drawCell(doc, x, y, width, height, value, options = {}) {
  if (options.fill) {
    doc.rect(x, y, width, height).fillAndStroke(options.fill, BORDER);
  } else {
    doc.rect(x, y, width, height).strokeColor(BORDER).stroke();
  }
  doc
    .font(options.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(options.fontSize || 8.5)
    .fillColor(options.color || TEXT)
    .text(text(value), x + 4, y + 5, {
      width: width - 8,
      height: height - 8,
      align: options.align || "left",
      ellipsis: true,
    });
}

function drawTableHeader(doc, columns, x, y, rowHeight) {
  columns.reduce((cursor, column) => {
    drawCell(doc, cursor, y, column.width, rowHeight, column.label, {
      fill: HEADER_FILL,
      bold: true,
      align: column.align || "center",
      fontSize: 8.5,
    });
    return cursor + column.width;
  }, x);
}

function drawTableRow(doc, columns, row, x, y, rowHeight) {
  columns.reduce((cursor, column) => {
    drawCell(doc, cursor, y, column.width, rowHeight, row[column.key], {
      align: column.align,
      fontSize: 8.2,
      color: column.muted ? MUTED : TEXT,
    });
    return cursor + column.width;
  }, x);
}

function ensureTableSpace(doc, neededHeight, columns, x, tableTop, rowHeight) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight <= bottom) return;
  doc.addPage();
  doc.y = tableTop;
  drawTableHeader(doc, columns, x, doc.y, rowHeight);
  doc.y += rowHeight;
}

function classRoutineRows(routine) {
  return [...(routine.entries || [])]
    .sort((a, b) =>
      Number(a.weekday) - Number(b.weekday) ||
      Number(a.period_number) - Number(b.period_number) ||
      String(a.start_time || "").localeCompare(String(b.start_time || ""))
    )
    .map((entry) => ({
      day: WEEKDAYS[Number(entry.weekday)] || text(entry.weekday),
      period: periodLabel(entry),
      time: timeRange(entry),
      type: displayType(entry.entry_type),
      subject: entryLabel(entry),
      teacher: text(entry.teacher_names),
      room: text(entry.room),
    }));
}

function examRoutineRows(routine) {
  return [...(routine.entries || [])]
    .sort((a, b) =>
      String(a.exam_date || "").localeCompare(String(b.exam_date || "")) ||
      String(a.start_time || "").localeCompare(String(b.start_time || "")) ||
      String(a.class_name || "").localeCompare(String(b.class_name || ""), undefined, { numeric: true })
    )
    .map((entry) => ({
      date: formatDate(entry.exam_date),
      day: weekdayFromDate(entry.exam_date),
      time: timeRange(entry),
      classScope: [
        entry.class_name,
        entry.section_name ? `(${entry.section_name})` : "",
        entry.medium,
        entry.stream_name,
      ].filter(Boolean).join(" "),
      subject: entryLabel(entry),
      invigilator: text(entry.invigilator_names),
      room: text(entry.room),
    }));
}

export async function buildClassRoutinePdf(routine) {
  const doc = new PDFDocument({
    margin: PAGE_MARGIN,
    size: "A4",
    layout: "landscape",
  });
  const done = collectBuffer(doc);

  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const tableTop = drawHeader(doc, "CLASS ROUTINE", [
    `Session : ${text(routine.session_name)}    Class : ${text(routine.class_name)}    Section : ${text(routine.section_name)}    Medium : ${text(routine.medium)}${routine.stream_name ? `    Stream : ${routine.stream_name}` : ""}`,
    `Version : v${text(routine.version_number)}    Status : ${displayType(routine.status)}`,
  ]);

  const columns = [
    { key: "day", label: "Day", width: 76, align: "center" },
    { key: "period", label: "Period", width: 64, align: "center" },
    { key: "time", label: "Time", width: 76, align: "center" },
    { key: "type", label: "Type", width: 74, align: "center" },
    { key: "subject", label: "Subject / Activity", width: 188 },
    { key: "teacher", label: "Teacher", width: 190 },
    { key: "room", label: "Room", width: width - 76 - 64 - 76 - 74 - 188 - 190 },
  ];
  const headerHeight = 24;
  const rowHeight = 24;

  doc.y = tableTop;
  drawTableHeader(doc, columns, left, doc.y, headerHeight);
  doc.y += headerHeight;

  const rows = classRoutineRows(routine);
  if (!rows.length) {
    drawCell(doc, left, doc.y, width, 32, "No routine entries found.", { align: "center", color: MUTED });
  } else {
    rows.forEach((row) => {
      ensureTableSpace(doc, rowHeight, columns, left, tableTop, headerHeight);
      drawTableRow(doc, columns, row, left, doc.y, rowHeight);
      doc.y += rowHeight;
    });
  }

  doc.end();
  return done;
}

export async function buildExamRoutinePdf(routine) {
  const doc = new PDFDocument({
    margin: PAGE_MARGIN,
    size: "A4",
    layout: "landscape",
  });
  const done = collectBuffer(doc);

  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const tableTop = drawHeader(doc, "EXAM ROUTINE", [
    `Exam : ${text(routine.exam_name)}    Session : ${text(routine.session_name)}`,
    `Status : ${displayType(routine.status)}`,
  ]);

  const columns = [
    { key: "date", label: "Date", width: 72, align: "center" },
    { key: "day", label: "Day", width: 50, align: "center" },
    { key: "time", label: "Time", width: 86, align: "center" },
    { key: "classScope", label: "Class / Section / Medium", width: 158 },
    { key: "subject", label: "Subject", width: 178 },
    { key: "invigilator", label: "Invigilator", width: 164 },
    { key: "room", label: "Room", width: width - 72 - 50 - 86 - 158 - 178 - 164 },
  ];
  const headerHeight = 24;
  const rowHeight = 26;

  doc.y = tableTop;
  drawTableHeader(doc, columns, left, doc.y, headerHeight);
  doc.y += headerHeight;

  const rows = examRoutineRows(routine);
  if (!rows.length) {
    drawCell(doc, left, doc.y, width, 32, "No exam routine entries found.", { align: "center", color: MUTED });
  } else {
    rows.forEach((row) => {
      ensureTableSpace(doc, rowHeight, columns, left, tableTop, headerHeight);
      drawTableRow(doc, columns, row, left, doc.y, rowHeight);
      doc.y += rowHeight;
    });
  }

  doc.end();
  return done;
}

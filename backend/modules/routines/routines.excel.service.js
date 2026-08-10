const WEEKDAYS = {
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
  7: "SUNDAY",
};

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function writeUInt16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function writeUInt32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function buildZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { time, day } = dosDateTime();

  files.forEach((file) => {
    const nameBuffer = Buffer.from(file.name);
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
    const crc = crc32(data);
    const localHeader = Buffer.concat([
      writeUInt32(0x04034b50),
      writeUInt16(20),
      writeUInt16(0x0800),
      writeUInt16(0),
      writeUInt16(time),
      writeUInt16(day),
      writeUInt32(crc),
      writeUInt32(data.length),
      writeUInt32(data.length),
      writeUInt16(nameBuffer.length),
      writeUInt16(0),
      nameBuffer,
    ]);
    localParts.push(localHeader, data);

    centralParts.push(Buffer.concat([
      writeUInt32(0x02014b50),
      writeUInt16(20),
      writeUInt16(20),
      writeUInt16(0x0800),
      writeUInt16(0),
      writeUInt16(time),
      writeUInt16(day),
      writeUInt32(crc),
      writeUInt32(data.length),
      writeUInt32(data.length),
      writeUInt16(nameBuffer.length),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(offset),
      nameBuffer,
    ]));
    offset += localHeader.length + data.length;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.concat([
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(files.length),
    writeUInt16(files.length),
    writeUInt32(centralDirectory.length),
    writeUInt32(offset),
    writeUInt16(0),
  ]);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index) {
  let name = "";
  let value = index;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function timeLabel(start, end) {
  const clean = (value) => String(value || "").slice(0, 5);
  return [clean(start), clean(end)].filter(Boolean).join("\n");
}

function displayEntryTitle(entry) {
  if (entry.entry_type === "break") return entry.title || entry.slot_label || "Break";
  return entry.title || entry.subject_name || entry.activity_name || entry.slot_label || "";
}

function entryText(entry) {
  const parts = [
    displayEntryTitle(entry),
    entry.applies_section_names ? `Sections: ${entry.applies_section_names}` : "",
    entry.applies_medium ? `Medium: ${entry.applies_medium}` : "",
    entry.teacher_names || "",
  ].filter(Boolean);
  return parts.join("\n");
}

function periodSort(a, b) {
  return Number(a.period_number || 0) - Number(b.period_number || 0) ||
    String(a.start_time || "").localeCompare(String(b.start_time || ""));
}

function uniquePeriods(entries) {
  const periods = new Map();
  [...entries].sort(periodSort).forEach((entry) => {
    const key = String(entry.period_number || "");
    if (!periods.has(key)) {
      periods.set(key, {
        period_number: Number(entry.period_number || periods.size + 1),
        start_time: entry.start_time,
        end_time: entry.end_time,
      });
    }
  });
  return [...periods.values()];
}

function entriesFor(entries, weekday, period) {
  return entries
    .filter((entry) => Number(entry.weekday) === Number(weekday) && Number(entry.period_number) === Number(period.period_number))
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(displayEntryTitle(a)).localeCompare(displayEntryTitle(b)));
}

function routineClassLabel(routine) {
  return [routine.class_name, routine.section_name, routine.medium, routine.stream_name]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
}

function sheetName(value) {
  return String(value || "Routine").replace(/[\\/?*:[\]]/g, " ").slice(0, 31) || "Routine";
}

function fileSafe(value) {
  return String(value || "routine")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "routine";
}

function createSheetBuilder() {
  const cells = [];
  const merges = [];
  const rowHeights = new Map();
  const colWidths = new Map();

  return {
    cell(row, col, value, style = 0) {
      cells.push({ row, col, value, style });
    },
    merge(fromRow, fromCol, toRow, toCol) {
      merges.push(`${columnName(fromCol)}${fromRow}:${columnName(toCol)}${toRow}`);
    },
    rowHeight(row, height) {
      rowHeights.set(row, height);
    },
    colWidth(col, width) {
      colWidths.set(col, width);
    },
    build(name) {
      return buildWorkbook({ name, cells, merges, rowHeights, colWidths });
    },
  };
}

function buildWorksheet({ cells, merges, rowHeights, colWidths }) {
  const maxRow = Math.max(...cells.map((cell) => cell.row), 1);
  const maxCol = Math.max(...cells.map((cell) => cell.col), 1);
  const byRow = new Map();
  cells.forEach((cell) => {
    if (!byRow.has(cell.row)) byRow.set(cell.row, []);
    byRow.get(cell.row).push(cell);
  });

  const cols = [];
  for (let col = 1; col <= maxCol; col += 1) {
    const width = colWidths.get(col) || (col === 1 ? 18 : 24);
    cols.push(`<col min="${col}" max="${col}" width="${width}" customWidth="1"/>`);
  }

  const rows = [];
  for (let row = 1; row <= maxRow; row += 1) {
    const height = rowHeights.get(row);
    const attrs = height ? ` r="${row}" ht="${height}" customHeight="1"` : ` r="${row}"`;
    const rowCells = (byRow.get(row) || [])
      .sort((a, b) => a.col - b.col)
      .map((cell) => {
        const ref = `${columnName(cell.col)}${cell.row}`;
        return `<c r="${ref}" t="inlineStr" s="${cell.style || 0}"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
      })
      .join("");
    rows.push(`<row${attrs}>${rowCells}</row>`);
  }

  const mergeXml = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${columnName(maxCol)}${maxRow}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${cols.join("")}</cols>
  <sheetData>${rows.join("")}</sheetData>
  ${mergeXml}
</worksheet>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="16"/><name val="Calibri"/></font>
    <font><b/><sz val="12"/><name val="Calibri"/></font>
    <font><sz val="10"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function buildWorkbook({ name, cells, merges, rowHeights, colWidths }) {
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${escapeXml(sheetName(name))}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  return buildZip([
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: rels },
    { name: "xl/workbook.xml", data: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRels },
    { name: "xl/styles.xml", data: stylesXml() },
    { name: "xl/worksheets/sheet1.xml", data: buildWorksheet({ cells, merges, rowHeights, colWidths }) },
  ]);
}

function buildStandardRoutineWorkbook(routine, entries) {
  const sheet = createSheetBuilder();
  const periods = uniquePeriods(entries);
  const maxCol = periods.length + 1;
  const classLabel = routineClassLabel(routine) || "Class";
  let row = 1;

  sheet.colWidth(1, 20);
  periods.forEach((period, index) => sheet.colWidth(index + 2, period.period_number === 0 ? 16 : 24));

  if (!entries.length) {
    sheet.cell(row, 1, `TIME TABLE - ${classLabel}`, 1);
    sheet.merge(row, 1, row, Math.max(maxCol, 2));
    sheet.rowHeight(row, 24);
    row += 1;
    sheet.cell(row, 1, "No routine entries found.", 5);
    sheet.merge(row, 1, row, Math.max(maxCol, 2));
    return sheet.build("Class Routine");
  }

  Object.entries(WEEKDAYS).forEach(([weekday, label]) => {
    const dayEntries = entries.filter((entry) => Number(entry.weekday) === Number(weekday));
    if (!dayEntries.length) return;

    sheet.cell(row, 1, "TIME TABLE", 1);
    sheet.merge(row, 1, row, maxCol);
    sheet.rowHeight(row, 24);
    row += 1;

    sheet.cell(row, 1, `${label} (${classLabel})`, 2);
    sheet.merge(row, 1, row, maxCol);
    sheet.rowHeight(row, 22);
    row += 1;

    sheet.cell(row, 1, "Class & Time", 3);
    periods.forEach((period, index) => sheet.cell(row, index + 2, timeLabel(period.start_time, period.end_time), 3));
    sheet.rowHeight(row, 34);
    row += 1;

    sheet.cell(row, 1, classLabel, 4);
    periods.forEach((period, index) => {
      const cellEntries = entriesFor(entries, weekday, period);
      const value = cellEntries.map(entryText).filter(Boolean).join("\n\n");
      sheet.cell(row, index + 2, value, cellEntries.some((entry) => entry.entry_type === "break") ? 6 : 5);
    });
    sheet.rowHeight(row, 60);
    row += 3;
  });

  return sheet.build("Class Routine");
}

function buildPackedHsRoutineWorkbook(routine, entries) {
  const sheet = createSheetBuilder();
  const periods = uniquePeriods(entries);
  const maxCol = periods.length + 1;
  const classLabel = routineClassLabel(routine) || "Higher Secondary Routine";
  let row = 1;

  sheet.colWidth(1, 16);
  periods.forEach((period, index) => sheet.colWidth(index + 2, period.period_number === 0 ? 14 : 26));

  sheet.cell(row, 1, classLabel, 1);
  sheet.merge(row, 1, row, maxCol);
  sheet.rowHeight(row, 26);
  row += 1;

  sheet.cell(row, 1, "Day", 3);
  periods.forEach((period, index) => sheet.cell(row, index + 2, timeLabel(period.start_time, period.end_time), 3));
  sheet.rowHeight(row, 36);
  row += 1;

  Object.entries(WEEKDAYS).forEach(([weekday, label]) => {
    const dayEntries = entries.filter((entry) => Number(entry.weekday) === Number(weekday));
    if (!dayEntries.length) return;
    sheet.cell(row, 1, label, 4);
    periods.forEach((period, index) => {
      const cellEntries = entriesFor(dayEntries, weekday, period);
      const value = cellEntries.map(entryText).filter(Boolean).join("\n\n");
      sheet.cell(row, index + 2, value, cellEntries.some((entry) => entry.entry_type === "break") ? 6 : 5);
    });
    sheet.rowHeight(row, 95);
    row += 1;
  });

  return sheet.build("HS Routine");
}

export function buildClassRoutineXlsx(routine) {
  const entries = Array.isArray(routine.entries) ? routine.entries : [];
  const packed = routine.layout_mode === "packed_hs" || routine.class_scope === "hs";
  return packed
    ? buildPackedHsRoutineWorkbook(routine, entries)
    : buildStandardRoutineWorkbook(routine, entries);
}

export function classRoutineXlsxFileName(routine) {
  const label = fileSafe(routineClassLabel(routine));
  return `class-routine-${label || routine.id}.xlsx`;
}

export { XLSX_CONTENT_TYPE };

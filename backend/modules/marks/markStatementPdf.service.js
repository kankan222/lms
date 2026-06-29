import PDFDocument from "pdfkit";

const TABLE_ROW_HEIGHT = 20;
const SIGNATURE_RESERVED_HEIGHT = 96;

function safeText(value) {
  return String(value ?? "").trim();
}

function formatStatementDate(value) {
  const raw = safeText(value);
  if (!raw) return "";

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  return raw;
}

function collectPdf(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function drawCell(doc, x, y, width, height, text, options = {}) {
  doc.rect(x, y, width, height).stroke();
  if (text !== undefined && text !== null && text !== "") {
    const paddingX = options.paddingX ?? 4;
    const paddingY = options.paddingY ?? 5;
    doc.text(String(text), x + paddingX, y + paddingY, {
      width: width - paddingX * 2,
      height: height - paddingY * 2,
      align: options.align || "left",
      ellipsis: options.ellipsis ?? true,
    });
  }
}

function drawCenteredUnderlinedText(doc, text, x, y, width, options = {}) {
  const fontSize = options.fontSize || 13;
  doc.font(options.font || "Helvetica-Bold").fontSize(fontSize);

  const textWidth = doc.widthOfString(text);
  const textX = x + Math.max(0, (width - textWidth) / 2);
  doc.text(text, x, y, {
    width,
    align: "center",
  });
  doc
    .moveTo(textX, y + fontSize + 2)
    .lineTo(textX + textWidth, y + fontSize + 2)
    .stroke();
}

function drawStudentTable(doc, students, x, y, width) {
  const rowHeight = TABLE_ROW_HEIGHT;
  const rollWidth = 48;
  const marksWidth = 38;
  const nameWidth = width - rollWidth - marksWidth;

  doc.font("Helvetica-Bold").fontSize(9);
  drawCell(doc, x, y, rollWidth, rowHeight, "Roll No", {
    align: "center",
    ellipsis: false,
  });
  drawCell(doc, x + rollWidth, y, nameWidth, rowHeight, "Student Name", { align: "center" });
  drawCell(doc, x + rollWidth + nameWidth, y, marksWidth, rowHeight, "Marks", { align: "center" });

  doc.font("Helvetica").fontSize(9);
  students.forEach((student, index) => {
    const rowY = y + rowHeight * (index + 1);
    drawCell(doc, x, rowY, rollWidth, rowHeight, safeText(student.roll_number), { align: "center" });
    drawCell(doc, x + rollWidth, rowY, nameWidth, rowHeight, safeText(student.student_name));
    drawCell(doc, x + rollWidth + nameWidth, rowY, marksWidth, rowHeight, "");
  });

  return y + rowHeight * (students.length + 1);
}

function getRowsPerSide(doc, tableTop) {
  const tableBottom = doc.page.height - doc.page.margins.bottom - SIGNATURE_RESERVED_HEIGHT;
  const availableHeight = tableBottom - tableTop;
  return Math.max(1, Math.floor(availableHeight / TABLE_ROW_HEIGHT) - 1);
}

export async function generateMarkStatementPdf({ exam, subject, scope, students, statementDate }) {
  const doc = new PDFDocument({
    size: "A4",
    layout: "portrait",
    margin: 32,
  });
  const done = collectPdf(doc);

  const rows = Array.isArray(students) ? students : [];
  const sampleTableTop = doc.page.margins.top + 120;
  const rowsPerSide = getRowsPerSide(doc, sampleTableTop);
  const pageSize = rowsPerSide * 2;
  const pages = [];
  for (let index = 0; index < rows.length; index += pageSize) {
    pages.push(rows.slice(index, index + pageSize));
  }
  if (!pages.length) pages.push([]);

  pages.forEach((pageRows, pageIndex) => {
    if (pageIndex > 0) doc.addPage();

    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;
    const top = doc.page.margins.top;
    const gap = 12;
    const tableWidth = (usableWidth - gap) / 2;
    const tableTop = top + 120;
    const subjectMaxMarks = Number(subject?.max_marks || 0);
    const statementDateText = formatStatementDate(statementDate);

    doc.font("Helvetica-Bold").fontSize(17).text("KALONG KAPILI VIDYAPITH", left, top, {
      width: usableWidth,
      align: "center",
    });
    drawCenteredUnderlinedText(doc, "MARKS STATEMENT", left, top + 24, usableWidth, { fontSize: 13 });

    doc.font("Helvetica-Bold").fontSize(10);
    doc.text(
      `Exam Name : ${safeText(exam?.name)}    Subject : ${safeText(subject?.subject_name)}`,
      left,
      top + 50,
      { width: usableWidth, align: "center" }
    );
    doc.text(
      `Class : ${safeText(scope?.class_name)}    Section : ${safeText(scope?.section_name)}    Medium : ${safeText(scope?.medium)}`,
      left,
      top + 66,
      { width: usableWidth, align: "center" }
    );
    doc
      .roundedRect(left, top + 88, 112, 24, 3)
      .stroke()
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(`Total Marks - ${subjectMaxMarks || "-"}`, left + 8, top + 95, {
        width: 96,
        align: "center",
      });
    doc
      .roundedRect(left + 124, top + 88, 112, 24, 3)
      .stroke()
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(`Date: ${statementDateText}`, left + 132, top + 95, {
        width: 96,
        align: "center",
      });

    if (pageRows.length <= rowsPerSide) {
      drawStudentTable(doc, pageRows, left, tableTop, usableWidth);
    } else {
      drawStudentTable(doc, pageRows.slice(0, rowsPerSide), left, tableTop, tableWidth);
      drawStudentTable(
        doc,
        pageRows.slice(rowsPerSide, pageSize),
        left + tableWidth + gap,
        tableTop,
        tableWidth
      );
    }

    const signatureY = doc.page.height - 92;
    const signatureWidth = 180;
    const signatureX = doc.page.width - doc.page.margins.right - signatureWidth;
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("Signature of Subject Teacher", signatureX, signatureY, {
        width: signatureWidth,
        align: "center",
      });
    doc
      .moveTo(signatureX + 16, signatureY + 34)
      .lineTo(signatureX + signatureWidth - 16, signatureY + 34)
      .dash(2, { space: 3 })
      .stroke()
      .undash();

    doc.font("Helvetica").fontSize(8).text(`Page ${pageIndex + 1} of ${pages.length}`, left, doc.page.height - 42, {
      width: usableWidth,
      align: "right",
    });
  });

  doc.end();
  return done;
}

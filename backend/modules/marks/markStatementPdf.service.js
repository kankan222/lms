import PDFDocument from "pdfkit";

const PAGE_ROWS_PER_SIDE = 20;

function safeText(value) {
  return String(value ?? "").trim();
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
    doc.text(String(text), x + 4, y + 5, {
      width: width - 8,
      height: height - 8,
      align: options.align || "left",
      ellipsis: true,
    });
  }
}

function drawStudentTable(doc, students, x, y, width) {
  const rowHeight = 22;
  const rollWidth = 46;
  const marksWidth = 52;
  const nameWidth = width - rollWidth - marksWidth;

  doc.font("Helvetica-Bold").fontSize(9);
  drawCell(doc, x, y, rollWidth, rowHeight, "Roll No.", { align: "center" });
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

export async function generateMarkStatementPdf({ exam, subject, scope, students }) {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 32,
  });
  const done = collectPdf(doc);

  const rows = Array.isArray(students) ? students : [];
  const pageSize = PAGE_ROWS_PER_SIDE * 2;
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
    const gap = 18;
    const tableWidth = (usableWidth - gap) / 2;
    const tableTop = top + 82;

    doc.font("Helvetica-Bold").fontSize(17).text("KALONG KAPILI VIDYAPITH", left, top, {
      width: usableWidth,
      align: "center",
    });
    doc.fontSize(13).text("(MARKS STATEMENT)", left, top + 24, {
      width: usableWidth,
      align: "center",
    });

    doc.font("Helvetica-Bold").fontSize(10);
    doc.text(
      `Exam Name : ${safeText(exam?.name)}    Subject : ${safeText(subject?.subject_name)}`,
      left,
      top + 50,
      { width: usableWidth, align: "center" }
    );
    doc.text(
      `Class : ${safeText(scope?.class_name)}    Medium : ${safeText(scope?.medium)}`,
      left,
      top + 66,
      { width: usableWidth, align: "center" }
    );

    drawStudentTable(doc, pageRows.slice(0, PAGE_ROWS_PER_SIDE), left, tableTop, tableWidth);
    if (pageRows.length > PAGE_ROWS_PER_SIDE) {
      drawStudentTable(
        doc,
        pageRows.slice(PAGE_ROWS_PER_SIDE, pageSize),
        left + tableWidth + gap,
        tableTop,
        tableWidth
      );
    }

    doc.font("Helvetica").fontSize(8).text(`Page ${pageIndex + 1} of ${pages.length}`, left, doc.page.height - 42, {
      width: usableWidth,
      align: "right",
    });
  });

  doc.end();
  return done;
}

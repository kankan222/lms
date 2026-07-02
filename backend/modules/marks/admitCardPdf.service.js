import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function sectionLabel(scope) {
  return String(scope || "").toLowerCase() === "hs" ? "HIGHER SECONDARY SECTION" : "SCHOOL SECTION";
}

function signatureLabel(scope) {
  return String(scope || "").toLowerCase() === "hs" ? "Signature of Rector" : "Signature of Principal";
}

function signaturePath(scope) {
  const fileName = String(scope || "").toLowerCase() === "hs" ? "rector.jpg" : "principal.jpg";
  return path.join(__dirname, "..", "reports", "templates", fileName);
}

function detailLine(doc, label, value, x, y, width, options = {}) {
  const fontSize = options.fontSize || 10.5;
  doc.font("Helvetica").fontSize(fontSize).fillColor("#111827");
  const labelWidth = doc.widthOfString(label);
  doc.text(label, x, y, { width: labelWidth, lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(fontSize).text(safeText(value) || "...", x + labelWidth + 4, y, {
    width: Math.max(width - labelWidth - 4, 30),
    lineBreak: false,
  });
}

function drawAdmitCard(doc, { exam, scope, student, x, y, width, height }) {
  const classScope = scope?.class_scope || "school";
  const contentTop = y + 13;

  doc.rect(x, y, width, height).stroke();

  doc
    .font("Helvetica-Bold")
    .fontSize(17)
    .fillColor("#0f3440")
    .text("KALONG KAPILI VIDYAPITH", x + 16, contentTop, { width: width - 32, align: "center" });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#1f2937")
    .text(`(${sectionLabel(classScope)})`, x + 16, contentTop + 24, { width: width - 32, align: "center" });

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#b91c1c")
    .text("ADMIT CARD", x + 16, contentTop + 43, { width: width - 32, align: "center" });

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#1f2937")
    .text(safeText(exam?.name) || "...", x + 16, contentTop + 64, { width: width - 32, align: "center" });

  const detailsTop = contentTop + 88;
  const detailLeft = x + 36;
  const detailWidth = width - 72;
  const colGap = 18;
  const colWidth = (detailWidth - colGap) / 2;
  const secondCol = detailLeft + colWidth + colGap;

  detailLine(doc, "Student's Name -", student.student_name, detailLeft, detailsTop, detailWidth, {
    fontSize: 12,
  });
  detailLine(doc, "Guardian's Name -", student.guardian_name, detailLeft, detailsTop + 24, detailWidth, {
    fontSize: 12,
  });
  detailLine(doc, "Class -", scope?.class_name, detailLeft, detailsTop + 55, colWidth, {
    fontSize: 12,
  });
  detailLine(doc, "Roll No. -", student.roll_number, secondCol, detailsTop + 55, colWidth, {
    fontSize: 12,
  });
  detailLine(doc, "Section -", student.section_name || scope?.section_name, detailLeft, detailsTop + 80, colWidth, {
    fontSize: 12,
  });
  detailLine(doc, "Medium -", student.medium || scope?.medium, secondCol, detailsTop + 80, colWidth, {
    fontSize: 12,
  });

  const signPath = signaturePath(classScope);
  const signX = x + width - 168;
  const signY = y + height - 48;
  try {
    doc.image(signPath, signX + 38, signY - 22, { width: 70, height: 26, fit: [70, 26] });
  } catch {
    // Keep generating the admit card even if the signature asset is missing.
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor("#1f2937")
    .text(signatureLabel(classScope), signX, signY + 16, { width: 148, align: "center" });
}

export async function generateAdmitCardPdf({ exam, scope, students }) {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 32,
  });
  const done = collectPdf(doc);
  const rows = Array.isArray(students) ? students : [];
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const pageHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
  const left = doc.page.margins.left;
  const rowGap = 22;
  const cardHeight = (pageHeight - rowGap) / 2;
  const cardWidth = pageWidth;
  const top = doc.page.margins.top;

  const cards = rows.length ? rows : [{ student_name: "", roll_number: "", medium: scope?.medium }];

  cards.forEach((student, index) => {
    if (index > 0 && index % 2 === 0) doc.addPage();
    const row = index % 2;
    drawAdmitCard(doc, {
      exam,
      scope,
      student,
      x: left,
      y: top + row * (cardHeight + rowGap),
      width: cardWidth,
      height: cardHeight,
    });
  });

  doc.end();
  return done;
}

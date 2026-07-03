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

function logoPath() {
  return path.join(__dirname, "..", "..", "..", "frontend", "website", "public", "assets", "site", "logo.png");
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
  const contentTop = y + 14;

  doc.rect(x, y, width, height).stroke();

  try {
    doc.image(logoPath(), x + width / 2 - 18, contentTop, { width: 36, height: 36, fit: [36, 36] });
  } catch {
    // Keep generating the admit card even if the logo asset is missing.
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#0f3440")
    .text("KALONG KAPILI VIDYAPITH", x + 12, contentTop + 40, { width: width - 24, align: "center" });

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#1f2937")
    .text(`(${sectionLabel(classScope)})`, x + 12, contentTop + 59, { width: width - 24, align: "center" });

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#b91c1c")
    .text("ADMIT CARD", x + 12, contentTop + 78, { width: width - 24, align: "center" });

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#1f2937")
    .text(safeText(exam?.name) || "...", x + 12, contentTop + 101, { width: width - 24, align: "center" });

  const detailsTop = contentTop + 138;
  const detailLeft = x + 22;
  const detailWidth = width - 44;
  const colGap = 12;
  const colWidth = (detailWidth - colGap) / 2;
  const secondCol = detailLeft + colWidth + colGap;
  const isHigherSecondary = String(classScope).toLowerCase() === "hs";
  const thirdRowGap = 8;
  const thirdRowColWidth = isHigherSecondary ? (detailWidth - thirdRowGap * 2) / 3 : colWidth;
  const thirdRowSecondCol = detailLeft + thirdRowColWidth + thirdRowGap;
  const thirdRowThirdCol = thirdRowSecondCol + thirdRowColWidth + thirdRowGap;

  detailLine(doc, "Student's Name -", student.student_name, detailLeft, detailsTop, detailWidth, {
    fontSize: 10,
  });
  detailLine(doc, "Guardian's Name -", student.guardian_name, detailLeft, detailsTop + 24, detailWidth, {
    fontSize: 10,
  });
  detailLine(doc, "Class -", scope?.class_name, detailLeft, detailsTop + 55, colWidth, {
    fontSize: 10,
  });
  detailLine(doc, "Roll No. -", student.roll_number, secondCol, detailsTop + 55, colWidth, {
    fontSize: 10,
  });
  detailLine(doc, "Section -", student.section_name || scope?.section_name, detailLeft, detailsTop + 80, thirdRowColWidth, {
    fontSize: 10,
  });
  detailLine(doc, "Medium -", student.medium || scope?.medium, thirdRowSecondCol, detailsTop + 80, thirdRowColWidth, {
    fontSize: 10,
  });
  if (isHigherSecondary) {
    detailLine(doc, "Stream -", student.stream_name, thirdRowThirdCol, detailsTop + 80, thirdRowColWidth, {
      fontSize: 10,
    });
  }

  const signPath = signaturePath(classScope);
  const signX = x + width - 132;
  const signY = y + height - 48;
  try {
    doc.image(signPath, signX + 34, signY - 20, { width: 58, height: 24, fit: [58, 24] });
  } catch {
    // Keep generating the admit card even if the signature asset is missing.
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#1f2937")
    .text(signatureLabel(classScope), signX, signY + 16, { width: 118, align: "center" });
}

export async function generateAdmitCardPdf({ exam, scope, students }) {
  const doc = new PDFDocument({
    size: "A4",
    layout: "portrait",
    margin: 32,
  });
  const done = collectPdf(doc);
  const rows = Array.isArray(students) ? students : [];
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const pageHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
  const left = doc.page.margins.left;
  const colGap = 20;
  const cardHeight = pageHeight;
  const cardWidth = (pageWidth - colGap) / 2;
  const top = doc.page.margins.top;

  const cards = rows.length ? rows : [{ student_name: "", roll_number: "", medium: scope?.medium }];

  cards.forEach((student, index) => {
    if (index > 0 && index % 2 === 0) doc.addPage();
    const col = index % 2;
    drawAdmitCard(doc, {
      exam,
      scope,
      student,
      x: left + col * (cardWidth + colGap),
      y: top,
      width: cardWidth,
      height: cardHeight,
    });
  });

  doc.end();
  return done;
}

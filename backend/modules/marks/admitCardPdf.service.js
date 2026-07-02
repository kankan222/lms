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

function drawAdmitCard(doc, { exam, scope, student, x, y, width, height }) {
  const classScope = scope?.class_scope || "school";
  const center = x + width / 2;
  const contentTop = y + 16;

  doc.rect(x, y, width, height).stroke();

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#0f3440")
    .text("KALONG KAPILI VIDYAPITH", x + 12, contentTop, { width: width - 24, align: "center" });

  doc
    .fontSize(8.5)
    .fillColor("#1f2937")
    .text(`(${sectionLabel(classScope)})`, x + 12, contentTop + 24, { width: width - 24, align: "center" });

  doc
    .fontSize(9)
    .fillColor("#b91c1c")
    .text("ADMIT CARD", x + 12, contentTop + 44, { width: width - 24, align: "center" });

  doc
    .fontSize(11)
    .fillColor("#1f2937")
    .text(safeText(exam?.name), x + 12, contentTop + 68, { width: width - 24, align: "center" });

  const detailsTop = contentTop + 96;
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#1f2937");
  doc.text(`Name of the Student- ${safeText(student.student_name)}`, x + 58, detailsTop, {
    width: width - 116,
    align: "left",
  });
  doc.text(`Class- ${safeText(scope?.class_name)}`, x + 58, detailsTop + 23, {
    width: 130,
    align: "left",
  });
  doc.text(`Medium - ${safeText(student.medium || scope?.medium)}`, center + 5, detailsTop + 23, {
    width: 130,
    align: "left",
  });
  doc.text(`Roll No.- ${safeText(student.roll_number)}`, x + 58, detailsTop + 46, {
    width: 130,
    align: "left",
  });

  const signPath = signaturePath(classScope);
  const signX = x + width - 162;
  const signY = y + height - 52;
  try {
    doc.image(signPath, signX + 40, signY - 20, { width: 62, height: 24, fit: [62, 24] });
  } catch {
    // Keep generating the admit card even if the signature asset is missing.
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#1f2937")
    .text(signatureLabel(classScope), signX, signY + 20, { width: 140, align: "center" });
}

export async function generateAdmitCardPdf({ exam, scope, students }) {
  const doc = new PDFDocument({
    size: "A4",
    layout: "portrait",
    margin: 34,
  });
  const done = collectPdf(doc);
  const rows = Array.isArray(students) ? students : [];
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;
  const rowGap = 22;
  const colGap = 24;
  const cardHeight = (doc.page.height - doc.page.margins.top - doc.page.margins.bottom - rowGap) / 2;
  const cardWidth = (pageWidth - colGap) / 2;
  const top = doc.page.margins.top;

  const cards = rows.length ? rows : [{ student_name: "", roll_number: "", medium: scope?.medium }];

  cards.forEach((student, index) => {
    if (index > 0 && index % 4 === 0) doc.addPage();
    const slot = index % 4;
    const row = Math.floor(slot / 2);
    const col = slot % 2;
    drawAdmitCard(doc, {
      exam,
      scope,
      student,
      x: left + col * (cardWidth + colGap),
      y: top + row * (cardHeight + rowGap),
      width: cardWidth,
      height: cardHeight,
    });
  });

  doc.end();
  return done;
}

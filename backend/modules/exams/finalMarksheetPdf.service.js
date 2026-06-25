import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getScopeMeta(scope) {
  if (String(scope || "").trim().toLowerCase() === "hs") {
    return {
      sectionTitle: "HIGHER SECONDARY SECTION",
      sectionAddress: "ADP Road, Christian Patty, Nagaon - 782001, Assam",
      recordTitle: "Report Card",
    };
  }

  return {
    sectionTitle: "SCHOOL SECTION",
    sectionAddress: "G.M. Road, Nagaon - 782001, Assam",
    recordTitle: "Report Card",
  };
}

async function readLogoBase64() {
  const candidates = [
    path.join(process.cwd(), "..", "frontend", "software", "public", "assets", "logobg.png"),
    path.join(process.cwd(), "..", "frontend", "website", "public", "assets", "site", "logobg.png"),
    path.join(process.cwd(), "uploads", "students", "1773661485789-logo (512).png"),
    path.join(__dirname, "..", "..", "..", "frontend", "software", "public", "assets", "logobg.png"),
    path.join(__dirname, "..", "..", "..", "frontend", "website", "public", "assets", "site", "logobg.png"),
    path.join(__dirname, "..", "..", "uploads", "students", "1773661485789-logo (512).png"),
  ];

  for (const filePath of candidates) {
    try {
      const file = await fs.readFile(filePath);
      return `data:image/png;base64,${file.toString("base64")}`;
    } catch {
      // Try the next known project layout.
    }
  }

  return "";
}

function gradeForPercentage(percentage) {
  const value = Number(percentage || 0);
  if (value >= 85) return "A++";
  if (value >= 75) return "A+";
  if (value >= 60) return "A";
  if (value >= 45) return "B";
  return "C";
}

function renderCells(values, className = "") {
  return values.map((value) => `<td class="${className}">${escapeHtml(value)}</td>`).join("");
}

export async function generateFinalMarksheetPdf(report) {
  const templatePath = path.join(__dirname, "..", "reports", "templates", "finalReportCard.html");
  let html = await fs.readFile(templatePath, "utf8");
  const logo = await readLogoBase64();
  const scopeMeta = getScopeMeta(report?.student?.class_scope);
  const exams = report.exams || [];
  const subjects = report.subjects || [];

  const examHeaders = exams
    .map(
      (exam) =>
        `<th>${escapeHtml(exam.name)}<br />${escapeHtml(exam.max_marks)} Marks</th>`
    )
    .join("");

  const subjectRows = subjects
    .map((subject) => {
      const examCells = exams
        .map((exam) => {
          const cell = subject.exams?.[exam.id];
          return `<td>${cell ? escapeHtml(cell.marks) : "-"}</td>`;
        })
        .join("");

      return `
        <tr>
          <td class="subject">${escapeHtml(subject.name)}</td>
          ${examCells}
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td>${escapeHtml(subject.total)}</td>
        </tr>`;
    })
    .join("");

  const examTotalCells = exams.map((exam) => report.exam_totals?.[exam.id]?.marks ?? "-");
  const examPercentageCells = exams.map((exam) => {
    const summary = report.exam_totals?.[exam.id];
    return summary ? `${summary.percentage}%` : "-";
  });
  const examGradeCells = exams.map((exam) => {
    const summary = report.exam_totals?.[exam.id];
    return summary ? gradeForPercentage(summary.percentage) : "-";
  });

  const signatureLabels = exams.length
    ? exams.map((exam) => exam.name)
    : ["Unit Test I", "Mock Test I", "Half Yearly Exam", "Mock Test II", "Mock Test III", "Annual Exam"];
  const paddedLabels = [...signatureLabels];
  while (paddedLabels.length < 6) paddedLabels.push("");

  const signatureCells = paddedLabels
    .slice(0, Math.max(6, signatureLabels.length))
    .flatMap((label) => [
      `Sign. of Class Teacher<br />${escapeHtml(label)}`,
      `Sign. of Guardian<br />${escapeHtml(label)}`,
      `Sign. of the Principal<br />${escapeHtml(label)}`,
      `Remarks : ${escapeHtml(label)}`,
    ])
    .map((label) => `<div class="signature-cell">${label}</div>`)
    .join("");

  html = html
    .replaceAll("{{schoolLogo}}", logo)
    .replaceAll("{{sectionTitle}}", escapeHtml(scopeMeta.sectionTitle))
    .replaceAll("{{sectionAddress}}", escapeHtml(scopeMeta.sectionAddress))
    .replaceAll("{{recordTitle}}", escapeHtml(scopeMeta.recordTitle))
    .replaceAll("{{sessionName}}", escapeHtml(report?.student?.session_name || "-"))
    .replaceAll("{{studentName}}", escapeHtml(report?.student?.name || "-"))
    .replaceAll("{{guardianName}}", escapeHtml(report?.student?.guardian_name || ""))
    .replaceAll("{{className}}", escapeHtml(report?.student?.class_name || "-"))
    .replaceAll("{{medium}}", escapeHtml(report?.student?.medium || "-"))
    .replaceAll("{{sectionName}}", escapeHtml(report?.student?.section_name || "-"))
    .replaceAll("{{rollNumber}}", escapeHtml(report?.student?.roll_number || "-"))
    .replaceAll("{{examColumnCount}}", String(Math.max(exams.length, 1)))
    .replaceAll("{{examHeaders}}", examHeaders || "<th>-</th>")
    .replaceAll("{{subjectRows}}", subjectRows)
    .replaceAll("{{examTotalCells}}", renderCells(examTotalCells))
    .replaceAll("{{examPercentageCells}}", renderCells(examPercentageCells))
    .replaceAll("{{examGradeCells}}", renderCells(examGradeCells))
    .replaceAll("{{grandTotal}}", escapeHtml(report?.summary?.total ?? 0))
    .replaceAll("{{percentage}}", escapeHtml(report?.summary?.percentage ?? 0))
    .replaceAll("{{grade}}", escapeHtml(report?.summary?.grade || "-"))
    .replaceAll("{{signatureCells}}", signatureCells);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  } finally {
    await browser.close();
  }
}

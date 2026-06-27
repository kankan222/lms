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

function formatCell(value) {
  if (value === null || value === undefined || value === "") return "";
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2).replace(/\.00$/, "") : value;
}

function formatWholeCell(value) {
  if (value === null || value === undefined || value === "") return "";
  return Number.isFinite(Number(value)) ? Number(value).toFixed(0) : value;
}

function renderGradeSecuredRows(activities = [], mockGrades = []) {
  const items = [
    ...activities.map((activity) => ({
      name: activity.name,
      grade: activity.grade || "",
    })),
    ...mockGrades.map((mock) => ({
      name: mock.name,
      grade: mock.grade || "",
    })),
  ];

  if (!items.length) {
    return `<tr><td colspan="4" class="empty-grade-row">-</td></tr>`;
  }

  if (items.length <= 6) {
    return items
      .map(
        (item) => `
        <tr>
          <td class="grade-name" colspan="2">${escapeHtml(item.name)}</td>
          <td class="grade-value" colspan="2">${escapeHtml(item.grade)}</td>
        </tr>`
      )
      .join("");
  }

  const leftItems = items.slice(0, 6);
  const rightItems = items.slice(6);
  const rowCount = Math.max(leftItems.length, rightItems.length);

  return Array.from({ length: rowCount }, (_, index) => {
    const left = leftItems[index];
    const right = rightItems[index];

    return `
        <tr>
          <td class="grade-name">${escapeHtml(left?.name || "")}</td>
          <td class="grade-value">${escapeHtml(left?.grade || "")}</td>
          <td class="grade-name">${escapeHtml(right?.name || "")}</td>
          <td class="grade-value">${escapeHtml(right?.grade || "")}</td>
        </tr>`;
  }).join("");
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
        `<th>${escapeHtml(exam.name)}<br />${escapeHtml(exam.max_marks || 100)} Marks</th>`
    )
    .join("");
  const examColGroup = exams.map(() => `<col style="width: 14mm;" />`).join("");

  const subjectRows = subjects
    .map((subject) => {
      const examCells = exams
        .map((exam) => {
          const cell = subject.exams?.[exam.id];
          return `<td>${cell ? escapeHtml(formatCell(cell.marks)) : ""}</td>`;
        })
        .join("");

      return `
        <tr>
          <td class="subject">${escapeHtml(subject.name)}</td>
          ${examCells}
          <td class="criteria-start">${escapeHtml(formatWholeCell(subject.criteria?.unit_test))}</td>
          <td>${escapeHtml(formatWholeCell(subject.criteria?.half_yearly))}</td>
          <td>${escapeHtml(formatWholeCell(subject.criteria?.annual))}</td>
          <td>${escapeHtml(formatWholeCell(subject.final_total))}</td>
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

  const gradeSecuredRows = renderGradeSecuredRows(report.activities || [], report.mock_grades || []);

  const signatureLabels = exams.length
    ? exams.map((exam) => exam.name)
    : ["Unit Test I", "Mock Test I", "Half Yearly Exam", "Mock Test II", "Mock Test III", "Annual Exam"];
  const paddedLabels = [...signatureLabels];
  while (paddedLabels.length < 6) paddedLabels.push("");

  const signatureCells = paddedLabels
    .slice(0, Math.max(6, signatureLabels.length))
    .map((label) => {
      const safeLabel = escapeHtml(label);
      return `
        <div class="signature-column">
          <div class="signature-cell">Sign. of Class Teacher<br />${safeLabel}</div>
          <div class="signature-cell">Sign. of Guardian<br />${safeLabel}</div>
          <div class="signature-cell">Sign. of the Principal<br />${safeLabel}</div>
          <div class="signature-cell signature-remarks">Remarks : ${safeLabel}</div>
        </div>`;
    })
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
    .replaceAll("{{examColGroup}}", examColGroup || `<col style="width: 14mm;" />`)
    .replaceAll("{{subjectRows}}", subjectRows)
    .replaceAll("{{examTotalCells}}", renderCells(examTotalCells))
    .replaceAll("{{examPercentageCells}}", renderCells(examPercentageCells))
    .replaceAll("{{examGradeCells}}", renderCells(examGradeCells))
    .replaceAll("{{grandTotal}}", escapeHtml(formatWholeCell(report?.summary?.total ?? 0)))
    .replaceAll("{{maxTotal}}", escapeHtml(formatWholeCell(report?.summary?.max_total ?? 0)))
    .replaceAll("{{percentage}}", escapeHtml(formatWholeCell(report?.summary?.percentage ?? 0)))
    .replaceAll("{{grade}}", escapeHtml(report?.summary?.grade || "-"))
    .replaceAll("{{gradeSecuredRows}}", gradeSecuredRows)
    .replaceAll("{{promotedClassName}}", escapeHtml(report?.student?.promoted_class_name || ""))
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

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

async function readSignatureBase64(fileName) {
  const filePath = path.join(__dirname, "..", "reports", "templates", fileName);
  const file = await fs.readFile(filePath);
  return `data:image/jpeg;base64,${file.toString("base64")}`;
}

function gradeForPercentage(percentage) {
  const value = Number(percentage || 0);
  if (value >= 85) return "A++";
  if (value >= 75) return "A+";
  if (value >= 60) return "A";
  if (value >= 45) return "B";
  return "C";
}

function qualitativeValueForGrade(grade) {
  const normalized = String(grade || "").trim().toUpperCase();
  if (normalized === "A++") return "Excellent";
  if (normalized === "A+") return "Very Good";
  if (normalized === "A") return "Good";
  if (normalized === "B") return "Average";
  if (normalized === "C") return "Below Average";
  return "";
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

function hasSplitMarks(component) {
  const pattern = String(component?.mark_pattern || "").trim().toLowerCase();
  return (
    pattern === "split" ||
    (component?.theory_marks !== null && component?.theory_marks !== undefined) ||
    (component?.practical_marks !== null && component?.practical_marks !== undefined) ||
    (component?.theory_max !== null && component?.theory_max !== undefined) ||
    (component?.practical_max !== null && component?.practical_max !== undefined)
  );
}

function isBiologyPartComponent(component) {
  const name = String(component?.name || "").trim().toLowerCase();
  return name === "botany" || name === "zoology";
}

function renderFinalMarkCell(cell) {
  if (!cell) return "<td></td>";
  if (String(cell.mark_status || "").trim().toLowerCase() === "absent") {
    return `<td class="absent-mark">AB</td>`;
  }

  const components = Array.isArray(cell.components) ? cell.components : [];
  const splitComponents = components.filter(hasSplitMarks);
  const shouldBreakDown = components.some(isBiologyPartComponent) || splitComponents.length > 0;
  if (!shouldBreakDown) {
    const isDirectSplit =
      String(cell.mark_pattern || "").trim().toLowerCase() === "split" ||
      (cell.theory_marks !== null && cell.theory_marks !== undefined) ||
      (cell.practical_marks !== null && cell.practical_marks !== undefined) ||
      (cell.theory_max !== null && cell.theory_max !== undefined) ||
      (cell.practical_max !== null && cell.practical_max !== undefined);
    if (isDirectSplit) {
      return `
        <td class="split-mark-cell">
          <div><span>Theory</span><span>-</span><span>${escapeHtml(formatCell(cell.theory_marks))}</span></div>
          <div><span>Practical</span><span>-</span><span>${escapeHtml(formatCell(cell.practical_marks))}</span></div>
          <div><span>Total</span><span>-</span><span>${escapeHtml(formatCell(cell.marks))}</span></div>
        </td>`;
    }
    return `<td>${escapeHtml(formatCell(cell.marks))}</td>`;
  }

  const theory = components.reduce(
    (sum, component) =>
      sum +
      (hasSplitMarks(component)
        ? Number(component.theory_marks || 0)
        : Number(component.marks || 0)),
    0
  );
  const practical = components.reduce(
    (sum, component) => sum + (hasSplitMarks(component) ? Number(component.practical_marks || 0) : 0),
    0
  );

  return `
    <td class="split-mark-cell">
      <div><span>Theory</span><span>-</span><span>${escapeHtml(formatCell(theory))}</span></div>
      <div><span>Practical</span><span>-</span><span>${escapeHtml(formatCell(practical))}</span></div>
      <div><span>Total</span><span>-</span><span>${escapeHtml(formatCell(cell.marks))}</span></div>
    </td>`;
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

function isClassXReport(report) {
  const className = String(report?.student?.class_name || "").trim().toUpperCase();
  return className === "X";
}

function renderFinalResultTitle(report) {
  if (isClassXReport(report)) {
    return "FINAL RESULT (UP TO TEST EXAMINATION)";
  }

  return "FINAL RESULT";
}

function renderFinalResultText(report) {
  if (isClassXReport(report)) return "";

  const grade = report?.summary?.grade || "...";
  const promotedClass = String(report?.student?.promoted_class_name || "").trim();
  return `PROMOTED TO CLASS ${escapeHtml(promotedClass || "...")} WITH ${escapeHtml(grade)} GRADE/DISTINCTION`;
}

function renderFinalExamCriteriaLabel(report) {
  return isClassXReport(report) ? "Test<br />Exam" : "Annual<br />Exam";
}

function getExamHeaderMaxMarks(exam, subjects) {
  const displayMaxMarks = Number(exam?.display_max_marks || 0);
  if (displayMaxMarks > 0) return displayMaxMarks;

  const subjectMaxMarks = subjects.reduce(
    (highest, subject) => Math.max(highest, Number(subject.exams?.[exam.id]?.max_marks || 0)),
    0
  );

  return subjectMaxMarks || Number(exam?.max_marks || 100);
}

function subjectDensityClass(subjectCount) {
  if (subjectCount <= 4) return "subjects-sparse";
  if (subjectCount <= 7) return "subjects-medium";
  return "subjects-dense";
}

function insertBeforeLast(values, insertedValue) {
  if (!values.length) return [insertedValue];
  return [...values.slice(0, -1), insertedValue, values[values.length - 1]];
}

export async function generateFinalMarksheetPdf(report) {
  const templatePath = path.join(__dirname, "..", "reports", "templates", "finalReportCard.html");
  let html = await fs.readFile(templatePath, "utf8");
  const [logo, administratorSignature, principalSignature] = await Promise.all([
    readLogoBase64(),
    readSignatureBase64("administrator.jpeg"),
    readSignatureBase64("principal.jpg"),
  ]);
  const scopeMeta = getScopeMeta(report?.student?.class_scope);
  const exams = report.exams || [];
  const subjects = report.subjects || [];

  const examHeaderCells = exams
    .map(
      (exam) => {
        const headerMaxMarks = getExamHeaderMaxMarks(exam, subjects);
        return `<th>${escapeHtml(exam.name)}<br />${escapeHtml(formatWholeCell(headerMaxMarks))} Marks</th>`;
      }
    );
  const examHeaders = insertBeforeLast(examHeaderCells, "<th>Total of<br />Unit Test</th>").join("");
  const examColGroup = insertBeforeLast(
    exams.map(() => `<col style="width: 14mm;" />`),
    `<col style="width: 14mm;" />`
  ).join("");

  const subjectRows = subjects
    .map((subject) => {
      const examCells = exams
        .map((exam) => {
          const cell = subject.exams?.[exam.id];
          return renderFinalMarkCell(cell);
        });
      const marksSecuredCells = insertBeforeLast(
        examCells,
        `<td>${escapeHtml(formatWholeCell(subject.criteria?.unit_test_total))}</td>`
      )
        .join("");

      return `
        <tr>
          <td class="subject">${escapeHtml(subject.name)}</td>
          ${marksSecuredCells}
          <td class="criteria-start">${escapeHtml(formatWholeCell(subject.criteria?.unit_test))}</td>
          <td>${escapeHtml(formatWholeCell(subject.criteria?.half_yearly))}</td>
          <td>${escapeHtml(formatWholeCell(subject.criteria?.annual))}</td>
          <td>${escapeHtml(formatWholeCell(subject.final_total))}</td>
        </tr>`;
    })
    .join("");

  const examTotalCells = exams.map((exam) => report.exam_totals?.[exam.id]?.marks ?? "-");
  const unitTestTotalCell = formatWholeCell(
    subjects.reduce((sum, subject) => sum + Number(subject.criteria?.unit_test_total || 0), 0)
  );
  const unitTestMaxTotal = subjects.reduce(
    (sum, subject) => sum + Number(subject.criteria?.unit_test_max_total || 0),
    0
  );
  const unitTestTotalPercentage = unitTestMaxTotal
    ? Number(((Number(unitTestTotalCell || 0) / unitTestMaxTotal) * 100).toFixed(2))
    : null;
  const unitTestTotalPercentageCell =
    unitTestTotalPercentage === null ? "-" : `${unitTestTotalPercentage}%`;
  const unitTestTotalGradeCell =
    unitTestTotalPercentage === null ? "-" : gradeForPercentage(unitTestTotalPercentage);
  const examPercentageCells = exams.map((exam) => {
    const summary = report.exam_totals?.[exam.id];
    return summary ? `${summary.percentage}%` : "-";
  });
  const examGradeCells = exams.map((exam) => {
    const summary = report.exam_totals?.[exam.id];
    return summary ? gradeForPercentage(summary.percentage) : "-";
  });

  const gradeSecuredRows = renderGradeSecuredRows(report.activities || [], report.mock_grades || []);

  const signatureItems = exams.length
    ? exams.map((exam) => {
        const summary = report.exam_totals?.[exam.id];
        const grade = summary ? gradeForPercentage(summary.percentage) : "";
        return {
          label: exam.name,
          qualitativeValue: qualitativeValueForGrade(grade) || "-",
        };
      })
    : [{ label: "Exam", qualitativeValue: "-" }];
  const signatureColumnCount = Math.max(signatureItems.length, 1);

  const signatureCells = signatureItems
    .map((item) => {
      const safeLabel = escapeHtml(item.label);
      const safeQualitativeValue = escapeHtml(item.qualitativeValue);
      return `
        <div class="signature-column">
          <div class="signature-cell"><img class="signature-image" src="${administratorSignature}" alt="Administrator signature" />Sign. of Administrator<br />${safeLabel}</div>
          <div class="signature-cell">Sign. of Guardian<br />${safeLabel}</div>
          <div class="signature-cell"><img class="signature-image" src="${principalSignature}" alt="Principal signature" />Sign. of the Principal<br />${safeLabel}</div>
          <div class="signature-cell signature-remarks">Remarks : ${safeQualitativeValue}</div>
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
    .replaceAll("{{marksSecuredColumnCount}}", String(Math.max(exams.length, 1) + 1))
    .replaceAll("{{subjectDensityClass}}", subjectDensityClass(subjects.length))
    .replaceAll("{{examHeaders}}", examHeaders || "<th>-</th>")
    .replaceAll("{{examColGroup}}", examColGroup || `<col style="width: 14mm;" />`)
    .replaceAll("{{subjectRows}}", subjectRows)
    .replaceAll("{{examTotalCells}}", renderCells(insertBeforeLast(examTotalCells, unitTestTotalCell)))
    .replaceAll("{{examPercentageCells}}", renderCells(insertBeforeLast(examPercentageCells, unitTestTotalPercentageCell)))
    .replaceAll("{{examGradeCells}}", renderCells(insertBeforeLast(examGradeCells, unitTestTotalGradeCell)))
    .replaceAll("{{grandTotal}}", escapeHtml(formatWholeCell(report?.summary?.total ?? 0)))
    .replaceAll("{{maxTotal}}", escapeHtml(formatWholeCell(report?.summary?.max_total ?? 0)))
    .replaceAll("{{percentage}}", escapeHtml(formatWholeCell(report?.summary?.percentage ?? 0)))
    .replaceAll("{{grade}}", escapeHtml(report?.summary?.grade || "-"))
    .replaceAll("{{gradeSecuredRows}}", gradeSecuredRows)
    .replaceAll("{{promotedClassName}}", escapeHtml(report?.student?.promoted_class_name || ""))
    .replaceAll("{{finalExamCriteriaLabel}}", renderFinalExamCriteriaLabel(report))
    .replaceAll("{{finalResultTitle}}", escapeHtml(renderFinalResultTitle(report)))
    .replaceAll("{{finalResultText}}", renderFinalResultText(report))
    .replaceAll("{{signatureColumnCount}}", String(signatureColumnCount))
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

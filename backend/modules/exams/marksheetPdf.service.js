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
      sectionTitle: "Higher Secondary Section",
      sectionAddress: "ADP Road, Christian Patty, Nagaon",
      signatureLabel: "Rector",
      signatureFile: "rector.jpg",
      scopeLabel: "Higher Secondary",
    };
  }

  return {
    sectionTitle: "School Section",
    sectionAddress: "Backside of Nowgong College, G.M Road",
    signatureLabel: "Principal",
    signatureFile: "principal.jpg",
    scopeLabel: "School",
  };
}

async function readSignatureBase64(fileName) {
  const filePath = path.join(__dirname, "..", "reports", "templates", fileName);
  const file = await fs.readFile(filePath);
  return `data:image/jpeg;base64,${file.toString("base64")}`;
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

function formatIssuedDate(dateValue = new Date()) {
  const date = dateValue instanceof Date
    ? dateValue
    : dateValue
      ? new Date(`${dateValue}T00:00:00`)
      : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  return safeDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function hasSplitMarks(item) {
  const hasValue = (value) => value !== null && value !== undefined && value !== "";
  return (
    String(item?.mark_pattern || "").trim().toLowerCase() === "split" ||
    hasValue(item?.theory_max) ||
    hasValue(item?.practical_max) ||
    hasValue(item?.theory_marks) ||
    hasValue(item?.practical_marks)
  );
}

function formatCell(value) {
  if (value === null || value === undefined || value === "") return "";
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2).replace(/\.00$/, "") : value;
}

function renderSplitMarksObtained(theoryMarks, practicalMarks, totalMarks) {
  return `
    <div class="marks-breakdown">
      <div><span>Theory</span><span>-</span><span>${escapeHtml(formatCell(theoryMarks))}</span></div>
      <div><span>Practical</span><span>-</span><span>${escapeHtml(formatCell(practicalMarks))}</span></div>
      <div><span>Total</span><span>-</span><span>${escapeHtml(formatCell(totalMarks))}</span></div>
    </div>`;
}

function normalizedSubjectName(value) {
  return String(value || "").trim().toLowerCase();
}

function isBiologyPartSubject(subject) {
  const name = normalizedSubjectName(subject?.subject);
  return name === "botany" || name === "zoology";
}

function sumNullable(items, key) {
  const values = items
    .map((item) => item?.[key])
    .filter((value) => value !== null && value !== undefined && value !== "");
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + Number(value || 0), 0);
}

function combineBiologyPartSubjects(subjects = []) {
  const biologyParts = subjects.filter(isBiologyPartSubject);
  if (!biologyParts.length) return subjects;

  const firstBiologyPartIndex = subjects.findIndex(isBiologyPartSubject);
  const combinedSubject = {
    subject: "Biology",
    mark_pattern: "split",
    marks: sumNullable(biologyParts, "marks") ?? 0,
    max_marks: sumNullable(biologyParts, "max_marks") ?? 0,
    pass_marks: sumNullable(biologyParts, "pass_marks") ?? 0,
    theory_marks: sumNullable(biologyParts, "theory_marks"),
    practical_marks: sumNullable(biologyParts, "practical_marks"),
    theory_max: sumNullable(biologyParts, "theory_max"),
    theory_pass: sumNullable(biologyParts, "theory_pass"),
    practical_max: sumNullable(biologyParts, "practical_max"),
    practical_pass: sumNullable(biologyParts, "practical_pass"),
    components: [],
  };

  const output = [];
  subjects.forEach((subject, index) => {
    if (index === firstBiologyPartIndex) {
      output.push(combinedSubject);
    }
    if (!isBiologyPartSubject(subject)) {
      output.push(subject);
    }
  });

  return output;
}

function renderMarksheetSubjectRows(subject) {
  const components = Array.isArray(subject.components) ? subject.components : [];
  let marksObtained = escapeHtml(formatCell(subject.marks));

  if (components.length) {
    const splitComponents = components.filter(hasSplitMarks);
    if (splitComponents.length) {
      const theoryMarks = splitComponents.reduce(
        (sum, component) => sum + Number(component.theory_marks || 0),
        0
      );
      const practicalMarks = splitComponents.reduce(
        (sum, component) => sum + Number(component.practical_marks || 0),
        0
      );
      marksObtained = renderSplitMarksObtained(theoryMarks, practicalMarks, subject.marks);
    }
  } else if (hasSplitMarks(subject)) {
    marksObtained = renderSplitMarksObtained(
      subject.theory_marks,
      subject.practical_marks,
      subject.marks
    );
  }

  return `
      <tr>
        <td>${escapeHtml(subject.subject)}</td>
        <td>${escapeHtml(formatCell(subject.max_marks))}</td>
        <td class="marks-obtained">${marksObtained}</td>
      </tr>`;
}

export async function generateMarksheetPdf(report) {
  const templatePath = path.join(__dirname, "..", "reports", "templates", "reportCard.html");
  let html = await fs.readFile(templatePath, "utf8");

  const scopeMeta = getScopeMeta(report?.exam?.class_scope);
  const [signatureImage, schoolLogo] = await Promise.all([
    readSignatureBase64(scopeMeta.signatureFile),
    readLogoBase64(),
  ]);

  const rows = combineBiologyPartSubjects(report.subjects || []).map(renderMarksheetSubjectRows).join("");

  html = html
    .replace("{{studentName}}", escapeHtml(report?.student?.name || "-"))
    .replace("{{rollNumber}}", escapeHtml(report?.student?.roll_number || "-"))
    .replace("{{guardianName}}", escapeHtml(report?.student?.guardian_name || "-"))
    .replace("{{examName}}", escapeHtml(report?.exam?.name || "-"))
    .replace("{{className}}", escapeHtml(report?.exam?.class_name || "-"))
    .replace("{{sectionName}}", escapeHtml(report?.exam?.section_name || "-"))
    .replace("{{medium}}", escapeHtml(report?.exam?.medium || "-"))
    .replace("{{scope}}", escapeHtml(scopeMeta.scopeLabel))
    .replace("{{sectionTitle}}", escapeHtml(scopeMeta.sectionTitle))
    .replace("{{sectionAddress}}", escapeHtml(scopeMeta.sectionAddress))
    .replace("{{schoolLogo}}", schoolLogo)
    .replace("{{issuedDate}}", escapeHtml(formatIssuedDate(report?.publication?.published_on)))
    .replace("{{rows}}", rows)
    .replace("{{total}}", escapeHtml(report?.summary?.total ?? report?.total ?? 0))
    .replaceAll("{{maxTotal}}", escapeHtml(report?.summary?.max_total ?? 0))
    .replace("{{grade}}", escapeHtml(report?.summary?.grade || "-"))
    .replace("{{percentage}}", escapeHtml(report?.summary?.percentage ?? report?.percentage ?? 0))
    .replaceAll("{{signatureLabel}}", escapeHtml(scopeMeta.signatureLabel))
    .replace("{{signatureImage}}", signatureImage);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({ format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }
}

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

function renderDetailRow(label, maxMarks, marks, level = 1) {
  return `
      <tr class="detail-row detail-level-${level}">
        <td>${escapeHtml(label)}</td>
        <td>${escapeHtml(maxMarks ?? "")}</td>
        <td>${escapeHtml(marks ?? "")}</td>
      </tr>`;
}

function renderMarksheetSubjectRows(subject) {
  const components = Array.isArray(subject.components) ? subject.components : [];
  const rows = [
    `
      <tr>
        <td>${escapeHtml(subject.subject)}</td>
        <td>${escapeHtml(subject.max_marks)}</td>
        <td>${escapeHtml(subject.marks)}</td>
      </tr>`,
  ];

  if (components.length) {
    components.forEach((component) => {
      rows.push(renderDetailRow(component.name, component.max_marks, component.marks, 1));
      if (hasSplitMarks(component)) {
        rows.push(renderDetailRow("Theory", component.theory_max, component.theory_marks, 2));
        rows.push(renderDetailRow("Practical", component.practical_max, component.practical_marks, 2));
      }
    });
    return rows.join("");
  }

  if (hasSplitMarks(subject)) {
    rows.push(renderDetailRow("Theory", subject.theory_max, subject.theory_marks, 1));
    rows.push(renderDetailRow("Practical", subject.practical_max, subject.practical_marks, 1));
  }

  return rows.join("");
}

export async function generateMarksheetPdf(report) {
  const templatePath = path.join(__dirname, "..", "reports", "templates", "reportCard.html");
  let html = await fs.readFile(templatePath, "utf8");

  const scopeMeta = getScopeMeta(report?.exam?.class_scope);
  const [signatureImage, schoolLogo] = await Promise.all([
    readSignatureBase64(scopeMeta.signatureFile),
    readLogoBase64(),
  ]);

  const rows = (report.subjects || []).map(renderMarksheetSubjectRows).join("");

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
    .replace("{{maxTotal}}", escapeHtml(report?.summary?.max_total ?? 0))
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

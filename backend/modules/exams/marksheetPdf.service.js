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

export async function generateMarksheetPdf(report) {
  const templatePath = path.join(__dirname, "..", "reports", "templates", "reportCard.html");
  let html = await fs.readFile(templatePath, "utf8");

  const scopeMeta = getScopeMeta(report?.exam?.class_scope);
  const signatureImage = await readSignatureBase64(scopeMeta.signatureFile);

  const rows = (report.subjects || [])
    .map(
      (subject) => `
      <tr>
        <td>${escapeHtml(subject.subject)}</td>
        <td>${escapeHtml(subject.max_marks)}</td>
        <td>${escapeHtml(subject.marks)}</td>
      </tr>`
    )
    .join("");

  html = html
    .replace("{{studentName}}", escapeHtml(report?.student?.name || "-"))
    .replace("{{rollNumber}}", escapeHtml(report?.student?.roll_number || "-"))
    .replace("{{examName}}", escapeHtml(report?.exam?.name || "-"))
    .replace("{{className}}", escapeHtml(report?.exam?.class_name || "-"))
    .replace("{{sectionName}}", escapeHtml(report?.exam?.section_name || "-"))
    .replace("{{medium}}", escapeHtml(report?.exam?.medium || "-"))
    .replace("{{scope}}", escapeHtml(scopeMeta.scopeLabel))
    .replace("{{sectionTitle}}", escapeHtml(scopeMeta.sectionTitle))
    .replace("{{sectionAddress}}", escapeHtml(scopeMeta.sectionAddress))
    .replace("{{rows}}", rows)
    .replace("{{total}}", escapeHtml(report?.summary?.total ?? report?.total ?? 0))
    .replace("{{maxTotal}}", escapeHtml(report?.summary?.max_total ?? 0))
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

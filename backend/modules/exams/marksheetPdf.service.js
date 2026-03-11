import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

export async function generateMarksheetPdf(report) {
  const templatePath = path.resolve("modules/reports/templates/reportCard.html");
  let html = await fs.readFile(templatePath, "utf8");

  const rows = report.subjects
    .map(
      (s) => `
      <tr>
        <td>${s.subject}</td>
        <td>${s.marks}</td>
        <td>${s.max_marks}</td>
        <td>${s.pass_marks}</td>
      </tr>`
    )
    .join("");

  html = html
    .replace("{{studentName}}", report.student.name)
    .replace("{{rollNumber}}", report.student.roll_number ?? "-")
    .replace("{{examName}}", report.exam.name)
    .replace("{{className}}", report.exam.class_name)
    .replace("{{sectionName}}", report.exam.section_name)
    .replace("{{rows}}", rows)
    .replace("{{total}}", String(report.summary.total))
    .replace("{{maxTotal}}", String(report.summary.max_total))
    .replace("{{percentage}}", String(report.summary.percentage));

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  await browser.close();
  return pdf;
}

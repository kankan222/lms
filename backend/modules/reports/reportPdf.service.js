import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { generateReport }
  from "./reports.service.js";

export async function generateReportPdf(data){

  // 1️⃣ get report JSON
  const report = await generateReport(data);

  // 2️⃣ load template
  const templatePath = path.resolve(
    "modules/reports/templates/reportCard.html"
  );

  let html = await fs.readFile(templatePath,"utf8");

  // 3️⃣ build rows
  const rows = report.subjects.map(s=>`
    <tr>
      <td>${s.subject}</td>
      <td>${s.marks}</td>
    </tr>
  `).join("");

  // 4️⃣ replace placeholders
  html = html
    .replace("{{studentName}}", report.student.name)
    .replace("{{exam}}", report.exam)
    .replace("{{rows}}", rows)
    .replace("{{total}}", report.total)
    .replace("{{percentage}}", report.percentage)
    .replace("{{grade}}", report.grade);

  // 5️⃣ launch browser
  const browser = await puppeteer.launch({
    headless: "new"
  });

  const page = await browser.newPage();

  await page.setContent(html,{
    waitUntil:"networkidle0"
  });

  const pdfBuffer = await page.pdf({
    format:"A4",
    printBackground:true
  });

  await browser.close();

  return pdfBuffer;
}
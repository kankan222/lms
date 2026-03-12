import { generateReport } from "./reports.service.js";
import { generateMarksheetPdf } from "../exams/marksheetPdf.service.js";

export async function generateReportPdf(data) {
  const report = await generateReport(data);
  return generateMarksheetPdf(report);
}

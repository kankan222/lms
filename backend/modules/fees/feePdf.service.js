import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import * as repo from "./fee.repository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function money(value) {
  return `Rs ${Number(value || 0).toFixed(2)}`;
}

export async function generateReceiptPdf(paymentId) {
  const payment = await repo.getPaymentReceipt(paymentId);
  if (!payment) throw new Error("Payment not found");

  const templatePath = path.join(__dirname, "templates", "receipt.html");
  let html = await fs.readFile(templatePath, "utf8");

  const feeItem =
    payment.fee_type === "admission"
      ? "Admission Fee"
      : (payment.installment_name || "Installment Fee");

  html = html
    .replace("{{receiptId}}", String(payment.id))
    .replace("{{receiptDate}}", new Date(payment.created_at).toLocaleDateString())
    .replace("{{paymentStatus}}", String(payment.fee_status || payment.status || "-").toUpperCase())
    .replace("{{studentName}}", payment.name || "-")
    .replace("{{className}}", payment.class_name || "-")
    .replace("{{sectionName}}", payment.section_name || "-")
    .replace("{{medium}}", payment.medium || "-")
    .replace("{{feeItem}}", feeItem)
    .replace("{{feeAmount}}", money(payment.fee_amount))
    .replace("{{amountPaid}}", money(payment.amount_paid))
    .replace("{{remainingAmount}}", money(payment.remaining_amount))
    .replace("{{remarks}}", payment.remarks || "-");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "12mm",
        right: "10mm",
        bottom: "12mm",
        left: "10mm",
      },
    });
  } finally {
    await browser.close();
  }
}

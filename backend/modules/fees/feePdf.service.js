import puppeteer from "puppeteer";
import fs from "node:fs/promises";
import path from "node:path";
import * as repo from "./fee.repository.js";

function money(value) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

export async function generateReceiptPdf(paymentId) {
  const payment = await repo.getPaymentReceipt(paymentId);
  if (!payment) throw new Error("Payment not found");

  const templatePath = path.resolve("modules/fees/templates/receipt.html");
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

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "12mm",
      right: "10mm",
      bottom: "12mm",
      left: "10mm",
    },
  });

  await browser.close();
  return pdfBuffer;
}

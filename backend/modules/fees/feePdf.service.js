import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import * as repo from "./fee.repository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function rupees(value) {
  return `Rs ${money(value)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function receiptValue(value, fallback = "....................") {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return fallback;
  return text;
}

function replaceReceiptTokens(html, values) {
  let output = html;
  for (const [key, value] of Object.entries(values)) {
    output = output
      .replaceAll(`{{${key}}}`, value)
      .replaceAll(`{${key}}`, value);
  }
  return output.replace(/\{\{?[A-Za-z0-9_]+\}?\}/g, "....................");
}

function imageDataUri(filePath, mimeType) {
  return fs.readFile(filePath).then((buffer) => `data:${mimeType};base64,${buffer.toString("base64")}`);
}

const BELOW_TWENTY = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function wordsBelowThousand(value) {
  const number = Number(value);
  const parts = [];
  if (number >= 100) {
    parts.push(`${BELOW_TWENTY[Math.floor(number / 100)]} Hundred`);
  }
  const rest = number % 100;
  if (rest >= 20) {
    parts.push([TENS[Math.floor(rest / 10)], BELOW_TWENTY[rest % 10]].filter(Boolean).join(" "));
  } else if (rest > 0) {
    parts.push(BELOW_TWENTY[rest]);
  }
  return parts.join(" ");
}

function amountInWords(value) {
  let number = Math.floor(Number(value || 0));
  if (number <= 0) return "Zero Rupees Only";

  const parts = [];
  const crore = Math.floor(number / 10000000);
  number %= 10000000;
  const lakh = Math.floor(number / 100000);
  number %= 100000;
  const thousand = Math.floor(number / 1000);
  number %= 1000;

  if (crore) parts.push(`${wordsBelowThousand(crore)} Crore`);
  if (lakh) parts.push(`${wordsBelowThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${wordsBelowThousand(thousand)} Thousand`);
  if (number) parts.push(wordsBelowThousand(number));

  return `${parts.join(" ")} Rupees Only`;
}

export async function renderFeeReceiptPdf(data) {
  const templatePath = path.join(__dirname, "templates", "receipt.html");
  let html = await fs.readFile(templatePath, "utf8");

  const isHs = String(data.class_scope || "").toLowerCase() === "hs";
  const signatureFile = isHs ? "collegeCollector.jpg" : "schoolCollector.png";
  const signatureMime = isHs ? "image/jpeg" : "image/png";
  const signatureDataUri = await imageDataUri(
    path.join(__dirname, "templates", signatureFile),
    signatureMime
  );
  const logoDataUri = await imageDataUri(
    path.join(__dirname, "..", "..", "..", "frontend", "website", "public", "assets", "site", "logo.png"),
    "image/png"
  );

  html = replaceReceiptTokens(html, {
    receiptId: escapeHtml(data.receipt_serial),
    receiptDate: escapeHtml(new Date(data.created_at).toLocaleDateString("en-IN")),
    studentName: escapeHtml(receiptValue(data.student_name)),
    className: escapeHtml(receiptValue(data.class_name)),
    sectionName: escapeHtml(receiptValue(data.section_name)),
    streamField: isHs
      ? `<span class="label">Stream</span><span class="value">${escapeHtml(receiptValue(data.stream_name))}</span>`
      : "",
    rollNo: escapeHtml(receiptValue(data.roll_number)),
    sessionName: escapeHtml(receiptValue(data.session_name)),
    feeItem: escapeHtml(receiptValue(data.fee_item)),
    installmentLabel: escapeHtml(receiptValue(data.installment_label, "")),
    feeAmount: escapeHtml(rupees(data.fee_amount)),
    previousPayment: escapeHtml(rupees(data.previous_payment)),
    amountPaid: escapeHtml(rupees(data.amount_paid)),
    remainingAmount: escapeHtml(rupees(data.remaining_amount)),
    amountWords: escapeHtml(amountInWords(data.amount_paid)),
    remarks: escapeHtml(receiptValue(data.remarks, "")),
    schoolLogo: logoDataUri,
    collectorSignature: signatureDataUri,
  });

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
        top: "10mm",
        right: "10mm",
        bottom: "10mm",
        left: "10mm",
      },
    });
  } finally {
    await browser.close();
  }
}

export async function generateReceiptPdf(paymentId) {
  const payment = await repo.getPaymentReceipt(paymentId);
  if (!payment) throw new Error("Payment not found");

  return renderFeeReceiptPdf({
    receipt_serial: payment.receipt_serial || `PAY-${String(payment.id).padStart(6, "0")}`,
    created_at: payment.created_at,
    student_name: payment.name,
    class_name: payment.class_name,
    section_name: payment.section_name,
    stream_name: payment.stream_name,
    class_scope: payment.class_scope,
    roll_number: payment.roll_number,
    session_name: payment.session_name,
    fee_item: payment.fee_type === "admission" ? "Admission Fee" : "Session Fees",
    installment_label: payment.fee_type === "admission" ? "" : receiptValue(payment.installment_name || "Installment Fee", ""),
    fee_amount: payment.fee_amount,
    previous_payment: payment.previous_payment,
    amount_paid: payment.amount_paid,
    remaining_amount: payment.remaining_amount,
    remarks: payment.remarks,
  });
}

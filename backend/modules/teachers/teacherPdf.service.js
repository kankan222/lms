import puppeteer from "puppeteer";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatScopeLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "hs") return "HS";
  if (normalized === "school") return "School";
  return "-";
}

function formatDateHeader(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export async function generateTeacherAttendanceMatrixPdf(data = {}) {
  const meta = data.meta || {};
  const dateKeys = Array.isArray(data.dateKeys) ? data.dateKeys : [];
  const rows = Array.isArray(data.rows) ? data.rows : [];

  const dateHeaders = dateKeys
    .map((dateKey) => `<th>${escapeHtml(formatDateHeader(dateKey))}</th>`)
    .join("");

  const bodyRows = rows
    .map((row) => {
      const statusCells = dateKeys
        .map((dateKey) => {
          const isPresent = row?.statusByDate?.[dateKey] === "present";
          return `<td class="${isPresent ? "present" : "absent"}">${isPresent ? "P" : "A"}</td>`;
        })
        .join("");

      return `
        <tr>
          <td class="teacher">${escapeHtml(row?.name || "-")}</td>
          <td>${escapeHtml(formatScopeLabel(row?.class_scope))}</td>
          <td>${Number(row?.presentDays || 0)}</td>
          <td>${Number(row?.absentDays || 0)}</td>
          ${statusCells}
        </tr>
      `;
    })
    .join("");

  const emptyRow = `
    <tr>
      <td colspan="${Math.max(4 + dateKeys.length, 4)}" class="empty">
        No teacher attendance matrix data found for this selection.
      </td>
    </tr>
  `;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Teacher Attendance Matrix</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
    .title { font-size: 16px; font-weight: 700; margin: 0 0 6px; }
    .meta { font-size: 11px; color: #4b5563; margin: 0 0 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th, td {
      border: 1px solid #d1d5db;
      padding: 4px 6px;
      text-align: center;
      white-space: nowrap;
    }
    th {
      background: #f3f4f6;
      font-weight: 700;
    }
    td.teacher, th.teacher {
      text-align: left;
    }
    td.present {
      background: #ecfdf3;
      color: #166534;
      font-weight: 700;
    }
    td.absent {
      background: #fff1f2;
      color: #9f1239;
      font-weight: 700;
    }
    td.empty {
      padding: 14px;
      color: #6b7280;
      text-align: center;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <h1 class="title">Teacher Attendance Matrix</h1>
  <p class="meta">
    Teacher: ${escapeHtml(meta.teacherLabel || "All Teachers")} |
    Scope: ${escapeHtml(meta.scopeLabel || "All Scopes")} |
    Range: ${escapeHtml(meta.from || "-")} to ${escapeHtml(meta.to || "-")}
  </p>
  <table>
    <thead>
      <tr>
        <th class="teacher">Teacher</th>
        <th>Scope</th>
        <th>Present</th>
        <th>Absent</th>
        ${dateHeaders}
      </tr>
    </thead>
    <tbody>
      ${rows.length ? bodyRows : emptyRow}
    </tbody>
  </table>
</body>
</html>`;

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
      margin: {
        top: "10mm",
        right: "8mm",
        bottom: "10mm",
        left: "8mm",
      },
    });
  } finally {
    await browser.close();
  }
}

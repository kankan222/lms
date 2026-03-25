const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatReadableDate(value, fallback = "-") {
  const date = parseDateValue(value);
  if (!date) {
    const raw = String(value || "").trim();
    return raw || fallback;
  }
  return dateFormatter.format(date);
}

export function formatReadableDateTime(value, fallback = "-") {
  const date = parseDateValue(value);
  if (!date) {
    const raw = String(value || "").trim();
    return raw || fallback;
  }
  return dateTimeFormatter.format(date);
}

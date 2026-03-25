const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1").replace(
  /\/api\/v1\/?$/,
  "",
);

const SERVER_UPLOAD_PREFIXES = ["/uploads/", "uploads/"];

export function resolveServerImageUrl(path) {
  const value = String(path || "").trim();
  if (!value) return "";

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (!SERVER_UPLOAD_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    return "";
  }

  return value.startsWith("/")
    ? `${API_ORIGIN}${value}`
    : `${API_ORIGIN}/${value}`;
}

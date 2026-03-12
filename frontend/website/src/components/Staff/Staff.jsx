import { useEffect, useMemo, useState } from "react";
import StaffCard from "./StaffCard";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, "");
const DISPLAY_SECTIONS = ["head", "teaching", "non_teaching"];

function normalizeTitle(value) {
  return String(value || "").toUpperCase().replace(/[\s_-]+/g, "");
}

function normalizeSection(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes("_")) return raw.toLowerCase();

  const title = normalizeTitle(raw);
  if (title === "HEADSTAFF") return "head";
  if (title === "TEACHINGSTAFF") return "teaching";
  if (title === "NONTEACHINGSTAFF") return "non_teaching";
  return raw.toLowerCase();
}

function displayTitle(value) {
  if (value === "head") return "Head Staff";
  if (value === "teaching") return "Teaching Staff";
  if (value === "non_teaching") return "Non Teaching Staff";
  return value;
}

function resolveImageUrl(path) {
  if (!path) return "/assets/layout/college/principal.jpg";
  if (String(path).startsWith("http")) return path;
  return `${API_ORIGIN}${path}`;
}

const Staff = ({
  type = "college",
  title = "Staff",
  showHeader = true,
  maxSections,
  className = "",
}) => {
  const [staffRows, setStaffRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadStaff() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/public/staff?type=${encodeURIComponent(type)}`);
        const json = await res.json();
        if (ignore) return;

        if (!res.ok) {
          setStaffRows([]);
          setError("Failed to load staff.");
          return;
        }

        setStaffRows(Array.isArray(json?.data) ? json.data : []);
      } catch {
        if (!ignore) {
          setStaffRows([]);
          setError("Failed to load staff.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadStaff();
    return () => {
      ignore = true;
    };
  }, [type]);

  const sections = useMemo(() => {
    const grouped = DISPLAY_SECTIONS.map((heading) => {
      const staff = staffRows
        .filter((row) => String(row.type || "").toLowerCase() === String(type || "").toLowerCase())
        .filter((row) => normalizeSection(row.section || row.title) === heading)
        .map((row) => ({
          id: row.id,
          src: resolveImageUrl(row.image_url),
          role: displayTitle(normalizeSection(row.section || row.title)),
          name: row.name || "",
        }));

      return {
        key: heading,
        heading: displayTitle(heading),
        staff,
      };
    }).filter((section) => section.staff.length > 0);

    return typeof maxSections === "number" ? grouped.slice(0, maxSections) : grouped;
  }, [maxSections, staffRows, type]);

  return (
    <div className={`flex flex-col items-center justify-center px-5 lg:px-15 2xl:px-30 ${className}`}>
      {showHeader ? (
        <>
          <p className="relative mt-8 text-3xl font-extrabold md:mt-12 md:text-5xl">
            <span className="text-gradient-bg bg-clip-text">{title}</span>
          </p>
          <hr className="my-5 w-20 border-t-2 border-stone-900" />
        </>
      ) : null}

      {loading ? <p className="mb-4 text-sm text-gray-500">Loading staff...</p> : null}
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {!loading && !error && !sections.length ? (
        <p className="mb-4 text-sm text-gray-500">No staff records found.</p>
      ) : null}

      <div className="w-full space-y-8">
        {sections.map((section) => (
          <div key={section.key}>
            <h2 className="mb-5 text-center text-2xl font-bold md:text-3xl">{section.heading}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {section.staff.map((person) => (
                <StaffCard key={person.id || `${person.name}-${person.role}`} {...person} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Staff;

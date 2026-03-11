import { useEffect, useMemo, useState } from "react";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

import StaffCard from "../../components/Staff/StaffCard";
import staffSections from "../../components/Staff/StaffSection";
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

const DISPLAY_SECTIONS = ["HEADSTAFF", "TEACHINGSTAFF", "NONTEACHINGSTAFF"];

function normalizeTitle(value) {
  return String(value || "").toUpperCase().replace(/[\s_-]+/g, "");
}

function displayTitle(value) {
  if (value === "HEADSTAFF") return "HEAD STAFF";
  if (value === "TEACHINGSTAFF") return "TEACHING STAFF";
  if (value === "NONTEACHINGSTAFF") return "NON TEACHING STAFF";
  return value;
}

const StaffPage = ({ type }) => {
  const [apiStaff, setApiStaff] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/public/staff?type=${encodeURIComponent(type)}`);
        const json = await res.json();
        if (!ignore && res.ok) {
          setApiStaff(Array.isArray(json?.data) ? json.data : []);
        }
      } catch {
        if (!ignore) setApiStaff([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [type]);

  const sections = useMemo(() => {
    if (!apiStaff.length) return staffSections[type] || [];

    return DISPLAY_SECTIONS.map((heading) => {
      const staff = apiStaff
        .filter((s) => normalizeTitle(s.title) === heading)
        .map((s) => ({
          src: s.image_url || "/assets/layout/college/principal.jpg",
          role: displayTitle(normalizeTitle(s.title)),
          name: s.name || "",
        }));
      return { heading: displayTitle(heading), staff };
    }).filter((section) => section.staff.length > 0);
  }, [apiStaff, type]);

  return (
    <>
      <Header />
      <div className="flex items-center justify-center flex-col px-5 lg:px-15 2xl:px-30">
        <p className="text-3xl md:text-5xl font-extrabold mt-8 sm:mt-12 relative">
          <span className="text-gradient-bg bg-clip-text">Staff</span>
        </p>
        <hr className="w-20 my-5 border-t-2 border-stone-900 " />
        {loading ? <p className="mb-4 text-sm text-gray-500">Loading staff...</p> : null}
        {sections.map((section, i) => (
          <div key={i}>
            <h2 className="text-center font-bold text-3xl mb-5">{section.heading}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-2 md:gap-4">
              {section.staff.map((person, i)=> (
                <StaffCard
                key={i}
                  {...person}
                />

              ))}
            </div>
          </div>
        ))}
      </div>

      <Footer />
    </>
  );
};

export default StaffPage;

import { useMemo, useState } from "react";
import { Atom, GraduationCap, IndianRupee, X } from "lucide-react";
import { streamConfig } from "./StreamConfig";

const iconMap = {
  "graduation-cap": GraduationCap,
  atom: Atom,
  "indian-rupee": IndianRupee,
};

export default function Stream({ Text }) {
  const sectionKey = Text === "school" ? "school" : "college";
  const courseData = useMemo(() => streamConfig[sectionKey] ?? [], [sectionKey]);
  const [activeCourse, setActiveCourse] = useState(null);

  return (
    <>
      <div className="flex items-center justify-center flex-col px-5 lg:px-15 2xl:px-30">
        <p className="text-3xl md:text-5xl font-extrabold mt-8 sm:mt-12 relative">
          <span className="text-gradient-bg bg-clip-text">
            {sectionKey === "school" ? "Classes" : "Stream"}
          </span>
        </p>
        <hr className="w-20 my-5 border-t-2 border-stone-900 " />
        <div
          className={`grid gap-5 w-full grid-cols-3 ${
            sectionKey === "school"
              ? "md:grid-cols-3 2xl:grid-cols-6"
              : "md:grid-cols-2 2xl:grid-cols-3"
          }`}
        >
          {courseData.map((course) => {
            const Icon = iconMap[course.icon] ?? GraduationCap;

            return (
              <button
                type="button"
                key={course.title}
                onClick={() => setActiveCourse(course)}
                className={`flex items-center justify-center flex-col border border-stone-200 rounded-10px shadow-punch-secondary bg-white w-full transition-transform hover:-translate-y-1 hover:shadow-lg ${
                  sectionKey === "school" ? "px-4 py-5" : "px-8 py-8"
                }`}
              >
                <Icon className="w-8 h-8 sm:w-18 sm:h-18" />
                <p className="font-medium md:font-bold text-base md:text-xl md:mt-3">
                  {course.title}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {activeCourse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 px-5 py-6"
          onClick={() => setActiveCourse(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
              <div>
                {/* <p className="text-sm font-semibold uppercase tracking-[0.2em] text-punch-700">
                  {sectionKey === "school" ? "Class Details" : "Stream Details"}
                </p> */}
                <h3 className="text-2xl font-bold text-stone-900">{activeCourse.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveCourse(null)}
                className="rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
                Subjects
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {activeCourse.subjects.map((subject) => (
                  <div
                    key={subject}
                    className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-800"
                  >
                    {subject}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

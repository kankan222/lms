import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import SchoolAdmissionForm from "./SchoolAdmissionForm";
import CollegeAdmissionForm from "./CollegeAdmissionForm";

export default function AdmissionDialog({
  section = "college",
  label = "Admission",
  className = "",
  variant,
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isSchool = section === "school";
  const FormComponent = isSchool ? SchoolAdmissionForm : CollegeAdmissionForm;

  useEffect(() => {
    setMounted(true);
  }, []);

  const dialogMarkup = open ? (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-black/60 px-3 py-4 sm:px-4 sm:py-6"
      onClick={() => setOpen(false)}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          className="flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-4 py-4 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-punch-700 sm:text-sm">
                {isSchool ? "School Section" : "Higher Secondary Section"}
              </p>
              <h2 className="mt-1 text-xl font-bold text-stone-900 sm:text-2xl">{label}</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
              aria-label="Close admission dialog"
            >
              <X size={20} />
            </button>
          </div>
          <div className="max-h-[calc(100vh-6rem)] overflow-y-auto bg-stone-50 p-3 sm:p-4 md:p-6">
            <FormComponent />
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
        {label}
        <ArrowUpRight className="transition hover:-translate-x-1" />
      </Button>

      {mounted && dialogMarkup ? createPortal(dialogMarkup, document.body) : null}
    </>
  );
}

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
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-6"
      onClick={() => setOpen(false)}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-punch-700">
              {isSchool ? "School Section" : "Higher Secondary Section"}
            </p>
            <h2 className="text-2xl font-bold text-stone-900">{label}</h2>
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
        <div className="overflow-y-auto bg-stone-50 p-4 md:p-6">
          <FormComponent />
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
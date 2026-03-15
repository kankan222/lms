import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

const initialForm = {
  name: "",
  contact_number: "",
  message: "",
};

export default function Form() {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const showToast = (message, type) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast({ message, type });
    timeoutRef.current = setTimeout(() => setToast(null), 2500);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/public/contact/submissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Failed to submit contact form.");
      }

      setForm(initialForm);
      showToast("Contact details submitted successfully.", "success");
    } catch (error) {
      showToast(error.message || "Failed to submit contact form.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full flex items-center justify-center">
      {toast ? (
        <div
          className={`fixed right-5 top-5 z-[70] rounded-xl border px-4 py-3 text-sm font-medium shadow-xl transition-all ${
            toast.type === "success"
              ? "border-emerald-700 bg-emerald-950 text-emerald-200"
              : "border-red-800 bg-red-950 text-red-200"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="border border-stone-100 rounded-xl flex justify-center flex-col p-5 md:p-10 w-full md:min-w-187.5 gap-3 shadow-punch-secondary bg-stone-50"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="contact-name" className="text-sm ml-1 text-stone-600">
            Name
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            className="border border-stone-200 rounded-[6px] p-2 font-sm bg-white"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="contact-number" className="text-sm ml-1 text-stone-600">
            Contact Number
          </label>
          <input
            id="contact-number"
            name="contact_number"
            type="text"
            value={form.contact_number}
            onChange={handleChange}
            className="border border-stone-200 rounded-[6px] p-2 bg-white"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="contact-message" className="text-sm ml-1 text-stone-600">
            Message <span className="text-stone-400 text-xs">(*optional)</span>
          </label>
          <textarea
            id="contact-message"
            name="message"
            value={form.message}
            onChange={handleChange}
            className="border border-stone-200 rounded-[6px] p-2 rows resize-none bg-white"
            rows={5}
          />
        </div>
        <Button disabled={submitting}>
          {submitting ? "Submitting..." : "Submit"}
        </Button>
      </form>
    </div>
  );
}
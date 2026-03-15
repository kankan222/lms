function Field({ label, children, className = "" }) {
  return (
    <div className={`grid gap-2 ${className}`.trim()}>
      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-600">
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({ type = "text" }) {
  return (
    <input
      type={type}
      className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-punch-500"
    />
  );
}

const inputClass =
  "w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-punch-500";

export default function SchoolAdmissionForm() {
  const classes = [
    "Nursery",
    "LKG",
    "UKG",
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
  ];

  return (
    <div className="mx-auto w-full max-w-5xl rounded-[28px] border border-stone-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
      <div className="mb-8 text-center">
        <h1 className="text-xl font-bold tracking-[0.2em] text-stone-900 sm:text-2xl">
          KALONG KAPILI VIDYAPITH
        </h1>
        <h2 className="mt-2 text-base font-semibold text-stone-700 sm:text-lg">
          (SCHOOL SECTION)
        </h2>
        <p className="mt-2 text-sm font-semibold text-stone-600">NURSERY TO CLASS - X</p>
        <h3 className="mt-3 text-lg font-bold text-stone-900 underline underline-offset-4 sm:text-xl">
          ADMISSION FORM
        </h3>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Field label="Form No.">
          <TextInput />
        </Field>
        <Field label="Date of Issue">
          <TextInput type="date" />
        </Field>
        <Field label="Registration No.">
          <TextInput />
        </Field>
      </div>

      <section className="mb-8 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-5">
        <p className="mb-4 text-sm font-semibold text-stone-800">
          Class in Which Admission is Sought (English Medium)
        </p>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {classes.map((cls) => (
            <label
              key={cls}
              className="flex min-w-[88px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm font-medium text-stone-700 transition hover:border-punch-500 hover:text-punch-700 sm:flex-none"
            >
              <input type="checkbox" className="h-4 w-4 accent-punch-700" />
              <span>{cls}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h3 className="mb-4 text-base font-semibold text-stone-900 underline underline-offset-4">
          Particulars of Student (In Block Letters)
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name of the Student" className="md:col-span-2">
            <TextInput />
          </Field>
          <Field label="Father's Name" className="md:col-span-2">
            <TextInput />
          </Field>
          <Field label="Mother's Name" className="md:col-span-2">
            <TextInput />
          </Field>
          <Field label="Aadhaar Card No.">
            <TextInput />
          </Field>
          <Field label="Student PEN No.">
            <TextInput />
          </Field>
          <Field label="Apaar ID No.">
            <TextInput />
          </Field>
          <Field label="Date of Birth">
            <TextInput type="date" />
          </Field>
          <Field label="Date of Birth (In Words)" className="md:col-span-2">
            <TextInput />
          </Field>
          <Field label="Place of Birth">
            <TextInput />
          </Field>
          <Field label="City">
            <TextInput />
          </Field>
          <Field label="District">
            <TextInput />
          </Field>
          <Field label="State">
            <TextInput />
          </Field>
          <Field label="Nationality">
            <TextInput />
          </Field>
          <Field label="Religion">
            <TextInput />
          </Field>
          <Field label="Mother Tongue">
            <TextInput />
          </Field>
          <Field label="Caste">
            <TextInput />
          </Field>
          <Field label="Category">
            <TextInput />
          </Field>
          <Field label="Name of the School Last Attended" className="md:col-span-2">
            <TextInput />
          </Field>
          <Field label="Permanent Address" className="md:col-span-2">
            <textarea rows={3} className={inputClass} />
          </Field>
          <Field label="City">
            <TextInput />
          </Field>
          <Field label="District">
            <TextInput />
          </Field>
          <Field label="State">
            <TextInput />
          </Field>
          <Field label="PIN Code">
            <TextInput />
          </Field>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="mb-4 text-base font-semibold text-stone-900 underline underline-offset-4">
          Parent's Details
        </h3>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-stone-200 p-4 sm:p-5">
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-stone-700">
              Father
            </h4>
            <div className="grid gap-4">
              <Field label="Name"><TextInput /></Field>
              <Field label="Qualification"><TextInput /></Field>
              <Field label="Occupation"><TextInput /></Field>
              <Field label="Correspondence Address"><TextInput /></Field>
              <Field label="Mobile No."><TextInput /></Field>
              <Field label="Email"><TextInput type="email" /></Field>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 p-4 sm:p-5">
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-stone-700">
              Mother
            </h4>
            <div className="grid gap-4">
              <Field label="Name"><TextInput /></Field>
              <Field label="Qualification"><TextInput /></Field>
              <Field label="Occupation"><TextInput /></Field>
              <Field label="Correspondence Address"><TextInput /></Field>
              <Field label="Mobile No."><TextInput /></Field>
              <Field label="Email"><TextInput type="email" /></Field>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-5">
        <h3 className="mb-2 text-base font-semibold text-stone-900 underline underline-offset-4">
          Declaration
        </h3>
        <p className="text-sm leading-7 text-stone-700">
          I do hereby declare that the particulars furnished above are true, and I will abide by
          all the rules and regulations of the School and uphold the dignity and sanctity of the
          institution.
        </p>
      </section>

      <div className="grid gap-6 border-t border-stone-200 pt-6 text-sm text-stone-700 md:grid-cols-2">
        <div>
          <p className="font-semibold">Signature of Father/Mother/Guardian</p>
          <p className="mt-3">Date: __________</p>
        </div>
        <div>
          <p className="font-semibold">Signature of the Applicant</p>
          <p className="mt-3">Date: __________</p>
        </div>
      </div>
    </div>
  );
}

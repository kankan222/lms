export default function CollegeAdmissionForm() {
  const streams = ["Arts", "Science", "Commerce"];

  return (
    <div className="mx-auto max-w-4xl border bg-white p-8 text-sm shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-wide">KALONG KAPILI VIDYAPITH</h1>
        <h2 className="text-lg font-semibold">(HIGHER SECONDARY SECTION)</h2>
        <p className="mt-2 font-semibold">ARTS, SCIENCE & COMMERCE</p>
        <h3 className="mt-1 text-lg font-bold underline">ADMISSION FORM</h3>
      </div>

      <div className="mb-6 flex flex-wrap justify-between gap-4">
        <div className="flex items-center gap-2">
          <span>Form No.</span>
          <input className="w-40 border-b border-black outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <span>Date of Issue</span>
          <input className="w-40 border-b border-black outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <span>Registration No.</span>
          <input className="w-40 border-b border-black outline-none" />
        </div>
      </div>

      <div className="mb-6">
        <p className="mb-2 font-semibold">Stream for Which Admission is Sought</p>
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          {streams.map((stream) => (
            <label key={stream} className="flex items-center justify-center gap-2 rounded border p-3">
              <input type="checkbox" />
              <span>{stream}</span>
            </label>
          ))}
        </div>
      </div>

      <h3 className="mb-3 font-semibold underline">Particulars of Student (In Block Letters)</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label>Name of the Student</label>
          <input className="w-full border-b border-black outline-none" />
        </div>
        <div className="md:col-span-2">
          <label>Father's Name</label>
          <input className="w-full border-b border-black outline-none" />
        </div>
        <div className="md:col-span-2">
          <label>Mother's Name</label>
          <input className="w-full border-b border-black outline-none" />
        </div>
        <div>
          <label>Date of Birth (DD/MM/YYYY)</label>
          <input type="date" className="w-full border-b border-black outline-none" />
        </div>
        <div>
          <label>Gender</label>
          <input className="w-full border-b border-black outline-none" />
        </div>
        <div>
          <label>Religion</label>
          <input className="w-full border-b border-black outline-none" />
        </div>
        <div>
          <label>Caste / Category</label>
          <input className="w-full border-b border-black outline-none" />
        </div>
        <div>
          <label>Aadhaar Card No.</label>
          <input className="w-full border-b border-black outline-none" />
        </div>
        <div>
          <label>Student PEN No.</label>
          <input className="w-full border-b border-black outline-none" />
        </div>
        <div>
          <label>Apaar ID No.</label>
          <input className="w-full border-b border-black outline-none" />
        </div>
        <div>
          <label>Mobile No.</label>
          <input className="w-full border-b border-black outline-none" />
        </div>
        <div>
          <label>Email</label>
          <input className="w-full border-b border-black outline-none" />
        </div>
        <div className="md:col-span-2">
          <label>Present Address</label>
          <textarea className="w-full border p-1 outline-none" rows={2} />
        </div>
        <div className="md:col-span-2">
          <label>Permanent Address</label>
          <textarea className="w-full border p-1 outline-none" rows={2} />
        </div>
      </div>

      <h3 className="mb-4 mt-10 font-semibold underline">Previous Academic Record</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label>Name of the School Last Attended</label>
          <input className="w-full border-b border-black outline-none" />
        </div>
        <div>
          <label>Board / Council</label>
          <input className="w-full border-b border-black outline-none" />
        </div>
        <div>
          <label>Year of Passing</label>
          <input className="w-full border-b border-black outline-none" />
        </div>
        <div>
          <label>Roll No.</label>
          <input className="w-full border-b border-black outline-none" />
        </div>
        <div>
          <label>Registration No.</label>
          <input className="w-full border-b border-black outline-none" />
        </div>
        <div>
          <label>Total Marks</label>
          <input className="w-full border-b border-black outline-none" />
        </div>
        <div>
          <label>Percentage / Division</label>
          <input className="w-full border-b border-black outline-none" />
        </div>
      </div>

      <h3 className="mb-4 mt-10 font-semibold underline">Parent / Guardian Details</h3>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <h4 className="font-semibold">Father / Guardian</h4>
          <input placeholder="Name" className="w-full border-b outline-none" />
          <input placeholder="Qualification" className="w-full border-b outline-none" />
          <input placeholder="Occupation" className="w-full border-b outline-none" />
          <input placeholder="Mobile No." className="w-full border-b outline-none" />
          <input placeholder="Email" className="w-full border-b outline-none" />
        </div>
        <div className="space-y-3">
          <h4 className="font-semibold">Mother</h4>
          <input placeholder="Name" className="w-full border-b outline-none" />
          <input placeholder="Qualification" className="w-full border-b outline-none" />
          <input placeholder="Occupation" className="w-full border-b outline-none" />
          <input placeholder="Mobile No." className="w-full border-b outline-none" />
          <input placeholder="Email" className="w-full border-b outline-none" />
        </div>
      </div>

      <div className="mt-10">
        <h3 className="mb-2 font-semibold underline">Declaration</h3>
        <p className="leading-relaxed text-sm">
          I do hereby declare that the particulars furnished above are true, and I will
          abide by all the rules and regulations of the institution.
        </p>
      </div>

      <div className="mt-16 flex justify-between gap-6">
        <div>
          <p>Signature of Parent / Guardian</p>
          <p className="mt-2">Date: __________</p>
        </div>
        <div>
          <p>Signature of the Applicant</p>
          <p className="mt-2">Date: __________</p>
        </div>
      </div>
    </div>
  );
}


export default function SchoolAdmissionForm() {
  const classes = [
    "Nursery","LKG","UKG","I","II","III","IV","V","VI","VII","VIII","IX","X"
  ];

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 border shadow-sm text-sm">
      
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-wide">
          KALONG KAPILI VIDYAPITH
        </h1>
        <h2 className="text-lg font-semibold">(SCHOOL SECTION)</h2>
        <p className="mt-2 font-semibold">NURSERY TO CLASS - X</p>
        <h3 className="text-lg font-bold mt-1 underline">
          ADMISSION FORM
        </h3>
      </div>

      {/* Form Info */}
      <div className="flex justify-between mb-6">
        <div className="flex items-center gap-2">
          <span>Form No.</span>
          <input className="border-b border-black w-40 outline-none" />
        </div>

        <div className="flex items-center gap-2">
          <span>Date of Issue</span>
          <input className="border-b border-black w-40 outline-none" />
        </div>

        <div className="flex items-center gap-2">
          <span>Registration No</span>
          <input className="border-b border-black w-40 outline-none" />
        </div>
      </div>

      {/* Class Selection */}
      <div className="mb-6">
        <p className="font-semibold mb-2">
          Class in Which Admission is Sought (✓) – English Medium
        </p>

        <div className="grid grid-cols-13 gap-2 text-center">
          {classes.map((cls) => (
            <label key={cls} className="flex flex-col items-center text-xs">
              <span>{cls}</span>
              <input type="checkbox" />
            </label>
          ))}
        </div>
      </div>

      {/* Student Details */}
      <h3 className="font-semibold underline mb-3">
        Particulars of Student (In Block Letters)
      </h3>

      <div className="grid grid-cols-2 gap-4">

        <div className="col-span-2">
          <label>Name of the Student</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div className="col-span-2">
          <label>Father's Name</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div className="col-span-2">
          <label>Mother's Name</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div>
          <label>Aadhaar Card No.</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div>
          <label>Student PEN No.</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div>
          <label>Apaar ID No.</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div>
          <label>Date of Birth (DD/MM/YYYY)</label>
          <input type="date" className="border-b border-black w-full outline-none" />
        </div>

        <div className="col-span-2">
          <label>Date of Birth (In Words)</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div>
          <label>Place of Birth</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div>
          <label>City</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div>
          <label>District</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div>
          <label>State</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div>
          <label>Nationality</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div>
          <label>Religion</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div>
          <label>Mother Tongue</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div>
          <label>Caste</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div>
          <label>Category</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div className="col-span-2">
          <label>Name of the School Last Attended</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div className="col-span-2">
          <label>Permanent Address</label>
          <textarea className="border w-full outline-none p-1" rows={2} />
        </div>

        <div>
          <label>City</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div>
          <label>District</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div>
          <label>State</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

        <div>
          <label>PIN Code</label>
          <input className="border-b border-black w-full outline-none" />
        </div>

      </div>

      {/* Parent Details */}
      <h3 className="font-semibold underline mt-10 mb-4">
        Parent's Details
      </h3>

      <div className="grid grid-cols-2 gap-8">

        {/* Father */}
        <div className="space-y-3">
          <h4 className="font-semibold">Father</h4>

          <input placeholder="Name" className="border-b w-full outline-none" />
          <input placeholder="Qualification" className="border-b w-full outline-none" />
          <input placeholder="Occupation" className="border-b w-full outline-none" />
          <input placeholder="Correspondence Address" className="border-b w-full outline-none" />
          <input placeholder="Mobile No." className="border-b w-full outline-none" />
          <input placeholder="Email" className="border-b w-full outline-none" />
        </div>

        {/* Mother */}
        <div className="space-y-3">
          <h4 className="font-semibold">Mother</h4>

          <input placeholder="Name" className="border-b w-full outline-none" />
          <input placeholder="Qualification" className="border-b w-full outline-none" />
          <input placeholder="Occupation" className="border-b w-full outline-none" />
          <input placeholder="Correspondence Address" className="border-b w-full outline-none" />
          <input placeholder="Mobile No." className="border-b w-full outline-none" />
          <input placeholder="Email" className="border-b w-full outline-none" />
        </div>
      </div>

      {/* Declaration */}
      <div className="mt-10">
        <h3 className="font-semibold underline mb-2">Declaration</h3>

        <p className="text-sm leading-relaxed">
          I do hereby declare that the particulars furnished above are true,
          and I will abide by all the rules and regulations of the School and
          uphold the dignity and sanctity of the institution.
        </p>
      </div>

      {/* Signatures */}
      <div className="flex justify-between mt-16">
        <div>
          <p>Signature of Father/Mother/Guardian</p>
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
const LongCourses = [
  {
    title: "Post Graduate Diploma in Computer Application (PGDCA)",
    desc: [
      "MS-Office",
      "DTP",
      "PageMaker",
      "Fundamental of Computer",
      "HTML/DHTML",
      "Photoshop",
      "Tally ERP 9 with GST",
      "Internet & Multimedia",
    ],
  },
  {
    title: "Honors Diploma in Computer Application (HDCA)",
    desc: [
      "MS-Office",
      "Tally ERP 9 with GST",
      "HTML/DHTML",
      "PageMaker",
      "Corel Draw",
      "Fundamental of Computer",
      "DTP (Assamese Typing)",
      "Photoshop",
      "Internet & Multimedia",
      "Networking",
    ],
  },
  {
    title: "Advance Diploma in Computer Application (ADCA)",
    desc: [
      "MS-Office",
      "Tally ERP 9 with GST",
      "HTML/DHTML",
      "PageMaker",
      "Corel Draw",
      "Fundamental of Computer",
      "DTP (Assamese Typing)",
      "Photoshop",
      "JavaScript",
      "Networking",
    ],
  },
  {
    title: "Advance Diploma in Information Technology (ADIT)",
    desc: [
      "MS-Office",
      "DTP",
      "PageMaker",
      "Fundamental of Computer",
      "JavaScript",
      "Power Point Presentation",
      "HTML/DHTML",
      "Photoshop",
      "Tally ERP 9 with GST",
      "Internet & Multimedia",
      "Assamese Typing",
      "Advance Office Accounting",
    ],
  },
  {
    title: "Advance Diploma in Financial Accounting (ADFA)",
    desc: [
      "Computer Basic",
      "Manual Accounting",
      "Tally ERP 9 (Basic + Advance)",
      "Excel Advance",
      "MS-Access",
      "Fundamental of Accounting",
      "GST",
      "Data Entry",
      "Operating System",
    ],
  },
  {
    title: "Advance Diploma in Multimedia and Animation (ADMA)",
    desc: [
      "Corel Draw",
      "Power Point Presentation",
      "Data Entry (Excel)",
      "Photoshop",
      "Fundamental of Computer",
      "PageMaker",
      "Editing/Designing",
      "MS-Access",
      "MS-Word",
    ],
  },
];
const ShortCourses = [
  {
    title: "Basic Diploma in Computer Application (BDCA)",
    desc: [
      "MS-Word",
      "MS-PowerPoint",
      "MS-Excel",
      "MS-Access",
      "MS-Paint",
      "Typing Skill",
      "Internet",
    ],
  },
  {
    title: "Certificate of Financial Accounting (CFA)",
    desc: ["MS-Excel", "Foundation of Accounting", "MS-Access", "Tally"],
  },
  {
    title: "Basic Diploma in Office Automation (DOA)",
    desc: [
      "MS-Word",
      "MS-PowerPoint",
      "MS-Excel",
      "MS-Access",
      "Internet & Multimedia",
      "Fundamental of Computer",
      "Internet",
    ],
  },
  {
    title: "Diploma in Computer Application (DCA)",
    desc: [
      "MS-Office",
      "Tally",
      "Photoshop",
      "Fundamental of Computer",
      "Typing Test",
      "PageMaker",
    ],
  },
  {
    title: "Diploma in Tally ERP 9 with GST",
    desc: [
      "Fundamental of Accounting",
      "Fundamental of Computer",
      "GST Rule",
      "Tally Accounting with GST",
    ],
  },
  {
    title: "Diploma in DTP (Advance Desktop Publishing)",
    desc: ["Photoshop 7.0 and CC", "Corel Draw", "Leap Office", "PageMaker"],
  },
];
const ComputerHero = () => {
  const Courses = [
    {
      title: "Courses",
      items: LongCourses,
    },
    {
      title: "Short Term Courses",
      items: ShortCourses,
    },
  ];
  return (
    <div className=" px-5 lg:px-15 2xl:px-30 mb-5">
      <div className="flex items-center justify-center flex-col">
        <p className="text-5xl font-extrabold mt-12">
          <span className="text-gradient-bg bg-clip-text">EMAX</span> INDIA
        </p>
        <p className="text-xl font-medium mt-2 ">Under Govt. Of India</p>

        <hr className="w-20 mt-5 border-t-2 border-stone-900 " />
      </div>
      {Courses.map((group, i) => (
        <div>
          <h3 className="text-2xl uppercase font-bold text-center my-3" key={i}>
            {group.title}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
            {group.items.map((course, index) => (
              <div
                className="border border-stone-100 rounded-10px shadow-punch-secondary p-5"
                key={index}
              >
                <p className="font-bold text-lg">{course.title}</p>
                <p className="font-normal text-sm">Duration 1 Year</p>
                <hr className="w-15 my-1.5 border-t-2 border-stone-900 " />
                <ul>
                  {course.desc?.map((item, j) => (
                    <li key={j} className="text-stone-700">
                      {item}{" "}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ComputerHero;

import { GraduationCap, Atom, IndianRupee } from "lucide-react";

const CollegeData = [
  {
    title: "Arts",
    icon: GraduationCap,
    items: [
      "English",
      "M.I.L(Assamese, Bengali, Hindi)/Alternative English",
      "Economics",
      "Political Science",
      "Education",
      "Logic & Philosophy",
      "Sociology",
      "History",
      "Geography",
      "Advance Assamese / Advance Hindi",
      "Mathematics",
      "Sanskrit",
      "Swadesh Adhyayan",
      "Bihu",
      "Computer Science",
    ],
  },
  {
    title: "Science",
    icon: Atom,
    items: [""],
  },
  {
    title: "Commerce",
    icon: IndianRupee,
    items: [""],
  },
];
const SchoolData = [
  {
    title: "Nursery",
    icon: GraduationCap,
  },
  {
    title: "L.K.G",
    icon: GraduationCap,
  },
  {
    title: "U.K.G",
    icon: GraduationCap,
  },
  {
    title: "Class I",
    icon: GraduationCap,
  },
  {
    title: "Class II",
    icon: GraduationCap,
  },
  {
    title: "Class III",
    icon: GraduationCap,
  },
  {
    title: "Class IV",
    icon: GraduationCap,
  },
  {
    title: "Class V",
    icon: GraduationCap,
  },
  {
    title: "Class VI",
    icon: GraduationCap,
  },
  {
    title: "Class VII",
    icon: GraduationCap,
  },
  {
    title: "Class VIII",
    icon: GraduationCap,
  },
  {
    title: "Class IX",
    icon: GraduationCap,
  },
  {
    title: "Class X",
    icon: GraduationCap,
  },
];

export default function Stream({Text}) {
  const CourseData = Text === "school" ? SchoolData : CollegeData;
  return (
    <div className="flex items-center justify-center flex-col px-5 lg:px-15 2xl:px-30">
      <p className="text-3xl md:text-5xl font-extrabold mt-8 sm:mt-12 relative">
        <span className="text-gradient-bg bg-clip-text">{Text === "school" ? "Classes" : "Stream"}</span> 
      </p>
      <hr className="w-20 my-5 border-t-2 border-stone-900 " />
      <div className={`grid gap-5 w-full grid-cols-3 ${Text === "school" ? " md:grid-cols-3 2xl:grid-cols-7" : " md:grid-cols-2 2xl:grid-cols-3"}`}>
        {CourseData.map((data) => (
          <div className="" key={data.title}>
              <div className={`flex items-center justify-center flex-col border border-stone-200 rounded-10px shadow-punch-secondary ${Text ? "px-2 py-4": "p-20"} sm:${Text ? "px-8 py-8": "p-20"} px-8 py-8` }>
                <data.icon className={`w-8 h-8 ${Text ? "" : ""} sm:w-18 sm:h-18`}/>
                <p className="font-medium md:font-bold text-base md:text-xl md:mt-3">{data.title}</p>
              </div>
          </div>
        ))}
      </div>
    </div>
  );
}

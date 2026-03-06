import { useState } from "react";
const collegeMembers = [
  {
    src: "/assets/layout/college/principal.jpg",
    role: "Principal",
    name: "Banashree Agasty",
  },
  {
    src: "/assets/layout/college/vicePrincipal.jpg",
    role: "Vice Principal",
    name: "Sri Shekhar Jyoti Saikia",
  },
  {
    src: "/assets/layout/college/chiefAdvisor.jpg",
    role: "Chief Advisor",
    name: "Sri Manabendra Nag",
    staffdetails: "Former Vice Chancellor, Dibrugarh University",
  },
  {
    src: "/assets/layout/college/rector.jpeg",
    role: "Rector",
    name: "Bidhan Boruah",
  },
  {
    src: "/assets/layout/college/advisor.jpeg",
    role: "Advisor",
    name: "Devojit Goswami",
  },
  {
    src: "/assets/layout/college/academicOfficer.png",
    role: "Academic Officer",
    name: "Binita Kakoti",
  },
  {
    src: "/assets/layout/college/madhumita.jpg",
    role: "SuperVisor",
    name: "Madhumita Boruah",
  },
];
const SchoolMembers = [
  {
    src: "/assets/layout/college/principal.jpg",
    role: "Principal",
    name: "Banashree Agasty",
  },
   {
    src: "/assets/layout/college/advisor.jpeg",
    role: "Administrator",
    name: "Devojit Goswami",
  },
   {
    src: "/assets/layout/college/chiefAdvisor.jpg",
    role: "Chief Advisor",
    name: "Sri Manabendra Nag",
  },
  {
    src: "/assets/layout/college/vicePrincipal.jpg",
    role: "Vice Principal",
    name: "Sri Shekhar Jyoti Saikia",
  },
  {
    src: "/assets/layout/college/rector.jpeg",
    role: "Rector",
    name: "Bidhan Boruah",
  },
 
  {
    src: "/assets/layout/school/ramesh.jpeg",
    role: "Head of KKv Computer Dept",
    name: "Ramesh Kumar Prasad",
  },
  {
    src: "/assets/layout/school/monalisha.jpeg",
    role: "SuperVisor",
    name: "Monalisha Saikia",
  },
  {
    src: "/assets/layout/school/",
    role: "Academic Officer",
    name: "Mala Sarma Bordoloi",
  },
  {
    src: "/assets/layout/school/rinamoni.jpeg",
    role: "Block Incharge (Assamese Medium)",
    name: "Rima Moni Bhuyan Bora",
  },

];

const Staff = ({type}) => {
  const members = type === "school" ? SchoolMembers : collegeMembers;
  const [active, setActive] = useState(0);
  return (
    <div className="flex items-center justify-center flex-col px-5 lg:px-15 2xl:px-30">
      <p className="text-3xl md:text-5xl font-extrabold mt-8 sm:mt-12 relative">
        Head <span className="text-gradient-bg bg-clip-text">Staff</span>
      </p>
      <hr className="w-20 my-5 border-t-2 border-stone-900 " />
      <div className="flex items-center justify-center gap-2 md:gap-5 flex-col md:flex-row w-full">
        {members.map((member, index) => {
          const isActive = active === index;

          return (
            <div
              key={index}
              onMouseEnter={() => setActive(index)}
              // onMouseLeave={()=> setActive(0)}
              className={`
              relative overflow-hidden cursor-pointer
              rounded-10px
              transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)]
              ${isActive ? "w-full aspect-square" : "w-[90%]"}
              md:${isActive ? "w-[100%]" : "w-[80%]"}
              h-90
              ${!isActive && "scale-90 opacity-80"}
            `}
            >
              {/* IMAGE */}
              <img
                src={member.src}
                alt={member.role}
                className={`
                w-[750px] h-full object-cover
                transition-transform duration-700
                ${isActive ? "scale-100" : "scale-100"}
              `}
              />

              {/* TEXT */}
              <div
                className={`
                absolute bottom-6 left-6 text-stone-50 z-40
                transition-all duration-500
                ${
                  isActive
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-6"
                }
              `}
              >
                <h3 className="text-xl font-semibold">{member.name}</h3>
                <p className="text-sm opacity-80">{member.role}</p>
              </div>

              <div className={`absolute inset-0 ${isActive ? "bg-linear-to-t from-punch-400 from-5% via-transparent to-transparent to-90" : ""}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Staff;

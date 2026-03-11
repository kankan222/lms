import StaffCard from "./StaffCard";
const collegeMembers = [
  {
    src: "/assets/layout/college/rector.jpeg",
    role: "Rector",
    name: "Bidhan Boruah",
  },
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
    src: "/assets/layout/college/rector.jpeg",
    role: "Rector",
    name: "Bidhan Boruah",
  },
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
  const Image = type === "school" ? SchoolMembers : collegeMembers;
  
  return (
    <div className="flex items-center justify-center flex-col px-5 lg:px-15 2xl:px-30">
      <p className="text-5xl font-extrabold mt-12 relative ">
        Head <span className="text-gradient-bg bg-clip-text">Staff</span>
      </p>
      <hr className="w-20 my-5 border-t-2 border-stone-900 "/>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
        {Image.map((image, index) => (
          <StaffCard
            key={index}
            src={image.src}
            role={image.role}
            name={image.name}
          />
        ))}
      </div>
    </div>
  );
};

export default Staff;

import StaffCard from "./StaffCard";

const Image = [
    {
      src: "/assets/layout/college/principal.jpg",
      title: "Principal",
      staffcardname: "Banashree Agasty",
    },
     {
      src: "/assets/layout/college/vicePrincipal.jpg",
      title: "Vice Principal",
      staffcardname: "Sri Shekhar Jyoti Saikia",
    },
    {
      src: "/assets/layout/college/chiefAdvisor.jpg",
      title: "Chief Advisor",
      staffcardname: "Sri Manabendra Nag",
      staffdetails: "Former Vice Chancellor, Dibrugarh University",
    },
    {
      src: "/assets/layout/college/rector.jpg",
      title: "Rector",
      staffcardname: "Bidhan Boruah",
    },
    {
      src: "/assets/layout/college/advisor.jpeg",
      title: "Advisor",
      staffcardname: "Devojit Goswami",
    },
    {
      src: "/assets/layout/college/academicOfficer.jpg",
      title: "Academic Officer",
      staffcardname: "Binita Kakoti",
    },
    {
      src: "/assets/layout/college/academicOfficer.jpg",
      title: "SuperVisor",
      staffcardname: "Madhumita Boruah",
    },
    
  ];

const Staff = () => {
  
  return (
    <div className="flex items-center justify-center flex-col px-5 lg:px-15 2xl:px-30">
      <p className="text-5xl font-extrabold mt-12 relative ">
        Head <span className="text-gradient-bg bg-clip-text">Staff</span>
      </p>
      <hr className="w-20 my-5 border-t-2 border-stone-900 "/>
      <div className="grid grid-cols-3 gap-4">
        {Image.map((image, index) => (
          <StaffCard
            key={index}
            src={image.src}
            title={image.title}
            staffcardname={image.staffcardname}
            staffdetails={image.staffdetails}
          />
        ))}
      </div>
    </div>
  );
};

export default Staff;

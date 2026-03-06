import Header from "../../components/Header";
import Footer from "../../components/Footer";

import StaffCard from "../../components/Staff/StaffCard";
import staffSections from "../../components/Staff/StaffSection";
const StaffPage = ({type}) => {
  const sections = staffSections[type]
  console.log("Section", type)
  console.log(typeof type)
  return (
    <>
      <Header />
      <div className="flex items-center justify-center flex-col px-5 lg:px-15 2xl:px-30">
        <p className="text-3xl md:text-5xl font-extrabold mt-8 sm:mt-12 relative">
          <span className="text-gradient-bg bg-clip-text">Staff</span>
        </p>
        <hr className="w-20 my-5 border-t-2 border-stone-900 " />
        {sections.map((section, i) => (
          <div key={i}>
            <h2 className="text-center font-bold text-3xl mb-5">{section.heading}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-2 md:gap-4">
              {section.staff.map((person, i)=> (
                <StaffCard
                key={i}
                  {...person}
                />

              ))}
            </div>
          </div>
        ))}
      </div>

      <Footer />
    </>
  );
};

export default StaffPage;

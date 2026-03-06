import Header from "../../components/Header";
import Footer from "../../components/Footer";

const Facilities = ({ type }) => {

  const CollegeText = [
    {
      title: "Hostel Facility",
      text: `Hostel facility will be provided for female students coming from out side the town area on payment of fees for food & lodging.`,
    },
    {
      title: "Scholarship",
      text: `AStudents may enjoy State Merit Scholarship, ST/SC/OBC & Minority Scholarships etc. according to their eligibility.`,
    },
    {
      title: "Awards",
      text: `The college authority has declared Kalong Kapili Award comprising of a cheque of Rupees Fifty thousand and certificate to the student who secures highest percentage of marks in the H.S. Final Examination of the college. Moreover, Manabendra Nag Award that includes a cheque of Rupees Twenty thousand and certificate is awarded to the student who obtains highest percentage of marks in the H.S. First Year Examination.he school authority has declared Awards for the brilliant students doing exceptionally good result in the Unit Tests & Screening Test. Further, in order to inspire the students, it has declared a coveted prize for the brilliant student/students who would secure the highest marks in each Final Examination from the school.`,
    },
    {
      title: "Library Facility",
      text: `Students will be issued Library Cards after their admission against which they will be able to borrow two books at a time from the college library for a period of two weeks. They must return the books to the Library before the announcement of the result of the Screening Test examination, falling which their results will be kept withheld.`,
    },
    {
      title: "Special Attraction of The School",
      text: `SEMINARS, DEBATE & SYMPOSIUMS, QUIZ COMPETITIONS, CULTURAL FUNCTIONS, GAMES AND SPORTS, ETC.`,
    },
  ];
  const SchoolText = [
    {
      title: "Identity Cards",
      text: `Identity Cards will be issued to the Students at the time of admission. The card will bear informations about the holder including his/her photograph duly endorsed by the principal. It must be surrendered to the principal at the end of the academic year for renewal.`,
    },
    {
      title: "Attendance",
      text: `Students must attend their classes regularly and punctually. A student will not be allowed to sit for the final examination, if he/she fails to attend alteast 90% in an academic year.`,
    },
    {
      title: "Examination",
      text: `Attendance in Unit Tests, Half Yearly Examination and Annual Examination is compulsory. No application seeking exemption from appearing at the said examinations will be entertained.`,
    },
    {
      title: "Awards",
      text: `The school authority has declared Awards for the brilliant students doing exceptionally good result in the Unit Tests & Screening Test. Further, in order to inspire the students, it has declared a coveted prize for the brilliant student/students who would secure the highest marks in each Final Examination from the school.`,
    },
    {
      title: "Library Facility",
      text: `Students will be issued Library Cards after their admission against which they will be able to borrow two books at a time from the school library for a period of two weeks. They must return the books to the Library before the announcement of the result of the Screening Test examination, failing which their result will be kept withheld.`,
    },
    {
      title: "Special Attraction of The School",
      text: `SEMINARS, DEBATE & SYMPOSIUMS, QUIZ COMPETITIONS, CULTURAL FUNCTIONS, GAMES AND SPORTS, ETC.`,
    },
  ];
  const RulesText = type === "school" ? SchoolText : CollegeText;
  return (
    <>
      <Header />
      <div
        className="
      items-center justify-center sm:text-center flex flex-col w-full h-full px-5 lg:px-15 2xl:px-30"
      >
        <p className="text-3xl md:text-5xl font-extrabold mt-8 sm:mt-12 relative">
          <span className="text-gradient-bg bg-clip-text">Facilities</span>
        </p>
        <hr className="w-20 my-5 border-t-2 border-stone-900 " />
        {RulesText.map((text, i)=>(
          <div className=" flex justify-center items-center flex-col">
          <p key={i} className="text-base font-bold md:text-lg text-black mb-2 ">{text.title}</p>
          <p className="text-sm md:text-base whitespace-pre-line">{text.text}</p>
          <hr className="w-20 my-5 border-t-2 border-stone-900" />
          </div>
          
        ))}
      </div>
      <Footer />
    </>
  );
};

export default Facilities;

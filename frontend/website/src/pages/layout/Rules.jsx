import Header from "../../components/Header";
import Footer from "../../components/Footer";

const Rules = ({ type }) => {
  const CollegeText = [
    {
      title: "Rules & Regulations",
      text: "Kalong Kapili Vidyapith, School Section is located in the heart of Nagaon town. The school has well-equipped class-rooms with close circuit cameras, library with adequate number of books, journals and periodicals, science laboratories with sophisticated instruments, generator facility for uninterrupted power supply and a good number of Water Purifiers for supplying pure drinking water. The school campus is extremely safe and there are close circuit cameras in every corner to ensure security of the students. The school curriculum gives opportunities and experiences for all children to meet the ever-changing future with resilience and confidence promoting all aspects of school life including sports, culture, environmental issues, performing arts and academic success. The dedicated faculty members are the strength of the school; they inspire intellectual curiosity, independence and effective learning habits. We provide a solid foundation that is supportive and inclusive where we embrace and celebrate every individual.",
    },
    {
      title: "Identity Card",
      text: "Identity Cards will be issued to the Students at the time of admission. The card will bear informations about the holder including his/her photograph duly endorsed by the principal. It must be surrendered to the principal at the end of the academic year for renewal. If the Identity Cards are lost or damaged, the students will have to apply for the new ones which will be provided with after the payment of Rs 20.00 (Rupees Twenty) only.",
    },
    {
      title: "College Uniform",
      text: `BOYS

        White Shirt,Black Long Pant,Orange coloured Tie & Black Shoes with White Socks.
        During Winter:- White Shirt,Black Long Pant,Orange coloured Tie & Black Shoes with White Socks & Black Blazer.

        GIRLS
        White coloured Salwar Kameez with Orange coloured Choorni & Black Pump Shoes.
        During Winter:- White coloured Salwar Kameez with Orange coloured Choorni & Black Pump Shoes & Black Blazer.`,
    },
    {
      title: "Attendance",
      text: "Students must attend their classes regularly and punctually. A student will not be allowed to sit for the final examination, if he/she fails to attend atleast 90% lectures in each subject in an academic year.",
    },
    {
      title: "Examination",
      text: "Attendance in unit tests and screening test conducted by the College is compulsory. No application seeking exemption from appearing at the internal examinations will be entertained. Unsuccessful students in the screening Test will not be eligible to sit for H.S.1st year and H.S.2nd year final examination.",
    }
  ];
  const SchoolText = [
    {
      title: "GENERAL RULES FOR MAINTENANCE OF DISCIPLINE AMONG STUDENTS",
      text: `Great emphasis has been laid by the school authority on discipline and character building. Students are expected to maintain a high standard of discipline & punctuality. They must follow the rules and regulations of the school strictly. Violation of school rules, unsatisfactory progress, irregular attendance, damage of school property, defacing or tampering of notice, showing discourtesy to the teachers & staff members in any form, ragging of students and adoption of unfair means in the examination halls, may lead to suspension, forced transfer and even expulsion of the students from this school.
A student must obtain permission from the principal to leave the school campus during school hours due to any unavoidable reasons.
No transfer certificate will be issued to the students before clearing their fees for the session.`,
    }
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
          <span className="text-gradient-bg bg-clip-text">Rules</span>
        </p>
        <hr className="w-20 my-5 border-t-2 border-stone-900 " />
        {RulesText.map((text, i)=>(
          <div className=" flex justify-center items-center flex-col">
          <p key={i} className="text-base md:text-lg text-black mb-2 ">{text.title}</p>
          <p className="text-sm whitespace-pre-line">{text.text}</p>
          <hr className="w-20 my-5 border-t-2 border-stone-900" />
          </div>
          
        ))}
      </div>
      <Footer />
    </>
  );
};

export default Rules;

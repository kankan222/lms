const SchoolText = [
  "Kalong Kapili Vidyapith, School Section is located in the heart of Nagaon town. The school has well-equipped class-rooms with close circuit cameras, library with adequate number of books, journals and periodicals, science laboratories with sophisticated instruments, generator facility for uninterrupted power supply and a good number of Water Purifiers for supplying pure drinking water. The school campus is extremely safe and there are close circuit cameras in every corner to ensure security of the students. The school curriculum gives opportunities and experiences for all children to meet the ever-changing future with resilience and confidence promoting all aspects of school life including sports, culture, environmental issues, performing arts and academic success. The dedicated faculty members are the strength of the school; they inspire intellectual curiosity, independence and effective learning habits. We provide a solid foundation that is supportive and inclusive where we embrace and celebrate every individual."
]
const CollegeText = [
"Kalong Kapili Vidyapith is located in the heart of Nagaon town. The college has two blocks, Block 1 at GM Road, behind Nowgong College and Block 2 at A.D.P. Road, Christian Patty possessing Arts, Science and Commerce stream for H.S. Classes.We are consistently producing outstanding results because of numerous interventions, teamwork and diligence by staff. The college has well equipped class rooms with speaker facility and close circuit cameras, library with adequate number of books, journals and periodicals, science laboratories with sophisticated instruments, generator facility for uninterrupted power supply, a good number of water purifiers for supplying pure drinking water and lift facility too. The college has a canteen in order to provide hygienic food. The college campus is extremely safe and there are close circuit cameras in every corner to ensure security of the students."
]
const About = ({Text}) => {
  return (
    
      <div
      className="
      items-center justify-center sm:text-center bg-radial from-punch-400 via-transparent to-transparent flex flex-col w-full h-full px-5 lg:px-15 2xl:px-30" 
    >
      <p className="text-3xl md:text-5xl font-extrabold mt-8 sm:mt-12 relative">
        About <span className="text-gradient-bg bg-clip-text">Us</span>
      </p>
      <hr className="w-20 my-5 border-t-2 border-stone-900 "/>
      <p className="text-base md:text-lg text-black"> {Text  === "school"? SchoolText : CollegeText}
        </p>
    </div>
  )
}

export default About
import Header from ".././components/Header"
import Hero from ".././components/Hero"
import About from ".././components/About"
import Staff from ".././components/Staff/Staff"
import Stream from "../components/Stream/Stream"
import Utilities from "../components/Utils/Utilities"
import Gallery from "../components/Gallery/Gallery"
import ContactUs from "../components/Form/ContactUs"
import Footer from "../components/Footer"

const SchoolHome = () => {
  return (
    <>
      <Header Text="school"/>
      <Hero Text="school" />
      <About Text="school"/>
      <Staff type="school"/>
      <Stream Text="school"/>
      <Utilities/>
      <Gallery Text="school"/>
      <ContactUs />
      <Footer />
    </>
  )
}

export default SchoolHome

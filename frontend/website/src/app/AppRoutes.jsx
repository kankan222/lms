import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "../pages/Home";

//Section Layout
import SectionLayout from "../modules/SectionLayout";
import { sectionConfigs } from "../modules/SectionConfig";

//College Section
import CollegeHome from "../pages/CollegeHome";
import Staff from "../pages/layout/StaffPage";
import FeeStructure from "../pages/layout/FeeStructure";
import Rules from "../pages/layout/Rules";
import Facilities from "../pages/layout/Facilities";
import Gallery from "./../pages/layout/GalleryPage";

//School Section
import SchoolHome from "../pages/SchoolHome";

//Computer Section
import ComputerLayout from "../pages/ComputerHome";

const AppRoutes = () => {
  return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />

          {/* College  */}
          <Route path='/college' element={<SectionLayout config={sectionConfigs.college} />} >
            <Route index element={<CollegeHome />} />
            <Route path="facilities" element={<Facilities />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="fee-structure" element={<FeeStructure />} />
            <Route path="staff" element={<Staff type="college"/>} />
            <Route path="rules" element={<Rules />} />
          </Route>

          {/* School  */}
          <Route path='/school' element={<SectionLayout config={sectionConfigs.school} />} >
          <Route index element={<SchoolHome />} />
            <Route path="facilities" element={<Facilities type="school"/>} />
            <Route path="gallery" element={<Gallery type="school"/>} />
            <Route path="fee-structure" element={<FeeStructure type="school"/>} />
            <Route path="staff" element={<Staff type="school"/>} />
            <Route path="rules" element={<Rules type="school"/>} />
          </Route>
          
          {/* Computer Section */}
          <Route path='/computer' element={<ComputerLayout />} >
          </Route>
          
        </Routes>
      </BrowserRouter>
  )
}

export default AppRoutes

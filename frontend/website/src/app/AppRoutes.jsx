import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SeoManager from "./SeoManager";

const Home = lazy(() => import("../pages/Home"));

//Section Layout
const SectionLayout = lazy(() => import("../modules/SectionLayout"));
import { sectionConfigs } from "../modules/SectionConfig";

//College Section
const CollegeHome = lazy(() => import("../pages/CollegeHome"));
const Staff = lazy(() => import("../pages/layout/StaffPage"));
const FeeStructure = lazy(() => import("../pages/layout/FeeStructure"));
const Rules = lazy(() => import("../pages/layout/Rules"));
const PrivacyPolicy = lazy(() => import("../pages/layout/PrivacyPolicy"));
const Error402 = lazy(() => import("../pages/layout/Error402"));
const ContactPage = lazy(() => import("../pages/layout/ContactPage"));
const Facilities = lazy(() => import("../pages/layout/Facilities"));
const Gallery = lazy(() => import("./../pages/layout/GalleryPage"));

//School Section
const SchoolHome = lazy(() => import("../pages/SchoolHome"));

//Computer Section
const ComputerLayout = lazy(() => import("../pages/ComputerHome"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center px-5 text-sm text-muted-foreground">
      Loading page...
    </div>
  );
}

const AppRoutes = () => {
  return (
    <Suspense fallback={<RouteFallback />}>
      <BrowserRouter>
        <SeoManager />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/contact-us" element={<ContactPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />

          {/* College  */}
          <Route path='/college' element={<SectionLayout config={sectionConfigs.college} />} >
            <Route index element={<CollegeHome />} />
            <Route path="facilities" element={<Facilities />} />
            <Route path="gallery" element={<Gallery Text="college" />} />
            <Route path="fee-structure" element={<FeeStructure />} />
            <Route path="staff" element={<Staff type="college"/>} />
            <Route path="rules" element={<Rules />} />
          </Route>

          {/* School  */}
          <Route path='/school' element={<SectionLayout config={sectionConfigs.school} />} >
          <Route index element={<SchoolHome />} />
            <Route path="facilities" element={<Facilities type="school"/>} />
            <Route path="gallery" element={<Gallery Text="school"/>} />
            <Route path="fee-structure" element={<FeeStructure type="school"/>} />
            <Route path="staff" element={<Staff type="school"/>} />
            <Route path="rules" element={<Rules type="school"/>} />
          </Route>
          
          {/* Computer Section */}
          <Route path='/computer' element={<ComputerLayout />} >
          </Route>

          <Route path="*" element={<Error402 />} />
          
        </Routes>
      </BrowserRouter>
    </Suspense>
  )
}

export default AppRoutes


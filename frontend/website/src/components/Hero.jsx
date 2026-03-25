import CollegeHero from "/assets/site/collegeHero.png";
import SchoolHero from "/assets/site/schoolHero.png";
import AdmissionDialog from "./Form/AdmissionDialog";

function Hero({ Text }) {
  const section = Text === "school" ? "school" : "college";

  return (
    <section className="flex w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 w-full overflow-hidden ">
        <div className="flex justify-center w-full text-center md:text-left flex-col p-5 xl:px-28 lg:pb-15">
          <div className="">
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Empowering <span className="text-gradient-bg bg-clip-text">Students</span>{" "}
              for a Brighter Future
            </h1>

            <p className="text-muted-foreground">
              Achieve your academic and career goals with world-class programs,
              expert faculty, and vibrant campus life.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-4 md:flex-row">
            <AdmissionDialog section={section} label="Apply for Admission" />
          </div>
        </div>

        <div className="relative flex justify-center border border-stone-100 overflow-hidden rounded-bl-10px w-full">
          <img
            src={Text === "school" ? SchoolHero : CollegeHero}
            alt="College"
            fetchPriority="high"
            decoding="async"
            className="w-full h-[50vh] sm:h-[calc(100vh-80px)] object"
          />
        </div>
      </div>
    </section>
  );
}
export default Hero;

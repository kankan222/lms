import { Link } from "react-router-dom";
import CollegeHero from "/assets/site/collegeHero.png";
import SchoolHero from "/assets/site/schoolHero.png";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";

function Hero({ Text }) {
  return (
    <section className="flex w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 w-full overflow-hidden ">
        {/* LEFT SIDE */}

        <div className="flex justify-center w-full text-center md:text-left flex-col p-5 xl:px-28 lg:pb-15">
          <div className="">
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Empowering{" "}
              <span className="text-gradient-bg bg-clip-text">Students</span>{" "}
              for a Brighter Future
            </h1>

            <p className="text-muted-foreground">
              Achieve your academic and career goals with world-class programs,
              expert faculty, and vibrant campus life.
            </p>
          </div>

          <div className="flex gap-4 mt-4 flex-col md:flex-row">
            <Button>
              Apply for Admission
              <ArrowUpRight />
            </Button>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="relative flex justify-center border border-stone-100 overflow-hidden rounded-bl-10px w-full">
          <img
            src={Text === "school" ? SchoolHero : CollegeHero}
            alt="College"
            className="w-full h-[50vh] sm:h-[calc(100vh-80px)] object"
          />
        </div>
      </div>
    </section>
  );
}
export default Hero;

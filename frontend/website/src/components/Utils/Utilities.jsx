import {
  Users,
  HandCoins,
  BookOpenText,
  BriefcaseBusiness,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom"
const Utils = [
  {
    icon: Users,
    title: "Staff",
    description: "List of All Staff Members",
    path: "staff"
  },
  {
    icon: HandCoins,
    title: "Fee Structure",
    description: "Structure for fees",
    path: "fee-structure"
  },
  {
    icon: BookOpenText,
    title: "Rules",
    description: "Rules & Regulations",
    path: "rules"
  },
  {
    icon: BriefcaseBusiness,
    title: "Facilities",
    description: "Library, Hall, Playground",
    path: "facilities"
  },
];
const Utilities = () => {
    const location = useLocation();
  const section = location.pathname.split("/")[1]; 
  return (
    <div className="flex items-center justify-center flex-col px-5 lg:px-15 2xl:px-30">
        <p className="text-3xl md:text-5xl font-extrabold mt-8 sm:mt-12 relative ">
        <span className="text-gradient-bg bg-clip-text">Utilities</span> 
      </p>
      <hr className="w-20 my-5 border-t-2 border-stone-900 " />
      <div className="grid grid-cols-1 gap-5 w-full md:grid-cols-2 2xl:grid-cols-4">
        {Utils.map((util, index) => (
          <Link key={index} to={`/${section}/${util.path}`}>
          <div className="flex items-center gap-3 border border-stone-200 rounded-10px shadow-punch-secondary px-5 py-3 md:px-10 md:py-8">
            <util.icon className={`w-8 h-8 sm:w-18 sm:h-18`}/>
            <div className="">
              <p className="font-medium md:font-bold text-base md:text-xl">{util.title}</p>
              <p className="text-xs text-stone-500">{util.description}</p>
            </div>
          </div>
          
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Utilities;

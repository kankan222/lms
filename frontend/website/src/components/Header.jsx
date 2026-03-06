import logo from "/assets/site/logobg.png";
import Navbar from "./Navbar.jsx"
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { useNavigate} from "react-router-dom"
const Header = ({Text}) => {
  const navigate = useNavigate();
   const base = location.pathname.split("/")[1];

  const handleClick = () => {
    navigate(`/${base}`);
  };

  return (
    <>
      <header className="z-50 sticky top-0 left-0 w-full backdrop-blur-sm border border-b-stone-200">
        <div className="min-h-15 flex items-center justify-between w-full px-2 lg:px-15 2xl:px-30 mr-auto ml-auto">
          <div className="header-left flex items-center gap-2">
            <div className="w-20">
              
              <img src={logo} alt="logo" onClick={handleClick}/>
            </div>
            <div className="header-text border-l-2 border-primary pl-2 leading-10 hidden md:block lg:block 2xl:block">
              <p>
                <b>Kalong Kapili Vidyapith <span>{Text === "school" ? "School Section" : ""}</span></b>
              </p>
              <hr style={{border: "1px solid"}}/>
                <p><b>কলং কপিলী বিদ্যাপীঠ</b></p>
            </div>
          </div>
          <div className="header-right flex gap-6 items-center">
            <Navbar/>
            <Button className="">
            Admission
            <ArrowUpRight className="transition hover:-translate-x-1"/>
          </Button>
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;

import { useNavigate } from "react-router-dom";
import logo from "/assets/site/logo.png";
import { Button } from "@/components/ui/button";
import { Phone, Mail,  School , GraduationCap, MonitorCheck} from "lucide-react";

const Home = () => {
  const navigate = useNavigate();
  const HomeCardData = [
    {
      title: "Higher Secondary Section",
      desc: "Arts, Science & Commerce (English & Assamese Medium)",
      address: "ADP Road, Christianpatty, Nagaon(Assam)",
      route: "/college",
      icon: School,
    },
    {
      title: "School Section",
      desc: "Nursery to Class-X (English & Assamese Medium)",
      address: "G.M Road, (Back side of Nowgong College)",
      route: "/school",
      icon: GraduationCap,
    },
    {
      title: "EMAX INDIA",
      desc: "Computer Education & Training Center",
      address: "ADP Road, Christianpatty, Nagaon(Assam)",
      route: "/computer",
      icon: MonitorCheck,
    },
  ];
  return (
    <>
      <header className="flex items-center xl:justify-between py-2 text-black z-50 flex-col sm:flex-row md:flex-row lg:flex-row 2xl:flex-row px-5 lg:px-15  2xl:px-30">
        <div className="header-left flex items-center gap-2">
          <div className="header-img w-25">
            <img src={logo} alt="" />
          </div>
          <div className="header-text border-l-2 border-primary pl-2 leading-10 ">
            <p>
              <b>Kalong Kapili Vidyapith</b>
            </p>
            <hr style={{ border: "1px solid" }} />
            <p>
              <b>কলং কপিলী বিদ্যাপীঠ</b>
            </p>
          </div>
        </div>

        <div className="header-right flex gap-2">
          <Button className="bg-punch-600 rounded-2xl hover:bg-punch-800 cursor-pointer mt-2.5 lg:mt-0 3xl:mt-0 w-fit">
            <Phone />
            Enquire Now
          </Button>
          <Button variant="secondary" className="rounded-2xl cursor-pointer mt-2.5 lg:mt-0 3xl:mt-0 w-fit">
            <Mail />
            Contact Us
          </Button>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-1 lg:grid-cols-2 lg:gap-3 2xl:grid-cols-3 2xl:gap-4 px-5 lg:px-15 2xl:px-30">
        {HomeCardData.map((card, index) => (
          <div
            className=" p-4 my-1 rounded-lg shadow-md flex border border-punch-300 bg-punch-50-1 gap-4 items-start lg:my-2 2xl:my-4"
            key={index}
            onClick={() => navigate(card.route)}
          >
            <Button className="bg-punch-600 rounded-md hover:bg-punch-800 " size="icon">
            <card.icon />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{card.title}</h1>
              <p className="text-gray-900 text-base">{card.desc}</p>
              <p className="text-gray-600 text-sm">{card.address}</p>
              <Button variant="" className="bg-punch-600 rounded-2xl hover:bg-punch-800 mt-5"> 
                Click Here
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default Home;

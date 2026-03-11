import { Link, NavLink } from "react-router-dom";
const NavItem = [
  
  {
    title: "Staff",
    link: "/staff",
  },
  {
    title: "Gallery",
    link: "/gallery",
  },
  {
    title: "Fees",
    link: "/fee-structure",
  },
  {
    title: "Facilities",
    link: "/facilities",
  },
];
const Navbar = () => {
  const section = location.pathname.split("/")[1];

  return (
    <nav className="hidden sm:block md:block lg:block xl:block 2xl:block">
      <ul className="flex align-center">
        {NavItem.map((item, index) => (
          <li key={index} className="px-2 py-1.5 rounded-xl text-sm border border-transparent text-stone-700 hover:text-stone-950 hover:bg-stone-50 hover:border-stone-100">
            <NavLink
              to = {`/${section}/${item.link}`}
              className={({ isActive }) => `${isActive ? "bg-stone-50 border-stone-100" : ""} `}
            >
              {item.title}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navbar;

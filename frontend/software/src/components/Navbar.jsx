import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Moon, User, Settings, LogOut, Sun, Mail, Bell, Search, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/providers/useTheme";
import {
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
} from "./ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "../hooks/useAuth";
import { useNotifications } from "../notifications/useNotifications";
import logo from "/assets/logobg.png";

const Navbar = () => {
  const { setTheme } = useTheme();
  const { logout } = useAuth();
  const { unread, canViewNotifications } = useNotifications();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  function publishPageSearch(nextQuery) {
    window.dispatchEvent(
      new CustomEvent("lms:page-search", {
        detail: { query: nextQuery },
      }),
    );
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    publishPageSearch(normalizedQuery);
  }

  return (
    <nav className="p-2 flex items-center justify-between">
      <header className="flex shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="ml-2" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <SidebarGroup className="py-0">
            <SidebarGroupContent className="relative">
              <form onSubmit={handleSearchSubmit}>
                <SidebarInput
                  id="search"
                  placeholder="Search this page..."
                  className="h-11 w-[min(56vw,560px)] pl-10 pr-24 text-base md:w-[460px] xl:w-[560px]"
                  value={query}
                  onChange={(e) => {
                    const nextQuery = e.target.value;
                    setQuery(nextQuery);
                    publishPageSearch(nextQuery.trim());
                  }}
                />
              </form>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 opacity-50 select-none" />
              {normalizedQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    publishPageSearch("");
                  }}
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80"
                >
                  Clear
                </button>
              ) : null}
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      </header>
      <div className="flex items-center gap-2 mr-1.5">
        <Button variant="outline" size="icon" asChild>
          <a
            href="https://kalongkapilividyapith.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Open main website"
            title="Open main website"
          >
            <Globe />
          </a>
        </Button>
        <Link to="/messaging">
          <Button variant="outline" size="icon">
            <Mail />
          </Button>
        </Link>
        {canViewNotifications ? (
          <Link to="/notifications" className="relative">
            <Button variant="outline" size="icon">
              <Bell />
            </Button>
            {unread ? (
              <span className="absolute -top-1.5 -right-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Link>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar>
              <AvatarImage src={logo} />
              <AvatarFallback>Admin</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent sideOffset={10}>
            <DropdownMenuGroup>
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuItem>
                <User />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut />
                LogOut
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
};

export default Navbar;


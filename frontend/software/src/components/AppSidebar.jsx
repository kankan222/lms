import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
} from "@/components/ui/sidebar";

import {
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "./ui/sidebar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { CircleUserRound, ChevronUp } from "lucide-react";

import { appRoutes, isRouteAllowedForUser } from "../routes/RouteConfig";
import { usePermissions } from "../hooks/usePermissions";
import { useAuth } from "../hooks/useAuth";
const AppSidebar = () => {

  const { can } = usePermissions();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate()

  const visibleRoutes = appRoutes.filter(route => {
    if (!isRouteAllowedForUser(route, user)) return false;

    if (!route.permission) return true;

    return can(route.permission);

  });

  function isRouteActive(path) {
    if (path === "/") return location.pathname === path;
    return (
      location.pathname === path ||
      location.pathname.startsWith(`${path}/`)
    );
  }

  const displayName =
    user?.name ||
    user?.teacher_name ||
    user?.parent_name ||
    user?.staff_name ||
    user?.username ||
    user?.email ||
    user?.phone ||
    "User";

const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };
  return (
    <Sidebar collapsible="icon">

      <SidebarHeader className="py-2.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/">
                <span className="uppercase font-medium">Kalong Kapili Vidyapith</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>

          <SidebarGroupLabel>Application</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>

              {visibleRoutes.map((item, index) => (
                <SidebarMenuItem key={index}>
                  {(() => {
                    const active = isRouteActive(item.path);

                    return (
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className={active ? "border border-border bg-accent font-medium text-accent-foreground shadow-sm" : ""}
                      >

                        <NavLink to={item.path}>
                          <item.icon />
                          <span>{item.title}</span>
                        </NavLink>

                      </SidebarMenuButton>
                    );
                  })()}

                </SidebarMenuItem>
              ))}

            </SidebarMenu>
          </SidebarGroupContent>

        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <DropdownMenu>

          <DropdownMenuTrigger asChild>
            <SidebarMenuButton>
              <CircleUserRound />
              <span className="truncate">{displayName}</span>
              <ChevronUp className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuItem>Account</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
          </DropdownMenuContent>

        </DropdownMenu>
      </SidebarFooter>

    </Sidebar>
  );
};

export default AppSidebar;

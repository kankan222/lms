import { NavLink, useNavigate } from "react-router-dom";
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

import { appRoutes } from "../routes/RouteConfig";
import { usePermissions } from "../hooks/usePermissions";
import { logoutApi } from "../api/auth.api";
const AppSidebar = () => {

  const { can } = usePermissions();
  const navigate = useNavigate()

  const visibleRoutes = appRoutes.filter(route => {

    if (!route.permission) return true;

    return can(route.permission);

  });
const handleLogout = async () => {
  try {
    await logoutApi();
  } catch (err) {
    console.error(err);
  } finally {
    navigate("/login");
  }
};
  return (
    <Sidebar collapsible="icon">

      <SidebarHeader className="py-2.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/">
                <span className="uppercase">Kalong Kapili Vidyapith</span>
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

                  <SidebarMenuButton asChild>

                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        isActive ? "bg-muted" : ""
                      }
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>

                  </SidebarMenuButton>

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
              <span>Admin</span>
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
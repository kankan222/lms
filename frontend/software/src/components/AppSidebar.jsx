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

import { isRouteAllowedForUser, navSections } from "../routes/RouteConfig";
import { usePermissions } from "../hooks/usePermissions";
import { useAuth } from "../hooks/useAuth";
const AppSidebar = () => {

  const { can } = usePermissions();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate()

  function canShowRoute(route) {
    if (!isRouteAllowedForUser(route, user)) return false;

    if (!route.permission) return true;

    return can(route.permission);
  }

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(canShowRoute),
    }))
    .filter((section) => section.items.length > 0);

  function isRouteActive(item) {
    const target = item.to || item.path;
    const [targetPath, targetSearch = ""] = target.split("?");

    if (targetSearch) {
      return location.pathname === targetPath && location.search === `?${targetSearch}`;
    }

    if (item.path === "/attendance" && location.pathname === "/attendance" && location.search) {
      return false;
    }

    if (item.path === "/") return location.pathname === item.path;
    if (location.pathname === item.path) return true;

    const hasExactSidebarMatch = visibleSections.some((section) =>
      section.items.some((sectionItem) => {
        const sectionTarget = sectionItem.to || sectionItem.path;
        const [sectionTargetPath, sectionTargetSearch = ""] = sectionTarget.split("?");

        if (sectionTargetSearch) {
          return location.pathname === sectionTargetPath && location.search === `?${sectionTargetSearch}`;
        }

        return location.pathname === sectionTargetPath;
      })
    );

    if (hasExactSidebarMatch) return false;

    return location.pathname.startsWith(`${item.path}/`);
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

      <SidebarContent className="sidebar-primary-scrollbar">
        <SidebarGroup>

          {visibleSections.map((section) => (
            <div key={section.title} className="mb-1 last:mb-0">
              <SidebarGroupLabel className="h-6 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/55">
                {section.title}
              </SidebarGroupLabel>

              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {section.items.map((item) => {
                    const active = isRouteActive(item);

                    return (
                      <SidebarMenuItem
                        key={`${section.title}-${item.title}-${item.to || item.path}`}
                        className="ml-3"
                      >
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          className={
                            active
                              ? "border border-sidebar-border bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-sm [&>svg]:text-sidebar-accent-foreground"
                              : "font-semibold text-sidebar-foreground/55 hover:text-sidebar-foreground [&>svg]:text-sidebar-foreground/55 hover:[&>svg]:text-sidebar-foreground"
                          }
                        >
                          <NavLink to={item.to || item.path}>
                            <item.icon />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </div>
          ))}

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

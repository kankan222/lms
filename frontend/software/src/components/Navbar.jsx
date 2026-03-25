import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Moon, User, Settings, LogOut, Sun, Mail, Bell, Search } from "lucide-react";
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
import { appRoutes } from "../routes/RouteConfig";
import { getStudents } from "../api/students.api";
import { getTeachers } from "../api/teachers.api";
import { listStaff } from "../api/staff.api";
import { getSubjects } from "../api/subjects.api";
import { getClassStructure } from "../api/academic.api";
import { getExams } from "../api/exam.api";
import { getUsers } from "../api/users.api";
import logo from "/assets/logobg.png";

function buildSearchEntry({ label, path, type, keywords = [], meta = "", description = "" }) {
  return {
    label,
    path,
    type,
    meta,
    description,
    keywords: [label, type, meta, description, ...keywords].filter(Boolean).join(" ").toLowerCase(),
  };
}

const Navbar = () => {
  const { setTheme } = useTheme();
  const { logout, user } = useAuth();
  const { unread, canViewNotifications } = useNotifications();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recordResults, setRecordResults] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const permissions = useMemo(() => (Array.isArray(user?.permissions) ? user.permissions : []), [user?.permissions]);
  const roles = useMemo(() => (Array.isArray(user?.roles) ? user.roles : []), [user?.roles]);

  const searchableRoutes = useMemo(() => {
    const routes = appRoutes
      .filter((route) => {
        if (route.hideForRoles?.some((role) => roles.includes(role))) {
          return false;
        }
        if (route.permission && !permissions.includes(route.permission)) {
          return false;
        }
        return true;
      })
      .map((route) =>
        buildSearchEntry({
          label: route.title,
          path: route.path,
          type: "Module",
          keywords: [route.title, route.path.replace("/", " ")],
          meta: route.path,
        }),
      );

    if (canViewNotifications) {
      routes.push(
        buildSearchEntry({
          label: "Notifications",
          path: "/notifications",
          type: "Module",
          keywords: ["alerts", "bell", "feed"],
          meta: "/notifications",
        }),
      );
    }

    return routes;
  }, [permissions, roles, canViewNotifications]);

  useEffect(() => {
    let ignore = false;

    async function loadSearchRecords() {
      setLoadingRecords(true);
      try {
        const requests = [];

        if (permissions.includes("student.view")) {
          requests.push(
            getStudents().then((rows) =>
              (rows?.data || rows || []).map((student) =>
                buildSearchEntry({
                  label: student.name || student.full_name || `Student #${student.id}`,
                  path: `/students/${student.id}`,
                  type: "Student",
                  meta: [student.admission_no, student.roll_number].filter(Boolean).join(" • "),
                  description: [student.class_name, student.section_name].filter(Boolean).join(" / "),
                  keywords: [student.phone, student.email, student.admission_no, student.roll_number],
                }),
              ),
            ),
          );
        }

        if (permissions.includes("teacher.view")) {
          requests.push(
            getTeachers().then((rows) =>
              (rows?.data || rows || []).map((teacher) =>
                buildSearchEntry({
                  label: teacher.name || `Teacher #${teacher.id}`,
                  path: `/teachers/${teacher.id}`,
                  type: "Teacher",
                  meta: [teacher.employee_id, teacher.phone].filter(Boolean).join(" • "),
                  description: teacher.email || "",
                  keywords: [teacher.email, teacher.class_scope],
                }),
              ),
            ),
          );
        }

        if (permissions.includes("staff.view")) {
          requests.push(
            listStaff().then((rows) =>
              (rows?.data || rows || []).map((staff) =>
                buildSearchEntry({
                  label: staff.name || `Staff #${staff.id}`,
                  path: "/staff",
                  type: "Staff",
                  meta: [staff.title, staff.section].filter(Boolean).join(" • "),
                  description: staff.type || "",
                  keywords: [staff.section, staff.type, staff.title],
                }),
              ),
            ),
          );
        }

        if (permissions.includes("subjects.view")) {
          requests.push(
            getSubjects().then((rows) =>
              (rows?.data || rows || []).map((subject) =>
                buildSearchEntry({
                  label: subject.name || `Subject #${subject.id}`,
                  path: "/subjects",
                  type: "Subject",
                  meta: subject.code || "",
                  keywords: [subject.code],
                }),
              ),
            ),
          );
        }

        if (permissions.includes("academic.view")) {
          requests.push(
            getClassStructure().then((rows) =>
              (rows?.data || rows || []).flatMap((item) => {
                const classEntry = buildSearchEntry({
                  label: item.name || `Class #${item.id}`,
                  path: "/classes",
                  type: "Class",
                  meta: item.class_scope === "hs" ? "Higher Secondary" : "School",
                  keywords: [item.medium],
                });

                const sectionEntries = (item.sections || []).map((section) =>
                  buildSearchEntry({
                    label: `${item.name} - ${section.name}`,
                    path: "/classes",
                    type: "Section",
                    meta: section.medium || "",
                    keywords: [item.name, section.name, section.medium],
                  }),
                );

                return [classEntry, ...sectionEntries];
              }),
            ),
          );
        }

        if (permissions.includes("exams.view")) {
          requests.push(
            getExams().then((rows) =>
              (rows?.data || rows || []).map((exam) =>
                buildSearchEntry({
                  label: exam.name || `Exam #${exam.id}`,
                  path: "/exams",
                  type: "Exam",
                  meta: exam.session_name || "",
                  description: [exam.class_name, exam.section_name].filter(Boolean).join(" / "),
                  keywords: [exam.session_name, exam.class_name, exam.section_name],
                }),
              ),
            ),
          );
        }

        if (permissions.includes("teacher.update")) {
          requests.push(
            getUsers({ limit: 200 }).then((rows) =>
              (rows?.data || rows || []).map((account) =>
                buildSearchEntry({
                  label: account.name || account.username || account.email || account.phone || `User #${account.id}`,
                  path: "/users",
                  type: "User",
                  meta: [account.username, account.email, account.phone].filter(Boolean).join(" • "),
                  description: account.status || "",
                  keywords: [account.role, account.status],
                }),
              ),
            ),
          );
        }

        const results = (await Promise.all(requests)).flat();
        if (!ignore) {
          setRecordResults(results);
        }
      } catch {
        if (!ignore) {
          setRecordResults([]);
        }
      } finally {
        if (!ignore) {
          setLoadingRecords(false);
        }
      }
    }

    loadSearchRecords();
    return () => {
      ignore = true;
    };
  }, [permissions]);

  const searchableItems = useMemo(() => {
    const seen = new Map();
    [...searchableRoutes, ...recordResults].forEach((item) => {
      const key = `${item.path}-${item.type}-${item.label}`;
      if (!seen.has(key)) {
        seen.set(key, item);
      }
    });
    return Array.from(seen.values());
  }, [searchableRoutes, recordResults]);

  const searchValue = query.trim().toLowerCase();
  const filteredRoutes = searchValue
    ? searchableItems.filter((route) => route.keywords.includes(searchValue)).slice(0, 10)
    : [];
  const isSearchOpen = isSearchFocused && (filteredRoutes.length > 0 || loadingRecords);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  function goToSearchResult(path) {
    setQuery("");
    setIsSearchFocused(false);
    navigate(path);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    if (!filteredRoutes.length) return;
    goToSearchResult(filteredRoutes[0].path);
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
                  placeholder="Search modules, students, teachers, classes..."
                  className="pl-8"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => {
                    window.setTimeout(() => setIsSearchFocused(false), 120);
                  }}
                />
              </form>
              <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
              {isSearchOpen ? (
                <div className="absolute top-[calc(100%+0.35rem)] left-0 z-50 w-full overflow-hidden rounded-xl border bg-popover shadow-lg">
                  {filteredRoutes.map((route) => (
                    <button
                      key={`${route.path}-${route.type}-${route.label}`}
                      type="button"
                      onMouseDown={() => goToSearchResult(route.path)}
                      className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{route.label}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {route.type}
                          </span>
                        </div>
                        {route.description ? (
                          <div className="truncate text-xs text-muted-foreground">{route.description}</div>
                        ) : null}
                        {route.meta ? (
                          <div className="truncate text-xs text-muted-foreground">{route.meta}</div>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{route.path}</span>
                    </button>
                  ))}
                  {loadingRecords && searchValue ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Loading search data...</div>
                  ) : null}
                </div>
              ) : null}
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      </header>
      <div className="flex items-center gap-2 mr-1.5">
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


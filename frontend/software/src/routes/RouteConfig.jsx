import {
  LayoutDashboard,
  NotebookPen,
  User,
  Book,
  BriefcaseBusiness,
  IndianRupee,
  Hand,
  Calendar,
  MessageCircleMore,
  Mail,
  FileQuestionMark,
  FileSpreadsheet,
  FileStack,
  NotebookTabs,
  Settings,
  BriefcaseBusinessIcon,
  Users,
  Globe,
} from "lucide-react";


import DashBoard from "../pages/Dashboard"
import Classes from "../pages/Classes";
import Subjects from "../pages/Subjects";
import Students from "../pages/Students"
import Teachers from "../pages/teacher/Teachers";
import TeacherDetails from "../pages/teacher/TeacherDetails"
import Fees from "../pages/Fees";
import Payments from "../pages/Payments";
import Attendance from "../pages/Attendance";
import Messaging from "../pages/Messaging";
import Exams from "../pages/Exams";
import Reports from "../pages/Reports";
import SettingsPage from "../pages/Settings";
import UsersPage from "../pages/Users";
import WebsiteModule from "../pages/WebsiteModule";
import StaffPage from "../pages/Staff";


import StudentDetails from "../pages/modules/StudentDetails";

export function isRouteAllowedForUser(route, user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  if (Array.isArray(route.hideForRoles) && route.hideForRoles.some((role) => roles.includes(role))) {
    return false;
  }

  return true;
}

export const appRoutes = [   
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
      element : <DashBoard/>,
      protected : true,
      permission: "dashboard.view",
      hideForRoles: ["teacher"],
    },
    {
      title: "Classes",
      icon: NotebookPen,
      path : "/classes",
      element: <Classes/>,
      protected : true,
      permission: "academic.view",
      hideForRoles: ["teacher"],
    },
    {
      title: "Subjects",
      icon: Book,
      path: "/subjects",
      element: <Subjects/>,
      protected : true,
      permission: "subjects.view",
      hideForRoles: ["teacher"],
    },
    {
      title: "Students",
      icon: User,
      path: "/students",
      element: <Students />,
      protected : true,
      permission: "student.view",
      hideForRoles: ["teacher"],
    },
    {
      title: "Teachers",
      icon: BriefcaseBusiness,
      path: "/teachers",
      element: <Teachers />,
      protected : true,
      permission: "teacher.view",
    },
      {
      title: "Attendance",
      icon: Hand,
      path: "/attendance",
      element: <Attendance/>,
      protected : true,
      permission: "attendance.take",
    },
    {
      title: "Fees",
      icon: BriefcaseBusinessIcon,
      path: "/fees",
      element: <Fees/>,
      protected : true,
      permission: "fee.view",
      hideForRoles: ["teacher", "parent"],
    },
    {
      title: "Payments",
      icon: IndianRupee,
      path: "/payments",
      element: <Payments />,
      protected : true,
      permission: "payment.view",
      hideForRoles: ["teacher"],
    },
    // {
    //   title: "Timetable",
    //   icon: Calendar,
    //   element: "/timetable",
    // },
    // {
    //   title: "WhatsApp",
    //   icon: MessageCircleMore,
    //   element: "/whatsapp",
    // },
    {
      title: "Messaging",
      icon: Mail,
      path: "/messaging",
      element: <Messaging />,
      protected : true,
      permission: "messages.view",
    },
    // {
    //   title: "Question Paper",
    //   icon: FileQuestionMark,
    //   element: "/question-paper",
    // },
    {
      title: "Exams",
      icon: FileSpreadsheet,
      path: "/exams",
      element: <Exams/>,
      protected : true,
      permission: "exams.view",
      hideForRoles: ["teacher"],
    },
    // {
    //   title: "Class Tests",
    //   icon: FileStack,
    //   element: "/class-tests",
    // },
    {
      title: "Reports",
      icon: NotebookTabs,
      path: "/reports",
      element: <Reports/>,
      protected : true,
      permission: "marks.view",
    },
    {
      title: "Users",
      icon: Users,
      path: "/users",
      element: <UsersPage />,
      protected: true,
      permission: "teacher.update",
      hideForRoles: ["teacher"],
    },
    {
      title: "Staff",
      icon: BriefcaseBusinessIcon,
      path: "/staff",
      element: <StaffPage />,
      protected: true,
      permission: "staff.view",
      hideForRoles: ["teacher"],
    },
    {
      title: "Website",
      icon: Globe,
      path: "/website",
      element: <WebsiteModule />,
      protected: true,
      permission: "dashboard.view",
      hideForRoles: ["teacher"],
    },
    {
      title: "Settings",
      icon: Settings,
      path: "/settings",
      element: <SettingsPage />,
      protected : true,
      permission: "dashboard.view",
      hideForRoles: ["teacher"],
    },
  ];


  export const hiddenRoutes = [
      {
      path: "/teachers/:id",
      element: <TeacherDetails />,
      protected : true,
      permission: "teacher.view",
    },
    {
      path: "/students/:id",
      element: <StudentDetails />,
      protected: true,
      permission: "student.view",
      hideForRoles: ["teacher"],
    },
  ]

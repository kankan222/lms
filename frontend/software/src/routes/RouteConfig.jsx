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
  CircleUserRound,
  ArrowUp,
  ChevronUp,
  BriefcaseBusinessIcon,
} from "lucide-react";


import DashBoard from "../pages/Dashboard"
import Classes from "../pages/Classes";
import Subjects from "../pages/Subjects";
import Students from "../pages/Students"
import Teachers from "../pages/Teachers";
import Fees from "../pages/Fees";
import Payments from "../pages/Payments";
import Attendance from "../pages/Attendance";
import Messaging from "../pages/Messaging";
import Exams from "../pages/Exams";
import Reports from "../pages/Reports";
import SettingsPage from "../pages/Settings";


import StudentDetails from "../pages/modules/StudentDetails";

export const appRoutes = [   
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      path: "/",
      element : <DashBoard/>,
      protected : true,
      permission: "dashboard.view"
    },
    {
      title: "Classes",
      icon: NotebookPen,
      path : "/classes",
      element: <Classes/>,
      protected : true,
      permission: ""
    },
    {
      title: "Subjects",
      icon: Book,
      path: "/subjects",
      element: <Subjects/>,
      protected : true,
      permission: ""
    },
    {
      title: "Students",
      icon: User,
      path: "/students",
      element: <Students />,
      protected : true,
      permission: "student.view",
      children : [
        {
            path: ":id",
            element : <StudentDetails />,
            permission: "student.view"
        }
      ]
    },
    {
      title: "Teachers",
      icon: BriefcaseBusiness,
      path: "/teachers",
      element: <Teachers />,
      protected : true,
      permission: ""
    },
    {
      title: "Fees",
      icon: BriefcaseBusinessIcon,
      path: "/payments",
      element: <Fees/>,
      protected : true,
      permission: "",
    },
    {
      title: "Payments",
      icon: IndianRupee,
      path: "/fees",
      element: <Payments />,
      protected : true,
      permission: "",
    },
    {
      title: "Attendance",
      icon: Hand,
      path: "/attendance",
      element: <Attendance/>,
      protected : true,
      permission: "",
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
      permission: "",
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
      permission: "",
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
      permission: "",
    },
    {
      title: "Settings",
      icon: Settings,
      path: "/settings",
      element: <SettingsPage />,
      protected : true,
      permission: "",
    },
  ];

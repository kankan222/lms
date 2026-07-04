import {
  LayoutDashboard,
  NotebookPen,
  User,
  Book,
  BriefcaseBusiness,
  IndianRupee,
  Hand,
  Mail,
  Bell,
  FileSpreadsheet,
  FileText,
  NotebookTabs,
  Settings,
  BriefcaseBusinessIcon,
  Users,
  Globe,
  UserRoundCog,
  ClipboardList,
  ClipboardPenLine,
  Trophy,
  SlidersHorizontal,
  Bus,
} from "lucide-react";
import { lazy } from "react";

const DashBoard = lazy(() => import("../pages/Dashboard"));
const Classes = lazy(() => import("../pages/Classes"));
const Subjects = lazy(() => import("../pages/Subjects"));
const Activities = lazy(() => import("../pages/Activities"));
const AssignSubjectToClass = lazy(() => import("../pages/AssignSubjectToClass"));
const AssignTeacherToClass = lazy(() => import("../pages/AssignTeacherToClass"));
const Students = lazy(() => import("../pages/Students"));
const Teachers = lazy(() => import("../pages/teacher/Teachers"));
const TeacherDetails = lazy(() => import("../pages/teacher/TeacherDetails"));
const Fees = lazy(() => import("../pages/Fees"));
const Payments = lazy(() => import("../pages/Payments"));
const TransportationFee = lazy(() => import("../pages/TransportationFee"));
const Attendance = lazy(() => import("../pages/Attendance"));
const TeacherDeviceMapping = lazy(() => import("../pages/TeacherDeviceMapping"));
const Messaging = lazy(() => import("../pages/Messaging"));
const Exams = lazy(() => import("../pages/Exams"));
const Reports = lazy(() => import("../pages/Reports"));
const MarkReport = lazy(() => import("../pages/MarkReport"));
const AdmitCard = lazy(() => import("../pages/AdmitCard"));
const ActivityMarks = lazy(() => import("../pages/ActivityMarks"));
const SettingsPage = lazy(() => import("../pages/Settings"));
const GradeSettings = lazy(() => import("../pages/GradeSettings"));
const UsersPage = lazy(() => import("../pages/Users"));
const WebsiteModule = lazy(() => import("../pages/WebsiteModule"));
const StaffPage = lazy(() => import("../pages/Staff"));
const StudentDetails = lazy(() => import("../pages/modules/StudentDetails"));
const NotificationsPage = lazy(() => import("../pages/Notifications"));

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
      title: "Activities",
      icon: Trophy,
      path: "/activities",
      element: <Activities />,
      protected: true,
      permission: "academic.view",
      hideForRoles: ["teacher"],
    },
    {
      title: "Assign Subject to Class",
      icon: ClipboardList,
      path: "/subjects/assign-class",
      element: <AssignSubjectToClass />,
      protected: true,
      permission: "subjects.assign",
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
      title: "Assign Teacher to Class",
      icon: UserRoundCog,
      path: "/teachers/assign-class",
      element: <AssignTeacherToClass />,
      protected: true,
      permission: "teacher.assign",
      hideForRoles: ["teacher"],
    },
    {
      title: "Attendance",
      icon: Hand,
      path: "/attendance",
      element: <Attendance/>,
      protected : true,
      permission: "attendance.take",
      hideForRoles: ["parent"],
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
    {
      title: "Transportation Fee",
      icon: Bus,
      path: "/transportation-fee",
      element: <TransportationFee />,
      protected: true,
      permission: "fee.view",
      hideForRoles: ["teacher", "parent"],
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
    {
      title: "Mark Statement",
      icon: FileText,
      path: "/mark-report",
      element: <MarkReport />,
      protected: true,
      permission: "marks.approve",
      hideForRoles: ["teacher", "parent"],
    },
    {
      title: "Admit Card",
      icon: FileText,
      path: "/admit-card",
      element: <AdmitCard />,
      protected: true,
      permission: "marks.approve",
      hideForRoles: ["teacher", "parent"],
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
      hideForRoles: ["parent"],
    },
    {
      title: "Activity Marks",
      icon: ClipboardPenLine,
      path: "/activity-marks",
      element: <ActivityMarks />,
      protected: true,
      permission: "academic.view",
      hideForRoles: ["teacher", "parent"],
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
    {
      title: "Grade Settings",
      icon: SlidersHorizontal,
      path: "/settings/grades",
      element: <GradeSettings />,
      protected: true,
      permission: "dashboard.view",
      hideForRoles: ["teacher"],
    },
  ];

const routeByPath = new Map(appRoutes.map((route) => [route.path, route]));

function navEntry(path, overrides = {}) {
  const route = routeByPath.get(path);
  return {
    ...route,
    ...overrides,
    path,
    to: overrides.to || path,
  };
}

export const navSections = [
  {
    title: "Dashboard",
    items: [
      navEntry("/dashboard"),
    ],
  },
  {
    title: "Academics",
    items: [
      navEntry("/classes", {
        title: "Class",
        icon: NotebookPen,
      }),
      navEntry("/subjects", {
        title: "Subject",
        icon: Book,
      }),
      navEntry("/activities", {
        title: "Activity",
        icon: Trophy,
      }),
      navEntry("/teachers/assign-class", {
        title: "Assign Teacher to Class",
        icon: UserRoundCog,
      }),
      navEntry("/subjects/assign-class", {
        title: "Assign Subject to Class",
        icon: ClipboardList,
      }),
    ],
  },
  {
    title: "Student",
    items: [
      navEntry("/students", {
        title: "Student Info",
        icon: User,
      }),
      navEntry("/attendance", {
        title: "Student Attendance",
        icon: Hand,
        to: "/attendance?tab=student-attendance",
        hideForRoles: ["parent"],
      }),
    ],
  },
  {
    title: "Fee",
    items: [
      navEntry("/fees", {
        title: "Fee Setup",
        icon: BriefcaseBusinessIcon,
      }),
      navEntry("/payments", {
        title: "Payment",
        icon: IndianRupee,
      }),
      navEntry("/transportation-fee", {
        title: "Transportation Fee",
        icon: Bus,
      }),
    ],
  },
  {
    title: "Staff",
    items: [
      navEntry("/teachers", {
        title: "Teacher",
        icon: BriefcaseBusiness,
      }),
      navEntry("/attendance", {
        title: "Teacher Attendance",
        icon: UserRoundCog,
        permission: "teacher.view",
        to: "/attendance?tab=teacher-logs",
      }),
      navEntry("/staff"),
    ],
  },
  {
    title: "Exam",
    items: [
      navEntry("/exams", {
        title: "Exam Setup",
        icon: FileSpreadsheet,
      }),
      navEntry("/mark-report", {
        title: "Mark Statement",
        icon: FileText,
      }),
      navEntry("/admit-card", {
        title: "Admit Card",
        icon: FileText,
      }),
    ],
  },
  {
    title: "Utilities",
    items: [
      navEntry("/messaging", {
        title: "Chat",
        icon: Mail,
      }),
      navEntry("/website"),
    ],
  },
  {
    title: "Reports",
    items: [
      navEntry("/reports", {
        title: "Exam Report",
        icon: NotebookTabs,
      }),
      navEntry("/activity-marks", {
        title: "Activity Marks",
        icon: ClipboardPenLine,
      }),
    ],
  },
  {
    title: "Settings Section",
    items: [
      navEntry("/settings", {
        title: "General Settings",
        icon: Settings,
      }),
      navEntry("/settings/grades", {
        title: "Grade Settings",
        icon: SlidersHorizontal,
      }),
      navEntry("/users", {
        title: "Users",
        icon: Users,
      }),
    ],
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
    {
      path: "/teacher-device-mapping",
      element: <TeacherDeviceMapping />,
      protected: true,
      permission: "teacher.assign",
      hideForRoles: ["teacher"],
    },
    {
      path: "/notifications",
      element: <NotificationsPage />,
      protected: true,
      permission: "notifications.view",
      icon: Bell,
    },
  ]

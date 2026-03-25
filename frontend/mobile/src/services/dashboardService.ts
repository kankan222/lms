import { api } from "./api";

export type DashboardExam = {
  id: number;
  exam_name: string;
  class_name: string | null;
  section_name: string | null;
  session_name: string | null;
  exam_date: string;
};

export type DashboardActivity = {
  id: number;
  user_id: number | null;
  actor: string;
  action: string;
  description: string;
  created_at: string;
};

export type DashboardMessage = {
  id: number;
  conversation_name: string;
  last_message: string;
  last_message_time: string;
};

export type DashboardClassOverview = {
  class_id: number;
  class_name: string;
  section_id: number;
  section_name: string;
  students: number;
  present_today: number;
};

export type DashboardTrendPoint = {
  bucket?: string;
  date?: string;
  label: string;
  value?: number;
  admissions?: number;
  collections?: number;
  present?: number;
  absent?: number;
  late?: number;
  half_day?: number;
};

export type DashboardFeeStatus = {
  status: string;
  total_items: number;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
};

export type DashboardSummary = {
  stats: {
    totalStudents: number;
    totalTeachers: number;
    studentsPresentToday: number;
    teachersPresentToday: number;
    upcomingExams: number;
    newAdmissionsThisMonth: number;
  };
  attendance: {
    student: { present: number; absent: number; late: number };
    teacher: { present: number; absent: number };
  };
  analytics: {
    admissionsTrend: DashboardTrendPoint[];
    feeCollectionTrend: DashboardTrendPoint[];
    studentAttendanceTrend: DashboardTrendPoint[];
    teacherAttendanceTrend: DashboardTrendPoint[];
    feeStatusBreakdown: DashboardFeeStatus[];
  };
  upcomingExams: DashboardExam[];
  recentActivities: DashboardActivity[];
  recentMessages: DashboardMessage[];
  classOverview: DashboardClassOverview[];
};

export async function getDashboardSummary() {
  const response = await api.get<{ success: boolean; data: DashboardSummary }>("/dashboard/summary");
  return response.data.data;
}

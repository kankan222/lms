import { useEffect, useState } from "react";
import TopBar from "../TopBar";
import StatsCards from "./StatsCards";
import AttendanceChart from "./AttendanceChart";
import UpcomingExams from "./UpcomingExams";
import RecentMessages from "./RecentMessages";
import RecentActivity from "./RecentActivity";
import ClassOverview from "./ClassOverview";
import QuickActions from "./QuickActions";
import { getDashboardSummary } from "../../api/dashboard.api";

const EMPTY_STATE = {
  stats: {
    totalStudents: 0,
    totalTeachers: 0,
    studentsPresentToday: 0,
    teachersPresentToday: 0,
    upcomingExams: 0,
    newAdmissionsThisMonth: 0
  },
  attendance: {
    student: { present: 0, absent: 0, late: 0 },
    teacher: { present: 0, absent: 0 }
  },
  upcomingExams: [],
  recentActivities: [],
  recentMessages: [],
  classOverview: []
};

export default function DashboardPage() {
  const [summary, setSummary] = useState(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSummary();
  }, []);

  async function loadSummary() {
    setLoading(true);
    setError("");
    try {
      const res = await getDashboardSummary();
      setSummary(res?.data || EMPTY_STATE);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load dashboard summary.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <TopBar title="Dashboard" subTitle="School operational overview" />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Loading dashboard...
        </div>
      ) : (
        <>
          <StatsCards stats={summary.stats} />

          <AttendanceChart attendance={summary.attendance} />

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <UpcomingExams exams={summary.upcomingExams} />
            <RecentMessages messages={summary.recentMessages} />
          </section>

          <RecentActivity activities={summary.recentActivities} />

          <ClassOverview rows={summary.classOverview} />

          <QuickActions />
        </>
      )}
    </div>
  );
}

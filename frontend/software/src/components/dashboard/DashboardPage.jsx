import { lazy, Suspense, useEffect, useEffectEvent, useState } from "react";
import TopBar from "../TopBar";
import StatsCards from "./StatsCards";
import UpcomingExams from "./UpcomingExams";
import RecentMessages from "./RecentMessages";
import RecentActivity from "./RecentActivity";
import QuickActions from "./QuickActions";
import { getDashboardSummary } from "../../api/dashboard.api";

const AnalyticsOverview = lazy(() => import("./AnalyticsOverview"));
const AttendanceChart = lazy(() => import("./AttendanceChart"));
const ClassOverview = lazy(() => import("./ClassOverview"));

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
  analytics: {
    admissionsTrend: [],
    feeCollectionTrend: [],
    studentAttendanceTrend: [],
    teacherAttendanceTrend: [],
    feeStatusBreakdown: [],
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

  const loadSummaryEvent = useEffectEvent(() => {
    loadSummary();
  });

  useEffect(() => {
    loadSummaryEvent();
  }, []);

  function SectionFallback({ label }) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        Loading {label}...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TopBar title="Dashboard" subTitle="School operational overview and daily performance signals" />

      {error && (
        <div className="rounded-md border border-red-200/70 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Loading dashboard...
        </div>
      ) : (
        <>
          <StatsCards
            stats={summary.stats}
            attendance={summary.attendance}
            analytics={summary.analytics}
          />

          <Suspense fallback={<SectionFallback label="analytics" />}>
            <AnalyticsOverview analytics={summary.analytics} />
          </Suspense>

          <Suspense fallback={<SectionFallback label="attendance trends" />}>
            <AttendanceChart analytics={summary.analytics} />
          </Suspense>

          <Suspense fallback={<SectionFallback label="class insights" />}>
            <ClassOverview rows={summary.classOverview} />
          </Suspense>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <section className="grid grid-cols-1 gap-4">
              <UpcomingExams exams={summary.upcomingExams} />
              <RecentActivity activities={summary.recentActivities} />
            </section>

            <section className="grid grid-cols-1 gap-4">
              <RecentMessages messages={summary.recentMessages} />
              <QuickActions />
            </section>
          </section>
        </>
      )}
    </div>
  );
}

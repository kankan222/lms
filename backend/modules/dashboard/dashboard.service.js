import * as repo from "./dashboard.repository.js";

async function safeRun(task, fallback) {
  try {
    return await task();
  } catch {
    return fallback;
  }
}

function formatMonthLabel(date) {
  return date.toLocaleString("en-US", { month: "short" });
}

function buildMonthBuckets(months, rows) {
  const safeMonths = Math.max(1, Number(months) || 1);
  const map = new Map(
    (rows || []).map((row) => [String(row.bucket), Number(row.total || 0)])
  );
  const now = new Date();
  const buckets = [];

  for (let offset = safeMonths - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const bucket = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      bucket,
      label: formatMonthLabel(date),
      value: Number(map.get(bucket) || 0),
    });
  }

  return buckets;
}

function buildDayBuckets(days, rows, mode = "student") {
  const safeDays = Math.max(1, Number(days) || 1);
  const grouped = new Map();

  for (const row of rows || []) {
    const bucket = String(row.attendance_date || row.date || "");
    const current = grouped.get(bucket) || {};
    current[String(row.status || "").toLowerCase()] = Number(row.total || 0);
    grouped.set(bucket, current);
  }

  const now = new Date();
  const buckets = [];
  for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const bucket = date.toISOString().slice(0, 10);
    const values = grouped.get(bucket) || {};
    const item = {
      date: bucket,
      label: date.toLocaleString("en-US", { weekday: "short" }),
      present: Number(values.present || 0),
      absent: Number(values.absent || 0),
    };

    if (mode === "student") {
      item.late = Number(values.late || 0);
    } else {
      item.late = Number(values.late || 0);
      item.half_day = Number(values.half_day || 0);
    }

    buckets.push(item);
  }

  return buckets;
}

export async function getDashboardSummary() {
  const [
    totalStudents,
    totalTeachers,
    studentAttendance,
    teacherAttendance,
    upcomingExamsCount,
    newAdmissionsThisMonth,
    upcomingExams,
    recentActivities,
    recentMessages,
    classOverview,
    studentAttendanceTrendRows,
    teacherAttendanceTrendRows,
    admissionsTrendRows,
    feeCollectionTrendRows,
    feeStatusBreakdown
  ] = await Promise.all([
    safeRun(() => repo.getTotalStudents(), 0),
    safeRun(() => repo.getTotalTeachers(), 0),
    safeRun(() => repo.getStudentAttendanceTodayBreakdown(), { present: 0, absent: 0, late: 0 }),
    safeRun(() => repo.getTeacherAttendanceTodayBreakdown(), { present: 0, absent: 0 }),
    safeRun(() => repo.getUpcomingExamsCount(), 0),
    safeRun(() => repo.getNewAdmissionsThisMonth(), 0),
    safeRun(() => repo.getUpcomingExams(5), []),
    safeRun(() => repo.getRecentActivities(10), []),
    safeRun(() => repo.getRecentConversations(5), []),
    safeRun(() => repo.getClassOverview(), []),
    safeRun(() => repo.getStudentAttendanceTrend(7), []),
    safeRun(() => repo.getTeacherAttendanceTrend(7), []),
    safeRun(() => repo.getAdmissionsTrend(6), []),
    safeRun(() => repo.getFeeCollectionTrend(6), []),
    safeRun(() => repo.getFeeStatusBreakdown(), [])
  ]);

  const admissionsTrend = buildMonthBuckets(6, admissionsTrendRows);
  const feeCollectionTrend = buildMonthBuckets(6, feeCollectionTrendRows);
  const studentAttendanceTrend = buildDayBuckets(7, studentAttendanceTrendRows, "student");
  const teacherAttendanceTrend = buildDayBuckets(7, teacherAttendanceTrendRows, "teacher");

  return {
    stats: {
      totalStudents,
      totalTeachers,
      studentsPresentToday: studentAttendance.present,
      teachersPresentToday: teacherAttendance.present,
      upcomingExams: upcomingExamsCount,
      newAdmissionsThisMonth
    },
    attendance: {
      student: {
        present: studentAttendance.present,
        absent: studentAttendance.absent,
        late: studentAttendance.late
      },
      teacher: {
        present: teacherAttendance.present,
        absent: teacherAttendance.absent
      }
    },
    analytics: {
      admissionsTrend,
      feeCollectionTrend,
      studentAttendanceTrend,
      teacherAttendanceTrend,
      feeStatusBreakdown: feeStatusBreakdown.map((row) => ({
        status: String(row.status || "pending"),
        total_items: Number(row.total_items || 0),
        total_amount: Number(row.total_amount || 0),
        paid_amount: Number(row.paid_amount || 0),
        outstanding_amount: Number(row.outstanding_amount || 0),
      })),
    },
    upcomingExams,
    recentActivities,
    recentMessages,
    classOverview
  };
}

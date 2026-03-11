import * as repo from "./dashboard.repository.js";

async function safeRun(task, fallback) {
  try {
    return await task();
  } catch {
    return fallback;
  }
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
    classOverview
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
    safeRun(() => repo.getClassOverview(), [])
  ]);

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
    upcomingExams,
    recentActivities,
    recentMessages,
    classOverview
  };
}

import { Activity, CircleAlert, FileSpreadsheet, Layers3 } from "lucide-react";

function safePercent(value, total) {
  const safeValue = Number(value || 0);
  const safeTotal = Number(total || 0);
  return safeTotal > 0 ? Math.round((safeValue / safeTotal) * 100) : 0;
}

export default function DashboardInsights({
  attendance = {},
  classOverview = [],
}) {
  const studentAttendance = attendance?.student || {};
  const teacherAttendance = attendance?.teacher || {};

  const totalStudentAttendance =
    Number(studentAttendance.present || 0) +
    Number(studentAttendance.absent || 0) +
    Number(studentAttendance.late || 0);
  const totalTeacherAttendance =
    Number(teacherAttendance.present || 0) +
    Number(teacherAttendance.absent || 0);

  const studentAttendanceRate = safePercent(
    Number(studentAttendance.present || 0) + Number(studentAttendance.late || 0),
    totalStudentAttendance
  );
  const teacherAttendanceRate = safePercent(
    teacherAttendance.present,
    totalTeacherAttendance
  );

  const totalSections = classOverview.length;
  const averageClassStrength =
    totalSections > 0
      ? Math.round(
          classOverview.reduce((sum, row) => sum + Number(row.students || 0), 0) / totalSections
        )
      : 0;

  const lowAttendanceSections = classOverview.filter((row) => {
    const students = Number(row.students || 0);
    const presentToday = Number(row.present_today || 0);
    return students > 0 && presentToday / students < 0.75;
  }).length;

  const cards = [
    {
      label: "Student Attendance",
      value: `${studentAttendanceRate}%`,
      meta: `${totalStudentAttendance} student records today`,
      icon: Activity,
    },
    {
      label: "Teacher Attendance",
      value: `${teacherAttendanceRate}%`,
      meta: `${totalTeacherAttendance} teacher records today`,
      icon: Layers3,
    },
    {
      label: "Average Class Strength",
      value: averageClassStrength,
      meta: `${totalSections} active class sections`,
      icon: FileSpreadsheet,
    },
    {
      label: "Sections Needing Attention",
      value: lowAttendanceSections,
      meta: "Below 75% present today",
      icon: CircleAlert,
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article
            key={card.label}
            className="rounded-2xl border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <div className="rounded-full border bg-muted/40 p-2 text-primary">
                <Icon size={16} />
              </div>
            </div>
            <p className="mt-4 text-3xl font-semibold">{card.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{card.meta}</p>
          </article>
        );
      })}
    </section>
  );
}

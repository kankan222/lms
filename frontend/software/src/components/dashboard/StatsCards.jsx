import {
  GraduationCap,
  Users2,
  UserCheck,
  BriefcaseBusiness,
  FileSpreadsheet,
  UserPlus
} from "lucide-react";

const CARD_CONFIG = [
  { key: "totalStudents", label: "Total Students", icon: GraduationCap },
  { key: "totalTeachers", label: "Total Teachers", icon: Users2 },
  { key: "studentsPresentToday", label: "Students Present Today", icon: UserCheck },
  { key: "teachersPresentToday", label: "Teachers Present Today", icon: BriefcaseBusiness },
  { key: "upcomingExams", label: "Upcoming Exams", icon: FileSpreadsheet },
  { key: "newAdmissionsThisMonth", label: "New Admissions", icon: UserPlus }
];

export default function StatsCards({ stats = {} }) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {CARD_CONFIG.map((card) => {
        const Icon = card.icon;
        return (
          <article
            key={card.key}
            className="rounded-xl border bg-card p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <Icon size={16} />
              </div>
            </div>
            <p className="mt-3 text-2xl font-semibold">
              {Number(stats?.[card.key] || 0)}
            </p>
          </article>
        );
      })}
    </section>
  );
}

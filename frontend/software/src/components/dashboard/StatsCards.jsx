import {
  Activity,
  BanknoteArrowUp,
  CalendarClock,
  GraduationCap,
  ReceiptText,
  Users2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function sumOutstanding(rows = []) {
  return rows.reduce((sum, row) => sum + Number(row.outstanding_amount || 0), 0);
}

function latestCollection(rows = []) {
  return Number(rows[rows.length - 1]?.value || 0);
}

function safePercent(value, total) {
  const safeTotal = Number(total || 0);
  return safeTotal > 0 ? Math.round((Number(value || 0) / safeTotal) * 100) : 0;
}

function formatAmount(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function StatsCards({ stats = {}, analytics = {} }) {
  const studentPresentRate = safePercent(stats.studentsPresentToday, stats.totalStudents);
  const teacherPresentRate = safePercent(stats.teachersPresentToday, stats.totalTeachers);
  const outstandingFees = sumOutstanding(analytics.feeStatusBreakdown);
  const currentMonthCollection = latestCollection(analytics.feeCollectionTrend);

  const cards = [
    {
      title: "Student Base",
      value: Number(stats.totalStudents || 0),
      description: `${studentPresentRate}% marked present today`,
      icon: GraduationCap,
      accent: "from-sky-500/15 via-sky-500/5 to-transparent",
    },
    {
      title: "Teaching Staff",
      value: Number(stats.totalTeachers || 0),
      description: `${teacherPresentRate}% available today`,
      icon: Users2,
      accent: "from-violet-500/15 via-violet-500/5 to-transparent",
    },
    {
      title: "Monthly Collection",
      value: formatAmount(currentMonthCollection),
      description: "Approved payments booked this month",
      icon: BanknoteArrowUp,
      accent: "from-emerald-500/15 via-emerald-500/5 to-transparent",
    },
    {
      title: "Outstanding Fees",
      value: formatAmount(outstandingFees),
      description: "Pending plus partially collected balance",
      icon: ReceiptText,
      accent: "from-amber-500/15 via-amber-500/5 to-transparent",
    },
    {
      title: "Upcoming Exams",
      value: Number(stats.upcomingExams || 0),
      description: "Scheduled in active academic sessions",
      icon: CalendarClock,
      accent: "from-fuchsia-500/15 via-fuchsia-500/5 to-transparent",
    },
    {
      title: "New Admissions",
      value: Number(stats.newAdmissionsThisMonth || 0),
      description: "Students admitted this month",
      icon: Activity,
      accent: "from-cyan-500/15 via-cyan-500/5 to-transparent",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.title}
            className={`relative overflow-hidden border-border/70 bg-gradient-to-br ${card.accent}`}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardDescription className="text-xs uppercase tracking-[0.22em]">
                    {card.title}
                  </CardDescription>
                  <CardTitle className="mt-2 text-3xl font-semibold">{card.value}</CardTitle>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/70 p-3 text-primary shadow-sm">
                  <Icon size={18} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const studentConfig = {
  present: { label: "Present", color: "hsl(145 63% 42%)" },
  absent: { label: "Absent", color: "hsl(0 72% 51%)" },
  late: { label: "Late", color: "hsl(38 92% 50%)" },
  school: { label: "School Present", color: "hsl(221 83% 53%)" },
  hs: { label: "HS Present", color: "hsl(271 81% 56%)" },
  all_absent: { label: "Absent", color: "hsl(0 72% 51%)" },
};

const teacherConfig = {
  present: { label: "Present", color: "hsl(215 70% 52%)" },
  absent: { label: "Absent", color: "hsl(0 72% 51%)" },
  late: { label: "Late", color: "hsl(271 81% 56%)" },
  half_day: { label: "Half Day", color: "hsl(193 89% 42%)" },
};

function TrendCard({ title, description, rows, config, areas }) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[280px] w-full">
          <AreaChart
            data={rows}
            margin={{
              left: 8,
              right: 8,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <ChartLegend content={<ChartLegendContent />} />
            {areas.map((area) => (
              <Area
                key={area.dataKey}
                dataKey={area.dataKey}
                type="monotone"
                fill={`var(--color-${area.dataKey})`}
                stroke={`var(--color-${area.dataKey})`}
                fillOpacity={0.16}
                strokeWidth={2}
                stackId={area.stackId}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function buildStudentRows(analytics = {}, selectedScope = "all") {
  if (selectedScope === "all") {
    return (analytics.studentAttendanceTrendByScope || []).map((row) => ({
      label: row.label,
      school: Number(row.school_present || 0) + Number(row.school_late || 0),
      hs: Number(row.hs_present || 0) + Number(row.hs_late || 0),
      all_absent: Number(row.school_absent || 0) + Number(row.hs_absent || 0),
    }));
  }

  return (analytics.studentAttendanceTrendByScope || []).map((row) => ({
    label: row.label,
    present: Number(row[`${selectedScope}_present`] || 0),
    late: Number(row[`${selectedScope}_late`] || 0),
    absent: Number(row[`${selectedScope}_absent`] || 0),
  }));
}

export default function AttendanceChart({ analytics = {}, selectedScope = "all" }) {
  const studentRows = buildStudentRows(analytics, selectedScope);
  const teacherRows = analytics.teacherAttendanceTrend || [];
  const studentAreas =
    selectedScope === "all"
      ? [
          { dataKey: "school", stackId: "student" },
          { dataKey: "hs", stackId: "student" },
          { dataKey: "all_absent", stackId: "student" },
        ]
      : [
          { dataKey: "present", stackId: "student" },
          { dataKey: "late", stackId: "student" },
          { dataKey: "absent", stackId: "student" },
        ];

  return (
    <section className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
      <TrendCard
        title="Student Attendance by Scope"
        description={
          selectedScope === "all"
            ? "Seven-day school and Higher Secondary attendance split."
            : "Seven-day movement across present, absent, and late marks for the selected scope."
        }
        rows={studentRows}
        config={studentConfig}
        areas={studentAreas}
      />
      <TrendCard
        title="Teacher Attendance Trend"
        description="Daily staffing coverage across present, late, half-day, and absent records."
        rows={teacherRows}
        config={teacherConfig}
        areas={[
          { dataKey: "present", stackId: "teacher" },
          { dataKey: "late", stackId: "teacher" },
          { dataKey: "half_day", stackId: "teacher" },
          { dataKey: "absent", stackId: "teacher" },
        ]}
      />
    </section>
  );
}

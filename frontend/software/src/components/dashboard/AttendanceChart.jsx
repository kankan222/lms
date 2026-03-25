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

export default function AttendanceChart({ analytics = {} }) {
  const studentRows = analytics.studentAttendanceTrend || [];
  const teacherRows = analytics.teacherAttendanceTrend || [];

  return (
    <section className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
      <TrendCard
        title="Student Attendance Trend"
        description="Seven-day movement across present, absent, and late marks."
        rows={studentRows}
        config={studentConfig}
        areas={[
          { dataKey: "present", stackId: "student" },
          { dataKey: "late", stackId: "student" },
          { dataKey: "absent", stackId: "student" },
        ]}
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

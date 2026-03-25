import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  students: {
    label: "Enrolled",
    color: "hsl(221 83% 53%)",
  },
  present_today: {
    label: "Present Today",
    color: "hsl(145 63% 42%)",
  },
};

function normalizeRows(rows) {
  return rows
    .map((row) => ({
      ...row,
      students: Number(row.students || 0),
      present_today: Number(row.present_today || 0),
      label: `${row.class_name}-${row.section_name}`,
      attendanceRate:
        Number(row.students || 0) > 0
          ? Math.round((Number(row.present_today || 0) / Number(row.students || 0)) * 100)
          : 0,
    }))
    .sort((a, b) => b.students - a.students);
}

export default function ClassOverview({ rows = [] }) {
  const normalizedRows = normalizeRows(rows);
  const chartRows = normalizedRows.slice(0, 8);
  const topRiskRows = [...normalizedRows]
    .filter((row) => row.students > 0)
    .sort((a, b) => a.attendanceRate - b.attendanceRate)
    .slice(0, 5);

  return (
    <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.9fr)]">
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Section Capacity vs Presence</CardTitle>
          <CardDescription>
            Enrolled students compared to today&apos;s attendance across the largest sections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No class data available.</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-[320px] w-full">
              <BarChart data={chartRows} barGap={8}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-24}
                  height={64}
                  textAnchor="end"
                />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="students" fill="var(--color-students)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="present_today" fill="var(--color-present_today)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Attendance Risk Watch</CardTitle>
          <CardDescription>
            Sections with the lowest attendance rate today.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {topRiskRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance gaps detected.</p>
          ) : (
            topRiskRows.map((row) => (
              <div key={`${row.class_id}-${row.section_id}`} className="rounded-xl border border-border/70 bg-background/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.class_name} - {row.section_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {row.present_today} present of {row.students}
                    </p>
                  </div>
                  <p className="text-xl font-semibold">{row.attendanceRate}%</p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.min(row.attendanceRate, 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}

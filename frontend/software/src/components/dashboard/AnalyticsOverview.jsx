import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const scopeLabels = {
  all: "All",
  school: "School",
  hs: "Higher Secondary",
};

const classConfig = {
  total: { label: "Students", color: "hsl(221 83% 53%)" },
};

const scopeConfig = {
  school: { label: "School", color: "hsl(221 83% 53%)" },
  hs: { label: "Higher Secondary", color: "hsl(271 81% 56%)" },
};

const paymentConfig = {
  school: { label: "School", color: "hsl(145 63% 42%)" },
  hs: { label: "Higher Secondary", color: "hsl(193 89% 42%)" },
  selected: { label: "Collection", color: "hsl(145 63% 42%)" },
};

const radarConfig = {
  school: { label: "School", color: "hsl(221 83% 53%)" },
  hs: { label: "Higher Secondary", color: "hsl(271 81% 56%)" },
  selected: { label: "Selected Scope", color: "hsl(193 89% 42%)" },
};

const feeStatusConfig = {
  paid: { label: "Paid", color: "hsl(145 63% 42%)" },
  partial: { label: "Partial", color: "hsl(38 92% 50%)" },
  pending: { label: "Pending", color: "hsl(0 72% 51%)" },
};

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function filterByScope(rows = [], selectedScope = "all") {
  if (selectedScope === "all") return rows;
  return rows.filter((row) => String(row.class_scope || "school") === selectedScope);
}

function buildClassRows(analytics = {}, selectedScope = "all") {
  return filterByScope(analytics.studentClassStats || [], selectedScope)
    .map((row) => ({
      ...row,
      total: Number(row.total || 0),
      label: String(row.class_name || "Class"),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);
}

function buildScopeRows(analytics = {}) {
  const rows = analytics.studentScopeStats || [];
  return ["school", "hs"].map((classScope) => ({
    class_scope: classScope,
    label: scopeLabels[classScope],
    value: Number(rows.find((row) => String(row.class_scope) === classScope)?.total || 0),
    fill: `var(--color-${classScope})`,
  }));
}

function buildPaymentRows(analytics = {}, selectedScope = "all") {
  return (analytics.paymentCollectionTrendByScope || []).map((row) => {
    if (selectedScope === "all") {
      return {
        ...row,
        school: Number(row.school || 0),
        hs: Number(row.hs || 0),
      };
    }
    return {
      bucket: row.bucket,
      label: row.label,
      selected: Number(row[selectedScope] || 0),
    };
  });
}

function buildFeeRows(analytics = {}, selectedScope = "all") {
  const source =
    selectedScope === "all"
      ? analytics.feeStatusBreakdown || []
      : filterByScope(analytics.feeStatusBreakdownByScope || [], selectedScope);

  return source.map((row) => ({
    status: row.status,
    value: Number(row.outstanding_amount || 0),
    paidAmount: Number(row.paid_amount || 0),
    totalAmount: Number(row.total_amount || 0),
    totalItems: Number(row.total_items || 0),
    fill: `var(--color-${row.status})`,
  }));
}

function sumRows(rows, key) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function safePercent(value, total) {
  const safeTotal = Number(total || 0);
  return safeTotal > 0 ? Math.round((Number(value || 0) / safeTotal) * 100) : 0;
}

function buildAttendanceTodayByScope(analytics = {}) {
  const grouped = { school: { present: 0, late: 0, absent: 0 }, hs: { present: 0, late: 0, absent: 0 } };
  for (const row of analytics.studentAttendanceTodayByScope || []) {
    const classScope = String(row.class_scope || "school");
    const status = String(row.status || "").toLowerCase();
    if (!grouped[classScope] || !(status in grouped[classScope])) continue;
    grouped[classScope][status] += Number(row.total || 0);
  }
  return grouped;
}

function buildRadarRows(analytics = {}, selectedScope = "all") {
  const scopeRows = buildScopeRows(analytics);
  const maxStudentBase = Math.max(...scopeRows.map((row) => row.value), 1);
  const paymentRows = analytics.paymentCollectionTrendByScope || [];
  const feeRows = analytics.feeStatusBreakdownByScope || [];
  const attendance = buildAttendanceTodayByScope(analytics);

  const metrics = ["school", "hs"].reduce((acc, classScope) => {
    const scopedFees = filterByScope(feeRows, classScope);
    const feePaid = sumRows(scopedFees, "paid_amount");
    const feeOutstanding = sumRows(scopedFees, "outstanding_amount");
    const latestCollection = Number(paymentRows[paymentRows.length - 1]?.[classScope] || 0);
    const maxLatestCollection = Math.max(
      ...paymentRows.map((row) => Math.max(Number(row.school || 0), Number(row.hs || 0))),
      1,
    );
    const attendanceTotal =
      Number(attendance[classScope]?.present || 0) +
      Number(attendance[classScope]?.late || 0) +
      Number(attendance[classScope]?.absent || 0);

    acc[classScope] = {
      studentBase: safePercent(scopeRows.find((row) => row.class_scope === classScope)?.value || 0, maxStudentBase),
      attendance: safePercent(
        Number(attendance[classScope]?.present || 0) + Number(attendance[classScope]?.late || 0),
        attendanceTotal,
      ),
      collection: safePercent(latestCollection, maxLatestCollection),
      feeHealth: safePercent(feePaid, feePaid + feeOutstanding),
    };
    return acc;
  }, {});

  const dimensions = [
    ["Student Base", "studentBase"],
    ["Attendance", "attendance"],
    ["Collection", "collection"],
    ["Fee Health", "feeHealth"],
  ];

  return dimensions.map(([metric, key]) => {
    if (selectedScope === "all") {
      return {
        metric,
        school: metrics.school[key],
        hs: metrics.hs[key],
      };
    }

    return {
      metric,
      selected: metrics[selectedScope]?.[key] || 0,
    };
  });
}

function EmptyText({ children }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

export default function AnalyticsOverview({ analytics = {}, selectedScope = "all" }) {
  const classRows = buildClassRows(analytics, selectedScope);
  const scopeRows = buildScopeRows(analytics);
  const paymentRows = buildPaymentRows(analytics, selectedScope);
  const feeRows = buildFeeRows(analytics, selectedScope);
  const radarRows = buildRadarRows(analytics, selectedScope);
  const feeOutstanding = sumRows(feeRows, "value");
  const feePaid = sumRows(feeRows, "paidAmount");

  return (
    <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.9fr)]">
      <Card className="border-border/70">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Student Base by Class</CardTitle>
            <CardDescription>
              Class-wise active enrollment for {scopeLabels[selectedScope].toLowerCase()} scope.
            </CardDescription>
          </div>
          <Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-200" variant="outline">
            {scopeLabels[selectedScope]}
          </Badge>
        </CardHeader>
        <CardContent>
          {classRows.length === 0 ? (
            <EmptyText>No student base data available.</EmptyText>
          ) : (
            <ChartContainer config={classConfig} className="h-[330px] w-full">
              <BarChart data={classRows}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-24}
                  height={68}
                  textAnchor="end"
                />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Scope Mix</CardTitle>
          <CardDescription>Student base split between School and Higher Secondary.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={scopeConfig} className="mx-auto h-[250px] w-full max-w-[320px]">
            <PieChart>
              <ChartTooltip
                content={<ChartTooltipContent hideLabel nameKey="class_scope" />}
              />
              <Pie
                data={scopeRows}
                dataKey="value"
                nameKey="class_scope"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={4}
                strokeWidth={0}
              >
                {scopeRows.map((row) => (
                  <Cell key={row.class_scope} fill={row.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="class_scope" />} />
            </PieChart>
          </ChartContainer>

          <div className="mt-4 grid gap-3">
            {scopeRows.map((row) => (
              <div key={row.class_scope} className="rounded-xl border border-border/70 bg-background/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.fill }} />
                    <p className="font-medium">{row.label}</p>
                  </div>
                  <p className="text-2xl font-semibold">{row.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Payment Collection Trend</CardTitle>
          <CardDescription>
            Approved payment movement split by academic scope.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={paymentConfig} className="h-[300px] w-full">
            <AreaChart data={paymentRows}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="line"
                    formatter={(value, name) => [
                      formatCurrency(value),
                      paymentConfig[name]?.label || name,
                    ]}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {selectedScope === "all" ? (
                <>
                  <Area
                    type="monotone"
                    dataKey="school"
                    fill="var(--color-school)"
                    fillOpacity={0.18}
                    stroke="var(--color-school)"
                    strokeWidth={3}
                  />
                  <Area
                    type="monotone"
                    dataKey="hs"
                    fill="var(--color-hs)"
                    fillOpacity={0.16}
                    stroke="var(--color-hs)"
                    strokeWidth={3}
                  />
                </>
              ) : (
                <Area
                  type="monotone"
                  dataKey="selected"
                  fill="var(--color-selected)"
                  fillOpacity={0.18}
                  stroke="var(--color-selected)"
                  strokeWidth={3}
                />
              )}
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Fee Exposure</CardTitle>
          <CardDescription>
            Outstanding fee balance by status for the selected scope.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {feeRows.length === 0 ? (
            <EmptyText>No fee records available.</EmptyText>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <p className="text-xs font-medium uppercase text-emerald-700 dark:text-emerald-200">Collected</p>
                  <p className="mt-2 text-xl font-semibold">{formatCurrency(feePaid)}</p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <p className="text-xs font-medium uppercase text-amber-700 dark:text-amber-200">Outstanding</p>
                  <p className="mt-2 text-xl font-semibold">{formatCurrency(feeOutstanding)}</p>
                </div>
              </div>

              <ChartContainer config={feeStatusConfig} className="mx-auto mt-4 h-[230px] w-full max-w-[320px]">
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value, name, item) => [
                          formatCurrency(value),
                          `${feeStatusConfig[name]?.label || name} (${item.payload.totalItems})`,
                        ]}
                      />
                    }
                  />
                  <Pie
                    data={feeRows}
                    dataKey="value"
                    nameKey="status"
                    innerRadius={54}
                    outerRadius={84}
                    paddingAngle={4}
                    strokeWidth={0}
                  >
                    {feeRows.map((row) => (
                      <Cell key={row.status} fill={row.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="status" className="flex-wrap gap-3" />} />
                </PieChart>
              </ChartContainer>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 2xl:col-span-2">
        <CardHeader>
          <CardTitle>Operational Balance Radar</CardTitle>
          <CardDescription>
            Normalized view of student base, attendance, fee collection, and fee health.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={radarConfig} className="mx-auto h-[340px] w-full max-w-[760px]">
            <RadarChart data={radarRows}>
              <PolarGrid radialLines={false} />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {selectedScope === "all" ? (
                <>
                  <Radar
                    dataKey="school"
                    fill="var(--color-school)"
                    fillOpacity={0.18}
                    stroke="var(--color-school)"
                    strokeWidth={2}
                  />
                  <Radar
                    dataKey="hs"
                    fill="var(--color-hs)"
                    fillOpacity={0.16}
                    stroke="var(--color-hs)"
                    strokeWidth={2}
                  />
                </>
              ) : (
                <Radar
                  dataKey="selected"
                  fill="var(--color-selected)"
                  fillOpacity={0.2}
                  stroke="var(--color-selected)"
                  strokeWidth={2}
                />
              )}
            </RadarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </section>
  );
}

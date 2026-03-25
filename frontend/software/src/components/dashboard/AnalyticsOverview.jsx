import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, Cell, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const trendConfig = {
  admissions: { label: "Admissions", color: "hsl(221 83% 53%)" },
  collections: { label: "Collections", color: "hsl(145 63% 42%)" },
};

const feeStatusConfig = {
  paid: { label: "Paid", color: "hsl(145 63% 42%)" },
  partial: { label: "Partial", color: "hsl(38 92% 50%)" },
  pending: { label: "Pending", color: "hsl(0 72% 51%)" },
};
const MAX_TREND_PERIODS = 6;

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function buildTrendRows(analytics = {}) {
  const admissionsMap = new Map(
    (analytics.admissionsTrend || []).map((row) => [row.bucket, Number(row.value || 0)])
  );
  return (analytics.feeCollectionTrend || [])
    .map((row) => ({
      bucket: row.bucket,
      label: row.label,
      admissions: Number(admissionsMap.get(row.bucket) || 0),
      collections: Number(row.value || 0),
    }))
    .slice(-MAX_TREND_PERIODS);
}

function buildFeeStatusRows(analytics = {}) {
  return (analytics.feeStatusBreakdown || []).map((row) => ({
    status: row.status,
    value: Number(row.outstanding_amount || row.total_amount || 0),
    totalItems: Number(row.total_items || 0),
    fill: `var(--color-${row.status})`,
  }));
}

export default function AnalyticsOverview({ analytics = {} }) {
  const trendRows = buildTrendRows(analytics);
  const feeRows = buildFeeStatusRows(analytics);

  return (
    <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.9fr)]">
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Admissions and Collection Trend</CardTitle>
          <CardDescription>
            Recent six-period view of admissions volume and approved fee collections.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(240px,0.9fr)]">
          <ChartContainer config={trendConfig} className="h-[300px] w-full">
            <BarChart data={trendRows}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar yAxisId="left" dataKey="admissions" fill="var(--color-admissions)" radius={[8, 8, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="collections"
                stroke="var(--color-collections)"
                strokeWidth={3}
                dot={{ r: 4, fill: "var(--color-collections)" }}
              />
            </BarChart>
          </ChartContainer>

          <div className="space-y-3">
            {trendRows.map((row) => (
              <div key={row.label} className="rounded-xl border border-border/70 bg-background/60 p-4">
                <p className="text-sm font-medium">{row.label}</p>
                <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Admissions</span>
                  <span className="font-medium">{row.admissions}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Collections</span>
                  <span className="font-medium">{formatCurrency(row.collections)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Fee Status Exposure</CardTitle>
          <CardDescription>
            Outstanding balance concentration by fee state.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {feeRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fee records available.</p>
          ) : (
            <>
              <ChartContainer config={feeStatusConfig} className="mx-auto h-[260px] w-full max-w-[320px]">
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
                    innerRadius={60}
                    outerRadius={92}
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

              <div className="mt-4 space-y-3">
                {feeRows.map((row) => (
                  <div key={row.status} className="rounded-xl border border-border/70 bg-background/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.fill }} />
                        <p className="font-medium">{feeStatusConfig[row.status]?.label || row.status}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{row.totalItems} items</p>
                    </div>
                    <p className="mt-2 text-lg font-semibold">{formatCurrency(row.value)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

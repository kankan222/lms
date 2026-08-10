import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";
import { DashboardSummary } from "../../services/dashboardService";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { DEFAULT_MOBILE_THEME, type MobileTheme } from "../../theme/mobileTheme";

type Props = {
  summary: DashboardSummary | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onOpenMessages?: () => void;
};

type ScopeValue = "all" | "school" | "hs";
type PaneValue = "overview" | "attendance" | "finance" | "classes";

const SCOPE_OPTIONS: Array<{ value: ScopeValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "school", label: "School" },
  { value: "hs", label: "Higher Secondary" },
];

const PANE_OPTIONS: Array<{ value: PaneValue; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "attendance", label: "Attendance" },
  { value: "finance", label: "Finance" },
  { value: "classes", label: "Classes" },
];

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
}

function formatCurrency(value?: number | null) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
  if (Math.abs(amount) >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  return INR.format(amount);
}

function safePercent(value?: number | null, total?: number | null) {
  const safeTotal = Number(total || 0);
  return safeTotal > 0 ? Math.round((Number(value || 0) / safeTotal) * 100) : 0;
}

function filterByScope<T extends { class_scope?: string | null }>(rows: T[] = [], scope: ScopeValue) {
  if (scope === "all") return rows;
  return rows.filter((row) => String(row.class_scope || "school") === scope);
}

function sumRows<T extends Record<string, unknown>>(rows: T[] = [], key: string) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function maxValue(values: number[]) {
  return Math.max(...values, 1);
}

function latestCollection(summary: DashboardSummary, scope: ScopeValue) {
  if (scope !== "all" && summary.analytics.paymentCollectionTrendByScope?.length) {
    const latest = summary.analytics.paymentCollectionTrendByScope[summary.analytics.paymentCollectionTrendByScope.length - 1];
    return Number(latest?.[scope] || 0);
  }
  const latest = summary.analytics.feeCollectionTrend?.[summary.analytics.feeCollectionTrend.length - 1];
  return Number(latest?.value || 0);
}

function buildFeeRows(summary: DashboardSummary, scope: ScopeValue) {
  return scope === "all"
    ? summary.analytics.feeStatusBreakdown || []
    : filterByScope(summary.analytics.feeStatusBreakdownByScope || [], scope);
}

function buildCollectionRows(summary: DashboardSummary, scope: ScopeValue) {
  if (summary.analytics.paymentCollectionTrendByScope?.length) {
    return summary.analytics.paymentCollectionTrendByScope.map((row) => ({
      label: row.label,
      school: Number(row.school || 0),
      hs: Number(row.hs || 0),
      collections: scope === "all" ? Number(row.school || 0) + Number(row.hs || 0) : Number(row[scope] || 0),
    }));
  }
  return (summary.analytics.feeCollectionTrend || []).map((row) => ({
    label: row.label,
    collections: Number(row.value || 0),
    school: 0,
    hs: 0,
  }));
}

function buildAttendanceRows(summary: DashboardSummary, scope: ScopeValue) {
  const scoped = summary.analytics.studentAttendanceTrendByScope || [];
  if (scoped.length) {
    return scoped.map((row) => ({
      label: row.label,
      school: Number(row.school_present || 0) + Number(row.school_late || 0),
      hs: Number(row.hs_present || 0) + Number(row.hs_late || 0),
      present: scope === "all" ? Number(row.school_present || 0) + Number(row.hs_present || 0) : Number(row[`${scope}_present`] || 0),
      absent: scope === "all" ? Number(row.school_absent || 0) + Number(row.hs_absent || 0) : Number(row[`${scope}_absent`] || 0),
      late: scope === "all" ? Number(row.school_late || 0) + Number(row.hs_late || 0) : Number(row[`${scope}_late`] || 0),
    }));
  }
  return (summary.analytics.studentAttendanceTrend || []).map((row) => ({
    label: row.label,
    school: 0,
    hs: 0,
    present: Number(row.present || 0),
    absent: Number(row.absent || 0),
    late: Number(row.late || 0),
  }));
}

function buildClassBaseRows(summary: DashboardSummary, scope: ScopeValue) {
  return filterByScope(summary.analytics.studentClassStats || [], scope)
    .map((row) => ({ ...row, total: Number(row.total || 0) }))
    .sort((a, b) => b.total - a.total);
}

function buildClassOverviewRows(summary: DashboardSummary, scope: ScopeValue) {
  return filterByScope(summary.classOverview || [], scope)
    .map((row) => ({
      ...row,
      students: Number(row.students || 0),
      present_today: Number(row.present_today || 0),
      rate: safePercent(row.present_today, row.students),
    }))
    .sort((a, b) => b.students - a.students);
}

export default function DashboardTab({
  summary,
  loading,
  error,
  onRefresh,
  onOpenMessages,
}: Props) {
  const { theme } = useAppTheme();
  styles = useMemo(() => createStyles(theme), [theme]);
  const [scope, setScope] = useState<ScopeValue>("all");
  const [pane, setPane] = useState<PaneValue>("overview");
  const [showAllSections, setShowAllSections] = useState(false);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.contentBody}>
          <View style={[styles.messageCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <Text style={[styles.messageTitle, { color: theme.text }]}>Loading dashboard...</Text>
            <Text style={[styles.messageText, { color: theme.subText }]}>Fetching summary, attendance, exams, and activity.</Text>
          </View>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.contentBody}>
          <View style={[styles.messageCard, { borderColor: theme.dangerBorder, backgroundColor: theme.dangerSoft }]}>
            <Text style={[styles.messageTitle, { color: theme.danger }]}>Dashboard unavailable</Text>
            <Text style={[styles.messageText, { color: theme.danger }]}>{error}</Text>
            {onRefresh ? (
              <Pressable style={[styles.retryButton, { backgroundColor: theme.danger }]} onPress={onRefresh}>
                <Text style={[styles.retryButtonText, { color: theme.primaryText }]}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  if (!summary) {
    return (
      <View style={styles.container}>
        <View style={styles.contentBody}>
          <View style={[styles.messageCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <Text style={[styles.messageTitle, { color: theme.text }]}>No dashboard data available.</Text>
          </View>
        </View>
      </View>
    );
  }

  const feeRows = buildFeeRows(summary, scope);
  const collectionRows = buildCollectionRows(summary, scope);
  const attendanceRows = buildAttendanceRows(summary, scope);
  const classBaseRows = buildClassBaseRows(summary, scope);
  const classOverviewRows = buildClassOverviewRows(summary, scope);
  const visibleClassOverview = showAllSections ? classOverviewRows : classOverviewRows.slice(0, 12);
  const outstandingFees = sumRows(feeRows, "outstanding_amount");
  const studentPresentRate = safePercent(summary.stats.studentsPresentToday, summary.stats.totalStudents);
  const teacherPresentRate = safePercent(summary.stats.teachersPresentToday, summary.stats.totalTeachers);
  const collectionMax = maxValue(collectionRows.flatMap((row) => [row.school, row.hs, row.collections]));
  const attendanceMax = maxValue(attendanceRows.flatMap((row) => [row.school, row.hs, row.present, row.absent, row.late]));
  const classMax = maxValue(classBaseRows.map((row) => Number(row.total || 0)));
  const exposureTotal = Math.max(sumRows(feeRows, "outstanding_amount"), 1);

  const kpis = [
    { label: "Student base", value: summary.stats.totalStudents, hint: `${studentPresentRate}% present today`, tone: "default" },
    { label: "Teaching staff", value: summary.stats.totalTeachers, hint: `${teacherPresentRate}% available today`, tone: "default" },
    { label: "Monthly collection", value: formatCurrency(latestCollection(summary, scope)), hint: "Approved this month", tone: "success" },
    { label: "Outstanding fees", value: formatCurrency(outstandingFees), hint: "Pending plus partial", tone: "warning" },
  ];
  const attendanceChartRows = attendanceRows.slice(-7).map((row) => ({
    label: row.label,
    value: scope === "all" ? Number(row.school || 0) + Number(row.hs || 0) : Number(row.present || 0),
    color: scope === "all" ? theme.info : theme.success,
  }));
  const financeChartRows = collectionRows.slice(-6).map((row) => ({
    label: row.label,
    value: Number(row.collections || 0),
    color: theme.success,
  }));
  const classChartRows = classBaseRows.slice(0, 6).map((row) => ({
    label: row.class_name,
    value: Number(row.total || 0),
    color: theme.primary,
  }));
  const studentAbsentRate = safePercent(summary.attendance.student.absent, summary.stats.totalStudents);
  const studentLateRate = safePercent(summary.attendance.student.late, summary.stats.totalStudents);

  return (
    <View style={styles.container}>
      <View style={styles.contentBody}>
        <View style={styles.topBlock}>
        <View style={styles.scopeControl}>
          {SCOPE_OPTIONS.map((item) => {
            const active = scope === item.value;
            return (
              <Pressable
                key={item.value}
                style={[styles.scopeButton, { borderColor: active ? theme.text : theme.border, backgroundColor: active ? theme.text : "transparent" }]}
                onPress={() => setScope(item.value)}
              >
                <Text style={[styles.scopeButtonText, { color: active ? theme.card : theme.subText }]} numberOfLines={1}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
          {PANE_OPTIONS.map((item) => {
            const active = pane === item.value;
            return (
              <Pressable key={item.value} style={[styles.tabButton, active ? { borderBottomColor: theme.text } : null]} onPress={() => setPane(item.value)}>
                <Text style={[styles.tabText, { color: active ? theme.text : theme.subText }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {pane === "overview" ? (
        <>
          <View style={styles.kpiGrid}>
            {kpis.map((item) => {
              const color = item.tone === "success" ? theme.success : item.tone === "warning" ? theme.warningText : theme.text;
              const background = item.tone === "success" ? theme.successSoft : item.tone === "warning" ? theme.warningSoft : theme.cardMuted;
              const borderColor = item.tone === "success" ? theme.successBorder : item.tone === "warning" ? theme.warningBorder : theme.border;
              return (
                <View key={item.label} style={[styles.kpiCard, { backgroundColor: background, borderColor }]}>
                  <Text style={[styles.kpiLabel, { color: item.tone === "default" ? theme.subText : color }]}>{item.label}</Text>
                  <Text style={[styles.kpiValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{item.value}</Text>
                  <Text style={[styles.kpiHint, { color: item.tone === "default" ? theme.mutedText : color }]} numberOfLines={2}>{item.hint}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.miniGrid}>
            <View style={[styles.miniCard, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
              <Text style={[styles.kpiLabel, { color: theme.subText }]}>Upcoming exams</Text>
              <Text style={[styles.miniValue, { color: theme.text }]}>{summary.stats.upcomingExams}</Text>
            </View>
            <View style={[styles.miniCard, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
              <Text style={[styles.kpiLabel, { color: theme.subText }]}>New admissions</Text>
              <Text style={[styles.miniValue, { color: theme.text }]}>{summary.stats.newAdmissionsThisMonth}</Text>
            </View>
          </View>

          <Section title="Recent Messages" actionLabel="View all" onAction={onOpenMessages}>
            {summary.recentMessages.length ? (
              summary.recentMessages.slice(0, 4).map((message) => (
                <ListRow key={message.id} title={message.conversation_name} meta={message.last_message || "No message preview available."} side={formatDateTime(message.last_message_time)} theme={theme} />
              ))
            ) : (
              <EmptyText text="No recent messages available." theme={theme} />
            )}
          </Section>

          <Section title="Upcoming Exams">
            {summary.upcomingExams.length ? (
              summary.upcomingExams.slice(0, 4).map((exam) => (
                <ListRow
                  key={`${exam.id}-${exam.class_name || "general"}`}
                  title={exam.exam_name}
                  meta={[exam.class_name, exam.section_name].filter(Boolean).join(" / ") || "General scope"}
                  side={formatDate(exam.exam_date)}
                  theme={theme}
                />
              ))
            ) : (
              <EmptyText text="No upcoming exams found." theme={theme} />
            )}
          </Section>
        </>
      ) : null}

      {pane === "attendance" ? (
        <>
          <View style={styles.miniGrid}>
            <View style={[styles.miniCard, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
              <Text style={[styles.kpiLabel, { color: theme.subText }]}>Students</Text>
              <Text style={[styles.miniValue, { color: theme.text }]}>{summary.attendance.student.present}/{summary.stats.totalStudents}</Text>
              <Text style={[styles.kpiHint, { color: theme.mutedText }]}>present today</Text>
            </View>
            <View style={[styles.miniCard, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
              <Text style={[styles.kpiLabel, { color: theme.subText }]}>Teachers</Text>
              <Text style={[styles.miniValue, { color: theme.text }]}>{summary.attendance.teacher.present}/{summary.stats.totalTeachers}</Text>
              <Text style={[styles.kpiHint, { color: theme.mutedText }]}>available today</Text>
            </View>
          </View>

          <ChartPanel title="Today Snapshot" theme={theme}>
            <View style={styles.statChipGrid}>
              <StatChip label="Present" value={`${studentPresentRate}%`} color={theme.success} theme={theme} />
              <StatChip label="Absent" value={`${studentAbsentRate}%`} color={theme.danger} theme={theme} />
              <StatChip label="Late" value={`${studentLateRate}%`} color={theme.warning} theme={theme} />
            </View>
            <StackedMeter
              items={[
                { value: summary.attendance.student.present, color: theme.success },
                { value: summary.attendance.student.absent, color: theme.danger },
                { value: summary.attendance.student.late, color: theme.warning },
              ]}
              theme={theme}
            />
          </ChartPanel>

          <ChartPanel title="Attendance Trend" theme={theme}>
            {attendanceChartRows.length ? (
              <VerticalBarChart rows={attendanceChartRows} max={attendanceMax} theme={theme} />
            ) : (
              <EmptyText text="No attendance trend available." theme={theme} />
            )}
          </ChartPanel>

          <Section title="Attendance by Scope" caption={scope === "all" ? "Last seven days split by School and Higher Secondary." : "Last seven days for the selected scope."}>
            <Legend theme={theme} items={scope === "all" ? ["School", "Higher Secondary"] : ["Present", "Absent", "Late"]} />
            {attendanceRows.length ? attendanceRows.map((row) => (
              <View key={row.label} style={styles.metricRow}>
                <Text style={[styles.metricLabel, { color: theme.subText }]}>{row.label}</Text>
                <View style={styles.metricBars}>
                  {scope === "all" ? (
                    <>
                      <Bar value={row.school} max={attendanceMax} tone="info" theme={theme} />
                      <Bar value={row.hs} max={attendanceMax} tone="violet" theme={theme} />
                    </>
                  ) : (
                    <>
                      <Bar value={row.present} max={attendanceMax} tone="success" theme={theme} />
                      <Bar value={row.absent} max={attendanceMax} tone="danger" theme={theme} />
                      <Bar value={row.late} max={attendanceMax} tone="warning" theme={theme} />
                    </>
                  )}
                </View>
                <Text style={[styles.metricValue, { color: theme.text }]}>
                  {scope === "all" ? `S ${row.school} / HS ${row.hs}` : `P ${row.present} / A ${row.absent}`}
                </Text>
              </View>
            )) : <EmptyText text="No attendance trend available." theme={theme} />}
          </Section>

          <Section title="Section Capacity vs Presence">
            {visibleClassOverview.length ? visibleClassOverview.map((row) => (
              <ProgressRow key={`${row.class_id}-${row.section_id}`} title={`${row.class_name} / ${row.section_name}`} side={`${row.present_today}/${row.students}`} percent={row.rate} theme={theme} />
            )) : <EmptyText text="No active class overview available." theme={theme} />}
            {classOverviewRows.length > visibleClassOverview.length ? (
              <Pressable style={[styles.secondaryButton, { borderColor: theme.border, backgroundColor: theme.cardMuted }]} onPress={() => setShowAllSections(true)}>
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Show {classOverviewRows.length - visibleClassOverview.length} More</Text>
              </Pressable>
            ) : null}
          </Section>
        </>
      ) : null}

      {pane === "finance" ? (
        <>
          <View style={styles.miniGrid}>
            <View style={[styles.miniCard, { backgroundColor: theme.successSoft, borderColor: theme.successBorder }]}>
              <Text style={[styles.kpiLabel, { color: theme.success }]}>Latest collection</Text>
              <Text style={[styles.miniValue, { color: theme.success }]}>{formatCurrency(latestCollection(summary, scope))}</Text>
            </View>
            <View style={[styles.miniCard, { backgroundColor: theme.warningSoft, borderColor: theme.warningBorder }]}>
              <Text style={[styles.kpiLabel, { color: theme.warningText }]}>Outstanding</Text>
              <Text style={[styles.miniValue, { color: theme.warningText }]}>{formatCurrency(outstandingFees)}</Text>
            </View>
          </View>

          <ChartPanel title="Collection Graph" theme={theme}>
            {financeChartRows.length ? (
              <VerticalBarChart rows={financeChartRows} max={collectionMax} theme={theme} formatValue={formatCurrency} />
            ) : (
              <EmptyText text="No payment trend available." theme={theme} />
            )}
          </ChartPanel>

          <Section title="Fee Status Exposure">
            <View style={[styles.exposureBar, { backgroundColor: theme.cardMuted }]}>
              {feeRows.map((row) => (
                <View key={row.status} style={[styles.exposureSegment, barColorStyle(row.status, theme), { flex: Math.max(Number(row.outstanding_amount || 0), 0.5) / exposureTotal }]} />
              ))}
            </View>
            {feeRows.length ? feeRows.map((row) => (
              <View key={row.status} style={[styles.feeLine, { borderBottomColor: theme.border }]}>
                <View style={styles.dotLabel}>
                  <View style={[styles.dot, barColorStyle(row.status, theme)]} />
                  <Text style={[styles.listTitle, { color: theme.text, textTransform: "capitalize" }]}>{row.status} - {row.total_items} items</Text>
                </View>
                <Text style={[styles.listSide, { color: theme.text }]}>{formatCurrency(row.outstanding_amount)}</Text>
              </View>
            )) : <EmptyText text="No fee records available." theme={theme} />}
          </Section>

          <Section title="Payment Collection Trend">
            <Legend theme={theme} items={scope === "all" ? ["School", "Higher Secondary"] : ["Collection"]} />
            {collectionRows.length ? collectionRows.map((row) => (
              <View key={row.label} style={styles.metricRow}>
                <Text style={[styles.metricLabel, { color: theme.subText }]}>{row.label}</Text>
                <View style={styles.metricBars}>
                  {scope === "all" ? (
                    <>
                      <Bar value={row.school} max={collectionMax} tone="info" theme={theme} />
                      <Bar value={row.hs} max={collectionMax} tone="violet" theme={theme} />
                    </>
                  ) : (
                    <Bar value={row.collections} max={collectionMax} tone="success" theme={theme} />
                  )}
                </View>
                <Text style={[styles.metricValue, { color: theme.text }]}>
                  {scope === "all" ? formatCurrency(row.school + row.hs) : formatCurrency(row.collections)}
                </Text>
              </View>
            )) : <EmptyText text="No payment trend available." theme={theme} />}
          </Section>
        </>
      ) : null}

      {pane === "classes" ? (
        <>
          <ChartPanel title="Largest Classes" theme={theme}>
            {classChartRows.length ? (
              <VerticalBarChart rows={classChartRows} max={classMax} theme={theme} />
            ) : (
              <EmptyText text="No student base data available." theme={theme} />
            )}
          </ChartPanel>

          <Section title="Student Base by Class" caption="Sorted by active enrollment size.">
            {classBaseRows.length ? classBaseRows.slice(0, 14).map((row) => (
              <ProgressRow key={`${row.class_id}-${row.class_scope || "all"}`} title={row.class_name} side={String(row.total)} percent={(Number(row.total || 0) / classMax) * 100} theme={theme} />
            )) : <EmptyText text="No student base data available." theme={theme} />}
          </Section>

          <Section title="Recent Activity">
            {summary.recentActivities.length ? summary.recentActivities.slice(0, 6).map((activity) => (
              <ListRow key={activity.id} title={activity.actor} meta={activity.description || activity.action} side={formatDateTime(activity.created_at)} theme={theme} />
            )) : <EmptyText text="No recent activity recorded." theme={theme} />}
          </Section>
        </>
      ) : null}
      </View>
    </View>
  );
}

function Section({
  title,
  caption,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  caption?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
          {actionLabel && onAction ? (
            <Pressable onPress={onAction} hitSlop={8}>
              <Text style={[styles.sectionAction, { color: theme.primary }]}>{actionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
        {caption ? <Text style={[styles.sectionCaption, { color: theme.subText }]}>{caption}</Text> : null}
      </View>
      <View style={[styles.dividerList, { borderTopColor: theme.border }]}>{children}</View>
    </View>
  );
}

function ListRow({ title, meta, side, theme }: { title: string; meta: string; side: string; theme: MobileTheme }) {
  return (
    <View style={[styles.listRow, { borderBottomColor: theme.border }]}>
      <View style={styles.listRowContent}>
        <Text style={[styles.listTitle, { color: theme.text }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.listMeta, { color: theme.subText }]} numberOfLines={1}>{meta}</Text>
      </View>
      <Text style={[styles.listSide, { color: theme.mutedText }]} numberOfLines={1}>{side}</Text>
    </View>
  );
}

function ProgressRow({ title, side, percent, theme }: { title: string; side: string; percent: number; theme: MobileTheme }) {
  return (
    <View style={[styles.progressRow, { borderBottomColor: theme.border }]}>
      <View style={styles.progressHeader}>
        <Text style={[styles.listTitle, { color: theme.text }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.listSide, { color: theme.subText }]}>{side}</Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: theme.cardMuted }]}>
        <View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${Math.max(0, Math.min(100, percent))}%` }]} />
      </View>
    </View>
  );
}

function EmptyText({ text, theme }: { text: string; theme: MobileTheme }) {
  return <Text style={[styles.emptyText, { color: theme.subText }]}>{text}</Text>;
}

function ChartPanel({ title, theme, children }: { title: string; theme: MobileTheme; children: React.ReactNode }) {
  return (
    <View style={[styles.chartPanel, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.chartTitle, { color: theme.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function StatChip({ label, value, color, theme }: { label: string; value: string; color: string; theme: MobileTheme }) {
  return (
    <View style={[styles.statChip, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
      <View style={[styles.statChipDot, { backgroundColor: color }]} />
      <View style={styles.statChipText}>
        <Text style={[styles.statChipLabel, { color: theme.subText }]}>{label}</Text>
        <Text style={[styles.statChipValue, { color }]}>{value}</Text>
      </View>
    </View>
  );
}

function StackedMeter({ items, theme }: { items: Array<{ value: number; color: string }>; theme: MobileTheme }) {
  const total = Math.max(items.reduce((sum, item) => sum + Number(item.value || 0), 0), 1);
  return (
    <View style={[styles.stackedMeter, { backgroundColor: theme.cardMuted }]}>
      {items.map((item, index) => (
        <View
          key={`${item.color}-${index}`}
          style={[
            styles.stackedMeterSegment,
            {
              backgroundColor: item.color,
              flex: Math.max(Number(item.value || 0), 0) / total,
            },
          ]}
        />
      ))}
    </View>
  );
}

function VerticalBarChart({
  rows,
  max,
  theme,
  formatValue,
}: {
  rows: Array<{ label: string; value: number; color: string }>;
  max: number;
  theme: MobileTheme;
  formatValue?: (value: number) => string;
}) {
  const safeMax = Math.max(max, ...rows.map((row) => Number(row.value || 0)), 1);
  return (
    <View style={styles.verticalChart}>
      <View style={styles.verticalChartBars}>
        {rows.map((row) => {
          const height = row.value > 0 ? Math.max((row.value / safeMax) * 100, 10) : 0;
          return (
            <View key={row.label} style={styles.verticalChartItem}>
              <Text style={[styles.verticalChartValue, { color: theme.subText }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatValue ? formatValue(row.value) : row.value}
              </Text>
              <View style={[styles.verticalBarTrack, { backgroundColor: theme.cardMuted }]}>
                <View style={[styles.verticalBarFill, { backgroundColor: row.color, height: `${height}%` }]} />
              </View>
              <Text style={[styles.verticalChartLabel, { color: theme.mutedText }]} numberOfLines={1}>
                {row.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Legend({ items, theme }: { items: string[]; theme: MobileTheme }) {
  return (
    <View style={styles.legendRow}>
      {items.map((item, index) => (
        <View key={item} style={styles.legendItem}>
          <View style={[styles.legendDot, index === 0 ? { backgroundColor: theme.info } : index === 1 ? { backgroundColor: theme.isDark ? "#c4b5fd" : "#7c3aed" } : { backgroundColor: theme.warning }]} />
          <Text style={[styles.legendText, { color: theme.subText }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function Bar({ value, max, tone, theme }: { value: number; max: number; tone: "info" | "violet" | "success" | "danger" | "warning"; theme: MobileTheme }) {
  const width = value > 0 ? Math.max((value / max) * 100, 8) : 0;
  const backgroundColor =
    tone === "info" ? theme.info :
    tone === "violet" ? (theme.isDark ? "#c4b5fd" : "#7c3aed") :
    tone === "success" ? theme.success :
    tone === "danger" ? theme.danger :
    theme.warning;
  return (
    <View style={[styles.progressTrack, { backgroundColor: theme.cardMuted }]}>
      <View style={[styles.progressFill, { backgroundColor, width: `${width}%` }]} />
    </View>
  );
}

function barColorStyle(status: string, theme: MobileTheme) {
  if (status === "paid") return { backgroundColor: theme.success };
  if (status === "partial") return { backgroundColor: theme.warning };
  return { backgroundColor: theme.danger };
}

let styles = createStyles(DEFAULT_MOBILE_THEME);

function createStyles(theme: MobileTheme) {
return StyleSheet.create({
  container: { gap: 12, paddingBottom: 118 },
  contentBody: { gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  topBlock: { gap: 10 },
  heroTitle: { fontSize: 16, lineHeight: 20, fontWeight: "800", letterSpacing: 0.4 },
  heroText: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
  scopeControl: { flexDirection: "row", gap: 6 },
  scopeButton: { flex: 1, minHeight: 30, borderWidth: 1, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  scopeButtonText: { fontSize: 12, fontWeight: "700" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabButton: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 12, fontWeight: "700" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard: { width: "48%", borderRadius: 8, borderWidth: 1, padding: 12, minHeight: 82 },
  kpiLabel: { fontSize: 12, fontWeight: "600" },
  kpiValue: { marginTop: 3, fontSize: 22, lineHeight: 28, fontWeight: "600" },
  kpiHint: { marginTop: 3, fontSize: 11, lineHeight: 15, fontWeight: "500" },
  miniGrid: { flexDirection: "row", gap: 10 },
  miniCard: { flex: 1, borderRadius: 8, borderWidth: 1, padding: 12, minHeight: 70 },
  miniValue: { marginTop: 2, fontSize: 20, lineHeight: 26, fontWeight: "600" },
  sectionBlock: { gap: 8 },
  sectionHeader: { gap: 3 },
  sectionTitleRow: { minHeight: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "800" },
  sectionAction: { fontSize: 12, fontWeight: "700", textDecorationLine: "underline" },
  sectionCaption: { fontSize: 12, lineHeight: 16 },
  dividerList: { borderTopWidth: 1 },
  chartPanel: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 12 },
  chartTitle: { fontSize: 13, fontWeight: "800" },
  statChipGrid: { flexDirection: "row", gap: 8 },
  statChip: { flex: 1, minHeight: 58, borderWidth: 1, borderRadius: 8, padding: 9, flexDirection: "row", alignItems: "center", gap: 8 },
  statChipDot: { width: 8, height: 8, borderRadius: 4 },
  statChipText: { flex: 1, minWidth: 0 },
  statChipLabel: { fontSize: 10, fontWeight: "700" },
  statChipValue: { marginTop: 2, fontSize: 15, fontWeight: "800" },
  stackedMeter: { height: 12, borderRadius: 6, overflow: "hidden", flexDirection: "row" },
  stackedMeterSegment: { height: "100%" },
  verticalChart: { minHeight: 150 },
  verticalChartBars: { height: 148, flexDirection: "row", alignItems: "flex-end", gap: 8 },
  verticalChartItem: { flex: 1, minWidth: 0, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 5 },
  verticalChartValue: { width: "100%", textAlign: "center", fontSize: 10, fontWeight: "700" },
  verticalBarTrack: { width: "78%", maxWidth: 26, height: 92, borderRadius: 7, overflow: "hidden", justifyContent: "flex-end" },
  verticalBarFill: { width: "100%", borderTopLeftRadius: 7, borderTopRightRadius: 7 },
  verticalChartLabel: { width: "100%", textAlign: "center", fontSize: 10, fontWeight: "700" },
  listRow: { minHeight: 54, paddingVertical: 10, borderBottomWidth: 1, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  listRowContent: { flex: 1, minWidth: 0, gap: 3 },
  listTitle: { fontSize: 13, fontWeight: "700" },
  listMeta: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  listSide: { maxWidth: 86, textAlign: "right", fontSize: 11, fontWeight: "600" },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 2 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: 11, fontWeight: "600" },
  metricRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  metricLabel: { width: 34, fontSize: 11, fontWeight: "700" },
  metricBars: { flex: 1, gap: 4 },
  metricValue: { width: 74, textAlign: "right", fontSize: 11, fontWeight: "700" },
  progressRow: { paddingVertical: 10, borderBottomWidth: 1, gap: 6 },
  progressHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  exposureBar: { height: 14, borderRadius: 7, overflow: "hidden", flexDirection: "row" },
  exposureSegment: { height: "100%" },
  feeLine: { paddingVertical: 9, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  dotLabel: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  secondaryButton: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  secondaryButtonText: { fontSize: 12, fontWeight: "700" },
  emptyText: { paddingVertical: 12, fontSize: 12, fontWeight: "600" },
  messageCard: { margin: 14, borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  messageTitle: { fontWeight: "800", fontSize: 15 },
  messageText: { fontSize: 13, lineHeight: 18 },
  retryButton: { alignSelf: "flex-start", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  retryButtonText: { fontSize: 12, fontWeight: "800" },
});
}

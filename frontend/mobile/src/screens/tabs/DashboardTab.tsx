import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import { DashboardSummary } from "../../services/dashboardService";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { DEFAULT_MOBILE_THEME, type MobileTheme } from "../../theme/mobileTheme";

type Props = {
  summary: DashboardSummary | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
};

type StatItem = {
  key: string;
  label: string;
  value: number;
  tone?: "default" | "success" | "warning";
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toneStyles(theme: MobileTheme, tone?: "default" | "success" | "warning") {
  if (tone === "success") {
    return {
      borderColor: theme.successBorder,
      backgroundColor: theme.successSoft,
      valueColor: theme.success,
    };
  }
  if (tone === "warning") {
    return {
      borderColor: theme.warningBorder,
      backgroundColor: theme.warningSoft,
      valueColor: theme.warningText,
    };
  }
  return {
    borderColor: theme.border,
    backgroundColor: theme.card,
    valueColor: theme.text,
  };
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function buildCombinedTrend(summary: DashboardSummary) {
  const collectionMap = new Map(
    (summary.analytics?.feeCollectionTrend || []).map((row) => [row.label, Number(row.value || 0)])
  );

  return (summary.analytics?.admissionsTrend || []).map((row) => ({
    label: row.label,
    admissions: Number(row.value || 0),
    collections: Number(collectionMap.get(row.label) || 0),
  }));
}

function maxMetric<T extends Record<string, unknown>>(rows: T[], keys: string[]) {
  return rows.reduce((max, row) => {
    const rowMax = keys.reduce((innerMax, key) => Math.max(innerMax, Number(row[key] || 0)), 0);
    return Math.max(max, rowMax);
  }, 0);
}

export default function DashboardTab({ summary, loading, error, onRefresh }: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  if (loading) {
    return (
      <View style={[styles.messageCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <Text style={[styles.messageTitle, { color: theme.text }]}>Loading dashboard...</Text>
        <Text style={[styles.messageText, { color: theme.subText }]}>Fetching summary, attendance, exams, and activity.</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.messageCard, styles.errorCard]}>
        <Text style={styles.errorTitle}>Dashboard unavailable</Text>
        <Text style={styles.errorText}>{error}</Text>
        {onRefresh ? (
          <Pressable style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (!summary) {
    return (
      <View style={[styles.messageCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <Text style={[styles.messageTitle, { color: theme.text }]}>No dashboard data available.</Text>
      </View>
    );
  }

  const stats: StatItem[] = [
    { key: "students", label: "Total Students", value: summary.stats.totalStudents },
    { key: "teachers", label: "Total Teachers", value: summary.stats.totalTeachers },
    {
      key: "presentStudents",
      label: "Students Present",
      value: summary.stats.studentsPresentToday,
      tone: "success",
    },
    {
      key: "presentTeachers",
      label: "Teachers Present",
      value: summary.stats.teachersPresentToday,
      tone: "success",
    },
    {
      key: "upcomingExams",
      label: "Upcoming Exams",
      value: summary.stats.upcomingExams,
      tone: "warning",
    },
    { key: "newAdmissions", label: "New Admissions", value: summary.stats.newAdmissionsThisMonth },
  ];
  const combinedTrend = buildCombinedTrend(summary);
  const studentTrend = summary.analytics?.studentAttendanceTrend || [];
  const feeStatus = summary.analytics?.feeStatusBreakdown || [];
  const combinedTrendMax = maxMetric(combinedTrend, ["admissions", "collections"]) || 1;
  const studentTrendMax = maxMetric(studentTrend, ["present", "absent", "late"]) || 1;

  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <View>
          <Text style={styles.heroEyebrow}>Overview</Text>
          <Text style={styles.heroTitle}>School operational overview</Text>
          <Text style={styles.heroText}>
            Live attendance, exam schedule, classroom presence, and recent activity.
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        {stats.map((item) => {
          const tone = toneStyles(theme, item.tone);
          return (
            <View
              key={item.key}
              style={[
                styles.statCard,
                { borderColor: tone.borderColor, backgroundColor: tone.backgroundColor },
              ]}
            >
              <Text style={styles.statLabel}>{item.label}</Text>
              <Text style={[styles.statValue, { color: tone.valueColor }]}>{item.value}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.analyticsRow}>
        <View style={[styles.sectionCard, styles.analyticsCardWide, { borderColor: theme.border, backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Admissions and Collections</Text>
          <Text style={[styles.sectionCaption, { color: theme.subText }]}>Recent backend trend window</Text>
          {combinedTrend.length ? (
            <View style={styles.trendStack}>
              {combinedTrend.map((row) => (
                <View key={row.label} style={styles.trendRow}>
                  <View style={styles.trendLabelWrap}>
                    <Text style={[styles.trendLabel, { color: theme.subText }]}>{row.label}</Text>
                  </View>
                  <View style={styles.trendBars}>
                    <View style={styles.trendMetric}>
                      <View
                        style={[
                          styles.trendBar,
                          styles.trendBarPrimary,
                          { width: `${Math.max((row.admissions / combinedTrendMax) * 100, row.admissions ? 10 : 0)}%` },
                        ]}
                      />
                    </View>
                    <View style={styles.trendMetric}>
                      <View
                        style={[
                          styles.trendBar,
                          styles.trendBarSuccess,
                          { width: `${Math.max((row.collections / combinedTrendMax) * 100, row.collections ? 10 : 0)}%` },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.trendValues}>
                    <Text style={[styles.trendValue, { color: theme.text }]}>{row.admissions}</Text>
                    <Text style={[styles.trendSubValue, { color: theme.subText }]}>{formatCurrency(row.collections)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: theme.subText }]}>No admissions trend available.</Text>
          )}
        </View>

        <View style={[styles.sectionCard, styles.analyticsCardNarrow, { borderColor: theme.border, backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Fee Status Exposure</Text>
          <Text style={[styles.sectionCaption, { color: theme.subText }]}>Outstanding amount by status</Text>
          {feeStatus.length ? (
            feeStatus.map((row) => (
              <View key={row.status} style={styles.feeStatusRow}>
                <View style={styles.feeStatusHeader}>
                  <View style={styles.feeStatusLabelWrap}>
                    <View
                      style={[
                        styles.feeStatusDot,
                        row.status === "paid"
                          ? styles.dotSuccess
                          : row.status === "partial"
                            ? styles.dotWarning
                            : styles.dotDanger,
                      ]}
                    />
                    <Text style={[styles.listTitle, { color: theme.text }]}>{row.status}</Text>
                  </View>
                  <Text style={[styles.listMeta, { color: theme.subText }]}>{row.total_items} items</Text>
                </View>
                <Text style={styles.feeStatusAmount}>{formatCurrency(row.outstanding_amount)}</Text>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: theme.subText }]}>No fee records available.</Text>
          )}
        </View>
      </View>

      <View style={[styles.sectionCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Attendance Snapshot</Text>
        <View style={styles.attendanceRow}>
          <View style={styles.attendanceCard}>
            <Text style={styles.attendanceTitle}>Students</Text>
            <Text style={styles.attendanceText}>Present: {summary.attendance.student.present}</Text>
            <Text style={styles.attendanceText}>Absent: {summary.attendance.student.absent}</Text>
            <Text style={styles.attendanceText}>Late: {summary.attendance.student.late}</Text>
          </View>
          <View style={styles.attendanceCard}>
            <Text style={styles.attendanceTitle}>Teachers</Text>
            <Text style={styles.attendanceText}>Present: {summary.attendance.teacher.present}</Text>
            <Text style={styles.attendanceText}>Absent: {summary.attendance.teacher.absent}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.sectionCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Student Attendance Trend</Text>
        <Text style={[styles.sectionCaption, { color: theme.subText }]}>Approved attendance over the recent seven-day window</Text>
        {studentTrend.length ? (
          <View style={styles.trendStack}>
            {studentTrend.map((row) => (
              <View key={row.label} style={styles.trendRow}>
                <View style={styles.trendLabelWrap}>
                  <Text style={[styles.trendLabel, { color: theme.subText }]}>{row.label}</Text>
                </View>
                <View style={styles.tripleTrendBars}>
                  <View
                    style={[
                      styles.tripleTrendSegment,
                      styles.trendBarSuccess,
                      { flex: Math.max(Number(row.present || 0), 0.4) / studentTrendMax },
                    ]}
                  />
                  <View
                    style={[
                      styles.tripleTrendSegment,
                      styles.trendBarDanger,
                      { flex: Math.max(Number(row.absent || 0), 0.4) / studentTrendMax },
                    ]}
                  />
                  <View
                    style={[
                      styles.tripleTrendSegment,
                      styles.trendBarWarning,
                      { flex: Math.max(Number(row.late || 0), 0.4) / studentTrendMax },
                    ]}
                  />
                </View>
                <Text style={[styles.trendValueCompact, { color: theme.text }]}>
                  P {row.present || 0} / A {row.absent || 0} / L {row.late || 0}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.emptyText, { color: theme.subText }]}>No student attendance trend available.</Text>
        )}
      </View>

      <View style={[styles.sectionCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Upcoming Exams</Text>
        {summary.upcomingExams.length ? (
          summary.upcomingExams.map((exam) => (
            <View key={`${exam.id}-${exam.class_name || "general"}`} style={styles.listRow}>
              <View style={styles.listRowContent}>
                <Text style={[styles.listTitle, { color: theme.text }]}>{exam.exam_name}</Text>
                <Text style={[styles.listMeta, { color: theme.subText }]}>
                  {[exam.class_name, exam.section_name].filter(Boolean).join(" / ") || "General scope"}
                </Text>
              </View>
              <Text style={[styles.listDate, { color: theme.subText }]}>{formatDate(exam.exam_date)}</Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: theme.subText }]}>No upcoming exams found.</Text>
        )}
      </View>

      <View style={[styles.sectionCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Messages</Text>
        {summary.recentMessages.length ? (
          summary.recentMessages.map((message) => (
            <View key={message.id} style={styles.listRow}>
              <View style={styles.listRowContent}>
                <Text style={[styles.listTitle, { color: theme.text }]}>{message.conversation_name}</Text>
                <Text style={[styles.listMeta, { color: theme.subText }]} numberOfLines={2}>
                  {message.last_message || "No message preview available."}
                </Text>
              </View>
              <Text style={[styles.listDate, { color: theme.subText }]}>{formatDateTime(message.last_message_time)}</Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: theme.subText }]}>No recent messages available.</Text>
        )}
      </View>

      <View style={[styles.sectionCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</Text>
        {summary.recentActivities.length ? (
          summary.recentActivities.map((activity) => (
            <View key={activity.id} style={styles.activityRow}>
              <View style={styles.activityDot} />
              <View style={styles.activityContent}>
                <Text style={[styles.listTitle, { color: theme.text }]}>{activity.actor}</Text>
                <Text style={[styles.listMeta, { color: theme.subText }]}>{activity.description || activity.action}</Text>
                <Text style={[styles.activityTime, { color: theme.subText }]}>{formatDateTime(activity.created_at)}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: theme.subText }]}>No recent activity recorded.</Text>
        )}
      </View>

      <View style={[styles.sectionCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Class Overview</Text>
        {summary.classOverview.length ? (
          summary.classOverview.map((row) => (
            <View key={`${row.class_id}-${row.section_id}`} style={styles.listRow}>
              <View style={styles.listRowContent}>
                <Text style={[styles.listTitle, { color: theme.text }]}>
                  {row.class_name} / {row.section_name}
                </Text>
                <Text style={[styles.listMeta, { color: theme.subText }]}>Students: {row.students}</Text>
              </View>
              <Text style={styles.presenceBadge}>Present Today: {row.present_today}</Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: theme.subText }]}>No active class overview available.</Text>
        )}
      </View>
    </View>
  );
}

let styles = createStyles(DEFAULT_MOBILE_THEME);

function createStyles(theme: MobileTheme) {
return StyleSheet.create({
  container: {
    gap: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 120,
  },
  heroCard: {
    borderRadius: 18,
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 8,
  },
  heroEyebrow: {
    color: theme.subText,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroTitle: {
    marginTop: 4,
    color: theme.text,
    fontSize: theme.typography.fontSize["2xl"],
    fontWeight: theme.typography.fontWeight.extrabold,
  },
  heroText: {
    marginTop: 6,
    color: theme.subText,
    lineHeight: theme.typography.lineHeight.normal,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  analyticsRow: {
    gap: 14,
  },
  statCard: {
    width: "48%",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  statLabel: {
    color: theme.subText,
    fontSize: theme.typography.fontSize.sm,
  },
  statValue: {
    marginTop: 8,
    fontSize: theme.typography.fontSize["3xl"],
    fontWeight: theme.typography.fontWeight.extrabold,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    backgroundColor: theme.card,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: theme.text,
    fontWeight: theme.typography.fontWeight.extrabold,
    fontSize: theme.typography.fontSize.lg,
  },
  sectionCaption: {
    color: theme.subText,
    fontSize: theme.typography.fontSize.sm,
    marginTop: -4,
  },
  analyticsCardWide: {
    gap: 12,
  },
  analyticsCardNarrow: {
    gap: 10,
  },
  attendanceRow: {
    flexDirection: "row",
    gap: 10,
  },
  attendanceCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    backgroundColor: theme.cardMuted,
    padding: 12,
  },
  attendanceTitle: {
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.text,
    marginBottom: 8,
  },
  attendanceText: {
    color: theme.subText,
    marginBottom: 4,
  },
  trendStack: {
    gap: 10,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trendLabelWrap: {
    width: 36,
  },
  trendLabel: {
    color: theme.subText,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
  },
  trendBars: {
    flex: 1,
    gap: 5,
  },
  trendMetric: {
    height: 8,
    borderRadius: 999,
    backgroundColor: theme.cardMuted,
    overflow: "hidden",
  },
  trendBar: {
    height: "100%",
    borderRadius: 999,
  },
  trendBarPrimary: {
    backgroundColor: theme.info,
  },
  trendBarSuccess: {
    backgroundColor: theme.success,
  },
  trendBarDanger: {
    backgroundColor: theme.danger,
  },
  trendBarWarning: {
    backgroundColor: theme.warning,
  },
  trendValues: {
    width: 82,
    alignItems: "flex-end",
  },
  trendValue: {
    color: theme.text,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
  },
  trendSubValue: {
    color: theme.subText,
    fontSize: theme.typography.fontSize.xs,
    marginTop: 2,
  },
  tripleTrendBars: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 10,
  },
  tripleTrendSegment: {
    height: "100%",
    borderRadius: 999,
  },
  trendValueCompact: {
    width: 96,
    textAlign: "right",
    color: theme.subText,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  feeStatusRow: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 10,
    gap: 4,
  },
  feeStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  feeStatusLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  feeStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  dotSuccess: {
    backgroundColor: theme.success,
  },
  dotWarning: {
    backgroundColor: theme.warning,
  },
  dotDanger: {
    backgroundColor: theme.danger,
  },
  feeStatusAmount: {
    color: theme.text,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.extrabold,
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 10,
  },
  listRowContent: {
    flex: 1,
    gap: 3,
  },
  listTitle: {
    color: theme.text,
    fontWeight: theme.typography.fontWeight.bold,
  },
  listMeta: {
    color: theme.subText,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: 18,
  },
  listDate: {
    color: theme.subText,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    textAlign: "right",
    maxWidth: 100,
  },
  activityRow: {
    flexDirection: "row",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 10,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 5,
    backgroundColor: theme.info,
  },
  activityContent: {
    flex: 1,
    gap: 3,
  },
  activityTime: {
    color: theme.mutedText,
    fontSize: theme.typography.fontSize.xs,
  },
  presenceBadge: {
    color: theme.success,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    textAlign: "right",
    maxWidth: 110,
  },
  emptyText: {
    color: theme.subText,
  },
  messageCard: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    backgroundColor: theme.card,
    padding: 16,
    gap: 8,
  },
  messageTitle: {
    color: theme.text,
    fontWeight: theme.typography.fontWeight.bold,
  },
  messageText: {
    color: theme.subText,
  },
  errorCard: {
    borderColor: theme.dangerBorder,
    backgroundColor: theme.dangerSoft,
  },
  errorTitle: {
    color: theme.danger,
    fontWeight: theme.typography.fontWeight.extrabold,
  },
  errorText: {
    color: theme.danger,
  },
  retryButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: theme.danger,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: theme.primaryText,
    fontWeight: theme.typography.fontWeight.bold,
  },
});
}

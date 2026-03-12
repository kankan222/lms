import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DashboardSummary } from "../../services/dashboardService";

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

function toneStyles(tone?: "default" | "success" | "warning") {
  if (tone === "success") {
    return {
      borderColor: "#bbf7d0",
      backgroundColor: "#f0fdf4",
      valueColor: "#166534",
    };
  }
  if (tone === "warning") {
    return {
      borderColor: "#fde68a",
      backgroundColor: "#fffbeb",
      valueColor: "#92400e",
    };
  }
  return {
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    valueColor: "#0f172a",
  };
}

export default function DashboardTab({ summary, loading, error, onRefresh }: Props) {
  if (loading) {
    return (
      <View style={styles.messageCard}>
        <Text style={styles.messageTitle}>Loading dashboard...</Text>
        <Text style={styles.messageText}>Fetching summary, attendance, exams, and activity.</Text>
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
      <View style={styles.messageCard}>
        <Text style={styles.messageTitle}>No dashboard data available.</Text>
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

  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <View>
          <Text style={styles.heroEyebrow}>Overview</Text>
          <Text style={styles.heroTitle}>School operational overview</Text>
          <Text style={styles.heroText}>
            Live attendance, exam schedule, classroom presence, and recent activity from the current backend summary.
          </Text>
        </View>
        {onRefresh ? (
          <Pressable style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={16} color="#0f172a" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.grid}>
        {stats.map((item) => {
          const tone = toneStyles(item.tone);
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

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Attendance Snapshot</Text>
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

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Upcoming Exams</Text>
        {summary.upcomingExams.length ? (
          summary.upcomingExams.map((exam) => (
            <View key={`${exam.id}-${exam.class_name || "general"}`} style={styles.listRow}>
              <View style={styles.listRowContent}>
                <Text style={styles.listTitle}>{exam.exam_name}</Text>
                <Text style={styles.listMeta}>
                  {[exam.class_name, exam.section_name].filter(Boolean).join(" / ") || "General scope"}
                </Text>
              </View>
              <Text style={styles.listDate}>{formatDate(exam.exam_date)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No upcoming exams found.</Text>
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Recent Messages</Text>
        {summary.recentMessages.length ? (
          summary.recentMessages.map((message) => (
            <View key={message.id} style={styles.listRow}>
              <View style={styles.listRowContent}>
                <Text style={styles.listTitle}>{message.conversation_name}</Text>
                <Text style={styles.listMeta} numberOfLines={2}>
                  {message.last_message || "No message preview available."}
                </Text>
              </View>
              <Text style={styles.listDate}>{formatDateTime(message.last_message_time)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No recent messages available.</Text>
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {summary.recentActivities.length ? (
          summary.recentActivities.map((activity) => (
            <View key={activity.id} style={styles.activityRow}>
              <View style={styles.activityDot} />
              <View style={styles.activityContent}>
                <Text style={styles.listTitle}>{activity.actor}</Text>
                <Text style={styles.listMeta}>{activity.description || activity.action}</Text>
                <Text style={styles.activityTime}>{formatDateTime(activity.created_at)}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No recent activity recorded.</Text>
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Class Overview</Text>
        {summary.classOverview.length ? (
          summary.classOverview.map((row) => (
            <View key={`${row.class_id}-${row.section_id}`} style={styles.listRow}>
              <View style={styles.listRowContent}>
                <Text style={styles.listTitle}>
                  {row.class_name} / {row.section_name}
                </Text>
                <Text style={styles.listMeta}>Students: {row.students}</Text>
              </View>
              <Text style={styles.presenceBadge}>Present Today: {row.present_today}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No active class overview available.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    paddingBottom: 18,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  heroEyebrow: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroTitle: {
    marginTop: 6,
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "800",
  },
  heroText: {
    marginTop: 8,
    color: "#475569",
    lineHeight: 20,
  },
  refreshButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshButtonText: {
    color: "#0f172a",
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "48%",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  statLabel: {
    color: "#64748b",
    fontSize: 12,
  },
  statValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "800",
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16,
  },
  attendanceRow: {
    flexDirection: "row",
    gap: 10,
  },
  attendanceCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    padding: 12,
  },
  attendanceTitle: {
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  attendanceText: {
    color: "#475569",
    marginBottom: 4,
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
  },
  listRowContent: {
    flex: 1,
    gap: 3,
  },
  listTitle: {
    color: "#0f172a",
    fontWeight: "700",
  },
  listMeta: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
  },
  listDate: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
    maxWidth: 100,
  },
  activityRow: {
    flexDirection: "row",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 5,
    backgroundColor: "#2563eb",
  },
  activityContent: {
    flex: 1,
    gap: 3,
  },
  activityTime: {
    color: "#94a3b8",
    fontSize: 11,
  },
  presenceBadge: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    maxWidth: 110,
  },
  emptyText: {
    color: "#64748b",
  },
  messageCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 8,
  },
  messageTitle: {
    color: "#0f172a",
    fontWeight: "700",
  },
  messageText: {
    color: "#64748b",
  },
  errorCard: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  errorTitle: {
    color: "#991b1b",
    fontWeight: "800",
  },
  errorText: {
    color: "#b91c1c",
  },
  retryButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#991b1b",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});

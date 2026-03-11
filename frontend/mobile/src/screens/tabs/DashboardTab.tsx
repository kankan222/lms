import { StyleSheet, Text, View } from "react-native";
import { DashboardSummary } from "../../services/dashboardService";

type Props = {
  summary: DashboardSummary | null;
};

type StatItem = {
  key: string;
  label: string;
  value: number;
};

export default function DashboardTab({ summary }: Props) {
  if (!summary) {
    return <Text style={styles.emptyText}>No dashboard data available.</Text>;
  }

  const stats: StatItem[] = [
    { key: "students", label: "Total Students", value: summary.stats.totalStudents },
    { key: "teachers", label: "Total Teachers", value: summary.stats.totalTeachers },
    { key: "presentStudents", label: "Students Present", value: summary.stats.studentsPresentToday },
    { key: "presentTeachers", label: "Teachers Present", value: summary.stats.teachersPresentToday },
    { key: "upcomingExams", label: "Upcoming Exams", value: summary.stats.upcomingExams },
    { key: "newAdmissions", label: "New Admissions", value: summary.stats.newAdmissionsThisMonth },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {stats.map((item) => (
          <View key={item.key} style={styles.statCard}>
            <Text style={styles.statLabel}>{item.label}</Text>
            <Text style={styles.statValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  emptyText: {
    color: "#64748b",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  statLabel: {
    color: "#64748b",
    fontSize: 12,
  },
  statValue: {
    marginTop: 8,
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "700",
  },
  section: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  sectionTitle: {
    color: "#0f172a",
    fontWeight: "700",
    marginBottom: 10,
  },
  attendanceRow: {
    flexDirection: "row",
    gap: 10,
  },
  attendanceCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    padding: 10,
  },
  attendanceTitle: {
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
  },
  attendanceText: {
    color: "#475569",
    marginBottom: 4,
  },
});


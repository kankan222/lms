import { useEffect, useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { useAuthStore } from "../store/authStore";
import { getDashboardSummary } from "../services/dashboardService";

export default function DashboardScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [totalStudents, setTotalStudents] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const summary = await getDashboardSummary();
        setTotalStudents(summary.stats.totalStudents);
      } catch {
        setTotalStudents(null);
      }
    })();
  }, []);

  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Welcome {user?.name ?? "User"}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email ?? "-"}</Text>

          <Text style={[styles.label, styles.topSpacing]}>Roles</Text>
          <Text style={styles.value}>{user?.roles?.join(", ") || "-"}</Text>

          <Text style={[styles.label, styles.topSpacing]}>Total Students</Text>
          <Text style={styles.value}>
            {totalStudents !== null ? String(totalStudents) : "Not available"}
          </Text>
        </View>

        <Pressable style={styles.logoutButton} onPress={() => logout()}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 6,
    color: "#64748b",
  },
  card: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 16,
  },
  label: {
    color: "#64748b",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  value: {
    marginTop: 4,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "500",
  },
  topSpacing: {
    marginTop: 14,
  },
  logoutButton: {
    marginTop: 20,
    borderRadius: 10,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    height: 46,
  },
  logoutText: {
    color: "#fff",
    fontWeight: "600",
  },
});

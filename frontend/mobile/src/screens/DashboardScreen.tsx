import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { useAuthStore } from "../store/authStore";
import { getDashboardSummary } from "../services/dashboardService";
import { useAppTheme } from "../theme/AppThemeProvider";
import { type MobileTheme } from "../theme/mobileTheme";

export default function DashboardScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [totalStudents, setTotalStudents] = useState<number | null>(null);
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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

function createStyles(theme: MobileTheme) {
return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: theme.typography.fontSize["3xl"],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.text,
  },
  subtitle: {
    marginTop: 6,
    color: theme.subText,
  },
  card: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    backgroundColor: theme.card,
    padding: 16,
  },
  label: {
    color: theme.subText,
    fontSize: theme.typography.fontSize.sm,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  value: {
    marginTop: 4,
    color: theme.text,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
  },
  topSpacing: {
    marginTop: 14,
  },
  logoutButton: {
    marginTop: 20,
    borderRadius: 10,
    backgroundColor: theme.danger,
    alignItems: "center",
    justifyContent: "center",
    height: 46,
  },
  logoutText: {
    color: theme.primaryText,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});
}

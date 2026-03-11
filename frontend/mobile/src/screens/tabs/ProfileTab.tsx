import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuthStore } from "../../store/authStore";

export default function ProfileTab() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{user?.name ?? "-"}</Text>

        <Text style={[styles.label, styles.spaceTop]}>Email</Text>
        <Text style={styles.value}>{user?.email ?? "-"}</Text>

        <Text style={[styles.label, styles.spaceTop]}>Role</Text>
        <Text style={styles.value}>{user?.roles?.join(", ") || "-"}</Text>
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.actionsTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <View style={styles.actionChip}>
            <Text style={styles.actionText}>Add Student</Text>
          </View>
          <View style={styles.actionChip}>
            <Text style={styles.actionText}>Add Teacher</Text>
          </View>
          <View style={styles.actionChip}>
            <Text style={styles.actionText}>Create Exam</Text>
          </View>
          <View style={styles.actionChip}>
            <Text style={styles.actionText}>Mark Attendance</Text>
          </View>
        </View>
      </View>

      <Pressable style={styles.logoutButton} onPress={() => logout()}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  label: {
    color: "#64748b",
    fontSize: 12,
    textTransform: "uppercase",
  },
  value: {
    color: "#0f172a",
    fontWeight: "600",
    marginTop: 4,
  },
  spaceTop: {
    marginTop: 12,
  },
  quickActions: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  actionsTitle: {
    color: "#1e293b",
    fontWeight: "700",
    marginBottom: 10,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionChip: {
    width: "48%",
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  actionText: {
    color: "#334155",
    fontWeight: "600",
    textAlign: "center",
    fontSize: 12,
  },
  logoutButton: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    height: 46,
  },
  logoutText: {
    color: "#fff",
    fontWeight: "700",
  },
});


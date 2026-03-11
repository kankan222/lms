import { StyleSheet, Text, View } from "react-native";
import { DashboardSummary } from "../../services/dashboardService";
import { formatTimeLabel } from "../../utils/format";

type Props = {
  summary: DashboardSummary | null;
};

export default function MessagesTab({ summary }: Props) {
  const messages = summary?.recentMessages ?? [];
  const activities = summary?.recentActivities ?? [];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Recent Conversations</Text>
      {messages.length === 0 ? (
        <Text style={styles.emptyText}>No recent conversations available.</Text>
      ) : (
        messages.map((item, index) => (
          <View key={`${item.id}-${index}`} style={styles.card}>
            <Text style={styles.title}>{item.conversation_name}</Text>
            <Text style={styles.message} numberOfLines={2}>
              {item.last_message}
            </Text>
            <Text style={styles.time}>{formatTimeLabel(item.last_message_time)}</Text>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Recent Activity</Text>
      {activities.length === 0 ? (
        <Text style={styles.emptyText}>No activity logs available.</Text>
      ) : (
        activities.slice(0, 5).map((item) => (
          <View key={item.id} style={styles.activityRow}>
            <Text style={styles.activityAction}>{item.action}</Text>
            <Text style={styles.activityDesc} numberOfLines={2}>
              {item.description}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  sectionTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
    marginTop: 4,
  },
  emptyText: {
    color: "#64748b",
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  title: {
    color: "#1e293b",
    fontWeight: "700",
  },
  message: {
    marginTop: 6,
    color: "#334155",
  },
  time: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 12,
  },
  activityRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 10,
  },
  activityAction: {
    color: "#1e293b",
    fontWeight: "700",
  },
  activityDesc: {
    marginTop: 4,
    color: "#475569",
  },
});


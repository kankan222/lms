import { StyleSheet, Text, View } from "react-native";

type Stat = {
  label: string;
  value: number;
};

type Props = {
  title: string;
  subtitle: string;
  stats: Stat[];
};

export default function ModulePlaceholderTab({ title, subtitle, stats }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {stats.length > 0 ? (
        <View style={styles.grid}>
          {stats.map((item) => (
            <View key={item.label} style={styles.statCard}>
              <Text style={styles.statLabel}>{item.label}</Text>
              <Text style={styles.statValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No summary data available for this module yet.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  headerCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  title: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
  subtitle: {
    marginTop: 6,
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
    fontWeight: "700",
    fontSize: 22,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  emptyText: {
    color: "#64748b",
  },
});


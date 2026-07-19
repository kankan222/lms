import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../navigation/AppNavigator";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "../services/notificationsService";
import { useAppTheme } from "../theme/AppThemeProvider";
import { formatDateLabel, formatTimeLabel } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "Notifications">;

const FILTERS = [
  { label: "All", value: "all", icon: "notifications-outline" },
  { label: "Messages", value: "message", icon: "chatbubble-ellipses-outline" },
  { label: "Attendance", value: "attendance", icon: "calendar-outline" },
  { label: "Marksheet", value: "marksheet", icon: "bar-chart-outline" },
  { label: "Fees", value: "fee", icon: "wallet-outline" },
  { label: "Account", value: "account", icon: "shield-checkmark-outline" },
  { label: "System", value: "system", icon: "settings-outline" },
] as const;

function categoryOf(item: NotificationItem) {
  return String(item.category || "system").toLowerCase();
}

function isUnread(item: NotificationItem) {
  return item.is_read === false || Number(item.is_read) === 0;
}

export default function NotificationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadNotifications(mode: "initial" | "refresh" = "initial") {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    try {
      const data = await getMyNotifications({ limit: 100 });
      setItems(Array.isArray(data.list) ? data.list : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  const visibleItems = useMemo(
    () => items.filter((item) => filter === "all" || categoryOf(item) === filter),
    [filter, items],
  );
  const unread = visibleItems.filter(isUnread).length;

  async function markRead(item: NotificationItem) {
    if (!isUnread(item)) return;
    await markNotificationRead(Number(item.id));
    setItems((prev) => prev.map((row) => Number(row.id) === Number(item.id) ? { ...row, is_read: true, read_at: new Date().toISOString() } : row));
  }

  async function markAllRead() {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((item) => ({ ...item, is_read: true, read_at: item.read_at || new Date().toISOString() })));
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.bg,
            borderBottomColor: theme.border,
            paddingTop: Math.max(insets.top, 6),
            minHeight: 58 + Math.max(insets.top, 6),
          },
        ]}
      >
        <Pressable style={[styles.iconButton, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={18} color={theme.icon} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text }]}>Notifications</Text>
          <Text style={[styles.subtitle, { color: theme.subText }]}>{unread} unread in current view</Text>
        </View>
        <Pressable style={[styles.iconButton, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => void markAllRead()}>
          <Ionicons name="checkmark-done-outline" size={18} color={theme.icon} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadNotifications("refresh")} />}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((option) => {
            const active = filter === option.value;
            return (
              <Pressable
                key={option.value}
                style={[styles.filterChip, { borderColor: active ? theme.success : theme.border, backgroundColor: active ? theme.successSoft : theme.card }]}
                onPress={() => setFilter(option.value)}
              >
                <Ionicons name={option.icon} size={15} color={active ? theme.success : theme.icon} />
                <Text style={[styles.filterText, { color: active ? theme.success : theme.subText }]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator color={theme.icon} /></View>
        ) : visibleItems.length === 0 ? (
          <View style={[styles.emptyCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <Ionicons name="notifications-off-outline" size={24} color={theme.icon} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No notifications</Text>
            <Text style={[styles.emptyText, { color: theme.subText }]}>Attention-worthy updates will appear here.</Text>
          </View>
        ) : (
          visibleItems.map((item) => {
            const unreadItem = isUnread(item);
            return (
              <Pressable
                key={item.id}
                style={[
                  styles.row,
                  {
                    borderColor: unreadItem ? theme.successBorder : theme.border,
                    backgroundColor: unreadItem ? theme.successSoft : theme.card,
                  },
                ]}
                onPress={() => void markRead(item)}
              >
                <View style={[styles.rowIcon, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                  <Ionicons name="notifications-outline" size={18} color={theme.icon} />
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
                    {unreadItem ? <View style={[styles.unreadDot, { backgroundColor: theme.success }]} /> : null}
                  </View>
                  <Text style={[styles.rowText, { color: theme.subText }]} numberOfLines={2}>{item.body}</Text>
                  <Text style={[styles.rowMeta, { color: theme.mutedText }]}>
                    {categoryOf(item)} - {formatDateLabel(item.created_at)} {formatTimeLabel(item.created_at)}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { borderBottomWidth: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingBottom: 10 },
  iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: "800" },
  subtitle: { marginTop: 2, fontSize: 12, fontWeight: "600" },
  body: { flex: 1 },
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 28, gap: 12 },
  filters: { gap: 8, paddingRight: 14 },
  filterChip: { minHeight: 34, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 6 },
  filterText: { fontSize: 12, fontWeight: "700" },
  centered: { paddingVertical: 40, alignItems: "center", justifyContent: "center" },
  emptyCard: { borderWidth: 1, borderRadius: 16, padding: 18, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "800" },
  emptyText: { fontSize: 13, textAlign: "center" },
  row: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: "row", gap: 10 },
  rowIcon: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, minWidth: 0, gap: 4 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: "800" },
  rowText: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  rowMeta: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  unreadDot: { width: 9, height: 9, borderRadius: 5 },
});

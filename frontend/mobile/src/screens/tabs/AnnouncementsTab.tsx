import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getMobileAnnouncement,
  getMobileAnnouncements,
  type MobileAnnouncement,
} from "../../services/announcementsService";
import { useAppTheme } from "../../theme/AppThemeProvider";

type FilterKey = "all" | "urgent" | "holiday";

function formatDate(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString();
}

function isHoliday(item: MobileAnnouncement) {
  return ["holiday", "festival", "vacation"].includes(String(item.category_slug || "").toLowerCase());
}

function eventText(item: MobileAnnouncement) {
  const start = formatDate(item.event_start_date);
  const end = formatDate(item.event_end_date);
  if (!start && !end) return "";
  if (start && end && start !== end) return `${start} - ${end}`;
  return start || end;
}

export default function AnnouncementsTab() {
  const { theme } = useAppTheme();
  const [items, setItems] = useState<MobileAnnouncement[]>([]);
  const [selected, setSelected] = useState<MobileAnnouncement | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    if (filter === "urgent") return items.filter((item) => item.priority === "urgent");
    if (filter === "holiday") return items.filter(isHoliday);
    return items;
  }, [filter, items]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getMobileAnnouncements({ limit: 80 });
      setItems(data);
    } catch {
      setError("Could not load announcements.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function openDetail(item: MobileAnnouncement) {
    setSelected(item);
    setDetailError(null);
    try {
      const detail = await getMobileAnnouncement(item.id);
      setSelected(detail);
    } catch {
      setSelected(item);
    }
  }

  async function openAttachment(url?: string | null) {
    const target = String(url || "").trim();
    if (!target) {
      setDetailError("Attachment link is not available.");
      return;
    }
    try {
      const supported = await Linking.canOpenURL(target);
      if (!supported) {
        setDetailError("This attachment cannot be opened on this device.");
        return;
      }
      await Linking.openURL(target);
      setDetailError(null);
    } catch {
      setDetailError("Could not open attachment.");
    }
  }

  function renderChip(key: FilterKey, label: string, count: number) {
    const active = filter === key;
    return (
      <Pressable
        accessibilityRole="button"
        key={key}
        style={[
          styles.chip,
          {
            backgroundColor: active ? theme.primary : theme.card,
            borderColor: active ? theme.primary : theme.border,
          },
        ]}
        onPress={() => setFilter(key)}
      >
        <Text style={[styles.chipText, { color: active ? theme.primaryText : theme.text }]}>
          {label} {count}
        </Text>
      </Pressable>
    );
  }

  function renderMetaRow(icon: keyof typeof Ionicons.glyphMap, label: string, value?: string | null) {
    if (!value) return null;
    return (
      <View style={styles.metaRow}>
        <Ionicons name={icon} size={17} color={theme.mutedText} />
        <View style={styles.metaCopy}>
          <Text style={[styles.metaLabel, { color: theme.mutedText }]}>{label}</Text>
          <Text style={[styles.metaValue, { color: theme.text }]}>{value}</Text>
        </View>
      </View>
    );
  }

  if (selected) {
    return (
      <ScrollView
        style={[styles.screen, { backgroundColor: theme.bg }]}
        contentContainerStyle={styles.detailContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
      >
        <Pressable accessibilityRole="button" style={styles.backButton} onPress={() => setSelected(null)}>
          <Ionicons name="chevron-back" size={20} color={theme.primary} />
          <Text style={[styles.backText, { color: theme.primary }]}>Announcements</Text>
        </Pressable>

        <View style={[styles.detailCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.badgeRow}>
            {selected.category_name ? (
              <View style={[styles.badge, { backgroundColor: theme.infoSoft, borderColor: theme.infoBorder }]}>
                <Text style={[styles.badgeText, { color: theme.infoText }]}>{selected.category_name}</Text>
              </View>
            ) : null}
            {selected.priority === "urgent" ? (
              <View style={[styles.badge, { backgroundColor: theme.warningSoft, borderColor: theme.warningBorder }]}>
                <Text style={[styles.badgeText, { color: theme.warningText }]}>Urgent</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.detailTitle, { color: theme.text }]}>{selected.title}</Text>
          <Text style={[styles.detailBody, { color: theme.subText }]}>{selected.body}</Text>
        </View>

        <View style={[styles.detailCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {renderMetaRow("time-outline", "Published", formatDateTime(selected.published_at || selected.publish_at))}
          {renderMetaRow("calendar-outline", isHoliday(selected) ? "Holiday Date" : "Event Date", eventText(selected))}
          {renderMetaRow("return-up-forward-outline", "Reopen Date", formatDate(selected.reopen_date))}
          {renderMetaRow("hourglass-outline", "Available Until", formatDateTime(selected.expires_at))}
        </View>

        {selected.attachments?.length ? (
          <View style={[styles.detailCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Attachments</Text>
            {detailError ? (
              <Text style={[styles.attachmentError, { color: theme.danger }]}>{detailError}</Text>
            ) : null}
            {selected.attachments.map((attachment) => (
              <Pressable
                accessibilityRole="button"
                key={attachment.id}
                style={[styles.attachmentRow, { borderTopColor: theme.border }]}
                onPress={() => openAttachment(attachment.file_url)}
              >
                <Ionicons name="document-attach-outline" size={20} color={theme.icon} />
                <Text style={[styles.attachmentName, { color: theme.text }]} numberOfLines={1}>
                  {attachment.file_name || "Attachment"}
                </Text>
                <Ionicons name="open-outline" size={18} color={theme.mutedText} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
    >
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.summaryValue, { color: theme.text }]}>{items.length}</Text>
          <Text style={[styles.summaryLabel, { color: theme.subText }]}>Announcements</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.summaryValue, { color: theme.text }]}>{items.filter((item) => item.priority === "urgent").length}</Text>
          <Text style={[styles.summaryLabel, { color: theme.subText }]}>Urgent</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {renderChip("all", "All", items.length)}
        {renderChip("urgent", "Urgent", items.filter((item) => item.priority === "urgent").length)}
        {renderChip("holiday", "Holidays", items.filter(isHoliday).length)}
      </ScrollView>

      {error ? (
        <View style={[styles.messageCard, { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder }]}>
          <Text style={[styles.messageText, { color: theme.danger }]}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={[styles.messageCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.messageText, { color: theme.subText }]}>No announcements available.</Text>
        </View>
      ) : (
        filteredItems.map((item) => (
          <Pressable
            accessibilityRole="button"
            key={item.id}
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => openDetail(item)}
          >
            <View style={styles.cardTop}>
              <View style={[styles.iconBox, { backgroundColor: isHoliday(item) ? theme.successSoft : theme.infoSoft }]}>
                <Ionicons name={isHoliday(item) ? "calendar-outline" : "megaphone-outline"} size={20} color={isHoliday(item) ? theme.success : theme.info} />
              </View>
              <View style={styles.cardCopy}>
                <View style={styles.badgeRow}>
                  {item.category_name ? (
                    <Text style={[styles.inlineMeta, { color: theme.mutedText }]} numberOfLines={1}>{item.category_name}</Text>
                  ) : null}
                  {item.priority === "urgent" ? <Text style={[styles.urgentText, { color: theme.warning }]}>Urgent</Text> : null}
                </View>
                <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
                <Text style={[styles.cardBody, { color: theme.subText }]} numberOfLines={2}>{item.body}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.mutedText} />
            </View>
            <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
              <Text style={[styles.footerText, { color: theme.mutedText }]}>{formatDateTime(item.published_at || item.publish_at) || "Published"}</Text>
              {eventText(item) ? <Text style={[styles.footerText, { color: theme.mutedText }]}>{eventText(item)}</Text> : null}
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 12,
    padding: 16,
    paddingBottom: 110,
  },
  detailContent: {
    gap: 12,
    padding: 16,
    paddingBottom: 110,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: "800",
  },
  summaryLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
  },
  iconBox: {
    borderRadius: 10,
    padding: 9,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  inlineMeta: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  urgentText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  cardTitle: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  cardBody: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
  },
  cardFooter: {
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "600",
  },
  messageCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  messageText: {
    fontSize: 13,
    fontWeight: "600",
  },
  loadingBox: {
    paddingVertical: 32,
  },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: "800",
  },
  detailCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  detailTitle: {
    marginTop: 12,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 31,
  },
  detailBody: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 23,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
  },
  metaCopy: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metaValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  attachmentRow: {
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
  },
  attachmentName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  attachmentError: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
  },
});

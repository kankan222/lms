import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import {
  ActivityIndicator,
  Alert,
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
  getAnnouncement,
  getAnnouncementSmsJobs,
  getAnnouncementSmsTemplates,
  getAnnouncements,
  getHolidays,
  getMobileAnnouncement,
  getMobileAnnouncements,
  publishAnnouncement,
  type AnnouncementHoliday,
  type AnnouncementSmsJob,
  type AnnouncementSmsTemplate,
  type MobileAnnouncement,
} from "../../services/announcementsService";
import { useAuthStore } from "../../store/authStore";
import { useAppTheme } from "../../theme/AppThemeProvider";

type FilterKey = "all" | "urgent" | "holiday";
type AdminFilterKey = "all" | "draft" | "scheduled" | "published" | "sent";
type TabKey = "inbox" | "queue" | "templates" | "sms" | "holidays";

const DELIVERY_LABELS: Record<string, string> = {
  online: "Online",
  offline_sms: "Offline SMS",
  both: "Online + SMS",
};

function hasRole(roles: string[], role: string) {
  return roles.some((value) => String(value).toLowerCase() === role);
}

function hasAny(permissions: string[], list: string[]) {
  return list.some((permission) => permissions.includes(permission));
}

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

function messageTypeLabel(item: MobileAnnouncement) {
  return item.message_type === "registered_dlt" ? "Registered DLT" : "Custom";
}

function deliveryLabel(value?: string | null) {
  return DELIVERY_LABELS[String(value || "")] || String(value || "Online");
}

function eventText(item: MobileAnnouncement) {
  const start = formatDate(item.event_start_date);
  const end = formatDate(item.event_end_date);
  if (!start && !end) return "";
  if (start && end && start !== end) return `${start} - ${end}`;
  return start || end;
}

function numberValue(value?: number | string | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusTone(status?: string | null) {
  const value = String(status || "").toLowerCase();
  if (["published", "sent"].includes(value)) return "success";
  if (["draft", "scheduled", "queued"].includes(value)) return "info";
  if (["failed", "partial_failed", "cancelled"].includes(value)) return "danger";
  return "muted";
}

export default function AnnouncementsTab() {
  const { theme } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const isSuperAdmin = hasRole(roles, "super_admin");
  const canViewAdmin = isSuperAdmin || hasAny(permissions, ["announcements.view", "announcements.manage", "announcements.publish"]);
  const canPublish = isSuperAdmin || permissions.includes("announcements.publish");
  const canViewSms = isSuperAdmin || permissions.includes("announcements.sms.send");

  const [activeTab, setActiveTab] = useState<TabKey>("inbox");
  const [items, setItems] = useState<MobileAnnouncement[]>([]);
  const [queue, setQueue] = useState<MobileAnnouncement[]>([]);
  const [templates, setTemplates] = useState<AnnouncementSmsTemplate[]>([]);
  const [smsJobs, setSmsJobs] = useState<AnnouncementSmsJob[]>([]);
  const [holidays, setHolidays] = useState<AnnouncementHoliday[]>([]);
  const [selected, setSelected] = useState<MobileAnnouncement | null>(null);
  const [selectedSource, setSelectedSource] = useState<"mobile" | "admin">("mobile");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [queueFilter, setQueueFilter] = useState<AdminFilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const tabs = useMemo(() => {
    const next: Array<{ key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
      { key: "inbox", label: "Inbox", icon: "megaphone-outline" },
    ];
    if (canViewAdmin) {
      next.push({ key: "queue", label: "Queue", icon: "list-outline" });
      next.push({ key: "templates", label: "DLT", icon: "phone-portrait-outline" });
      next.push({ key: "holidays", label: "Holidays", icon: "calendar-outline" });
    }
    if (canViewSms) next.push({ key: "sms", label: "SMS", icon: "send-outline" });
    return next;
  }, [canViewAdmin, canViewSms]);

  const filteredItems = useMemo(() => {
    if (filter === "urgent") return items.filter((item) => item.priority === "urgent");
    if (filter === "holiday") return items.filter(isHoliday);
    return items;
  }, [filter, items]);

  const filteredQueue = useMemo(() => {
    if (queueFilter === "all") return queue;
    return queue.filter((item) => String(item.status || "") === queueFilter);
  }, [queue, queueFilter]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [mobileRows, queueRows, templateRows, smsRows, holidayRows] = await Promise.all([
        getMobileAnnouncements({ limit: 80 }),
        canViewAdmin ? getAnnouncements({ limit: 80 }) : Promise.resolve([]),
        canViewAdmin ? getAnnouncementSmsTemplates({ limit: 80 }) : Promise.resolve([]),
        canViewSms ? getAnnouncementSmsJobs({ limit: 80 }) : Promise.resolve([]),
        canViewAdmin ? getHolidays({ limit: 80 }) : Promise.resolve([]),
      ]);
      setItems(mobileRows);
      setQueue(queueRows);
      setTemplates(templateRows);
      setSmsJobs(smsRows);
      setHolidays(holidayRows);
    } catch {
      setError("Could not load announcements.");
    }
  }, [canViewAdmin, canViewSms]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.key === activeTab)) setActiveTab("inbox");
  }, [activeTab, tabs]);

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

  async function openDetail(item: MobileAnnouncement, source: "mobile" | "admin" = "mobile") {
    setSelected(item);
    setSelectedSource(source);
    setDetailError(null);
    try {
      const detail = source === "admin" ? await getAnnouncement(item.id) : await getMobileAnnouncement(item.id);
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

  function confirmPublish(item: MobileAnnouncement) {
    Alert.alert("Publish announcement", `Publish "${item.title}" now?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Publish",
        onPress: () => {
          void handlePublish(item);
        },
      },
    ]);
  }

  async function handlePublish(item: MobileAnnouncement) {
    if (!canPublish) return;
    setSaving(true);
    setError(null);
    try {
      await publishAnnouncement(item.id);
      await load();
      if (selected?.id === item.id) {
        const detail = await getAnnouncement(item.id);
        setSelected(detail);
      }
    } catch {
      setError("Could not publish announcement.");
    } finally {
      setSaving(false);
    }
  }

  function renderFilterChip(key: FilterKey, label: string, count: number) {
    const active = filter === key;
    return renderChip(label, count, active, () => setFilter(key));
  }

  function renderQueueChip(key: AdminFilterKey, label: string, count: number) {
    const active = queueFilter === key;
    return renderChip(label, count, active, () => setQueueFilter(key));
  }

  function renderChip(label: string, count: number | null, active: boolean, onPress: () => void) {
    return (
      <Pressable
        accessibilityRole="button"
        key={label}
        style={[
          styles.chip,
          {
            backgroundColor: active ? theme.primary : theme.card,
            borderColor: active ? theme.primary : theme.border,
          },
        ]}
        onPress={onPress}
      >
        <Text style={[styles.chipText, { color: active ? theme.primaryText : theme.text }]}>
          {count === null ? label : `${label} ${count}`}
        </Text>
      </Pressable>
    );
  }

  function renderBadge(label: string, tone: "success" | "info" | "warning" | "danger" | "muted" = "muted") {
    const palette = {
      success: { bg: theme.successSoft, border: theme.successBorder, text: theme.success },
      info: { bg: theme.infoSoft, border: theme.infoBorder, text: theme.infoText },
      warning: { bg: theme.warningSoft, border: theme.warningBorder, text: theme.warningText },
      danger: { bg: theme.dangerSoft, border: theme.dangerBorder, text: theme.danger },
      muted: { bg: theme.cardMuted, border: theme.border, text: theme.subText },
    }[tone];
    return (
      <View style={[styles.badge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
        <Text style={[styles.badgeText, { color: palette.text }]} numberOfLines={1}>{label}</Text>
      </View>
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

  function renderAnnouncementCard(item: MobileAnnouncement, source: "mobile" | "admin") {
    const holiday = isHoliday(item);
    return (
      <Pressable
        accessibilityRole="button"
        key={`${source}-${item.id}`}
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => openDetail(item, source)}
      >
        <View style={styles.cardTop}>
          <View style={[styles.iconBox, { backgroundColor: holiday ? theme.successSoft : theme.infoSoft }]}>
            <Ionicons name={holiday ? "calendar-outline" : "megaphone-outline"} size={20} color={holiday ? theme.success : theme.info} />
          </View>
          <View style={styles.cardCopy}>
            <View style={styles.badgeRow}>
              {source === "admin" ? renderBadge(String(item.status || "draft"), statusTone(item.status)) : null}
              {item.priority === "urgent" ? renderBadge("Urgent", "warning") : null}
              {item.category_name ? renderBadge(item.category_name, "muted") : null}
              {renderBadge(messageTypeLabel(item), "muted")}
            </View>
            <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
            <Text style={[styles.cardBody, { color: theme.subText }]} numberOfLines={2}>{item.body}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.mutedText} />
        </View>
        <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
          <Text style={[styles.footerText, { color: theme.mutedText }]} numberOfLines={1}>
            {formatDateTime(item.published_at || item.publish_at) || "Not published"}
          </Text>
          <Text style={[styles.footerText, { color: theme.mutedText }]} numberOfLines={1}>
            {deliveryLabel(item.delivery_mode)}
          </Text>
        </View>
      </Pressable>
    );
  }

  function renderTabs() {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[
                styles.tabChip,
                {
                  backgroundColor: active ? theme.primary : theme.card,
                  borderColor: active ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons name={tab.icon} size={15} color={active ? theme.primaryText : theme.icon} />
              <Text style={[styles.tabChipText, { color: active ? theme.primaryText : theme.text }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  function renderInbox() {
    return (
      <>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{items.length}</Text>
            <Text style={[styles.summaryLabel, { color: theme.subText }]}>Visible</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{items.filter((item) => item.priority === "urgent").length}</Text>
            <Text style={[styles.summaryLabel, { color: theme.subText }]}>Urgent</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {renderFilterChip("all", "All", items.length)}
          {renderFilterChip("urgent", "Urgent", items.filter((item) => item.priority === "urgent").length)}
          {renderFilterChip("holiday", "Holidays", items.filter(isHoliday).length)}
        </ScrollView>
        {renderList(filteredItems, "No announcements available.", (item) => renderAnnouncementCard(item, "mobile"))}
      </>
    );
  }

  function renderQueue() {
    return (
      <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {renderQueueChip("all", "All", queue.length)}
          {renderQueueChip("draft", "Draft", queue.filter((item) => item.status === "draft").length)}
          {renderQueueChip("scheduled", "Scheduled", queue.filter((item) => item.status === "scheduled").length)}
          {renderQueueChip("published", "Published", queue.filter((item) => item.status === "published").length)}
          {renderQueueChip("sent", "Sent", queue.filter((item) => item.status === "sent").length)}
        </ScrollView>
        {renderList(filteredQueue, "No announcement queue items.", (item) => renderAnnouncementCard(item, "admin"))}
      </>
    );
  }

  function renderTemplates() {
    return renderList(templates, "No registered DLT templates found.", (item) => (
      <View key={item.id} style={[styles.card, styles.simpleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.rowBetween}>
          <View style={styles.cardCopy}>
            <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>{item.template_name || "DLT Template"}</Text>
            <Text style={[styles.cardBody, { color: theme.subText }]} numberOfLines={1}>DLT: {item.dlt_template_id || "-"}</Text>
          </View>
          {renderBadge(String(item.status || "unknown"), statusTone(item.status))}
        </View>
        <Text style={[styles.cardBody, { color: theme.subText }]} numberOfLines={4}>{item.template_content || "No template content."}</Text>
      </View>
    ));
  }

  function renderSmsJobs() {
    return renderList(smsJobs, "No SMS jobs found.", (job) => (
      <View key={job.id} style={[styles.card, styles.simpleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Job #{job.id}</Text>
            <Text style={[styles.cardBody, { color: theme.subText }]}>Announcement #{job.announcement_id || "-"}</Text>
          </View>
          {renderBadge(String(job.status || "queued"), statusTone(job.status))}
        </View>
        <View style={styles.statsRow}>
          <Text style={[styles.footerText, { color: theme.subText }]}>Total {numberValue(job.total_recipients)}</Text>
          <Text style={[styles.footerText, { color: theme.subText }]}>Sent {numberValue(job.sent_count)}</Text>
          <Text style={[styles.footerText, { color: theme.subText }]}>Failed {numberValue(job.failed_count)}</Text>
        </View>
        <Text style={[styles.footerText, { color: theme.mutedText }]}>{formatDateTime(job.scheduled_at) || "No schedule"}</Text>
      </View>
    ));
  }

  function renderHolidays() {
    return renderList(holidays, "No holiday records found.", (item) => (
      <View key={item.id} style={[styles.card, styles.simpleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.rowBetween}>
          <View style={styles.cardCopy}>
            <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>{item.title || "Holiday"}</Text>
            <Text style={[styles.cardBody, { color: theme.subText }]} numberOfLines={2}>{item.description || "Published holiday record"}</Text>
          </View>
          {renderBadge(String(item.scope_type || "school_wide").replace(/_/g, " "), "muted")}
        </View>
        <View style={styles.statsRow}>
          <Text style={[styles.footerText, { color: theme.subText }]}>{formatDate(item.starts_on) || "-"}</Text>
          <Text style={[styles.footerText, { color: theme.subText }]}>to {formatDate(item.ends_on || item.starts_on) || "-"}</Text>
          {item.reopen_date ? <Text style={[styles.footerText, { color: theme.subText }]}>Reopen {formatDate(item.reopen_date)}</Text> : null}
        </View>
      </View>
    ));
  }

  function renderList<T>(rows: T[], emptyText: string, renderItem: (item: T) => ReactElement) {
    if (loading) {
      return (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.primary} />
        </View>
      );
    }
    if (!rows.length) {
      return (
        <View style={[styles.messageCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="megaphone-outline" size={22} color={theme.mutedText} />
          <Text style={[styles.messageText, { color: theme.subText }]}>{emptyText}</Text>
        </View>
      );
    }
    return <>{rows.map(renderItem)}</>;
  }

  if (selected) {
    const canPublishSelected = canPublish && ["draft", "scheduled"].includes(String(selected.status || ""));
    return (
      <ScrollView
        style={[styles.screen, { backgroundColor: theme.bg }]}
        contentContainerStyle={styles.detailContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
      >
        <Pressable accessibilityRole="button" style={styles.backButton} onPress={() => setSelected(null)}>
          <Ionicons name="chevron-back" size={20} color={theme.primary} />
          <Text style={[styles.backText, { color: theme.primary }]}>{selectedSource === "admin" ? "Queue" : "Announcements"}</Text>
        </Pressable>

        <View style={[styles.detailCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.badgeRow}>
            {selectedSource === "admin" ? renderBadge(String(selected.status || "draft"), statusTone(selected.status)) : null}
            {selected.category_name ? renderBadge(selected.category_name, "info") : null}
            {selected.priority === "urgent" ? renderBadge("Urgent", "warning") : null}
            {renderBadge(messageTypeLabel(selected), "muted")}
            {selected.version_number ? renderBadge(`v${selected.version_number}`, "muted") : null}
          </View>
          <Text style={[styles.detailTitle, { color: theme.text }]}>{selected.title}</Text>
          <Text style={[styles.detailBody, { color: theme.subText }]}>{selected.body}</Text>
          {canPublishSelected ? (
            <Pressable
              style={[styles.primaryAction, { backgroundColor: theme.primary, opacity: saving ? 0.65 : 1 }]}
              disabled={saving}
              onPress={() => confirmPublish(selected)}
            >
              <Ionicons name="send-outline" size={16} color={theme.primaryText} />
              <Text style={[styles.primaryActionText, { color: theme.primaryText }]}>{saving ? "Publishing..." : "Publish"}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.detailCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {renderMetaRow("time-outline", "Published", formatDateTime(selected.published_at || selected.publish_at))}
          {renderMetaRow("calendar-outline", isHoliday(selected) ? "Holiday Date" : "Event Date", eventText(selected))}
          {renderMetaRow("return-up-forward-outline", "Reopen Date", formatDate(selected.reopen_date))}
          {renderMetaRow("hourglass-outline", "Available Until", formatDateTime(selected.expires_at))}
          {renderMetaRow("phone-portrait-outline", "Delivery", deliveryLabel(selected.delivery_mode))}
          {renderMetaRow("document-text-outline", "DLT Template", selected.sms_template_name || (selected.sms_template_id ? `Template #${selected.sms_template_id}` : ""))}
        </View>

        {selected.attachments?.length ? (
          <View style={[styles.detailCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Attachments</Text>
            {detailError ? <Text style={[styles.attachmentError, { color: theme.danger }]}>{detailError}</Text> : null}
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
      {renderTabs()}

      {error ? (
        <View style={[styles.messageCard, { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder }]}>
          <Ionicons name="alert-circle-outline" size={22} color={theme.danger} />
          <Text style={[styles.messageText, { color: theme.danger }]}>{error}</Text>
        </View>
      ) : null}

      {activeTab === "inbox" ? renderInbox() : null}
      {activeTab === "queue" ? renderQueue() : null}
      {activeTab === "templates" ? renderTemplates() : null}
      {activeTab === "sms" ? renderSmsJobs() : null}
      {activeTab === "holidays" ? renderHolidays() : null}
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
  tabRow: {
    gap: 8,
    paddingBottom: 2,
  },
  tabChip: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  summaryLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  simpleCard: {
    padding: 14,
    gap: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  badge: {
    maxWidth: 150,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
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
    fontWeight: "700",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  messageCard: {
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  messageText: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  loadingBox: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
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
    borderRadius: 8,
    padding: 16,
  },
  detailTitle: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 29,
  },
  detailBody: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 23,
  },
  primaryAction: {
    minHeight: 42,
    borderRadius: 8,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryActionText: {
    fontSize: 13,
    fontWeight: "800",
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

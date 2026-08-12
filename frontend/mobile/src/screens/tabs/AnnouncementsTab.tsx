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
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  createAnnouncement,
  createAnnouncementHolidayName,
  getAnnouncementCategories,
  getAnnouncementHolidayNames,
  getAnnouncement,
  getAnnouncementSmsJobs,
  getAnnouncementSmsTemplates,
  getAnnouncements,
  getHolidays,
  getMobileAnnouncement,
  getMobileAnnouncements,
  publishAnnouncement,
  type AnnouncementCategory,
  type AnnouncementHolidayName,
  type AnnouncementHoliday,
  type AnnouncementSmsJob,
  type AnnouncementSmsTemplate,
  type MobileAnnouncement,
} from "../../services/announcementsService";
import { useAuthStore } from "../../store/authStore";
import { useAppTheme } from "../../theme/AppThemeProvider";
import DateField from "../../components/form/DateField";

type FilterKey = "all" | "urgent" | "holiday";
type AdminFilterKey = "all" | "draft" | "scheduled" | "published" | "sent";
type TabKey = "inbox" | "queue" | "templates" | "sms" | "holidays";
type ComposeTarget = "all" | "parents" | "teachers" | "staff" | "accounts" | "scope";
type ComposeStatus = "publish_now" | "draft" | "scheduled";

const EMPTY_COMPOSE = {
  target_type: "all" as ComposeTarget,
  scope_code: "school",
  message_type: "custom" as "custom" | "registered_dlt",
  title: "",
  body: "",
  category_id: "",
  sms_template_id: "",
  delivery_mode: "online" as "online" | "offline_sms" | "both",
  status: "publish_now" as ComposeStatus,
  priority: "normal" as "normal" | "urgent",
  publish_at: "",
  sms_send_at: "",
  expires_at: "",
  event_start_date: "",
  event_end_date: "",
  reopen_date: "",
  sms_variables: {} as Record<string, string>,
  show_in_software: true,
  show_in_mobile: true,
  create_notification: true,
  send_push: true,
};

const DELIVERY_LABELS: Record<string, string> = {
  online: "Online",
  offline_sms: "Offline SMS",
  both: "Online + SMS",
};

function normalizeRole(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized === "superadmin" ? "super_admin" : normalized;
}

function hasRole(roles: string[], role: string) {
  const expected = normalizeRole(role);
  return roles.some((value) => normalizeRole(value) === expected);
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

function templateVariableKey(item: any, index: number) {
  return String(item?.key || item?.name || `value_${index + 1}`);
}

function templateVariableLabel(item: any, fallback: string) {
  return String(item?.label || item?.name || fallback);
}

function parseJsonValue(value: unknown, fallback: any = null) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function parsePlaceholderSchema(template?: AnnouncementSmsTemplate | null) {
  const schema = parseJsonValue(template?.placeholder_schema_json, []);
  const parsed = Array.isArray(schema)
    ? schema
    : Array.isArray(schema?.variables)
      ? schema.variables
      : Array.isArray(schema?.placeholders)
        ? schema.placeholders
        : [];
  if (parsed.length) {
    return parsed.map((item: any, index: number) => ({
      ...item,
      key: templateVariableKey(item, index),
      label: templateVariableLabel(item, `Value ${index + 1}`),
      type: String(item?.type || "text").toLowerCase(),
      required: item?.required !== false,
    }));
  }
  const detectedCount = String(template?.template_content || "").match(/\{#(?:var|alp)#\}/gi)?.length || 0;
  const count = Number(template?.placeholder_count || detectedCount || 0);
  return Array.from({ length: Number.isFinite(count) ? count : 0 }, (_, index) => ({
    key: `value_${index + 1}`,
    label: `Value ${index + 1}`,
    type: "text",
    required: true,
  }));
}

function renderTemplateContent(template = "", schema: any[] = [], variables: Record<string, string> = {}) {
  let index = 0;
  return String(template || "").replace(/\{#(?:var|alp)#\}/gi, () => {
    const item = schema[index];
    const key = templateVariableKey(item, index);
    const value = String(variables[key] || "").trim();
    index += 1;
    return value;
  });
}

function statusTone(status?: string | null) {
  const value = String(status || "").toLowerCase();
  if (["published", "sent"].includes(value)) return "success";
  if (["draft", "scheduled", "queued"].includes(value)) return "info";
  if (["failed", "partial_failed", "cancelled"].includes(value)) return "danger";
  return "muted";
}

function audienceIcon(value: ComposeTarget): keyof typeof Ionicons.glyphMap {
  if (value === "parents") return "people-outline";
  if (value === "teachers") return "school-outline";
  if (value === "staff") return "briefcase-outline";
  if (value === "accounts") return "cash-outline";
  if (value === "scope") return "business-outline";
  return "globe-outline";
}

function audienceLabel(value: ComposeTarget, scopeCode = "school") {
  if (value === "parents") return "Parents";
  if (value === "teachers") return "Teachers";
  if (value === "staff") return "Staff";
  if (value === "accounts") return "Accounts";
  if (value === "scope") return scopeCode === "hs" ? "Higher Secondary" : "School";
  return "All Users";
}

const ANNOUNCEMENT_AUDIENCES: Array<{ value: ComposeTarget; label: string; description: string }> = [
  { value: "all", label: "All Users", description: "Everyone with an active account" },
  { value: "parents", label: "Parents", description: "All parent users" },
  { value: "teachers", label: "Teachers", description: "All teacher users" },
  { value: "staff", label: "Staff", description: "Users with staff role" },
  { value: "accounts", label: "Accounts", description: "Users with accounts role" },
  { value: "scope", label: "School / HS", description: "Limit by school or higher secondary scope" },
];

export default function AnnouncementsTab() {
  const { theme } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const isSuperAdmin = hasRole(roles, "super_admin");
  const isParentOrTeacher = hasRole(roles, "parent") || hasRole(roles, "teacher");
  const canViewAdmin = isSuperAdmin || (!isParentOrTeacher && hasAny(permissions, ["announcements.view", "announcements.manage", "announcements.publish"]));
  const canManage = canViewAdmin && (isSuperAdmin || permissions.includes("announcements.manage"));
  const canPublish = canViewAdmin && (isSuperAdmin || permissions.includes("announcements.publish"));
  const canViewSms = canViewAdmin && (isSuperAdmin || permissions.includes("announcements.sms.send"));

  const [activeTab, setActiveTab] = useState<TabKey>("inbox");
  const [items, setItems] = useState<MobileAnnouncement[]>([]);
  const [queue, setQueue] = useState<MobileAnnouncement[]>([]);
  const [templates, setTemplates] = useState<AnnouncementSmsTemplate[]>([]);
  const [categories, setCategories] = useState<AnnouncementCategory[]>([]);
  const [holidayNames, setHolidayNames] = useState<AnnouncementHolidayName[]>([]);
  const [smsJobs, setSmsJobs] = useState<AnnouncementSmsJob[]>([]);
  const [holidays, setHolidays] = useState<AnnouncementHoliday[]>([]);
  const [selected, setSelected] = useState<MobileAnnouncement | null>(null);
  const [composing, setComposing] = useState(false);
  const [composeStep, setComposeStep] = useState<"audience" | "message">("audience");
  const [compose, setCompose] = useState(EMPTY_COMPOSE);
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
    if (!canViewAdmin) return items;
    if (filter === "urgent") return items.filter((item) => item.priority === "urgent");
    if (filter === "holiday") return items.filter(isHoliday);
    return items;
  }, [canViewAdmin, filter, items]);

  const filteredQueue = useMemo(() => {
    if (queueFilter === "all") return queue;
    return queue.filter((item) => String(item.status || "") === queueFilter);
  }, [queue, queueFilter]);

  const registeredTemplates = useMemo(
    () => templates.filter((item) => String(item.status || "").toLowerCase() === "registered"),
    [templates],
  );

  const selectedTemplate = useMemo(
    () => registeredTemplates.find((item) => String(item.id) === String(compose.sms_template_id)) ?? null,
    [compose.sms_template_id, registeredTemplates],
  );

  const selectedTemplateVariables = useMemo(() => {
    return parsePlaceholderSchema(selectedTemplate);
  }, [selectedTemplate]);

  const renderedDltBody = useMemo(
    () => renderTemplateContent(selectedTemplate?.template_content || "", selectedTemplateVariables, compose.sms_variables),
    [compose.sms_variables, selectedTemplate, selectedTemplateVariables],
  );

  const holidayVariableOptions = useMemo(() => {
    const seen = new Set<string>();
    return [
      ...holidayNames.map((item) => item.name).filter(Boolean),
      ...holidays.map((item) => item.title).filter(Boolean),
      ...categories.filter((item) => ["holiday", "festival", "vacation"].includes(String(item.slug || "").toLowerCase())).map((item) => item.name),
    ]
      .map((item) => String(item || "").trim())
      .filter((item) => {
        if (!item || seen.has(item.toLowerCase())) return false;
        seen.add(item.toLowerCase());
        return true;
      });
  }, [categories, holidayNames, holidays]);

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
      const [categoryRows, holidayNameRows] = canManage
        ? await Promise.all([getAnnouncementCategories(), getAnnouncementHolidayNames({ limit: 120 })])
        : [[], []];
      setItems(mobileRows);
      setQueue(queueRows);
      setTemplates(templateRows);
      setCategories(categoryRows);
      setHolidayNames(holidayNameRows);
      setSmsJobs(smsRows);
      setHolidays(holidayRows);
    } catch {
      setError("Could not load announcements.");
    }
  }, [canManage, canViewAdmin, canViewSms]);

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

  function updateCompose<K extends keyof typeof EMPTY_COMPOSE>(key: K, value: (typeof EMPTY_COMPOSE)[K]) {
    setCompose((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "message_type" && value === "custom"
        ? { delivery_mode: "online", sms_template_id: "", sms_send_at: "", sms_variables: {} }
        : {}),
      ...(key === "message_type" && value === "registered_dlt"
        ? { delivery_mode: "both", body: "" }
        : {}),
      ...(key === "sms_template_id" ? { sms_variables: {} } : {}),
    }));
  }

  function resetCompose() {
    setCompose(EMPTY_COMPOSE);
    setComposeStep("audience");
    setComposing(false);
  }

  function selectAudience(value: ComposeTarget) {
    updateCompose("target_type", value);
    setComposeStep("message");
  }

  function updateSmsVariable(key: string, value: string) {
    setCompose((prev) => ({
      ...prev,
      sms_variables: { ...prev.sms_variables, [key]: value },
    }));
  }

  async function handleAddHolidayName(name: string) {
    const value = String(name || "").trim();
    if (!value || !canManage) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createAnnouncementHolidayName({ name: value, category: "holiday" });
      if (created) {
        setHolidayNames((prev) => {
          const exists = prev.some((item) => String(item.id) === String(created.id) || String(item.name).toLowerCase() === String(created.name).toLowerCase());
          const next = exists ? prev.map((item) => (String(item.id) === String(created.id) ? created : item)) : [...prev, created];
          return next.sort((a, b) => String(a.name).localeCompare(String(b.name)));
        });
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Could not save holiday name.");
    } finally {
      setSaving(false);
    }
  }

  function validateCompose() {
    if (!compose.title.trim()) return "Title is required.";
    if (compose.message_type === "custom" && !compose.body.trim()) return "Body is required.";
    if (compose.message_type === "registered_dlt" && !compose.sms_template_id) return "Select a registered DLT template.";
    if (compose.status === "scheduled" && !compose.publish_at.trim()) return "Publish date/time is required for scheduled announcements.";
    if (compose.target_type === "scope" && !compose.scope_code.trim()) return "Select school or higher secondary scope.";
    const missingVariable = selectedTemplateVariables.find((item: any, index: number) => {
      const key = templateVariableKey(item, index);
      return item.required !== false && !String(compose.sms_variables[key] || "").trim();
    });
    if (compose.message_type === "registered_dlt" && missingVariable) return "Fill all required template variables.";
    return "";
  }

  async function handleCreateAnnouncement() {
    if (!canManage) return;
    const validation = validateCompose();
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createAnnouncement({
        message_type: compose.message_type,
        title: compose.title.trim(),
        body: compose.message_type === "registered_dlt" ? renderedDltBody || selectedTemplate?.template_content || compose.body : compose.body.trim(),
        category_id: compose.category_id ? Number(compose.category_id) : null,
        delivery_mode: compose.message_type === "custom" ? "online" : compose.delivery_mode,
        status: compose.status === "publish_now" ? "draft" : compose.status,
        priority: compose.priority,
        publish_at: compose.status === "scheduled" ? compose.publish_at.trim() : null,
        sms_send_at: compose.message_type === "registered_dlt" ? compose.sms_send_at.trim() || null : null,
        expires_at: compose.expires_at.trim() || null,
        event_start_date: compose.event_start_date.trim() || null,
        event_end_date: compose.event_end_date.trim() || compose.event_start_date.trim() || null,
        reopen_date: compose.reopen_date.trim() || null,
        show_in_software: compose.show_in_software,
        show_in_mobile: compose.show_in_mobile,
        create_notification: compose.create_notification,
        send_push: compose.send_push,
        sms_template_id: compose.message_type === "registered_dlt" ? Number(compose.sms_template_id) : null,
        sms_variables: compose.message_type === "registered_dlt"
          ? {
              ...compose.sms_variables,
              order: selectedTemplateVariables.map((item: any, index: number) => templateVariableKey(item, index)),
            }
          : {},
        targets: [{
          target_type: compose.target_type,
          scope_code: compose.target_type === "scope" ? compose.scope_code : null,
        }],
      });
      if (compose.status === "publish_now" && created?.id) {
        await publishAnnouncement(created.id);
      }
      setCompose(EMPTY_COMPOSE);
      setComposing(false);
      setActiveTab("queue");
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Could not create announcement.");
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
            backgroundColor: active ? theme.successSoft : "transparent",
            borderColor: active ? theme.success : theme.border,
          },
        ]}
        onPress={onPress}
      >
        <Text style={[styles.chipText, { color: active ? theme.success : theme.subText }]}>{label}</Text>
        {count !== null && count > 0 ? (
          <Text style={[styles.chipCount, { color: active ? theme.success : theme.mutedText }]}>{count}</Text>
        ) : null}
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

  function renderSegment<T extends string>(value: T, label: string, activeValue: T, onPress: (value: T) => void) {
    const active = value === activeValue;
    return (
      <Pressable
        key={value}
        style={[styles.segment, { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.primary : theme.card }]}
        onPress={() => onPress(value)}
      >
        <Text style={[styles.segmentText, { color: active ? theme.primaryText : theme.text }]}>{label}</Text>
      </Pressable>
    );
  }

  function renderInput(label: string, value: string, onChangeText: (value: string) => void, options: { key?: string; multiline?: boolean; placeholder?: string; keyboardType?: "default" | "number-pad" | "numeric" } = {}) {
    return (
      <View key={options.key} style={styles.field}>
        <Text style={[styles.fieldLabel, { color: theme.subText }]}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          multiline={options.multiline}
          keyboardType={options.keyboardType || "default"}
          placeholder={options.placeholder}
          placeholderTextColor={theme.mutedText}
          style={[
            styles.input,
            options.multiline ? styles.textArea : null,
            { borderColor: theme.border, backgroundColor: theme.card, color: theme.text },
          ]}
        />
      </View>
    );
  }

  function renderBoolean(label: string, value: boolean, onPress: () => void) {
    return (
      <Pressable style={[styles.toggleRow, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={onPress}>
        <Text style={[styles.toggleText, { color: theme.text }]}>{label}</Text>
        <View style={[styles.toggleBox, { borderColor: value ? theme.primary : theme.border, backgroundColor: value ? theme.primary : theme.cardMuted }]}>
          {value ? <Ionicons name="checkmark" size={14} color={theme.primaryText} /> : null}
        </View>
      </Pressable>
    );
  }

  function renderDltVariableInput(item: any, index: number) {
    const key = templateVariableKey(item, index);
    const label = templateVariableLabel(item, key);
    const type = String(item?.type || "text").toLowerCase();
    const value = compose.sms_variables[key] || "";

    if (type === "date") {
      return (
        <DateField
          key={key}
          label={label}
          value={value}
          onChange={(next) => updateSmsVariable(key, next)}
          placeholder="Select date"
        />
      );
    }

    if (type === "holiday") {
      const canAddHolidayName = Boolean(value.trim()) && !holidayVariableOptions.some((option) => option.toLowerCase() === value.trim().toLowerCase());
      return (
        <View key={key} style={styles.field}>
          <Text style={[styles.fieldLabel, { color: theme.subText }]}>{label}</Text>
          <View style={styles.variableInputRow}>
            <TextInput
              value={value}
              onChangeText={(next) => updateSmsVariable(key, next)}
              placeholder="Select or type holiday"
              placeholderTextColor={theme.mutedText}
              style={[styles.input, styles.variableInput, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]}
            />
            <Pressable
              style={[styles.variableAddButton, { borderColor: theme.border, backgroundColor: canAddHolidayName ? theme.primary : theme.cardMuted, opacity: saving || !canAddHolidayName ? 0.55 : 1 }]}
              disabled={saving || !canAddHolidayName}
              onPress={() => void handleAddHolidayName(value)}
            >
              <Ionicons name="add" size={16} color={canAddHolidayName ? theme.primaryText : theme.mutedText} />
            </Pressable>
          </View>
          {holidayVariableOptions.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.variableOptionRow}>
              {holidayVariableOptions.map((option) => {
                const active = option === value;
                return (
                  <Pressable
                    key={`${key}-${option}`}
                    style={[styles.variableChip, { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.infoSoft : theme.cardMuted }]}
                    onPress={() => updateSmsVariable(key, option)}
                  >
                    <Text style={[styles.variableChipText, { color: active ? theme.primary : theme.subText }]} numberOfLines={1}>{option}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>
      );
    }

    return renderInput(label, value, (next) => updateSmsVariable(key, next), {
      key,
      keyboardType: type === "number" ? "numeric" : "default",
    });
  }

  function renderAudienceCard(option: { value: ComposeTarget; label: string; description: string }) {
    return (
      <Pressable
        key={option.value}
        style={[styles.audienceCard, { borderColor: theme.border, backgroundColor: theme.card }]}
        onPress={() => selectAudience(option.value)}
      >
        <View style={[styles.audienceIcon, { backgroundColor: theme.infoSoft }]}>
          <Ionicons name={audienceIcon(option.value)} size={20} color={theme.info} />
        </View>
        <View style={styles.audienceCopy}>
          <Text style={[styles.audienceTitle, { color: theme.text }]}>{option.label}</Text>
          <Text style={[styles.audienceDesc, { color: theme.subText }]}>{option.description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.icon} />
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
          <View style={[styles.iconBox, { backgroundColor: holiday ? theme.successSoft : theme.cardMuted }]}>
            <Ionicons name={holiday ? "calendar-outline" : "megaphone-outline"} size={20} color={holiday ? theme.success : theme.primary} />
          </View>
          <View style={styles.cardCopy}>
            <View style={styles.badgeRow}>
              {source === "admin" ? renderBadge(String(item.status || "draft"), statusTone(item.status)) : null}
              {item.priority === "urgent" ? renderBadge("Urgent", "warning") : null}
              {item.category_name ? renderBadge(item.category_name, "muted") : null}
              {source === "admin" ? renderBadge(messageTypeLabel(item), "muted") : null}
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
          {source === "admin" ? (
            <Text style={[styles.footerText, { color: theme.mutedText }]} numberOfLines={1}>
              {deliveryLabel(item.delivery_mode)}
            </Text>
          ) : null}
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
        {canViewAdmin ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {renderFilterChip("all", "All", items.length)}
            {renderFilterChip("urgent", "Urgent", items.filter((item) => item.priority === "urgent").length)}
            {renderFilterChip("holiday", "Holidays", items.filter(isHoliday).length)}
          </ScrollView>
        ) : null}
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
            {item.provider_template_id ? <Text style={[styles.cardBody, { color: theme.subText }]} numberOfLines={1}>Fast2SMS: {item.provider_template_id}</Text> : null}
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

  function renderCompose() {
    const selectedAudienceLabel = audienceLabel(compose.target_type, compose.scope_code);
    return (
      <ScrollView
        style={[styles.screen, { backgroundColor: theme.bg }]}
        contentContainerStyle={styles.detailContent}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          style={styles.backButton}
          onPress={() => {
            if (composeStep === "message") {
              setComposeStep("audience");
            } else {
              resetCompose();
            }
          }}
        >
          <Ionicons name="chevron-back" size={20} color={theme.primary} />
          <Text style={[styles.backText, { color: theme.primary }]}>Announcements</Text>
        </Pressable>

        <View style={[styles.detailCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.heroEyebrow, { color: theme.subText }]}>Step {composeStep === "audience" ? "1" : "2"} of 2</Text>
          <Text style={[styles.detailTitle, { color: theme.text }]}>
            {composeStep === "audience" ? "Select Audience" : "New Announcement"}
          </Text>
          <Text style={[styles.cardBody, { color: theme.subText }]}>
            {composeStep === "audience" ? "Choose who should receive this announcement." : "Set the message, delivery, and publish options."}
          </Text>
        </View>

        {composeStep === "audience" ? (
          <>
            <View style={styles.composeSection}>
              <Text style={[styles.groupLabel, { color: theme.subText }]}>Audience</Text>
              {ANNOUNCEMENT_AUDIENCES.map(renderAudienceCard)}
            </View>
          </>
        ) : (
          <>
            <View style={[styles.identityCard, { borderColor: theme.infoBorder, backgroundColor: theme.infoSoft }]}>
              <View style={[styles.audienceIcon, { backgroundColor: theme.card }]}>
                <Ionicons name={audienceIcon(compose.target_type)} size={20} color={theme.info} />
              </View>
              <View style={styles.audienceCopy}>
                <Text style={[styles.selectedLabel, { color: theme.infoText }]}>Sending To</Text>
                <Text style={[styles.audienceTitle, { color: theme.text }]}>{selectedAudienceLabel}</Text>
                <Text style={[styles.audienceDesc, { color: theme.subText }]}>Announcement audience</Text>
              </View>
            </View>

            {compose.target_type === "scope" ? (
              <View style={[styles.detailCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Scope</Text>
                <View style={styles.segmentWrap}>
                  {renderSegment("school", "School", compose.scope_code, (value) => updateCompose("scope_code", value))}
                  {renderSegment("hs", "Higher Secondary", compose.scope_code, (value) => updateCompose("scope_code", value))}
                </View>
              </View>
            ) : null}

            <View style={[styles.detailCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Message</Text>
              <View style={styles.segmentWrap}>
                {renderSegment("custom", "Custom", compose.message_type, (value) => updateCompose("message_type", value))}
                {renderSegment("registered_dlt", "Registered DLT", compose.message_type, (value) => updateCompose("message_type", value))}
              </View>
              {renderInput("Title", compose.title, (value) => updateCompose("title", value))}
              {categories.length ? (
                <>
                  <Text style={[styles.fieldLabel, { color: theme.subText }]}>Category</Text>
                  <View style={styles.segmentWrap}>
                    {renderSegment("", "None", compose.category_id, (value) => updateCompose("category_id", value))}
                    {categories.slice(0, 8).map((item) => renderSegment(String(item.id), item.name, compose.category_id, (value) => updateCompose("category_id", value)))}
                  </View>
                </>
              ) : null}
              {compose.message_type === "custom" ? (
                renderInput("Body", compose.body, (value) => updateCompose("body", value), { multiline: true })
              ) : (
                <>
                  <Text style={[styles.fieldLabel, { color: theme.subText }]}>DLT Template</Text>
                  <View style={styles.optionList}>
                    {registeredTemplates.map((item) => {
                      const active = String(item.id) === String(compose.sms_template_id);
                      return (
                        <Pressable
                          key={item.id}
                          style={[styles.templateOption, { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.infoSoft : theme.card }]}
                          onPress={() => updateCompose("sms_template_id", String(item.id))}
                        >
                          <Text style={[styles.templateTitle, { color: theme.text }]}>{item.template_name || `Template #${item.id}`}</Text>
                          <Text style={[styles.templateBody, { color: theme.subText }]} numberOfLines={3}>{item.template_content || "No template content."}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {selectedTemplate ? (
                    <View style={[styles.templatePreviewBox, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
                      <Text style={[styles.templateBody, { color: theme.subText }]}>{selectedTemplate.template_content || "No template content."}</Text>
                    </View>
                  ) : null}
                  {selectedTemplateVariables.map(renderDltVariableInput)}
                  {selectedTemplate ? (
                    <View style={[styles.templatePreviewBox, { borderColor: theme.infoBorder, backgroundColor: theme.infoSoft }]}>
                      <Text style={[styles.fieldLabel, { color: theme.infoText }]}>Preview</Text>
                      <Text style={[styles.previewText, { color: theme.text }]}>{renderedDltBody || selectedTemplate.template_content || ""}</Text>
                    </View>
                  ) : null}
                  {renderInput("SMS Send At", compose.sms_send_at, (value) => updateCompose("sms_send_at", value), { placeholder: "YYYY-MM-DD HH:mm" })}
                  <View style={styles.segmentWrap}>
                    {renderSegment("online", "Online", compose.delivery_mode, (value) => updateCompose("delivery_mode", value))}
                    {renderSegment("offline_sms", "SMS", compose.delivery_mode, (value) => updateCompose("delivery_mode", value))}
                    {renderSegment("both", "Online + SMS", compose.delivery_mode, (value) => updateCompose("delivery_mode", value))}
                  </View>
                </>
              )}
            </View>

            <View style={[styles.detailCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Publishing</Text>
              <View style={styles.segmentWrap}>
                {renderSegment("publish_now", "Publish Now", compose.status, (value) => updateCompose("status", value))}
                {renderSegment("draft", "Draft", compose.status, (value) => updateCompose("status", value))}
                {renderSegment("scheduled", "Schedule", compose.status, (value) => updateCompose("status", value))}
              </View>
              {compose.status === "scheduled" ? renderInput("Publish At", compose.publish_at, (value) => updateCompose("publish_at", value), { placeholder: "YYYY-MM-DD HH:mm" }) : null}
              <View style={styles.segmentWrap}>
                {renderSegment("normal", "Normal", compose.priority, (value) => updateCompose("priority", value))}
                {renderSegment("urgent", "Urgent", compose.priority, (value) => updateCompose("priority", value))}
              </View>
              {renderBoolean("Show in software", compose.show_in_software, () => updateCompose("show_in_software", !compose.show_in_software))}
              {renderBoolean("Show in mobile", compose.show_in_mobile, () => updateCompose("show_in_mobile", !compose.show_in_mobile))}
              {renderBoolean("Create notification", compose.create_notification, () => updateCompose("create_notification", !compose.create_notification))}
              {renderBoolean("Send push notification", compose.send_push, () => updateCompose("send_push", !compose.send_push))}
            </View>

            <View style={[styles.detailCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Event / Holiday Dates</Text>
              <Text style={[styles.helperText, { color: theme.subText }]}>Optional for closures, holidays, vacations, or dated events.</Text>
              <DateField label="Event Starts" value={compose.event_start_date} onChange={(value) => updateCompose("event_start_date", value)} placeholder="Select start date" />
              <DateField label="Event Ends" value={compose.event_end_date} onChange={(value) => updateCompose("event_end_date", value)} placeholder="Select end date" />
              <DateField label="Reopen Date" value={compose.reopen_date} onChange={(value) => updateCompose("reopen_date", value)} placeholder="Select reopen date" />
            </View>

            <View style={styles.composeFooterRow}>
              <Pressable style={[styles.secondaryAction, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setComposeStep("audience")}>
                <Text style={[styles.secondaryActionText, { color: theme.text }]}>Change Audience</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryAction, styles.footerPrimaryAction, { backgroundColor: theme.primary, opacity: saving ? 0.65 : 1 }]}
                disabled={saving}
                onPress={() => void handleCreateAnnouncement()}
              >
                <Ionicons name={compose.status === "publish_now" ? "send-outline" : "save-outline"} size={16} color={theme.primaryText} />
                <Text style={[styles.primaryActionText, { color: theme.primaryText }]}>{saving ? "Saving..." : compose.status === "publish_now" ? "Publish" : "Save"}</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    );
  }

  if (composing) return renderCompose();

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
            {selectedSource === "admin" ? renderBadge(messageTypeLabel(selected), "muted") : null}
            {selectedSource === "admin" && selected.version_number ? renderBadge(`v${selected.version_number}`, "muted") : null}
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
          {selectedSource === "admin" ? renderMetaRow("phone-portrait-outline", "Delivery", deliveryLabel(selected.delivery_mode)) : null}
          {selectedSource === "admin" ? renderMetaRow("document-text-outline", "DLT Template", selected.sms_template_name || (selected.sms_template_id ? `Template #${selected.sms_template_id}` : "")) : null}
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
      <View style={styles.listTitleRow}>
        <Text style={[styles.listTitle, { color: theme.text }]}>Announcements</Text>
        <View style={styles.listTitleActions}>
          {canManage ? (
            <Pressable
              style={[styles.newAnnouncementBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
              onPress={() => {
                setError(null);
                setComposing(true);
              }}
            >
              <Ionicons name="megaphone-outline" size={16} color={theme.primaryText} />
              <Text style={[styles.newAnnouncementBtnText, { color: theme.primaryText }]}>New</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {tabs.length > 1 ? renderTabs() : null}

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
  listTitleRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  listTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "800",
  },
  listTitleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  listIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  newAnnouncementBtn: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  newAnnouncementBtnText: {
    fontSize: 12,
    fontWeight: "800",
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  composeSection: {
    gap: 10,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  audienceCard: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  audienceIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  audienceCopy: {
    flex: 1,
    minWidth: 0,
  },
  audienceTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  audienceDesc: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  identityCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selectedLabel: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
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
  chipRow: {
    gap: 7,
    paddingRight: 14,
    paddingVertical: 2,
  },
  chip: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: "center",
    paddingHorizontal: 11,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  chipCount: {
    fontSize: 11,
    fontWeight: "700",
  },
  segmentWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  segment: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "800",
  },
  field: {
    marginTop: 12,
    gap: 6,
  },
  fieldGap: {
    marginTop: 8,
  },
  fieldLabel: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: "700",
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  optionList: {
    gap: 8,
    marginTop: 8,
  },
  templateOption: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  templateTitle: {
    fontSize: 13,
    fontWeight: "900",
  },
  templateBody: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  templatePreviewBox: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 10,
    padding: 12,
  },
  previewText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },
  variableOptionRow: {
    gap: 8,
    paddingRight: 12,
    paddingTop: 2,
  },
  variableInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  variableInput: {
    flex: 1,
  },
  variableAddButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  variableChip: {
    maxWidth: 180,
    minHeight: 32,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  variableChipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  toggleRow: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "800",
  },
  toggleBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
  composeFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  secondaryAction: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: "800",
  },
  footerPrimaryAction: {
    flex: 1,
    marginTop: 0,
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

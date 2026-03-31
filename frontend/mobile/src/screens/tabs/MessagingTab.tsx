import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TopNotice from "../../components/feedback/TopNotice";
import SelectField from "../../components/form/SelectField";
import { useAuthStore } from "../../store/authStore";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { ENV } from "../../constants/env";
import {
  getConversations,
  getMessages,
  getTargets,
  markAsRead,
  sendMessage,
  type ConversationItem,
  type MessageItem,
  type MessagingTargets,
} from "../../services/messagingService";
import { formatDateLabel, formatTimeLabel } from "../../utils/format";

type Props = {
  onConversationViewChange?: (isConversationOpen: boolean) => void;
};

type Notice = { title: string; message: string; tone: "success" | "error" } | null;
type Screen = "list" | "chat";
type Compose = {
  target_type: "direct" | "parent" | "teacher" | "class" | "section" | "broadcast" | "all_classes" | "all_sections" | "all_parents" | "all_teachers";
  recipient_user_id: string;
  class_id: string;
  section_id: string;
  teacher_type: "all" | "school" | "college";
  message: string;
};

const EMPTY_TARGETS: MessagingTargets = { parents: [], teachers: [], classes: [], sections: [], broadcast_targets: [] };
const EMPTY_COMPOSE: Compose = {
  target_type: "direct",
  recipient_user_id: "",
  class_id: "",
  section_id: "",
  teacher_type: "all",
  message: "",
};

const DEFAULT_THEME = {
  bg: "#f8fafc",
  card: "#ffffff",
  cardMuted: "#f8fafc",
  text: "#0f172a",
  subText: "#64748b",
  mutedText: "#94a3b8",
  border: "#e2e8f0",
  inputBg: "#ffffff",
  overlay: "rgba(15, 23, 42, 0.28)",
  icon: "#334155",
  primary: "#0f172a",
  primaryText: "#ffffff",
  success: "#15803d",
  successText: "#ffffff",
};
let styles = createStyles(DEFAULT_THEME);

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err && "response" in err) {
    const data = (err as { response?: { data?: { error?: string; message?: string } } }).response?.data;
    return data?.error || data?.message || fallback;
  }
  return fallback;
}

function firstLetter(value?: string | null) {
  return String(value || "?").trim().charAt(0).toUpperCase() || "?";
}

function resolveMediaUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = ENV.API_BASE_URL.replace(/\/api\/v1\/?$/i, "");
  return `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

function presenceText(conversation?: ConversationItem | null) {
  if (!conversation) return "";
  if (conversation.type !== "direct") return conversation.type;
  if (conversation.online) return "Online";
  if (!conversation.last_seen_at) return "Offline";
  return `Last seen ${formatDateLabel(conversation.last_seen_at)} ${formatTimeLabel(conversation.last_seen_at)}`;
}

function Avatar({ label, online, imageUrl }: { label?: string | null; online?: boolean; imageUrl?: string | null }) {
  const { theme, isDark } = useAppTheme();
  const resolvedImage = resolveMediaUrl(imageUrl);
  return (
    <View style={styles.avatarWrap}>
      <View
        style={[
          styles.avatarCircle,
          {
            backgroundColor: isDark ? theme.cardMuted : theme.primary,
          },
        ]}
      >
        {resolvedImage ? (
          <Image source={{ uri: resolvedImage }} style={styles.avatarImage} />
        ) : (
          <Text style={[styles.avatarText, { color: isDark ? theme.text : theme.primaryText }]}>{firstLetter(label)}</Text>
        )}
      </View>
      <View style={[styles.presenceDot, online ? styles.presenceOnline : styles.presenceOffline]} />
    </View>
  );
}

export default function MessagingTab({ onConversationViewChange }: Props) {
  const { theme, isDark } = useAppTheme();
  styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = Array.isArray(user?.roles) && user.roles.includes("super_admin");

  const [screen, setScreen] = useState<Screen>("list");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [targets, setTargets] = useState<MessagingTargets>(EMPTY_TARGETS);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [compose, setCompose] = useState<Compose>(EMPTY_COMPOSE);
  const [composeSearch, setComposeSearch] = useState("");
  const [composeRoleFilter, setComposeRoleFilter] = useState("all");
  const [composeClassFilter, setComposeClassFilter] = useState("");
  const [composeSectionFilter, setComposeSectionFilter] = useState("");
  const [composeTeacherTypeFilter, setComposeTeacherTypeFilter] = useState<"all" | "school" | "college">("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const activeConversation = useMemo(
    () => conversations.find((item) => Number(item.id) === Number(activeConversationId)) ?? null,
    [conversations, activeConversationId],
  );
  const recipientOptions = useMemo(() => {
    const grouped = new Map<
      number,
      {
        user_id: number;
        name: string;
        roleSet: Set<string>;
        classIds: Set<string>;
        sectionIds: Set<string>;
        classNames: Set<string>;
        sectionNames: Set<string>;
        phones: Set<string>;
        emails: Set<string>;
        teacherTypes: Set<string>;
      }
    >();

    for (const item of targets.parents) {
      const userId = Number(item.user_id);
      if (!userId) continue;
      const existing = grouped.get(userId) || {
        user_id: userId,
        name: item.name,
        roleSet: new Set<string>(),
        classIds: new Set<string>(),
        sectionIds: new Set<string>(),
        classNames: new Set<string>(),
        sectionNames: new Set<string>(),
        phones: new Set<string>(),
        emails: new Set<string>(),
        teacherTypes: new Set<string>(),
      };
      existing.roleSet.add("parent");
      if (item.class_id) existing.classIds.add(String(item.class_id));
      if (item.section_id) existing.sectionIds.add(String(item.section_id));
      if (item.class_name) existing.classNames.add(String(item.class_name));
      if (item.section_name) existing.sectionNames.add(String(item.section_name));
      if (item.mobile) existing.phones.add(String(item.mobile));
      if (item.email) existing.emails.add(String(item.email));
      grouped.set(userId, existing);
    }

    for (const item of targets.teachers) {
      const userId = Number(item.user_id);
      if (!userId) continue;
      const existing = grouped.get(userId) || {
        user_id: userId,
        name: item.name,
        roleSet: new Set<string>(),
        classIds: new Set<string>(),
        sectionIds: new Set<string>(),
        classNames: new Set<string>(),
        sectionNames: new Set<string>(),
        phones: new Set<string>(),
        emails: new Set<string>(),
        teacherTypes: new Set<string>(),
      };
      existing.roleSet.add("teacher");
      if (item.class_id) existing.classIds.add(String(item.class_id));
      if (item.section_id) existing.sectionIds.add(String(item.section_id));
      if (item.class_name) existing.classNames.add(String(item.class_name));
      if (item.section_name) existing.sectionNames.add(String(item.section_name));
      if (item.phone) existing.phones.add(String(item.phone));
      if (item.email) existing.emails.add(String(item.email));
      if (item.type) existing.teacherTypes.add(String(item.type));
      grouped.set(userId, existing);
    }

    const targetRole =
      compose.target_type === "parent" ? "parent" : compose.target_type === "teacher" ? "teacher" : composeRoleFilter;
    const query = composeSearch.trim().toLowerCase();

    return Array.from(grouped.values())
      .map((item) => ({
        user_id: item.user_id,
        name: item.name || `User #${item.user_id}`,
        roles: Array.from(item.roleSet),
        classIds: Array.from(item.classIds),
        sectionIds: Array.from(item.sectionIds),
        classNames: Array.from(item.classNames),
        sectionNames: Array.from(item.sectionNames),
        phones: Array.from(item.phones),
        emails: Array.from(item.emails),
        teacherTypes: Array.from(item.teacherTypes),
      }))
      .filter((item) => {
        if (targetRole !== "all" && !item.roles.includes(targetRole)) return false;
        if (composeClassFilter && !item.classIds.includes(composeClassFilter)) return false;
        if (composeSectionFilter && !item.sectionIds.includes(composeSectionFilter)) return false;
        if (
          composeTeacherTypeFilter !== "all" &&
          item.roles.includes("teacher") &&
          !item.teacherTypes.includes(composeTeacherTypeFilter)
        ) {
          return false;
        }
        if (!query) return true;
        return [
          item.name,
          item.roles.join(" "),
          item.classNames.join(" "),
          item.sectionNames.join(" "),
          item.phones.join(" "),
          item.emails.join(" "),
          item.teacherTypes.join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [targets, compose.target_type, composeRoleFilter, composeSearch, composeClassFilter, composeSectionFilter, composeTeacherTypeFilter]);
  const selectedRecipient = useMemo(
    () => recipientOptions.find((item) => String(item.user_id) === compose.recipient_user_id) ?? null,
    [recipientOptions, compose.recipient_user_id],
  );
  const sectionsBySelectedClass = useMemo(
    () => targets.sections.filter((item) => String(item.class_id) === compose.class_id),
    [targets.sections, compose.class_id],
  );
  const sectionsByFilterClass = useMemo(
    () => (composeClassFilter ? targets.sections.filter((item) => String(item.class_id) === composeClassFilter) : targets.sections),
    [targets.sections, composeClassFilter],
  );
  const targetTypeOptions = useMemo(
    () => [
      { label: "One-to-One", value: "direct" },
      { label: "One Parent", value: "parent" },
      { label: "One Teacher", value: "teacher" },
      { label: "Class", value: "class" },
      { label: "Section", value: "section" },
      ...targets.broadcast_targets.map((item) => ({ label: item.label, value: item.key })),
    ],
    [targets.broadcast_targets],
  );
  const classOptions = useMemo(
    () =>
      targets.classes.map((item) => ({
        label: item.name,
        value: String(item.id),
        description: [item.medium, item.class_scope === "hs" ? "Higher Secondary" : item.class_scope ? "School" : ""]
          .filter(Boolean)
          .join(" - "),
      })),
    [targets.classes],
  );
  const sectionOptions = useMemo(
    () =>
      sectionsBySelectedClass.map((item) => ({
        label: `${item.class_name} - ${item.name}`,
        value: String(item.id),
        description: [item.medium, item.class_scope === "hs" ? "Higher Secondary" : item.class_scope ? "School" : ""]
          .filter(Boolean)
          .join(" - "),
      })),
    [sectionsBySelectedClass],
  );
  const filteredSectionOptions = useMemo(
    () =>
      sectionsByFilterClass.map((item) => ({
        label: `${item.class_name} - ${item.name}`,
        value: String(item.id),
      })),
    [sectionsByFilterClass],
  );
  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((item) => [item.name, item.last_message, item.type].join(" - ").toLowerCase().includes(query));
  }, [conversations, search]);

  useEffect(() => {
    void loadBootstrap();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (screen !== "chat" || !activeConversationId) return;
    void loadMessagesForConversation(activeConversationId);
  }, [activeConversationId, screen]);

  useEffect(() => {
    onConversationViewChange?.(screen === "chat");
    return () => onConversationViewChange?.(false);
  }, [onConversationViewChange, screen]);

  useEffect(() => {
    if (screen !== "chat") return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setScreen("list");
      return true;
    });
    return () => subscription.remove();
  }, [screen]);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadConversations(true);
      if (screen === "chat" && activeConversationId) {
        void loadMessagesForConversation(activeConversationId, true);
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [activeConversationId, screen]);

  async function loadBootstrap() {
    await Promise.all([loadConversations(), loadTargets()]);
  }

  async function loadConversations(silent = false) {
    if (!silent) setLoadingConversations(true);
    try {
      const rows = await getConversations();
      setConversations(rows);
      if (!activeConversationId && rows.length) setActiveConversationId(Number(rows[0].id));
    } catch (err) {
      if (!silent) Alert.alert("Error", getErrorMessage(err, "Could not load conversations."));
      setConversations([]);
    } finally {
      if (!silent) setLoadingConversations(false);
    }
  }

  async function loadTargets() {
    try {
      setTargets(await getTargets());
    } catch {
      setTargets(EMPTY_TARGETS);
    }
  }

  async function loadMessagesForConversation(conversationId: number, silent = false) {
    if (!silent) setLoadingMessages(true);
    try {
      const rows = await getMessages(conversationId, 1, 100);
      setMessages([...rows].reverse());
      await markAsRead(conversationId);
      await loadConversations(true);
    } catch (err) {
      if (!silent) Alert.alert("Error", getErrorMessage(err, "Could not load messages."));
      setMessages([]);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([loadConversations(true), loadTargets()]);
      if (screen === "chat" && activeConversationId) await loadMessagesForConversation(activeConversationId, true);
    } finally {
      setRefreshing(false);
    }
  }

  async function sendReply() {
    if (!activeConversationId || !reply.trim()) return;
    setSending(true);
    try {
      await sendMessage({ conversation_id: activeConversationId, message: reply.trim() });
      setReply("");
      await loadMessagesForConversation(activeConversationId, true);
      setNotice({ title: "Sent", message: "Message delivered.", tone: "success" });
    } catch (err) {
      Alert.alert("Send failed", getErrorMessage(err, "Failed to send message."));
    } finally {
      setSending(false);
    }
  }

  async function sendNewMessage() {
    if (!compose.message.trim()) {
      Alert.alert("Validation", "Enter a message.");
      return;
    }
    setSending(true);
    try {
      const payload: Parameters<typeof sendMessage>[0] = {
        target_type: compose.target_type,
        message: compose.message.trim(),
      };

      if (["direct", "parent", "teacher"].includes(compose.target_type)) {
        if (!compose.recipient_user_id) {
          Alert.alert("Validation", "Choose a recipient.");
          return;
        }
        payload.recipient_user_id = Number(compose.recipient_user_id);
      }

      if (compose.target_type === "class") {
        if (!compose.class_id) {
          Alert.alert("Validation", "Choose a class.");
          return;
        }
        payload.class_id = Number(compose.class_id);
        payload.name = `Class ${targets.classes.find((item) => String(item.id) === compose.class_id)?.name || compose.class_id}`;
      }

      if (compose.target_type === "section") {
        if (!compose.section_id) {
          Alert.alert("Validation", "Choose a section.");
          return;
        }
        payload.section_id = Number(compose.section_id);
        const section = targets.sections.find((item) => String(item.id) === compose.section_id);
        payload.name = `Section ${section?.class_name || ""} ${section?.name || compose.section_id}`.trim();
      }

      if (compose.target_type === "broadcast") payload.name = "All Users";
      if (compose.target_type === "all_classes") payload.name = "All Classes";
      if (compose.target_type === "all_sections") payload.name = "All Sections";
      if (compose.target_type === "all_parents") payload.name = "All Parents";
      if (compose.target_type === "all_teachers") {
        payload.teacher_type = compose.teacher_type;
        payload.name =
          compose.teacher_type === "college"
            ? "All College Teachers"
            : compose.teacher_type === "school"
              ? "All School Teachers"
              : "All Teachers";
      }

      const result = await sendMessage(payload);
      setComposeOpen(false);
      setCompose(EMPTY_COMPOSE);
      setComposeSearch("");
      setComposeRoleFilter("all");
      setComposeClassFilter("");
      setComposeSectionFilter("");
      setComposeTeacherTypeFilter("all");
      await loadConversations(true);
      if (result.conversation_id) {
        setActiveConversationId(Number(result.conversation_id));
        setScreen("chat");
        await loadMessagesForConversation(Number(result.conversation_id), true);
      }
      setNotice({ title: "Sent", message: "Conversation started successfully.", tone: "success" });
    } catch (err) {
      Alert.alert("Send failed", getErrorMessage(err, "Failed to send message."));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {screen === "list" ? (
        <View style={[styles.screen, { backgroundColor: theme.bg }]}>
          <TopNotice notice={notice} style={styles.topNoticeOverlay} />
          <ScrollView
            style={styles.root}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.innerContent}>
              <View style={styles.heroCard}>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroEyebrow}>Overview</Text>
                  <Text style={styles.heroTitle}>Messaging</Text>
                  <Text style={styles.heroSubtitle}>
                    Review conversations, continue live chat threads, and send new messages.
                  </Text>
                </View>
                {isSuperAdmin ? (
                  <View style={styles.heroPrimaryActions}>
                    <Pressable style={styles.topActionBtn} onPress={() => setComposeOpen(true)}>
                      <Ionicons name="create-outline" size={18} color={theme.successText} />
                      <Text style={styles.topActionText}>New Conversation</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>

              <View style={[styles.searchWrap, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <Ionicons name="search-outline" size={16} color={theme.icon} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search conversations"
                  placeholderTextColor={theme.mutedText}
                  style={[styles.searchInput, { color: theme.text }]}
                />
              </View>

              {loadingConversations ? (
                <View style={styles.centered}><ActivityIndicator size="small" color={theme.icon} /></View>
              ) : filteredConversations.length ? (
                filteredConversations.map((conversation) => (
                  <Pressable
                    key={conversation.id}
                    style={[styles.rowCard, { borderColor: theme.border, backgroundColor: theme.card }]}
                    onPress={() => {
                      setActiveConversationId(Number(conversation.id));
                      setScreen("chat");
                    }}
                  >
                    <Avatar
                      label={conversation.name || conversation.type}
                      online={conversation.online}
                      imageUrl={conversation.other_user_image_url}
                    />
                    <View style={styles.rowBody}>
                      <View style={styles.rowTop}>
                        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                          {conversation.name || conversation.type}
                        </Text>
                        {Number(conversation.unread || 0) > 0 ? <Text style={styles.unread}>{conversation.unread}</Text> : null}
                      </View>
                      <Text style={[styles.rowPreview, { color: theme.subText }]} numberOfLines={1}>
                        {conversation.last_message || "No messages yet"}
                      </Text>
                    </View>
                  </Pressable>
                ))
              ) : (
                <View style={[styles.emptyCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={24} color={theme.icon} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>No conversations</Text>
                  <Text style={[styles.emptyText, { color: theme.subText }]}>
                    {search.trim() ? "Try a different search." : "Your conversations will appear here."}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

        </View>
      ) : (
        <View style={[styles.chatScreen, { backgroundColor: theme.bg }]}>
          <TopNotice notice={notice} style={styles.topNoticeOverlay} />
          <View style={styles.chatInnerContent}>
            <View style={styles.chatHeroCard}>
              <Text style={styles.heroEyebrow}>Conversation</Text>
              <View style={[styles.chatHeader, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <Pressable style={[styles.iconBtn, { backgroundColor: isDark ? theme.cardMuted : theme.bg }]} onPress={() => setScreen("list")}>
                  <Ionicons name="arrow-back-outline" size={20} color={theme.icon} />
                </Pressable>
                <Avatar
                  label={activeConversation?.name || activeConversation?.type}
                  online={activeConversation?.online}
                  imageUrl={activeConversation?.other_user_image_url}
                />
                <View style={styles.chatHeaderCopy}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>{activeConversation?.name || "Chat"}</Text>
                  <Text style={[styles.rowMeta, { color: theme.subText }]}>{presenceText(activeConversation)}</Text>
                </View>
              </View>
            </View>

            <View style={[styles.chatMessagesPanel, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
              <ScrollView
                style={styles.chatMessagesScroll}
                contentContainerStyle={[styles.chatMessagesContent, { paddingBottom: 16 }]}
                showsVerticalScrollIndicator={false}
              >
                {loadingMessages ? (
                  <View style={styles.centered}><ActivityIndicator size="small" color={theme.icon} /></View>
                ) : messages.length ? (
                  messages.map((message) => {
                    const mine = Number(message.sender_id) === Number(user?.id);
                    return (
                      <View key={message.id} style={[styles.messageRow, mine ? styles.mine : styles.other]}>
                        {!mine ? <Avatar label={message.sender_name || message.username} imageUrl={message.sender_image_url} /> : null}
                      <View style={[
                        styles.bubble,
                        mine
                          ? { backgroundColor: theme.cardMuted, borderColor: theme.border, borderWidth: 1, borderTopRightRadius: 6 }
                          : { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 },
                      ]}>
                        {!mine ? <Text style={[styles.senderName, { color: theme.subText }]}>{message.sender_name || message.username}</Text> : null}
                        <Text style={[styles.messageText, { color: theme.text }]}>{message.message}</Text>
                        <Text style={[styles.bubbleTime, { color: theme.subText }]}>{formatTimeLabel(message.created_at)}</Text>
                      </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={[styles.emptyCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
                  <Ionicons name="chatbox-outline" size={24} color={theme.icon} />
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>No messages yet</Text>
                    <Text style={[styles.emptyText, { color: theme.subText }]}>Start the conversation with a reply below.</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>

          <View
            style={[
              styles.replyBarWrap,
              {
                paddingBottom: Math.max(insets.bottom, 10),
                backgroundColor: theme.bg,
              },
            ]}
          >
            <View style={[styles.replyBar, { borderColor: theme.border, backgroundColor: theme.card }]}>
              <TextInput
                value={reply}
                onChangeText={setReply}
                placeholder="Type a message"
                placeholderTextColor={theme.mutedText}
                style={[styles.replyInput, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
              />
              <Pressable style={styles.sendBtn} onPress={() => void sendReply()} disabled={sending}>
                <Ionicons name="send" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <Modal visible={composeOpen} transparent animationType="slide" onRequestClose={() => setComposeOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setComposeOpen(false)} />
          <View style={[styles.modalCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>New Message</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.composeSection}>
                <SelectField
                  label="Audience"
                  value={compose.target_type}
                  options={targetTypeOptions}
                  onChange={(value) =>
                    setCompose((prev) => ({
                      ...prev,
                      target_type: value as Compose["target_type"],
                      recipient_user_id: "",
                      class_id: "",
                      section_id: "",
                      teacher_type: "all",
                    }))
                  }
                />
              </View>

              {["direct", "parent", "teacher"].includes(compose.target_type) ? (
                <View style={styles.composeSection}>
                  <TextInput
                    value={composeSearch}
                    onChangeText={setComposeSearch}
                    placeholder="Search by name, phone, class or section"
                    placeholderTextColor={theme.mutedText}
                    style={[styles.searchInputBox, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
                  />
                  {compose.target_type === "direct" ? (
                    <SelectField
                      label="User Type"
                      value={composeRoleFilter}
                      options={[
                        { label: "All User Types", value: "all" },
                        { label: "Parents", value: "parent" },
                        { label: "Teachers", value: "teacher" },
                      ]}
                      onChange={setComposeRoleFilter}
                    />
                  ) : null}
                  <SelectField
                    label="Class"
                    value={composeClassFilter}
                    options={classOptions}
                    onChange={(value) => {
                      setComposeClassFilter(value);
                      setComposeSectionFilter("");
                    }}
                    allowClear
                    clearLabel="All Classes"
                  />
                  <SelectField
                    label="Section"
                    value={composeSectionFilter}
                    options={filteredSectionOptions}
                    onChange={setComposeSectionFilter}
                    allowClear
                    clearLabel="All Sections"
                  />
                  {(compose.target_type === "teacher" || (compose.target_type === "direct" && composeRoleFilter !== "parent")) ? (
                    <SelectField
                      label="Teacher Type"
                      value={composeTeacherTypeFilter}
                      options={[
                        { label: "All Teacher Types", value: "all" },
                        { label: "School", value: "school" },
                        { label: "College", value: "college" },
                      ]}
                      onChange={(value) => setComposeTeacherTypeFilter(value as "all" | "school" | "college")}
                    />
                  ) : null}

                  {selectedRecipient ? (
                    <View style={[styles.selectedCard, { borderColor: "#bfdbfe", backgroundColor: isDark ? theme.cardMuted : "#eff6ff" }]}>
                      <Text style={[styles.selectedLabel, { color: "#1d4ed8" }]}>Selected Recipient</Text>
                      <Text style={[styles.rowTitle, { color: theme.text }]}>{selectedRecipient.name}</Text>
                      <Text style={[styles.rowMeta, { color: theme.subText }]}>
                        {selectedRecipient.roles.join(", ")}
                        {selectedRecipient.phones[0] ? ` - ${selectedRecipient.phones[0]}` : ""}
                        {selectedRecipient.classNames.length ? ` - ${selectedRecipient.classNames.join(", ")}` : ""}
                      </Text>
                    </View>
                  ) : null}

                  {recipientOptions.map((item) => {
                    const active = compose.recipient_user_id === String(item.user_id);
                    return (
                      <Pressable
                        key={item.user_id}
                        style={[
                          styles.targetRow,
                          {
                            borderColor: active ? "#1d4ed8" : theme.border,
                            backgroundColor: active ? (isDark ? theme.cardMuted : "#eff6ff") : theme.card,
                          },
                        ]}
                        onPress={() => setCompose((prev) => ({ ...prev, recipient_user_id: String(item.user_id) }))}
                      >
                        <Text style={[styles.rowTitle, { color: active ? "#1d4ed8" : theme.text }]}>{item.name}</Text>
                        <Text style={[styles.rowMeta, { color: theme.subText }]}>
                          {item.roles.join(", ")}
                          {item.phones[0] ? ` - ${item.phones[0]}` : ""}
                          {item.classNames.length ? ` - ${item.classNames.join(", ")}` : ""}
                          {item.sectionNames.length ? ` - ${item.sectionNames.join(", ")}` : ""}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {!recipientOptions.length ? (
                    <View style={[styles.emptyInline, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
                      <Text style={[styles.rowMeta, { color: theme.subText }]}>No matching recipients found.</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {compose.target_type === "class" ? (
                <View style={styles.composeSection}>
                  <SelectField label="Class" value={compose.class_id} options={classOptions} onChange={(value) => setCompose((prev) => ({ ...prev, class_id: value }))} />
                </View>
              ) : null}

              {compose.target_type === "section" ? (
                <View style={styles.composeSection}>
                  <SelectField
                    label="Class"
                    value={compose.class_id}
                    options={classOptions}
                    onChange={(value) => setCompose((prev) => ({ ...prev, class_id: value, section_id: "" }))}
                  />
                  <SelectField
                    label="Section"
                    value={compose.section_id}
                    options={sectionOptions}
                    onChange={(value) => setCompose((prev) => ({ ...prev, section_id: value }))}
                  />
                </View>
              ) : null}

              {compose.target_type === "all_teachers" ? (
                <View style={styles.composeSection}>
                  <SelectField
                    label="Teacher Type"
                    value={compose.teacher_type}
                    options={[
                      { label: "All Teachers", value: "all" },
                      { label: "School Teachers", value: "school" },
                      { label: "College Teachers", value: "college" },
                    ]}
                    onChange={(value) => setCompose((prev) => ({ ...prev, teacher_type: value as Compose["teacher_type"] }))}
                  />
                </View>
              ) : null}

              <TextInput
                value={compose.message}
                onChangeText={(value) => setCompose((prev) => ({ ...prev, message: value }))}
                placeholder="Write your message"
                placeholderTextColor={theme.mutedText}
                multiline
                textAlignVertical="top"
                style={[styles.composeInput, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setComposeOpen(false)}>
                <Text style={[styles.secondaryText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, { backgroundColor: theme.success }]} onPress={() => void sendNewMessage()} disabled={sending}>
                <Text style={styles.primaryText}>{sending ? "Sending..." : "Send"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(theme: typeof DEFAULT_THEME) {
return StyleSheet.create({
  screen: { flex: 1 },
  root: { flex: 1 },
  chatScreen: { flex: 1, minHeight: 0 },
  chatInnerContent: { flex: 1, gap: 12, paddingHorizontal: 14, paddingTop: 10 },
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 120 },
  innerContent: { gap: 12 },
  topNoticeOverlay: {
    position: "absolute",
    top: 10,
    left: 14,
    right: 14,
    zIndex: 20,
    elevation: 20,
  },
  heroCard: { borderRadius: 24, paddingVertical: 2, gap: 10 },
  chatHeroCard: { borderRadius: 24, paddingVertical: 2, gap: 10 },
  heroCopy: { gap: 6 },
  heroPrimaryActions: { flexDirection: "row", gap: 10 },
  heroEyebrow: { color: theme.subText, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  heroTitle: { color: theme.text, fontWeight: "800", fontSize: 22 },
  heroSubtitle: { color: theme.subText, lineHeight: 20 },
  chatMessagesScroll: { flex: 1, minHeight: 0 },
  chatMessagesContent: { gap: 10, paddingTop: 2 },
  chatMessagesPanel: {
    flex: 1.6,
    minHeight: 0,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
    overflow: "hidden",
  },
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 24 },
  topActionRow: { alignItems: "flex-end" },
  topActionBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.success, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  topActionText: { color: theme.successText, fontWeight: "700" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 16, paddingHorizontal: 11, minHeight: 44 },
  searchInput: { flex: 1, fontSize: 14 },
  rowCard: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: 20, padding: 12 },
  rowBody: { flex: 1, gap: 4, justifyContent: "center" },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rowTitle: { fontSize: 15, fontWeight: "800", flex: 1 },
  rowTime: { fontSize: 11 },
  rowPreview: { fontSize: 13 },
  rowMeta: { fontSize: 12, flex: 1 },
  unread: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, textAlign: "center", backgroundColor: theme.success, color: theme.successText, fontSize: 11, fontWeight: "700" },
  emptyCard: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 24, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "800" },
  avatarWrap: { width: 46, height: 46, alignItems: "center", justifyContent: "center", position: "relative" },
  avatarCircle: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  avatarImage: { width: 42, height: 42, borderRadius: 21 },
  avatarText: { color: theme.text, fontWeight: "800", fontSize: 16 },
  presenceDot: { position: "absolute", right: 2, bottom: 2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: theme.card },
  presenceOnline: { backgroundColor: "#22c55e" },
  presenceOffline: { backgroundColor: "#ef4444" },
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  chatHeaderCopy: { flex: 1, gap: 2 },
  messageRow: { flexDirection: "row", gap: 8 },
  mine: { justifyContent: "flex-end" },
  other: { justifyContent: "flex-start" },
  bubble: { maxWidth: "82%", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10 },
  bubbleMine: { borderTopRightRadius: 6 },
  senderName: { fontSize: 11, fontWeight: "700", marginBottom: 4 },
  messageText: {},
  bubbleTime: { marginTop: 6, fontSize: 11 },
  replyBarWrap: { paddingTop: 0, paddingHorizontal: 14, marginTop: "auto" },
  replyBar: { flexDirection: "row", gap: 10, alignItems: "center", borderWidth: 1, borderRadius: 22, paddingHorizontal: 10, paddingVertical: 7 },
  replyInput: { flex: 1, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.success, alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.overlay },
  modalCard: { maxHeight: "88%", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, padding: 16, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  composeSection: { gap: 10, marginBottom: 12 },
  searchInputBox: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14 },
  selectedCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  selectedLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  targetRow: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  emptyInline: { borderWidth: 1, borderRadius: 14, padding: 12 },
  composeInput: { borderWidth: 1, borderRadius: 14, minHeight: 120, paddingHorizontal: 12, paddingVertical: 10, marginTop: 6 },
  modalActions: { flexDirection: "row", gap: 10 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center" },
  secondaryText: { fontWeight: "700" },
  primaryBtn: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center" },
  primaryText: { color: theme.successText, fontWeight: "700" },
  emptyText: { textAlign: "center" },
});
}

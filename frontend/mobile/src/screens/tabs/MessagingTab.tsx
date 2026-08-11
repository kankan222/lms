import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import TopNotice from "../../components/feedback/TopNotice";
import SelectField from "../../components/form/SelectField";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { MessagingComposeResult } from "../MessagingComposeScreen";
import { useAuthStore } from "../../store/authStore";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { ENV } from "../../constants/env";
import {
  deleteConversation,
  deleteMessage,
  editMessage,
  getAttachmentAccess,
  getConversations,
  getMessages,
  getTargets,
  getTyping,
  markAsRead,
  reportMessage,
  searchMessages,
  sendMessage,
  sendTyping,
  uploadMessageAttachments,
  type ConversationItem,
  type MessageAttachment,
  type MessageItem,
  type MessagingTargets,
  type UploadAsset,
} from "../../services/messagingService";
import { formatDateLabel, formatTimeLabel } from "../../utils/format";

type Props = {
  onConversationViewChange?: (isConversationOpen: boolean) => void;
  parentConversationIntent?: ParentConversationIntent | null;
  onParentConversationIntentHandled?: (token: number) => void;
  composeTargetIntent?: MessagingComposeResult | null;
  onComposeTargetHandled?: (token: number) => void;
  isVisible?: boolean;
};

export type ParentConversationIntent = {
  token: number;
  targetType?: "parent" | "teacher";
  recipientUserId: number;
  recipientName?: string;
  classId?: number | null;
  sectionId?: number | null;
};

type Notice = { title: string; message: string; tone: "success" | "error" } | null;
type Screen = "list" | "chat";
type ConversationFilter = "all" | "unread" | "direct" | "parents" | "teachers" | "class" | "section" | "broadcast";
type Compose = {
  target_type: "direct" | "parent" | "teacher" | "class" | "section" | "broadcast" | "all_classes" | "all_sections" | "all_parents" | "all_teachers" | "admin";
  recipient_user_id: string;
  class_id: string;
  section_id: string;
  teacher_scope: "all" | "school" | "college";
  staff_type: "all" | "teaching" | "non_teaching";
  name: string;
};
type ConversationTargetPayload = Omit<Parameters<typeof sendMessage>[0], "message">;

const EMPTY_TARGETS: MessagingTargets = { parents: [], teachers: [], classes: [], sections: [], broadcast_targets: [] };
const EMPTY_COMPOSE: Compose = {
  target_type: "direct",
  recipient_user_id: "",
  class_id: "",
  section_id: "",
  teacher_scope: "all",
  staff_type: "all",
  name: "",
};
const CONVERSATIONS_PAGE_SIZE = 30;
const MESSAGE_PAGE_SIZE = 40;
const MESSAGE_SYNC_INTERVAL_MS = 6000;
const RECIPIENTS_INITIAL_LIMIT = 80;
const GROUP_TARGET_TYPES = ["class", "section", "broadcast", "all_classes", "all_sections", "all_parents", "all_teachers"] as const;

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
  primary: "#f9735b",
  primaryText: "#ffffff",
  success: "#f9735b",
  successSoft: "#fff1ed",
  successBorder: "#fed7d0",
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

function conversationMatchesFilter(
  conversation: ConversationItem,
  filter: ConversationFilter,
  parentUserIds: Set<number> = new Set(),
  teacherUserIds: Set<number> = new Set(),
) {
  const name = String(conversation.name || "").toLowerCase();
  const otherUserId = Number(conversation.other_user_id) || null;
  if (filter === "all") return true;
  if (filter === "unread") return Number(conversation.unread || 0) > 0;
  if (filter === "direct") return conversation.type === "direct";
  if (filter === "class") return conversation.type === "class" || name.includes("class");
  if (filter === "section") return conversation.type === "section" || name.includes("section");
  if (filter === "parents") return name.includes("parent") || (otherUserId !== null && parentUserIds.has(otherUserId));
  if (filter === "teachers") return name.includes("teacher") || (otherUserId !== null && teacherUserIds.has(otherUserId));
  if (filter === "broadcast") {
    return (
      conversation.type === "broadcast" &&
      !name.includes("parent") &&
      !name.includes("teacher") &&
      !name.includes("class") &&
      !name.includes("section")
    );
  }
  return true;
}

function isSuperAdminRole(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized === "super_admin" || normalized === "superadmin";
}

function hasSuperAdminRole(roles: string[]) {
  return roles.some(isSuperAdminRole);
}

function isGroupTargetType(value: string) {
  return (GROUP_TARGET_TYPES as readonly string[]).includes(value);
}

function audienceIcon(value: Compose["target_type"]): keyof typeof Ionicons.glyphMap {
  if (value === "parent") return "person-outline";
  if (value === "teacher") return "school-outline";
  if (value === "class") return "people-outline";
  if (value === "section") return "grid-outline";
  if (value === "all_parents") return "people-circle-outline";
  if (value === "all_teachers") return "briefcase-outline";
  if (value === "broadcast" || value === "all_classes" || value === "all_sections") return "megaphone-outline";
  return "chatbubble-ellipses-outline";
}

function normalizeTeacherScope(value?: string | null) {
  if (value === "college" || value === "hs") return "college";
  if (value === "school") return "school";
  return "all";
}

function normalizeStaffType(value?: string | null) {
  if (value === "non_teaching") return "non_teaching";
  if (value === "teaching") return "teaching";
  return "all";
}

function formatTeacherAudienceName(scope: Compose["teacher_scope"], staffType: Compose["staff_type"]) {
  const scopeLabel = scope === "college" ? "College" : scope === "school" ? "School" : "";
  const staffLabel = staffType === "non_teaching" ? "Non Teaching Staff" : staffType === "teaching" ? "Teaching Staff" : "Staff";
  return ["All", scopeLabel, staffLabel].filter(Boolean).join(" ");
}

function Avatar({
  label,
  online,
  imageUrl,
  size = "regular",
}: {
  label?: string | null;
  online?: boolean;
  imageUrl?: string | null;
  size?: "regular" | "large";
}) {
  const { theme } = useAppTheme();
  const resolvedImage = resolveMediaUrl(imageUrl);
  const large = size === "large";
  return (
    <View style={large ? styles.avatarWrapLarge : styles.avatarWrap}>
      <View
        style={[
          large ? styles.avatarCircleLarge : styles.avatarCircle,
          {
            backgroundColor: "#334155",
            borderColor: theme.border,
          },
        ]}
      >
        {resolvedImage ? (
          <Image source={{ uri: resolvedImage }} style={large ? styles.avatarImageLarge : styles.avatarImage} />
        ) : (
          <Text style={[large ? styles.avatarTextLarge : styles.avatarText, { color: "#f8fafc" }]}>{firstLetter(label)}</Text>
        )}
      </View>
      <View style={[large ? styles.presenceDotLarge : styles.presenceDot, online ? styles.presenceOnline : styles.presenceOffline]} />
    </View>
  );
}

function MessageAttachmentView({ attachment }: { attachment: MessageAttachment }) {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const brightText = "#f8fafc";
  const brightMeta = "#cbd5e1";
  const [url, setUrl] = useState<string | null>(null);
  const player = useAudioPlayer(attachment.category === "voice" ? url : null, {
    updateInterval: 250,
  });
  const playerStatus = useAudioPlayerStatus(player);
  const [speed, setSpeed] = useState(1);

  async function toggleVoicePlayback() {
    if (playerStatus.playing) {
      player.pause();
      return;
    }

    const duration = Math.max(playerStatus.duration || 0, 0);
    const current = Math.max(playerStatus.currentTime || 0, 0);
    if (duration > 0 && current >= duration - 0.25) {
      await player.seekTo(0);
    }
    player.play();
  }

  useEffect(() => {
    let active = true;
    getAttachmentAccess(attachment.id)
      .then((data) => {
        if (active) setUrl(resolveMediaUrl(data?.access_url));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [attachment.id]);

  if (!url) {
    return <ActivityIndicator size="small" color={theme.icon} />;
  }

  if (attachment.category === "image") {
    return (
      <Pressable
        style={styles.mediaPressable}
        onPress={() => navigation.navigate("MessagingPhotoPreview", { uri: url, title: attachment.original_name || "Photo" })}
      >
        <Image source={{ uri: url }} style={styles.messageImage} resizeMode="cover" />
      </Pressable>
    );
  }

  if (attachment.category === "voice") {
    const duration = Math.max(playerStatus.duration || 0, 0);
    const current = Math.max(playerStatus.currentTime || 0, 0);
    const progress = duration > 0 ? Math.min(1, current / duration) : 0;
    return (
      <View style={styles.voiceInline}>
        <Pressable style={styles.voicePlayBtn} onPress={() => void toggleVoicePlayback()}>
          <Ionicons name={playerStatus.playing ? "pause" : "play"} size={15} color={theme.successText} />
        </Pressable>
        <View style={styles.voiceBody}>
          <View style={styles.voiceWave}>
            {Array.from({ length: 18 }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.voiceBar,
                  {
                    height: 8 + ((index * 7) % 18),
                    backgroundColor: index / 18 <= progress ? brightText : brightMeta,
                    opacity: index / 18 <= progress ? 1 : 0.45,
                  },
                ]}
              />
            ))}
          </View>
        </View>
        <View style={styles.voiceSideMeta}>
          <Text style={[styles.voiceTime, { color: brightMeta }]}>
            {Math.floor(current / 60)}:{String(Math.floor(current % 60)).padStart(2, "0")}
          </Text>
          <Pressable
            style={styles.voiceSpeedBtn}
            onPress={() => {
              const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
              setSpeed(next);
              player.setPlaybackRate(next);
            }}
          >
            <Text style={[styles.voiceAction, { color: brightText }]}>{speed}x</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable style={styles.fileInline} onPress={() => void Linking.openURL(url)}>
      <View style={styles.fileIconWrap}>
        <Ionicons name="document-attach-outline" size={20} color={brightText} />
      </View>
      <View style={styles.fileTextWrap}>
        <Text style={[styles.fileName, { color: brightText }]} numberOfLines={1}>{attachment.original_name}</Text>
        <Text style={[styles.fileMeta, { color: brightMeta }]}>{Math.ceil(Number(attachment.file_size || 0) / 1024)} KB</Text>
      </View>
    </Pressable>
  );
}

function VoicePreview({ uri }: { uri: string }) {
  const { theme } = useAppTheme();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  async function togglePreviewPlayback() {
    if (status.playing) {
      player.pause();
      return;
    }

    const duration = Math.max(status.duration || 0, 0);
    const current = Math.max(status.currentTime || 0, 0);
    if (duration > 0 && current >= duration - 0.25) {
      await player.seekTo(0);
    }
    player.play();
  }

  return (
    <Pressable
      style={[styles.voicePreview, { borderColor: theme.border, backgroundColor: theme.inputBg }]}
      onPress={() => void togglePreviewPlayback()}
    >
      <Ionicons name={status.playing ? "pause" : "play"} size={18} color={theme.icon} />
      <Text style={[styles.fileName, { color: theme.text }]}>Preview voice note</Text>
    </Pressable>
  );
}

export default function MessagingTab({
  onConversationViewChange,
  parentConversationIntent,
  onParentConversationIntentHandled,
  composeTargetIntent,
  onComposeTargetHandled,
  isVisible = true,
}: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const { theme, isDark } = useAppTheme();
  styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const isSuperAdmin = hasSuperAdminRole(roles);
  const isParentOrTeacher = !isSuperAdmin && (roles.includes("parent") || roles.includes("teacher"));
  const canStartMessages = !isParentOrTeacher && (isSuperAdmin || permissions.includes("messages.send"));

  const [screen, setScreen] = useState<Screen>("list");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversationIds, setSelectedConversationIds] = useState<number[]>([]);
  const [failedMessageIds, setFailedMessageIds] = useState<number[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [targets, setTargets] = useState<MessagingTargets>(EMPTY_TARGETS);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>("all");
  const [reply, setReply] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<UploadAsset[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<"image" | "document" | "voice" | null>(null);
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<MessageItem | null>(null);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [typingUserIds, setTypingUserIds] = useState<number[]>([]);
  const [compose, setCompose] = useState<Compose>(EMPTY_COMPOSE);
  const [composeSearch, setComposeSearch] = useState("");
  const [composeRoleFilter, setComposeRoleFilter] = useState("all");
  const [composeClassFilter, setComposeClassFilter] = useState("");
  const [composeSectionFilter, setComposeSectionFilter] = useState("");
  const [composeTeacherScopeFilter, setComposeTeacherScopeFilter] = useState<"all" | "school" | "college">("all");
  const [composeStaffTypeFilter, setComposeStaffTypeFilter] = useState<"all" | "teaching" | "non_teaching">("all");
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeStep, setComposeStep] = useState<"audience" | "target">("audience");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [conversationsPage, setConversationsPage] = useState(1);
  const [conversationsHasMore, setConversationsHasMore] = useState(false);
  const [conversationsTotal, setConversationsTotal] = useState<number | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [messagesPage, setMessagesPage] = useState(1);
  const [messagesHasMore, setMessagesHasMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingConversationTarget, setPendingConversationTarget] = useState<ConversationTargetPayload | null>(null);
  const [pendingConversationLabel, setPendingConversationLabel] = useState("Conversation");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);
  const lastHandledIntentTokenRef = useRef<number | null>(null);
  const openingComposeTargetRef = useRef(false);
  const messagesListRef = useRef<FlatList<MessageItem> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);

  const activeConversation = useMemo(
    () => conversations.find((item) => Number(item.id) === Number(activeConversationId)) ?? null,
    [conversations, activeConversationId],
  );
  const canReplyMessages = Boolean(
    canStartMessages ||
    (
      isParentOrTeacher &&
      activeConversation &&
      (
        activeConversation.type === "direct" ||
        (roles.includes("parent") && Number(activeConversation.allow_parent_reply) === 1) ||
        (roles.includes("teacher") && Number(activeConversation.allow_teacher_reply) === 1)
      )
    ) ||
    (!activeConversationId && pendingConversationTarget?.target_type === "admin")
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
        teacherScopes: Set<string>;
        staffTypes: Set<string>;
        studentNames: Set<string>;
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
        teacherScopes: new Set<string>(),
        staffTypes: new Set<string>(),
        studentNames: new Set<string>(),
      };
      existing.roleSet.add("parent");
      if (item.class_id) existing.classIds.add(String(item.class_id));
      if (item.section_id) existing.sectionIds.add(String(item.section_id));
      if (item.class_name) existing.classNames.add(String(item.class_name));
      if (item.section_name) existing.sectionNames.add(String(item.section_name));
      if (item.student_name) {
        const rollNumber = String(item.roll_number ?? "").trim();
        const studentLabel = rollNumber ? `${item.student_name} (Roll ${rollNumber})` : item.student_name;
        existing.studentNames.add(String(studentLabel));
      }
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
        teacherScopes: new Set<string>(),
        staffTypes: new Set<string>(),
        studentNames: new Set<string>(),
      };
      existing.roleSet.add("teacher");
      if (item.class_id) existing.classIds.add(String(item.class_id));
      if (item.section_id) existing.sectionIds.add(String(item.section_id));
      if (item.class_name) existing.classNames.add(String(item.class_name));
      if (item.section_name) existing.sectionNames.add(String(item.section_name));
      if (item.phone) existing.phones.add(String(item.phone));
      if (item.email) existing.emails.add(String(item.email));
      const teacherScope = normalizeTeacherScope(item.type || item.class_scope);
      const staffType = normalizeStaffType(item.staff_type || "teaching");
      if (teacherScope !== "all") existing.teacherScopes.add(teacherScope);
      if (staffType !== "all") existing.staffTypes.add(staffType);
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
        teacherScopes: Array.from(item.teacherScopes),
        staffTypes: Array.from(item.staffTypes),
        studentNames: Array.from(item.studentNames),
      }))
      .filter((item) => {
        if (targetRole !== "all" && !item.roles.includes(targetRole)) return false;
        if (composeClassFilter && !item.classIds.includes(composeClassFilter)) return false;
        if (composeSectionFilter && !item.sectionIds.includes(composeSectionFilter)) return false;
        if (
          composeTeacherScopeFilter !== "all" &&
          item.roles.includes("teacher") &&
          !item.teacherScopes.includes(composeTeacherScopeFilter)
        ) {
          return false;
        }
        if (
          composeStaffTypeFilter !== "all" &&
          item.roles.includes("teacher") &&
          !item.staffTypes.includes(composeStaffTypeFilter)
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
          item.teacherScopes.join(" "),
          item.staffTypes.join(" "),
          item.studentNames.join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [targets, compose.target_type, composeRoleFilter, composeSearch, composeClassFilter, composeSectionFilter, composeTeacherScopeFilter, composeStaffTypeFilter]);
  const selectedRecipient = useMemo(
    () => recipientOptions.find((item) => String(item.user_id) === compose.recipient_user_id) ?? null,
    [recipientOptions, compose.recipient_user_id],
  );
  const visibleRecipientOptions = useMemo(
    () => (showAllRecipients ? recipientOptions : recipientOptions.slice(0, RECIPIENTS_INITIAL_LIMIT)),
    [recipientOptions, showAllRecipients],
  );
  const hiddenRecipientCount = Math.max(recipientOptions.length - visibleRecipientOptions.length, 0);
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
  const groupTargetValues = useMemo(
    () => new Set<string>([
      ...GROUP_TARGET_TYPES,
      ...targets.broadcast_targets.map((item) => String(item.key)).filter(Boolean),
    ]),
    [targets.broadcast_targets],
  );
  const isComposeGroupTarget = groupTargetValues.has(String(compose.target_type));
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
  const selectedClass = useMemo(
    () => targets.classes.find((item) => String(item.id) === compose.class_id) ?? null,
    [targets.classes, compose.class_id],
  );
  const selectedSection = useMemo(
    () => targets.sections.find((item) => String(item.id) === compose.section_id) ?? null,
    [targets.sections, compose.section_id],
  );
  const defaultConversationName = useMemo(() => {
    if (compose.target_type === "class") return selectedClass ? `Class ${selectedClass.name}` : "";
    if (compose.target_type === "section") {
      return selectedSection ? `Section ${selectedSection.class_name} ${selectedSection.name}` : "";
    }
    if (compose.target_type === "broadcast") return "All Users";
    if (compose.target_type === "all_classes") return "All Classes";
    if (compose.target_type === "all_sections") return "All Sections";
    if (compose.target_type === "all_parents") return "All Parents";
    if (compose.target_type === "all_teachers") {
      return formatTeacherAudienceName(compose.teacher_scope, compose.staff_type);
    }
    return "";
  }, [compose.target_type, compose.teacher_scope, compose.staff_type, selectedClass, selectedSection]);
  const effectiveConversationName = compose.name.trim() || defaultConversationName;
  const targetRecipientCount = useMemo(() => {
    if (["direct", "parent", "teacher"].includes(compose.target_type)) return selectedRecipient ? 1 : 0;
    if (compose.target_type === "class" && compose.class_id) {
      return new Set(targets.parents.filter((item) => String(item.class_id) === compose.class_id).map((item) => item.user_id).filter(Boolean)).size;
    }
    if (compose.target_type === "section" && compose.section_id) {
      return new Set(targets.parents.filter((item) => String(item.section_id) === compose.section_id).map((item) => item.user_id).filter(Boolean)).size;
    }
    if (compose.target_type === "all_parents" || compose.target_type === "all_classes" || compose.target_type === "all_sections") {
      return new Set(targets.parents.map((item) => item.user_id).filter(Boolean)).size;
    }
    if (compose.target_type === "all_teachers") {
      return new Set(targets.teachers.filter((item) => {
        const teacherScope = normalizeTeacherScope(item.type || item.class_scope);
        const staffType = normalizeStaffType(item.staff_type || "teaching");
        return (compose.teacher_scope === "all" || teacherScope === compose.teacher_scope) && (compose.staff_type === "all" || staffType === compose.staff_type);
      }).map((item) => item.user_id).filter(Boolean)).size;
    }
    if (compose.target_type === "broadcast") {
      return new Set([...targets.parents.map((item) => item.user_id), ...targets.teachers.map((item) => item.user_id)].filter(Boolean)).size;
    }
    return 0;
  }, [compose.target_type, compose.class_id, compose.section_id, compose.teacher_scope, compose.staff_type, selectedRecipient, targets.parents, targets.teachers]);
  const canContinueCompose = useMemo(() => {
    if (["direct", "parent", "teacher"].includes(compose.target_type)) return Boolean(compose.recipient_user_id);
    if (compose.target_type === "class") return Boolean(compose.class_id);
    if (compose.target_type === "section") return Boolean(compose.section_id);
    if (isComposeGroupTarget) return Boolean(effectiveConversationName);
    return true;
  }, [compose, effectiveConversationName, isComposeGroupTarget]);
  const parentConversationUserIds = useMemo(
    () => new Set(targets.parents.map((item) => Number(item.user_id)).filter(Boolean)),
    [targets.parents],
  );
  const teacherConversationUserIds = useMemo(
    () => new Set(targets.teachers.map((item) => Number(item.user_id)).filter(Boolean)),
    [targets.teachers],
  );
  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conversations.filter((item) => {
      if (!conversationMatchesFilter(item, conversationFilter, parentConversationUserIds, teacherConversationUserIds)) return false;
      if (!query) return true;
      return [item.name, item.last_message, item.type].join(" - ").toLowerCase().includes(query);
    });
  }, [conversationFilter, conversations, parentConversationUserIds, search, teacherConversationUserIds]);
  const conversationFilterOptions = useMemo(
    () => [
      { label: "All", value: "all" as ConversationFilter, count: conversations.length },
      { label: "Unread", value: "unread" as ConversationFilter, count: conversations.filter((item) => conversationMatchesFilter(item, "unread", parentConversationUserIds, teacherConversationUserIds)).length },
      { label: "One-to-One", value: "direct" as ConversationFilter, count: conversations.filter((item) => conversationMatchesFilter(item, "direct", parentConversationUserIds, teacherConversationUserIds)).length },
      { label: "Parents", value: "parents" as ConversationFilter, count: conversations.filter((item) => conversationMatchesFilter(item, "parents", parentConversationUserIds, teacherConversationUserIds)).length },
      { label: "Teachers", value: "teachers" as ConversationFilter, count: conversations.filter((item) => conversationMatchesFilter(item, "teachers", parentConversationUserIds, teacherConversationUserIds)).length },
      { label: "Classes", value: "class" as ConversationFilter, count: conversations.filter((item) => conversationMatchesFilter(item, "class", parentConversationUserIds, teacherConversationUserIds)).length },
      { label: "Sections", value: "section" as ConversationFilter, count: conversations.filter((item) => conversationMatchesFilter(item, "section", parentConversationUserIds, teacherConversationUserIds)).length },
      { label: "Broadcasts", value: "broadcast" as ConversationFilter, count: conversations.filter((item) => conversationMatchesFilter(item, "broadcast", parentConversationUserIds, teacherConversationUserIds)).length },
    ],
    [conversations, parentConversationUserIds, teacherConversationUserIds],
  );

  useEffect(() => {
    void loadBootstrap();
  }, []);

  useEffect(() => {
    if (!isVisible || !isFocused) return;
    void loadConversations(true);
  }, [isFocused, isVisible]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const nextHeight = Number(event?.endCoordinates?.height || 0);
      setKeyboardHeight(nextHeight > 0 ? nextHeight : 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (screen !== "chat" || !activeConversationId) return;
    void loadMessagesForConversation(activeConversationId, false, { scrollToLatest: true, mode: "reset" });
  }, [activeConversationId, screen]);

  useEffect(() => {
    onConversationViewChange?.(isVisible && screen === "chat");
    return () => onConversationViewChange?.(false);
  }, [onConversationViewChange, screen, isVisible]);

  useEffect(() => {
    if (screen !== "chat") return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closeChatView();
      return true;
    });
    return () => subscription.remove();
  }, [screen]);

  useEffect(() => {
    if (!isVisible) return undefined;
    const timer = setInterval(() => {
      void loadConversations(true);
      if (screen === "chat" && activeConversationId) {
        void loadMessagesForConversation(activeConversationId, true, { mode: "poll" });
        if (activeConversation?.type === "direct") {
          void getTyping(activeConversationId).then(setTypingUserIds).catch(() => {});
        }
      }
    }, MESSAGE_SYNC_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [activeConversation?.type, activeConversationId, screen, isVisible]);

  useEffect(() => {
    if (
      !isVisible ||
      screen !== "chat" ||
      !activeConversationId ||
      activeConversation?.type !== "direct"
    ) {
      setTypingUserIds([]);
      return undefined;
    }
    const loadTyping = () => {
      void getTyping(activeConversationId).then(setTypingUserIds).catch(() => {});
    };
    loadTyping();
    const timer = setInterval(loadTyping, 1500);
    return () => clearInterval(timer);
  }, [activeConversation?.type, activeConversationId, isVisible, screen]);

  useEffect(() => {
    const intent = parentConversationIntent;
    if (!intent?.token) return;
    if (lastHandledIntentTokenRef.current === intent.token) return;
    const targetType = intent.targetType === "teacher" ? "teacher" : "parent";

    lastHandledIntentTokenRef.current = intent.token;
    const payload: ConversationTargetPayload = {
      target_type: targetType,
      recipient_user_id: Number(intent.recipientUserId),
    };
    openingComposeTargetRef.current = true;
    setPendingConversationTarget(payload);
    setPendingConversationLabel(intent.recipientName || "Conversation");
    setActiveConversationId(null);
    setMessages([]);
    setMessagesPage(1);
    setMessagesHasMore(false);
    setReply("");
    setScreen("chat");
    onParentConversationIntentHandled?.(intent.token);
  }, [parentConversationIntent, onParentConversationIntentHandled]);

  useEffect(() => {
    const intent = composeTargetIntent;
    if (!intent?.token) return;
    openingComposeTargetRef.current = true;
    const existing = findConversationForTarget(intent.payload);
    setPendingConversationLabel(intent.label || "Conversation");
    setReply("");
    setMessages([]);
    setMessagesPage(1);
    setMessagesHasMore(false);
    if (existing?.id) {
      const conversationId = Number(existing.id);
      setPendingConversationTarget(null);
      setActiveConversationId(conversationId);
      setScreen("chat");
      void loadMessagesForConversation(conversationId, true, { scrollToLatest: true, mode: "reset" })
        .finally(() => {
          openingComposeTargetRef.current = false;
        });
    } else {
      setPendingConversationTarget(intent.payload);
      setActiveConversationId(null);
      setScreen("chat");
    }
    onComposeTargetHandled?.(intent.token);
  }, [composeTargetIntent, onComposeTargetHandled]);

  useEffect(() => {
    setShowAllRecipients(false);
  }, [compose.target_type, composeSearch, composeRoleFilter, composeClassFilter, composeSectionFilter, composeTeacherScopeFilter, composeStaffTypeFilter]);

  async function loadBootstrap() {
    await Promise.all([
      loadConversations(),
      canStartMessages ? loadTargets() : Promise.resolve(),
    ]);
  }

  async function loadConversations(silent = false, mode: "reset" | "loadMore" = "reset") {
    if (mode === "loadMore") {
      if (loadingMoreConversations || !conversationsHasMore) return;
      setLoadingMoreConversations(true);
    } else if (!silent) {
      setLoadingConversations(true);
    }

    try {
      const nextPage = mode === "loadMore" ? conversationsPage + 1 : 1;
      const result = await getConversations({ page: nextPage, limit: CONVERSATIONS_PAGE_SIZE });
      const rows = result.data || [];

      if (mode === "loadMore") {
        setConversations((prev) => {
          const ids = new Set(prev.map((item) => Number(item.id)));
          return [...prev, ...rows.filter((item) => !ids.has(Number(item.id)))];
        });
      } else {
        setConversations(rows);
      }
      setConversationsPage(nextPage);
      setConversationsTotal(result.pagination?.total ?? null);
      if (result.pagination) {
        setConversationsHasMore(nextPage < Number(result.pagination.totalPages || 0));
      } else {
        setConversationsHasMore(rows.length >= CONVERSATIONS_PAGE_SIZE);
      }

      const shouldAutoSelectFirst =
        mode !== "loadMore" &&
        screen === "list" &&
        !pendingConversationTarget &&
        !openingComposeTargetRef.current;
      if (shouldAutoSelectFirst) {
        setActiveConversationId((prev) => {
          const hasPrevious = prev !== null && rows.some((item) => Number(item.id) === Number(prev));
          if (hasPrevious) return prev;
          if (rows.length) return Number(rows[0].id);
          return null;
        });
      }
    } catch (err) {
      if (!silent) {
        Alert.alert("Error", getErrorMessage(err, "Could not load conversations."));
      }
      if (mode !== "loadMore") {
        setConversations([]);
        setConversationsPage(1);
        setConversationsHasMore(false);
        setConversationsTotal(null);
      }
    } finally {
      if (mode === "loadMore") {
        setLoadingMoreConversations(false);
      } else if (!silent) {
        setLoadingConversations(false);
      }
    }
  }

  async function loadTargets() {
    try {
      setTargets(await getTargets());
    } catch (err) {
      setTargets(EMPTY_TARGETS);
      setNotice({
        title: "Recipients unavailable",
        message: getErrorMessage(err, "Could not load recipients, classes, or sections."),
        tone: "error",
      });
    }
  }

  function scrollToLatestMessage(animated = true) {
    requestAnimationFrame(() => {
      messagesListRef.current?.scrollToOffset({ offset: 0, animated });
    });
  }

  function appendOlderMessages(existing: MessageItem[], older: MessageItem[]) {
    if (!older.length) return existing;
    const ids = new Set(existing.map((item) => Number(item.id)));
    const next = [...existing];
    older.forEach((item) => {
      if (!ids.has(Number(item.id))) {
        next.push(item);
      }
    });
    return next;
  }

  function mergeLatestMessages(existing: MessageItem[], latest: MessageItem[]) {
    if (!latest.length) return existing;
    const latestIds = new Set(latest.map((item) => Number(item.id)));
    return [...latest, ...existing.filter((item) => !latestIds.has(Number(item.id)))];
  }

  async function loadMessagesForConversation(
    conversationId: number,
    silent = false,
    options?: { scrollToLatest?: boolean; mode?: "reset" | "loadMore" | "poll" },
  ) {
    const mode = options?.mode ?? "reset";
    if (mode === "loadMore") {
      if (loadingMoreMessages || !messagesHasMore) return;
      setLoadingMoreMessages(true);
    } else if (!silent) {
      setLoadingMessages(true);
    }

    try {
      const nextPage = mode === "loadMore" ? messagesPage + 1 : 1;
      const rows = await getMessages(conversationId, nextPage, MESSAGE_PAGE_SIZE);

      if (mode === "loadMore") {
        setMessages((prev) => appendOlderMessages(prev, rows));
        setMessagesPage(nextPage);
        setMessagesHasMore(rows.length >= MESSAGE_PAGE_SIZE);
      } else if (mode === "poll" && messagesPage > 1) {
        setMessages((prev) => mergeLatestMessages(prev, rows));
        setMessagesHasMore(rows.length >= MESSAGE_PAGE_SIZE || messagesHasMore);
      } else {
        setMessages(rows);
        setMessagesPage(1);
        setMessagesHasMore(rows.length >= MESSAGE_PAGE_SIZE);
      }

      if (mode !== "loadMore") {
        await markAsRead(conversationId);
      }
      await loadConversations(true);
      if (options?.scrollToLatest) {
        scrollToLatestMessage(mode === "reset");
      }
    } catch (err) {
      if (!silent) {
        Alert.alert("Error", getErrorMessage(err, "Could not load messages."));
      }
      if (mode !== "loadMore") {
        setMessages([]);
        setMessagesPage(1);
        setMessagesHasMore(false);
      }
    } finally {
      if (mode === "loadMore") {
        setLoadingMoreMessages(false);
      } else if (!silent) {
        setLoadingMessages(false);
      }
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        loadConversations(true),
        canStartMessages ? loadTargets() : Promise.resolve(),
      ]);
      if (screen === "chat" && activeConversationId) {
        await loadMessagesForConversation(activeConversationId, true, { scrollToLatest: true, mode: "poll" });
      }
    } finally {
      setRefreshing(false);
    }
  }

  function resetComposeState() {
    setComposeOpen(false);
    setComposeStep("audience");
    setCompose(EMPTY_COMPOSE);
    setComposeSearch("");
    setComposeRoleFilter("all");
    setComposeClassFilter("");
    setComposeSectionFilter("");
    setComposeTeacherScopeFilter("all");
    setComposeStaffTypeFilter("all");
    setShowAllRecipients(false);
  }

  function closeChatView() {
    openingComposeTargetRef.current = false;
    setScreen("list");
    setReply("");
    setMessages([]);
    setMessagesPage(1);
    setMessagesHasMore(false);
    setPendingConversationTarget(null);
    setPendingConversationLabel("Conversation");
  }

  function buildConversationTargetPayload() {
    const payload: ConversationTargetPayload = {
      target_type: compose.target_type,
    };
    let label = "Conversation";

    if (["direct", "parent", "teacher"].includes(compose.target_type)) {
      if (!compose.recipient_user_id) {
        Alert.alert("Validation", "Choose a recipient.");
        return null;
      }
      payload.recipient_user_id = Number(compose.recipient_user_id);
      const selected = recipientOptions.find((item) => String(item.user_id) === compose.recipient_user_id);
      const selectedStudentLabel = selected?.studentNames?.join(", ").trim();
      label =
        compose.target_type === "parent" && selectedStudentLabel
          ? selectedStudentLabel
          : selected?.name || `User #${compose.recipient_user_id}`;
    }

    if (compose.target_type === "class") {
      if (!compose.class_id) {
        Alert.alert("Validation", "Choose a class.");
        return null;
      }
      payload.class_id = Number(compose.class_id);
      payload.name = compose.name.trim() || `Class ${targets.classes.find((item) => String(item.id) === compose.class_id)?.name || compose.class_id}`;
      label = payload.name;
    }

    if (compose.target_type === "section") {
      if (!compose.section_id) {
        Alert.alert("Validation", "Choose a section.");
        return null;
      }
      payload.section_id = Number(compose.section_id);
      const section = targets.sections.find((item) => String(item.id) === compose.section_id);
      payload.name = compose.name.trim() || `Section ${section?.class_name || ""} ${section?.name || compose.section_id}`.trim();
      label = payload.name;
    }

    if (compose.target_type === "broadcast") {
      payload.name = compose.name.trim() || "All Users";
      label = payload.name;
    }
    if (compose.target_type === "all_classes") {
      payload.name = compose.name.trim() || "All Classes";
      label = payload.name;
    }
    if (compose.target_type === "all_sections") {
      payload.name = compose.name.trim() || "All Sections";
      label = payload.name;
    }
    if (compose.target_type === "all_parents") {
      payload.name = compose.name.trim() || "All Parents";
      label = payload.name;
    }
    if (compose.target_type === "all_teachers") {
      payload.teacher_scope = compose.teacher_scope;
      payload.staff_type = compose.staff_type;
      payload.name = compose.name.trim() || formatTeacherAudienceName(compose.teacher_scope, compose.staff_type);
      label = payload.name;
    }

    return { payload, label };
  }

  function findConversationForTarget(payload: ConversationTargetPayload, rows: ConversationItem[] = conversations) {
    const targetType = payload.target_type;
    if (!targetType) return null;

    if (["direct", "parent", "teacher"].includes(targetType)) {
      const recipientUserId = Number(payload.recipient_user_id || 0);
      if (!recipientUserId) return null;
      return rows.find(
        (row) => row.type === "direct" && Number(row.other_user_id || 0) === recipientUserId,
      ) ?? null;
    }

    if (targetType === "class") {
      const classId = Number(payload.class_id || 0);
      if (!classId) return null;
      return rows.find((row) => row.type === "class" && Number(row.class_id || 0) === classId) ?? null;
    }

    if (targetType === "section") {
      const sectionId = Number(payload.section_id || 0);
      if (!sectionId) return null;
      return rows.find((row) => row.type === "section" && Number(row.section_id || 0) === sectionId) ?? null;
    }

    const targetName = String(payload.name || "").trim().toLowerCase();
    return rows.find(
      (row) =>
        row.type === "broadcast" &&
        String(row.name || "")
          .trim()
          .toLowerCase() === targetName,
    ) ?? null;
  }

  async function openNewConversationScreen() {
    const prepared = buildConversationTargetPayload();
    if (!prepared) return;

    setSending(true);
    try {
      const { payload, label } = prepared;
      const existing = findConversationForTarget(payload);

      resetComposeState();
      openingComposeTargetRef.current = true;
      setPendingConversationLabel(label);
      setReply("");

      if (existing?.id) {
        const conversationId = Number(existing.id);
        setPendingConversationTarget(null);
        setMessages([]);
        setMessagesPage(1);
        setMessagesHasMore(false);
        setActiveConversationId(conversationId);
        setScreen("chat");
        await loadMessagesForConversation(conversationId, true, { scrollToLatest: true, mode: "reset" });
        openingComposeTargetRef.current = false;
        setNotice({ title: "Conversation opened", message: "Send your message below.", tone: "success" });
        return;
      }

      setPendingConversationTarget(payload);
      setActiveConversationId(null);
      setMessages([]);
      setMessagesPage(1);
      setMessagesHasMore(false);
      setScreen("chat");
      setNotice({ title: "Conversation ready", message: "Type your message below to start.", tone: "success" });
    } catch (err) {
      Alert.alert("Open failed", getErrorMessage(err, "Could not open conversation."));
    } finally {
      setSending(false);
    }
  }

  async function pickImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow photo access to send images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 1,
    });
    if (result.canceled) return;
    setSelectedAssets(
      result.assets.slice(0, 5).map((asset, index) => ({
        uri: asset.uri,
        name: asset.fileName || `photo-${Date.now()}-${index}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      })),
    );
    setSelectedCategory("image");
  }

  async function pickDocuments() {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
        "text/plain",
      ],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    setSelectedAssets(
      result.assets.slice(0, 5).map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || "application/octet-stream",
      })),
    );
    setSelectedCategory("document");
  }

  async function startVoiceRecording() {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow microphone access to record voice messages.");
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record({ forDuration: 600 });
    setSelectedAssets([]);
    setSelectedCategory("voice");
  }

  async function stopVoiceRecording() {
    await recorder.stop();
    if (!recorder.uri) {
      Alert.alert("Recording failed", "The voice note could not be saved.");
      return;
    }
    const extension = Platform.OS === "ios" ? "m4a" : "m4a";
    setSelectedAssets([
      {
        uri: recorder.uri,
        name: `voice-${Date.now()}.${extension}`,
        mimeType: "audio/mp4",
      },
    ]);
    setSelectedCategory("voice");
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  }

  function clearSelectedMedia() {
    setSelectedAssets([]);
    setSelectedCategory(null);
  }

  async function runChatSearch() {
    if (!activeConversationId) return;
    if (!chatSearch.trim()) {
      await loadMessagesForConversation(activeConversationId, true, { mode: "reset" });
      return;
    }
    const rows = await searchMessages(activeConversationId, chatSearch.trim());
    setMessages(rows);
  }

  function openMessageActions(message: MessageItem) {
    const mine = Number(message.sender_id) === Number(user?.id);
    const buttons = [
      ...(canReplyMessages
        ? [
          { text: "Reply", onPress: () => setReplyTo(message) },
          ...(canStartMessages
            ? [{
              text: "Forward",
              onPress: () => {
                setForwardingMessage(message);
                clearConversationSelection();
                setScreen("list");
              },
            }]
            : []),
        ]
        : []),
      ...(canStartMessages && mine && message.message
        ? [{ text: "Edit", onPress: () => {
          setEditingMessageId(message.id);
          setReply(message.message || "");
        } }]
        : []),
      {
        text: "Delete for me",
        style: "destructive" as const,
        onPress: async () => {
          await deleteMessage(message.id, "self");
          if (activeConversationId) await loadMessagesForConversation(activeConversationId, true, { mode: "poll" });
        },
      },
      ...(canStartMessages && (mine || isSuperAdmin)
        ? [{
          text: "Delete for everyone",
          style: "destructive" as const,
          onPress: async () => {
            await deleteMessage(message.id, "everyone");
            if (activeConversationId) await loadMessagesForConversation(activeConversationId, true, { mode: "poll" });
          },
        }]
        : []),
      ...(!mine
        ? [{
          text: "Report",
          onPress: async () => {
            await reportMessage(message.id, "Inappropriate content");
            Alert.alert("Reported", "The message was sent to moderation.");
          },
        }]
        : []),
      { text: "Cancel", style: "cancel" as const },
    ];
    Alert.alert("Message actions", "Choose an action", buttons, { cancelable: true });
  }

  async function sendReply() {
    if (!canReplyMessages) {
      Alert.alert("View only", "Replies are not enabled for this conversation.");
      return;
    }
    const trimmed = reply.trim();
    if (!trimmed && !selectedAssets.length && !editingMessageId) return;
    if (!activeConversationId && !pendingConversationTarget) {
      Alert.alert("Validation", "Open a conversation first.");
      return;
    }

    setSending(true);
    try {
      if (editingMessageId) {
        await editMessage(editingMessageId, trimmed);
        setEditingMessageId(null);
        setReply("");
        if (activeConversationId) {
          await loadMessagesForConversation(activeConversationId, true, { mode: "poll" });
        }
        return;
      }

      let conversationId = activeConversationId ? Number(activeConversationId) : null;
      let attachmentIds: number[] = [];
      if (selectedAssets.length && selectedCategory) {
        const uploaded = await uploadMessageAttachments(selectedAssets, selectedCategory);
        attachmentIds = uploaded.map((item) => item.id);
      }

      if (conversationId) {
        await sendMessage({
          conversation_id: conversationId,
          message: trimmed,
          attachment_ids: attachmentIds,
          reply_to_message_id: replyTo?.id,
        });
      } else if (pendingConversationTarget) {
        const result = await sendMessage({
          ...pendingConversationTarget,
          message: trimmed,
          attachment_ids: attachmentIds,
          reply_to_message_id: replyTo?.id,
        });
        conversationId = result.conversation_id ? Number(result.conversation_id) : null;

        if (!conversationId) {
          const rows = (await getConversations({ page: 1, limit: CONVERSATIONS_PAGE_SIZE })).data;
          setConversations(rows);
          setConversationsPage(1);
          setConversationsHasMore(rows.length >= CONVERSATIONS_PAGE_SIZE);
          setConversationsTotal(null);
          conversationId = Number(findConversationForTarget(pendingConversationTarget, rows)?.id || 0) || null;
        }

        setPendingConversationTarget(null);
        openingComposeTargetRef.current = false;
        if (conversationId) {
          setActiveConversationId(conversationId);
        }
      }

      setReply("");
      setReplyTo(null);
      clearSelectedMedia();
      if (conversationId) {
        await loadMessagesForConversation(conversationId, true, { scrollToLatest: true, mode: "poll" });
      }
    } catch (err) {
      if (editingMessageId) {
        setFailedMessageIds((prev) => [...new Set([...prev, editingMessageId])]);
      }
    } finally {
      setSending(false);
    }
  }

  function confirmDeleteConversation(conversation: ConversationItem) {
    Alert.alert(
      "Delete chat?",
      "This will remove the chat from your list only. Other people will still see it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteConversation(Number(conversation.id));
              setConversations((prev) => prev.filter((item) => Number(item.id) !== Number(conversation.id)));
              if (Number(activeConversationId) === Number(conversation.id)) {
                closeChatView();
              }
              setNotice({ title: "Chat deleted", message: "The chat was removed from your list.", tone: "success" });
            } catch (err) {
              Alert.alert("Delete failed", getErrorMessage(err, "Could not delete this chat."));
            }
          },
        },
      ],
      { cancelable: true },
    );
  }

  function toggleConversationSelection(conversationId: number) {
    setSelectedConversationIds((prev) =>
      prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId],
    );
  }

  function clearConversationSelection() {
    setSelectedConversationIds([]);
  }

  function cancelForwarding() {
    setForwardingMessage(null);
    clearConversationSelection();
  }

  async function forwardToSelectedConversations() {
    if (!forwardingMessage || !selectedConversationIds.length) return;
    const targetIds = [...selectedConversationIds];
    try {
      await Promise.all(
        targetIds.map((conversationId) =>
          sendMessage({
            conversation_id: conversationId,
            forwarded_from_message_id: forwardingMessage.id,
            message: "",
          }),
        ),
      );
      setForwardingMessage(null);
      clearConversationSelection();
      await loadConversations(false, "reset");
    } catch (err) {
      setFailedMessageIds((prev) => [...new Set([...prev, forwardingMessage.id])]);
      setForwardingMessage(null);
      clearConversationSelection();
    }
  }

  function confirmDeleteSelectedConversations() {
    const ids = [...selectedConversationIds];
    if (!ids.length) return;
    Alert.alert(
      `Delete ${ids.length} chat${ids.length === 1 ? "" : "s"}?`,
      "This will remove the selected chats from your list only. Other people will still see them.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await Promise.all(ids.map((id) => deleteConversation(id)));
              setConversations((prev) => prev.filter((item) => !ids.includes(Number(item.id))));
              if (activeConversationId !== null && ids.includes(Number(activeConversationId))) {
                closeChatView();
              }
              clearConversationSelection();
              setNotice({ title: "Chats deleted", message: "Selected chats were removed from your list.", tone: "success" });
            } catch (err) {
              Alert.alert("Delete failed", getErrorMessage(err, "Could not delete the selected chats."));
            }
          },
        },
      ],
      { cancelable: true },
    );
  }

  function startNewConversationFlow() {
    navigation.navigate("MessagingCompose");
  }

  function selectAudience(value: Compose["target_type"]) {
    setCompose((prev) => ({
      ...prev,
      target_type: value,
      recipient_user_id: "",
      class_id: "",
      section_id: "",
      teacher_scope: "all",
      staff_type: "all",
      name: "",
    }));
    setComposeSearch("");
    setComposeRoleFilter("all");
    setComposeClassFilter("");
    setComposeSectionFilter("");
    setComposeTeacherScopeFilter("all");
    setComposeStaffTypeFilter("all");
    setShowAllRecipients(false);
    setComposeStep("target");
  }

  function renderAudienceCard(option: { label: string; value: string; description?: string }) {
    const value = option.value as Compose["target_type"];
    return (
      <Pressable
        key={option.value}
        style={[styles.audienceCard, { borderColor: theme.border, backgroundColor: theme.card }]}
        onPress={() => selectAudience(value)}
      >
        <View style={[styles.audienceIcon, { backgroundColor: isDark ? theme.cardMuted : "#fff7ed" }]}>
          <Ionicons name={audienceIcon(value)} size={20} color={theme.success} />
        </View>
        <View style={styles.audienceCopy}>
          <Text style={[styles.audienceTitle, { color: theme.text }]}>{option.label}</Text>
          <Text style={[styles.audienceDesc, { color: theme.subText }]}>
            {option.description || (groupTargetValues.has(String(value)) ? "Choose a group and name the conversation" : "Pick one recipient")}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.icon} />
      </Pressable>
    );
  }

  function renderGroupNameInput() {
    if (!isComposeGroupTarget) return null;
    return (
      <View style={styles.composeSection}>
        <Text style={[styles.inputLabel, { color: theme.text }]}>Conversation Name</Text>
        <TextInput
          value={compose.name}
          onChangeText={(value) => setCompose((prev) => ({ ...prev, name: value }))}
          placeholder={defaultConversationName || "Name this conversation"}
          placeholderTextColor={theme.mutedText}
          style={[styles.searchInputBox, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
        />
        <Text style={[styles.rowMeta, { color: theme.subText }]}>
          {effectiveConversationName ? `Will appear as: ${effectiveConversationName}` : "This name helps identify the group thread later."}
        </Text>
      </View>
    );
  }

  function renderTargetDetails() {
    if (["direct", "parent", "teacher"].includes(compose.target_type)) {
      return (
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
          <SelectField label="Class" value={composeClassFilter} options={classOptions} onChange={(value) => { setComposeClassFilter(value); setComposeSectionFilter(""); }} allowClear clearLabel="All Classes" />
          <SelectField label="Section" value={composeSectionFilter} options={filteredSectionOptions} onChange={setComposeSectionFilter} allowClear clearLabel="All Sections" />
          {(compose.target_type === "teacher" || (compose.target_type === "direct" && composeRoleFilter !== "parent")) ? (
            <>
              <SelectField
                label="Scope"
                value={composeTeacherScopeFilter}
                options={[
                  { label: "All Scopes", value: "all" },
                  { label: "School", value: "school" },
                  { label: "College", value: "college" },
                ]}
                onChange={(value) => setComposeTeacherScopeFilter(value as "all" | "school" | "college")}
              />
              <SelectField
                label="Staff Type"
                value={composeStaffTypeFilter}
                options={[
                  { label: "All Staff Types", value: "all" },
                  { label: "Teaching", value: "teaching" },
                  { label: "Non Teaching", value: "non_teaching" },
                ]}
                onChange={(value) => setComposeStaffTypeFilter(value as "all" | "teaching" | "non_teaching")}
              />
            </>
          ) : null}

          {selectedRecipient ? (
            <View style={[styles.selectedCard, { borderColor: "#fed7aa", backgroundColor: isDark ? theme.cardMuted : "#fff7ed" }]}>
              <Text style={[styles.selectedLabel, { color: theme.success }]}>Selected Recipient</Text>
              <Text style={[styles.rowTitle, { color: theme.text }]}>
                {compose.target_type === "parent" && selectedRecipient.studentNames.length ? selectedRecipient.studentNames.join(", ") : selectedRecipient.name}
              </Text>
              <Text style={[styles.rowMeta, { color: theme.subText }]}>
                {compose.target_type === "parent" && selectedRecipient.studentNames.length ? `Parent: ${selectedRecipient.name}` : selectedRecipient.roles.join(", ")}
                {selectedRecipient.phones[0] ? ` - ${selectedRecipient.phones[0]}` : ""}
                {selectedRecipient.classNames.length ? ` - ${selectedRecipient.classNames.join(", ")}` : ""}
                {selectedRecipient.sectionNames.length ? ` - ${selectedRecipient.sectionNames.join(", ")}` : ""}
              </Text>
            </View>
          ) : null}

          {visibleRecipientOptions.map((item) => {
            const active = compose.recipient_user_id === String(item.user_id);
            const isParentRow = compose.target_type === "parent" && item.roles.includes("parent");
            const rowTitle = isParentRow && item.studentNames.length ? item.studentNames.join(", ") : item.name;
            const rowMetaPrefix = isParentRow && item.studentNames.length ? `Parent: ${item.name}` : item.roles.join(", ");
            return (
              <Pressable
                key={item.user_id}
                style={[styles.targetRow, { borderColor: active ? theme.success : theme.border, backgroundColor: active ? (isDark ? theme.cardMuted : "#fff7ed") : theme.card }]}
                onPress={() => setCompose((prev) => ({ ...prev, recipient_user_id: String(item.user_id) }))}
              >
                <Text style={[styles.rowTitle, { color: active ? theme.success : theme.text }]}>{rowTitle}</Text>
                <Text style={[styles.rowMeta, { color: theme.subText }]}>
                  {rowMetaPrefix}
                  {item.phones[0] ? ` - ${item.phones[0]}` : ""}
                  {item.classNames.length ? ` - ${item.classNames.join(", ")}` : ""}
                  {item.sectionNames.length ? ` - ${item.sectionNames.join(", ")}` : ""}
                </Text>
              </Pressable>
            );
          })}
          {hiddenRecipientCount > 0 ? (
            <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.cardMuted }]} onPress={() => setShowAllRecipients(true)}>
              <Text style={[styles.secondaryText, { color: theme.text }]}>Show {hiddenRecipientCount} More Recipients</Text>
            </Pressable>
          ) : null}
          {!recipientOptions.length ? (
            <View style={[styles.emptyInline, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
              <Text style={[styles.rowMeta, { color: theme.subText }]}>No matching recipients found.</Text>
            </View>
          ) : null}
        </View>
      );
    }

    if (compose.target_type === "class") {
      return (
        <View style={styles.composeSection}>
          <SelectField label="Class" value={compose.class_id} options={classOptions} onChange={(value) => setCompose((prev) => ({ ...prev, class_id: value, name: "" }))} />
          {renderGroupNameInput()}
        </View>
      );
    }

    if (compose.target_type === "section") {
      return (
        <View style={styles.composeSection}>
          <SelectField label="Class" value={compose.class_id} options={classOptions} onChange={(value) => setCompose((prev) => ({ ...prev, class_id: value, section_id: "", name: "" }))} />
          <SelectField label="Section" value={compose.section_id} options={sectionOptions} onChange={(value) => setCompose((prev) => ({ ...prev, section_id: value, name: "" }))} />
          {renderGroupNameInput()}
        </View>
      );
    }

    return (
      <View style={styles.composeSection}>
        {compose.target_type === "all_teachers" ? (
          <>
            <SelectField
              label="Scope"
              value={compose.teacher_scope}
              options={[
                { label: "All Scopes", value: "all" },
                { label: "School", value: "school" },
                { label: "College", value: "college" },
              ]}
              onChange={(value) => setCompose((prev) => ({ ...prev, teacher_scope: value as Compose["teacher_scope"], name: "" }))}
            />
            <SelectField
              label="Staff Type"
              value={compose.staff_type}
              options={[
                { label: "All Staff Types", value: "all" },
                { label: "Teaching", value: "teaching" },
                { label: "Non Teaching", value: "non_teaching" },
              ]}
              onChange={(value) => setCompose((prev) => ({ ...prev, staff_type: value as Compose["staff_type"], name: "" }))}
            />
          </>
        ) : null}
        {renderGroupNameInput()}
      </View>
    );
  }

  function renderComposeScreen() {
    const audienceGroups = [
      { title: "One Person", values: ["parent", "teacher"] },
      { title: "Class Or Section", values: ["section", "class", "all_classes"] },
      { title: "Whole Group", values: ["all_parents", "all_teachers", "broadcast", "all_sections"] },
    ];
    const optionsByValue = new Map(targetTypeOptions.map((option) => [option.value, option]));
    return (
      <KeyboardAvoidingView
        style={[styles.screen, { backgroundColor: theme.bg, paddingTop: Math.max(insets.top, 10) }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <TopNotice notice={notice} style={styles.topNoticeOverlay} />
        <View style={[styles.composeHeader, { borderBottomColor: theme.border }]}>
          <Pressable style={[styles.iconBtn, { backgroundColor: theme.cardMuted, borderColor: theme.border }]} onPress={() => composeStep === "audience" ? resetComposeState() : setComposeStep("audience")}>
            <Ionicons name="arrow-back-outline" size={20} color={theme.icon} />
          </Pressable>
          <View style={styles.chatHeaderCopy}>
            <Text style={[styles.heroEyebrow, { color: theme.subText }]}>Step {composeStep === "audience" ? "1" : "2"} of 2</Text>
            <Text style={[styles.heroTitle, { color: theme.text }]}>New Conversation</Text>
          </View>
        </View>
        {composeStep === "audience" ? (
          <ScrollView contentContainerStyle={styles.composeScreenContent} showsVerticalScrollIndicator={false}>
            {audienceGroups.map((group) => (
              <View key={group.title} style={styles.composeSection}>
                <Text style={[styles.groupLabel, { color: theme.subText }]}>{group.title}</Text>
                {group.values.map((value) => {
                  const option = optionsByValue.get(value);
                  return option ? renderAudienceCard(option) : null;
                })}
              </View>
            ))}
          </ScrollView>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.composeScreenContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={[styles.identityCard, { borderColor: "#fed7aa", backgroundColor: isDark ? theme.cardMuted : "#fff7ed" }]}>
                <View style={[styles.audienceIcon, { backgroundColor: theme.card }]}>
                  <Ionicons name={audienceIcon(compose.target_type)} size={20} color={theme.success} />
                </View>
                <View style={styles.audienceCopy}>
                  <Text style={[styles.selectedLabel, { color: theme.success }]}>Sending To</Text>
                  <Text style={[styles.audienceTitle, { color: theme.text }]}>{targetTypeOptions.find((item) => item.value === compose.target_type)?.label || "Audience"}</Text>
                  <Text style={[styles.audienceDesc, { color: theme.subText }]}>
                    {targetRecipientCount ? `${targetRecipientCount} recipient${targetRecipientCount === 1 ? "" : "s"}` : "Select the target details"}
                  </Text>
                </View>
              </View>
              {renderTargetDetails()}
            </ScrollView>
            <View style={[styles.composeFooter, { borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
              <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setComposeStep("audience")}>
                <Text style={[styles.secondaryText, { color: theme.text }]}>Change Audience</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, { backgroundColor: theme.success }, !canContinueCompose && styles.btnDisabled]} onPress={() => void openNewConversationScreen()} disabled={!canContinueCompose || sending}>
                <Text style={styles.primaryText}>{sending ? "Opening..." : "Open Chat"}</Text>
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    );
  }

  return (
    <SafeAreaView edges={["left", "right"]} style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      {screen === "list" ? (
        <KeyboardAvoidingView
          style={[styles.screen, { backgroundColor: theme.bg }]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <TopNotice notice={notice} style={styles.topNoticeOverlay} />
          <FlatList
            style={styles.root}
            contentContainerStyle={styles.content}
            data={loadingConversations ? [] : filteredConversations}
            keyExtractor={(item) => String(item.id)}
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
            ListHeaderComponent={
              <View style={styles.innerContent}>
                <View style={styles.listTitleRow}>
                  {forwardingMessage ? (
                    <>
                      <Pressable style={[styles.listIconBtn, { backgroundColor: theme.cardMuted, borderColor: theme.border }]} onPress={cancelForwarding}>
                        <Ionicons name="close-outline" size={20} color={theme.icon} />
                      </Pressable>
                      <Text style={[styles.listTitle, { color: theme.text }]}>
                        {selectedConversationIds.length ? `${selectedConversationIds.length} selected` : "Forward to"}
                      </Text>
                      <Pressable
                        style={[styles.listIconBtn, { backgroundColor: theme.success, borderColor: theme.success }, !selectedConversationIds.length && styles.btnDisabled]}
                        onPress={() => void forwardToSelectedConversations()}
                        disabled={!selectedConversationIds.length}
                      >
                        <Ionicons name="send" size={18} color={theme.successText} />
                      </Pressable>
                    </>
                  ) : selectedConversationIds.length ? (
                    <>
                      <Pressable style={[styles.listIconBtn, { backgroundColor: theme.cardMuted, borderColor: theme.border }]} onPress={clearConversationSelection}>
                        <Ionicons name="close-outline" size={20} color={theme.icon} />
                      </Pressable>
                      <Text style={[styles.listTitle, { color: theme.text }]}>{selectedConversationIds.length} selected</Text>
                      <Pressable style={[styles.listIconBtn, { backgroundColor: theme.danger, borderColor: theme.danger }]} onPress={confirmDeleteSelectedConversations}>
                        <Ionicons name="trash-outline" size={19} color="#fff" />
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.listTitle, { color: theme.text }]}>Messaging</Text>
                      <View style={styles.listTitleActions}>
                        <Pressable style={[styles.listIconBtn, { backgroundColor: theme.cardMuted, borderColor: theme.border }]} onPress={() => void onRefresh()}>
                          <Ionicons name="refresh-outline" size={19} color={theme.icon} />
                        </Pressable>
                        {canStartMessages ? (
                          <Pressable
                            style={[
                              styles.newMessageBtn,
                              {
                                backgroundColor: theme.primary,
                                shadowColor: theme.primary,
                              },
                            ]}
                            onPress={startNewConversationFlow}
                          >
                            <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.primaryText} />
                            <Text style={[styles.newMessageBtnText, { color: theme.primaryText }]}>New Message</Text>
                          </Pressable>
                        ) : isParentOrTeacher ? (
                          <Pressable
                            style={[
                              styles.newMessageBtn,
                              {
                                backgroundColor: theme.primary,
                                shadowColor: theme.primary,
                              },
                            ]}
                            onPress={() => {
                              setPendingConversationTarget({ target_type: "admin" });
                              setPendingConversationLabel("Admin");
                              setActiveConversationId(null);
                              setMessages([]);
                              setScreen("chat");
                            }}
                          >
                            <Ionicons name="shield-checkmark-outline" size={16} color={theme.primaryText} />
                            <Text style={[styles.newMessageBtnText, { color: theme.primaryText }]}>Admin</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </>
                  )}
                </View>

                <View style={[styles.searchWrap, { borderColor: theme.border, backgroundColor: isDark ? "#1f2933" : theme.card }]}>
                  <Ionicons name="search-outline" size={22} color={theme.mutedText} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search conversations"
                    placeholderTextColor={theme.mutedText}
                    style={[styles.searchInput, { color: theme.text }]}
                  />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterChipRow}
                >
                  {conversationFilterOptions.map((option) => {
                    const active = conversationFilter === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        style={[
                          styles.filterChip,
                          {
                            borderColor: active ? theme.success : theme.border,
                            backgroundColor: active ? theme.successSoft : "transparent",
                          },
                        ]}
                        onPress={() => setConversationFilter(option.value)}
                      >
                        <Text style={[styles.filterChipText, { color: active ? theme.success : theme.subText }]}>
                          {option.label}
                        </Text>
                        {option.count > 0 ? (
                          <Text style={[styles.filterChipCount, { color: active ? theme.success : theme.mutedText }]}>
                            {option.count}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Text style={[styles.rowMeta, { color: theme.subText }]}>
                  {filteredConversations.length} visible
                  {conversationsTotal !== null ? ` | ${conversations.length}/${conversationsTotal} loaded` : ""}
                </Text>
              </View>
            }
            ListEmptyComponent={
              loadingConversations ? (
                <View style={styles.centered}><ActivityIndicator size="small" color={theme.icon} /></View>
              ) : (
                <View style={[styles.emptyCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={24} color={theme.icon} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>No conversations</Text>
                  <Text style={[styles.emptyText, { color: theme.subText }]}>
                    {search.trim() ? "Try a different search." : "Your conversations will appear here."}
                  </Text>
                </View>
              )
            }
            ItemSeparatorComponent={null}
            ListFooterComponent={
              !loadingConversations && conversationsHasMore ? (
                <Pressable
                  style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
                  onPress={() => void loadConversations(true, "loadMore")}
                  disabled={loadingMoreConversations}
                >
                  <Text style={[styles.secondaryText, { color: theme.text }]}>
                    {loadingMoreConversations ? "Loading..." : "Load More Conversations"}
                  </Text>
                </Pressable>
              ) : null
            }
            renderItem={({ item: conversation }) => {
              const conversationId = Number(conversation.id);
              const selected = selectedConversationIds.includes(conversationId);
              return (
                <Pressable
                  style={[
                    styles.rowCard,
                    {
                      borderBottomColor: theme.border,
                      backgroundColor: selected ? theme.successSoft : theme.bg,
                    },
                  ]}
                  onLongPress={() => toggleConversationSelection(conversationId)}
                  onPress={async () => {
                    if (forwardingMessage) {
                      toggleConversationSelection(conversationId);
                      return;
                    }
                    if (selectedConversationIds.length) {
                      toggleConversationSelection(conversationId);
                      return;
                    }
                    setMessages([]);
                    setMessagesPage(1);
                    setMessagesHasMore(false);
                    setActiveConversationId(conversationId);
                    setScreen("chat");
                  }}
                >
                  <View style={styles.avatarSelectionWrap}>
                    <Avatar
                      label={conversation.name || conversation.type}
                      online={conversation.online}
                      imageUrl={conversation.other_user_image_url}
                      size="large"
                    />
                    {selected ? (
                      <View style={[styles.selectionBadge, { backgroundColor: theme.success }]}>
                        <Ionicons name="checkmark" size={14} color={theme.successText} />
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                      {conversation.name || conversation.type}
                    </Text>
                    {conversation.last_message_at ? (
                      <Text style={[styles.rowTime, { color: theme.subText }]} numberOfLines={1}>
                        {formatDateLabel(conversation.last_message_at)} {formatTimeLabel(conversation.last_message_at)}
                      </Text>
                    ) : null}
                    <View style={styles.rowBottom}>
                      <Text style={[styles.rowPreview, { color: theme.subText }]} numberOfLines={2}>
                        {conversation.last_message || "No messages yet"}
                      </Text>
                      {Number(conversation.unread || 0) > 0 ? <Text style={styles.unread}>{conversation.unread}</Text> : null}
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />

        </KeyboardAvoidingView>
      ) : (
        <KeyboardAvoidingView
          style={[styles.chatScreen, { backgroundColor: theme.bg }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? Math.max(insets.top, 8) : 0}
        >
          <TopNotice notice={notice} style={styles.topNoticeOverlay} />
          <View style={styles.chatInnerContent}>
            <View style={styles.chatHeroCard}>
              <View style={[styles.chatHeader, { borderBottomColor: theme.border, backgroundColor: theme.bg }]}>
                <Pressable style={[styles.iconBtn, { backgroundColor: theme.cardMuted, borderColor: theme.border }]} onPress={closeChatView}>
                  <Ionicons name="arrow-back-outline" size={20} color={theme.icon} />
                </Pressable>
                <Pressable
                  style={styles.chatHeaderIdentity}
                  disabled={!activeConversation || activeConversation.type === "direct" || !canStartMessages}
                  onPress={() => {
                    if (!activeConversation || activeConversation.type === "direct" || !canStartMessages) return;
                    navigation.navigate("MessagingConversationDetails", {
                      conversationId: Number(activeConversation.id),
                      name: activeConversation.name || "Conversation",
                      type: activeConversation.type,
                    });
                  }}
                >
                  <Avatar
                    label={activeConversation?.name || pendingConversationLabel || activeConversation?.type}
                    online={activeConversation?.online}
                    imageUrl={activeConversation?.other_user_image_url}
                  />
                  <View style={styles.chatHeaderCopy}>
                    <Text style={[styles.chatTitle, { color: theme.text }]} numberOfLines={1}>
                      {activeConversation?.name || pendingConversationLabel || "Chat"}
                    </Text>
                    <Text style={[styles.chatMeta, { color: theme.subText }]} numberOfLines={1}>
                      {typingUserIds.length
                        ? "Typing..."
                        : activeConversation
                          ? presenceText(activeConversation)
                      : "New conversation"}
                    </Text>
                  </View>
                </Pressable>
                {activeConversation ? (
                  <Pressable
                    style={[styles.iconBtn, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}
                    onPress={() => confirmDeleteConversation(activeConversation)}
                  >
                    <Ionicons name="trash-outline" size={19} color={theme.danger} />
                  </Pressable>
                ) : null}
                <Pressable
                  style={[styles.iconBtn, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}
                  onPress={() => setChatSearchOpen((value) => !value)}
                >
                  <Ionicons name="search-outline" size={20} color={theme.icon} />
                </Pressable>
              </View>
              {chatSearchOpen ? (
                <View style={[styles.searchWrap, { borderColor: theme.border, backgroundColor: theme.card }]}>
                  <TextInput
                    value={chatSearch}
                    onChangeText={setChatSearch}
                    placeholder="Search this conversation"
                    placeholderTextColor={theme.mutedText}
                    style={[styles.searchInput, { color: theme.text }]}
                    onSubmitEditing={() => void runChatSearch()}
                  />
                  <Pressable style={[styles.searchSubmitBtn, { borderColor: theme.border, backgroundColor: theme.cardMuted }]} onPress={() => void runChatSearch()}>
                    <Ionicons name="search" size={18} color={theme.icon} />
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={[styles.chatMessagesPanel, { backgroundColor: theme.bg }]}>
              <FlatList
                ref={messagesListRef}
                style={styles.chatMessagesScroll}
                contentContainerStyle={[styles.chatMessagesContent, { paddingBottom: 16 }]}
                showsVerticalScrollIndicator={false}
                data={messages}
                keyExtractor={(item) => String(item.id)}
                inverted
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                windowSize={9}
                onEndReachedThreshold={0.2}
                onEndReached={() => {
                  if (!activeConversationId || loadingMessages || loadingMoreMessages || !messagesHasMore) return;
                  void loadMessagesForConversation(activeConversationId, true, { mode: "loadMore" });
                }}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                ListFooterComponent={
                  loadingMoreMessages ? (
                    <View style={styles.centered}><ActivityIndicator size="small" color={theme.icon} /></View>
                  ) : null
                }
                ListEmptyComponent={
                  loadingMessages ? (
                  <View style={styles.centered}><ActivityIndicator size="small" color={theme.icon} /></View>
                  ) : (
                    <View style={[styles.emptyCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
                    <Ionicons name="chatbox-outline" size={24} color={theme.icon} />
                      <Text style={[styles.emptyTitle, { color: theme.text }]}>No messages yet</Text>
                      <Text style={[styles.emptyText, { color: theme.subText }]}>
                        {canReplyMessages ? "Start the conversation with a reply below." : "Replies are not enabled for this conversation."}
                      </Text>
                    </View>
                  )
                }
                renderItem={({ item: message }) => {
                  const mine = Number(message.sender_id) === Number(user?.id);
                  const deleted = Boolean(message.deleted_for_everyone_at);
                  const statuses = message.statuses || [];
                  const readCount = statuses.filter((item) => item.status === "read").length;
                  const deliveredCount = statuses.filter((item) => ["delivered", "read"].includes(item.status)).length;
                  const failed = failedMessageIds.includes(Number(message.id));
                  const attachments = message.attachments || [];
                  const hasMediaAttachment = attachments.some((attachment) => ["image", "document"].includes(attachment.category));
                  const bubbleTextColor = "#f8fafc";
                  const bubbleMetaColor = "#cbd5e1";
                  const bubbleIconColor = "#e2e8f0";
                  const sentBubbleColor = isDark ? "#334155" : "#111827";
                  const receivedBubbleColor = isDark ? "#334155" : "#1f2937";
                  return (
                    <Pressable
                      style={[styles.messageRow, mine ? styles.mine : styles.other]}
                      onLongPress={canReplyMessages ? () => openMessageActions(message) : undefined}
                    >
                      {!mine ? <Avatar label={message.sender_name || message.username} imageUrl={message.sender_image_url} /> : null}
                      <View style={[
                        styles.bubble,
                        hasMediaAttachment ? styles.mediaBubble : null,
                        mine
                          ? { backgroundColor: sentBubbleColor, borderTopRightRadius: 6 }
                          : { backgroundColor: receivedBubbleColor, borderTopLeftRadius: 6 },
                      ]}>
                        <View style={[styles.bubbleTopRow, hasMediaAttachment ? styles.mediaBubbleInset : null]}>
                          {!mine ? <Text style={[styles.senderName, { color: bubbleMetaColor }]} numberOfLines={1}>{message.sender_name || message.username}</Text> : <View style={styles.senderNameSpacer} />}
                          {canReplyMessages ? (
                            <Pressable style={styles.messageActionBtn} onPress={() => openMessageActions(message)}>
                              <Ionicons name="ellipsis-horizontal" size={16} color={bubbleIconColor} />
                            </Pressable>
                          ) : null}
                        </View>
                        {message.reply_to_message_id ? (
                          <View style={[styles.replyQuote, hasMediaAttachment ? styles.mediaBubbleInset : null, { borderColor: bubbleMetaColor }]}>
                            <Text style={[styles.fileMeta, { color: bubbleMetaColor }]} numberOfLines={2}>
                              {message.reply_sender_name || "Reply"}: {message.reply_message || message.reply_message_type}
                            </Text>
                          </View>
                        ) : null}
                        {message.forwarded_from_message_id ? (
                          <Text style={[styles.forwardedLabel, hasMediaAttachment ? styles.mediaBubbleInset : null, { color: bubbleMetaColor }]}>Forwarded</Text>
                        ) : null}
                        {deleted ? (
                          <Text style={[styles.deletedMessage, hasMediaAttachment ? styles.mediaBubbleInset : null, { color: bubbleMetaColor }]}>This message was deleted</Text>
                        ) : (
                          <>
                            {hasMediaAttachment ? attachments.map((attachment) => (
                              <MessageAttachmentView key={`${message.id}-${attachment.id}`} attachment={attachment} />
                            )) : null}
                            {message.message ? (
                              <Text
                                style={[styles.messageText, hasMediaAttachment ? styles.mediaBubbleInset : null, { color: bubbleTextColor }]}
                              >
                                {message.message}
                              </Text>
                            ) : null}
                            {!hasMediaAttachment ? attachments.map((attachment) => (
                              <MessageAttachmentView key={`${message.id}-${attachment.id}`} attachment={attachment} />
                            )) : null}
                          </>
                        )}
                        <View style={[styles.messageMetaRow, hasMediaAttachment ? styles.mediaBubbleMeta : null]}>
                          {message.edited_at ? <Text style={[styles.bubbleTime, { color: bubbleMetaColor }]}>Edited</Text> : null}
                          <Text style={[styles.bubbleTime, { color: bubbleMetaColor }]}>{formatTimeLabel(message.created_at)}</Text>
                          {mine ? (
                            <View style={styles.deliveryIconWrap}>
                              {failed ? (
                                <Ionicons name="alert-circle" size={14} color={theme.success} />
                              ) : statuses.length && readCount === statuses.length ? (
                                <Ionicons name="checkmark-done" size={15} color={theme.success} />
                              ) : deliveredCount ? (
                                <Ionicons name="checkmark-done" size={15} color={theme.success} />
                              ) : (
                                <Ionicons name="checkmark" size={15} color={theme.success} />
                              )}
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                }}
              />
            </View>
          </View>

          <View
            style={[
              styles.replyBarWrap,
              {
                paddingBottom:
                  Math.max(insets.bottom, 10) +
                  (Platform.OS === "android" ? Math.max(keyboardHeight - Math.max(insets.bottom, 0), 0) : 0),
                backgroundColor: theme.bg,
              },
            ]}
          >
            {canReplyMessages ? (
              <>
                {replyTo || editingMessageId ? (
                  <View style={[styles.composerContext, { borderColor: theme.border, backgroundColor: theme.card }]}>
                    <Text style={[styles.fileMeta, { color: theme.subText }]} numberOfLines={2}>
                      {editingMessageId
                        ? "Editing message"
                        : `Replying to ${replyTo?.sender_name || replyTo?.username}: ${replyTo?.message || replyTo?.message_type}`}
                    </Text>
                    <Pressable onPress={() => {
                      setReplyTo(null);
                      setEditingMessageId(null);
                      if (editingMessageId) setReply("");
                    }}>
                      <Ionicons name="close" size={18} color={theme.icon} />
                    </Pressable>
                  </View>
                ) : null}
                {selectedAssets.length ? (
                  <View style={[styles.composerContext, { borderColor: theme.border, backgroundColor: theme.card }]}>
                    {selectedCategory === "voice" ? (
                      <VoicePreview uri={selectedAssets[0].uri} />
                    ) : (
                      <Text style={[styles.fileMeta, { color: theme.subText }]} numberOfLines={2}>
                        {selectedAssets.map((asset) => asset.name).join(", ")}
                      </Text>
                    )}
                    <Pressable onPress={clearSelectedMedia}>
                      <Ionicons name="close" size={18} color={theme.icon} />
                    </Pressable>
                  </View>
                ) : null}
                <View style={styles.composerOuterRow}>
                  <View style={[styles.replyBar, { borderColor: theme.border, backgroundColor: isDark ? "#1f2933" : theme.card }]}>
                    <TextInput
                      value={reply}
                      onChangeText={(value) => {
                        setReply(value);
                        if (activeConversation?.type === "direct" && activeConversationId) {
                          void sendTyping(activeConversationId, true);
                          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                          typingTimerRef.current = setTimeout(() => {
                            void sendTyping(activeConversationId, false);
                          }, 1200);
                        }
                      }}
                      multiline
                      placeholder={recorderState.isRecording ? `Recording ${Math.floor(recorderState.durationMillis / 1000)}s` : "Message"}
                      placeholderTextColor={isDark ? "#9ca3af" : theme.mutedText}
                      style={[styles.replyInput, { color: isDark ? "#f8fafc" : theme.text }]}
                    />
                    <Pressable style={styles.composerIconBtn} onPress={() => void pickDocuments()}>
                      <Ionicons name="attach-outline" size={24} color={isDark ? "#a7b0ba" : theme.icon} />
                    </Pressable>
                    <Pressable style={styles.composerIconBtn} onPress={() => void pickImages()}>
                      <Ionicons name="camera-outline" size={23} color={isDark ? "#a7b0ba" : theme.icon} />
                    </Pressable>
                  </View>
                  <Pressable
                    style={[
                      styles.composerActionBtn,
                      recorderState.isRecording ? styles.recordingActionBtn : null,
                      sending ? styles.composerActionDisabled : null,
                    ]}
                    onPress={() => {
                      if (recorderState.isRecording) {
                        void stopVoiceRecording();
                        return;
                      }
                      if (reply.trim() || selectedAssets.length || editingMessageId) {
                        void sendReply();
                        return;
                      }
                      void startVoiceRecording();
                    }}
                    disabled={sending}
                  >
                    <Ionicons
                      name={
                        recorderState.isRecording
                          ? "stop"
                          : reply.trim() || selectedAssets.length || editingMessageId
                            ? "send"
                            : "mic"
                      }
                      size={22}
                      color="#fff"
                    />
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={[styles.readOnlyNotice, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <Ionicons name="eye-outline" size={18} color={theme.icon} />
                <Text style={[styles.readOnlyNoticeText, { color: theme.subText }]}>
                  Parents and teachers can view super admin messages only.
                </Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      )}

    </SafeAreaView>
  );
}

function createStyles(theme: typeof DEFAULT_THEME) {
return StyleSheet.create({
  safeArea: { flex: 1 },
  screen: { flex: 1 },
  root: { flex: 1 },
  chatScreen: { flex: 1, minHeight: 0 },
  chatInnerContent: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: 0, paddingTop: 10, paddingBottom: 120 },
  innerContent: { gap: 8, paddingHorizontal: 14, paddingTop: 0, paddingBottom: 8 },
  topNoticeOverlay: {
    position: "absolute",
    top: 10,
    left: 14,
    right: 14,
    zIndex: 20,
    elevation: 20,
  },
  heroCard: { borderRadius: 24, paddingVertical: 2, gap: 10 },
  chatHeroCard: { gap: 8 },
  heroCopy: { gap: 6 },
  heroPrimaryActions: { flexDirection: "row", gap: 10 },
  heroEyebrow: { color: theme.subText, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  heroTitle: { color: theme.text, fontWeight: "800", fontSize: 22 },
  heroSubtitle: { color: theme.subText, lineHeight: 20 },
  listTitleRow: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  listTitle: { flex: 1, fontSize: 20, lineHeight: 25, fontWeight: "800" },
  listTitleActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  listIconBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  newMessageBtn: {
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
  newMessageBtnText: { fontSize: 12, fontWeight: "800" },
  filterChipRow: { gap: 7, paddingRight: 14 },
  filterChip: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11 },
  filterChipText: { fontSize: 13, fontWeight: "700" },
  filterChipCount: { fontSize: 11, fontWeight: "700" },
  chatMessagesScroll: { flex: 1, minHeight: 0 },
  chatMessagesContent: { gap: 10, paddingTop: 2 },
  chatMessagesPanel: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 4,
    overflow: "hidden",
  },
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 24 },
  topActionRow: { alignItems: "flex-end" },
  topActionBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.success, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  topActionText: { color: theme.successText, fontWeight: "700" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, minHeight: 44 },
  searchInput: { flex: 1, fontSize: 14, paddingHorizontal: 2, paddingVertical: 6 },
  searchSubmitBtn: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rowCard: { flexDirection: "row", gap: 12, borderBottomWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  rowBody: { flex: 1, gap: 3, justifyContent: "center", minWidth: 0 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowBottom: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  rowTitle: { fontSize: 15, fontWeight: "800", flex: 1 },
  avatarSelectionWrap: { position: "relative" },
  selectionBadge: { position: "absolute", right: 0, bottom: 0, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowTime: { fontSize: 11, flexShrink: 0 },
  rowPreview: { flex: 1, minWidth: 0, flexShrink: 1, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  rowMeta: { fontSize: 12, flex: 1 },
  unread: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, textAlign: "center", backgroundColor: theme.success, color: theme.successText, fontSize: 11, fontWeight: "700" },
  emptyCard: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 24, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "800" },
  avatarWrap: { width: 46, height: 46, alignItems: "center", justifyContent: "center", position: "relative" },
  avatarWrapLarge: { width: 58, height: 58, alignItems: "center", justifyContent: "center", position: "relative" },
  avatarCircle: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarCircleLarge: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: 42, height: 42, borderRadius: 21 },
  avatarImageLarge: { width: 52, height: 52, borderRadius: 26 },
  avatarText: { color: theme.text, fontWeight: "800", fontSize: 16 },
  avatarTextLarge: { color: theme.text, fontWeight: "800", fontSize: 19 },
  presenceDot: { position: "absolute", right: 2, bottom: 2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: theme.card },
  presenceDotLarge: { position: "absolute", right: 4, bottom: 4, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: theme.card },
  presenceOnline: { backgroundColor: theme.success },
  presenceOffline: { backgroundColor: "#ef4444" },
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chatHeaderIdentity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  chatHeaderCopy: { flex: 1, gap: 2 },
  chatTitle: { fontSize: 15, fontWeight: "800" },
  chatMeta: { fontSize: 12 },
  messageRow: { flexDirection: "row", gap: 8, paddingHorizontal: 2, minWidth: 0 },
  mine: { justifyContent: "flex-end", alignItems: "flex-end" },
  other: { justifyContent: "flex-start", alignItems: "flex-start" },
  bubble: { maxWidth: "88%", minWidth: 120, flexShrink: 1, alignSelf: "flex-start", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9 },
  mediaBubble: { paddingHorizontal: 0, paddingVertical: 0, overflow: "hidden" },
  mediaBubbleInset: { marginHorizontal: 10, marginTop: 8 },
  mediaBubbleMeta: { paddingHorizontal: 10, paddingBottom: 7 },
  bubbleMine: { borderTopRightRadius: 6 },
  bubbleTopRow: { minHeight: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 },
  senderName: { flex: 1, fontSize: 11, fontWeight: "700" },
  senderNameSpacer: { flex: 1 },
  messageActionBtn: { width: 24, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  messageText: { width: "100%", minWidth: 0, flexShrink: 1, flexWrap: "wrap", fontSize: 14, lineHeight: 21, fontWeight: "600", includeFontPadding: true },
  bubbleTime: { fontSize: 11 },
  messageMetaRow: { marginTop: 7, flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 6 },
  deliveryIconWrap: { width: 16, height: 14, alignItems: "center", justifyContent: "center" },
  replyQuote: { borderLeftWidth: 3, paddingLeft: 8, paddingVertical: 4, marginBottom: 6 },
  forwardedLabel: { fontSize: 11, fontStyle: "italic", marginBottom: 4 },
  deletedMessage: { fontStyle: "italic" },
  mediaPressable: { alignSelf: "stretch" },
  messageImage: { width: 238, height: 220, borderRadius: 16 },
  voiceInline: { marginTop: 4, minWidth: 210, maxWidth: 250, flexDirection: "row", alignItems: "center", gap: 8 },
  voicePlayBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: theme.success },
  voiceBody: { flex: 1, minWidth: 0, gap: 2 },
  voiceWave: { height: 26, flexDirection: "row", alignItems: "center", gap: 2 },
  voiceBar: { width: 3, borderRadius: 2 },
  voiceSideMeta: { alignItems: "flex-end", gap: 2 },
  voiceSpeedBtn: { minWidth: 30, height: 20, alignItems: "center", justifyContent: "center" },
  voiceAction: { fontSize: 10, fontWeight: "800" },
  voiceTime: { fontSize: 10 },
  fileInline: { minWidth: 230, maxWidth: 250, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 9 },
  fileIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(248, 250, 252, 0.12)" },
  fileTextWrap: { flex: 1, minWidth: 0 },
  fileName: { flex: 1, fontSize: 12, fontWeight: "700" },
  fileMeta: { fontSize: 11 },
  replyBarWrap: { paddingTop: 8, paddingHorizontal: 8, marginTop: "auto", borderTopWidth: 0 },
  composerContext: { marginBottom: 6, borderWidth: 1, borderRadius: 14, padding: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  voicePreview: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  composerOuterRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  replyBar: { flex: 1, minHeight: 54, maxHeight: 118, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 27, paddingLeft: 18, paddingRight: 8, paddingVertical: 6 },
  composerIconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  replyInput: { flex: 1, minHeight: 40, maxHeight: 96, paddingTop: 9, paddingBottom: 8, paddingHorizontal: 0, fontSize: 17 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.success, alignItems: "center", justifyContent: "center" },
  composerActionBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: theme.success, alignItems: "center", justifyContent: "center" },
  composerActionDisabled: { opacity: 0.55 },
  recordingActionBtn: { backgroundColor: "#dc2626" },
  recordingButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#dc2626", alignItems: "center", justifyContent: "center" },
  readOnlyNotice: { minHeight: 44, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  readOnlyNoticeText: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  composeHeader: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, paddingHorizontal: 14, paddingBottom: 12 },
  composeScreenContent: { gap: 16, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 120 },
  composeSection: { gap: 10, marginBottom: 12 },
  groupLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7 },
  audienceCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 13 },
  audienceIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  audienceCopy: { flex: 1, gap: 3 },
  audienceTitle: { fontSize: 14, fontWeight: "800" },
  audienceDesc: { fontSize: 12, lineHeight: 17 },
  identityCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16, padding: 13 },
  composeFooter: { flexDirection: "row", gap: 10, borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 12, backgroundColor: theme.bg },
  inputLabel: { fontSize: 12, fontWeight: "800" },
  searchInputBox: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14 },
  selectedCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  selectedLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  targetRow: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  emptyInline: { borderWidth: 1, borderRadius: 14, padding: 12 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center" },
  secondaryText: { fontWeight: "700" },
  primaryBtn: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center" },
  primaryText: { color: theme.successText, fontWeight: "700" },
  btnDisabled: { opacity: 0.5 },
  emptyText: { textAlign: "center" },
});
}

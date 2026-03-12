import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuthStore } from "../../store/authStore";
import {
  ConversationItem,
  getConversations,
  getMessages,
  getTargets,
  markAsRead,
  MessageItem,
  MessagingTargets,
  sendMessage,
} from "../../services/messagingService";
import { formatTimeLabel } from "../../utils/format";

type ComposeState = {
  target_type:
    | "direct"
    | "parent"
    | "teacher"
    | "class"
    | "section"
    | "broadcast"
    | "all_classes"
    | "all_sections"
    | "all_parents"
    | "all_teachers";
  recipient_user_id: string;
  class_id: string;
  section_id: string;
  teacher_type: "all" | "school" | "college";
  message: string;
};

type RecipientFilters = {
  search: string;
  role: "all" | "parent" | "teacher";
  class_id: string;
  section_id: string;
  medium: string;
  teacher_type: "all" | "school" | "college";
};

const EMPTY_COMPOSE: ComposeState = {
  target_type: "direct",
  recipient_user_id: "",
  class_id: "",
  section_id: "",
  teacher_type: "all",
  message: "",
};

const EMPTY_FILTERS: RecipientFilters = {
  search: "",
  role: "all",
  class_id: "",
  section_id: "",
  medium: "",
  teacher_type: "all",
};

function formatScopeLabel(scope?: string | null) {
  return scope === "hs" ? "Higher Secondary" : scope === "school" ? "School" : "";
}

export default function MessagingTab() {
  const user = useAuthStore((state) => state.user);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [targets, setTargets] = useState<MessagingTargets>({
    parents: [],
    teachers: [],
    classes: [],
    sections: [],
    broadcast_targets: [],
  });

  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [newMessageText, setNewMessageText] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState<ComposeState>(EMPTY_COMPOSE);
  const [recipientFilters, setRecipientFilters] = useState<RecipientFilters>(EMPTY_FILTERS);
  const [conversationSearch, setConversationSearch] = useState("");

  const activeConversation = useMemo(
    () => conversations.find((c) => Number(c.id) === Number(activeConversationId)) ?? null,
    [conversations, activeConversationId]
  );
  const broadcastTargetOptions = useMemo(
    () =>
      targets.broadcast_targets?.length
        ? targets.broadcast_targets
        : [
            { key: "broadcast", label: "All Users" },
            { key: "all_classes", label: "All Classes" },
            { key: "all_sections", label: "All Sections" },
            { key: "all_parents", label: "All Parents" },
            { key: "all_teachers", label: "All Teachers" },
          ],
    [targets.broadcast_targets]
  );
  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((item) =>
      [item.name || "", item.type || "", item.last_message || ""].join(" ").toLowerCase().includes(query)
    );
  }, [conversationSearch, conversations]);

  const sectionsByClass = useMemo(() => {
    if (!compose.class_id) return [];
    return targets.sections.filter((s) => String(s.class_id) === String(compose.class_id));
  }, [targets.sections, compose.class_id]);

  const sectionsByFilterClass = useMemo(() => {
    if (!recipientFilters.class_id) return targets.sections;
    return targets.sections.filter((s) => String(s.class_id) === String(recipientFilters.class_id));
  }, [targets.sections, recipientFilters.class_id]);

  const recipientOptions = useMemo(() => {
    const parents = targets.parents.map((p) => ({
      role: "parent" as const,
      user_id: p.user_id,
      name: p.name,
      email: p.email || "",
      mobile: p.mobile || "",
      class_id: p.class_id ? String(p.class_id) : "",
      section_id: p.section_id ? String(p.section_id) : "",
      class_name: p.class_name || "",
      section_name: p.section_name || "",
      medium: p.medium || "",
      class_scope: p.class_scope || "",
      teacher_type: "",
    }));

    const teachers = targets.teachers.map((t) => ({
      role: "teacher" as const,
      user_id: t.user_id,
      name: t.name,
      email: t.email || "",
      mobile: t.phone || "",
      class_id: t.class_id ? String(t.class_id) : "",
      section_id: t.section_id ? String(t.section_id) : "",
      class_name: t.class_name || "",
      section_name: t.section_name || "",
      medium: t.medium || t.class_medium || "",
      class_scope: t.class_scope || "",
      teacher_type: t.type || "school",
    }));

    const merged = [...parents, ...teachers].filter((row) => row.user_id);
    const map = new Map<
      string,
      {
        user_id: number;
        name: string;
        email: string;
        mobile: string;
        roles: Set<"parent" | "teacher">;
        classIds: Set<string>;
        sectionIds: Set<string>;
        classNames: Set<string>;
        sectionNames: Set<string>;
        mediums: Set<string>;
        classScopes: Set<string>;
        teacherTypes: Set<string>;
      }
    >();

    for (const row of merged) {
      if (user?.id && Number(row.user_id) === Number(user.id)) continue;
      const key = String(row.user_id);
      if (!map.has(key)) {
        map.set(key, {
          user_id: row.user_id,
          name: row.name || "Unknown",
          email: row.email,
          mobile: row.mobile,
          roles: new Set(),
          classIds: new Set(),
          sectionIds: new Set(),
          classNames: new Set(),
          sectionNames: new Set(),
          mediums: new Set(),
          classScopes: new Set(),
          teacherTypes: new Set(),
        });
      }
      const item = map.get(key)!;
      item.roles.add(row.role);
      if (row.class_id) item.classIds.add(row.class_id);
      if (row.section_id) item.sectionIds.add(row.section_id);
      if (row.class_name) item.classNames.add(row.class_name);
      if (row.section_name) item.sectionNames.add(row.section_name);
      if (row.medium) item.mediums.add(row.medium);
      if (row.class_scope) item.classScopes.add(row.class_scope);
      if (row.teacher_type) item.teacherTypes.add(row.teacher_type);
    }

    const targetRole =
      compose.target_type === "parent"
        ? "parent"
        : compose.target_type === "teacher"
          ? "teacher"
          : recipientFilters.role;
    const search = recipientFilters.search.trim().toLowerCase();

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        roles: Array.from(item.roles),
        classIds: Array.from(item.classIds),
        sectionIds: Array.from(item.sectionIds),
        classNames: Array.from(item.classNames),
        sectionNames: Array.from(item.sectionNames),
        mediums: Array.from(item.mediums),
        classScopes: Array.from(item.classScopes),
        teacherTypes: Array.from(item.teacherTypes),
      }))
      .filter((item) => {
        if (targetRole !== "all" && !item.roles.includes(targetRole)) return false;
        if (recipientFilters.class_id && !item.classIds.includes(recipientFilters.class_id)) return false;
        if (recipientFilters.section_id && !item.sectionIds.includes(recipientFilters.section_id)) return false;
        if (recipientFilters.medium && !item.mediums.includes(recipientFilters.medium)) return false;
        if (
          recipientFilters.teacher_type !== "all" &&
          item.roles.includes("teacher") &&
          !item.teacherTypes.includes(recipientFilters.teacher_type)
        ) {
          return false;
        }
        if (!search) return true;
        const text = [
          item.name,
          item.email,
          item.mobile,
          item.roles.join(" "),
          item.classNames.join(" "),
          item.sectionNames.join(" "),
          item.mediums.join(" "),
          item.classScopes.join(" "),
          item.teacherTypes.join(" "),
        ]
          .join(" ")
          .toLowerCase();
        return text.includes(search);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [targets.parents, targets.teachers, user?.id, compose.target_type, recipientFilters]);
  const availableMedia = useMemo(() => {
    const values = new Set<string>();
    for (const item of [...targets.sections, ...targets.classes, ...targets.parents, ...targets.teachers]) {
      if (item?.medium) values.add(String(item.medium));
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [targets]);

  useEffect(() => {
    loadConversations();
    loadTargets();
  }, []);

  useEffect(() => {
    if (!activeConversationId) return;
    loadMessages(activeConversationId);
  }, [activeConversationId]);

  async function loadConversations() {
    setLoadingConversations(true);
    try {
      const data = await getConversations();
      setConversations(data);
      if (!activeConversationId && data.length) {
        setActiveConversationId(data[0].id);
      }
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err, "Could not load conversations."));
    } finally {
      setLoadingConversations(false);
    }
  }

  async function loadTargets() {
    try {
      const data = await getTargets();
      setTargets(data);
    } catch {
      setTargets({ parents: [], teachers: [], classes: [], sections: [], broadcast_targets: [] });
    }
  }

  async function loadMessages(conversationId: number) {
    setLoadingMessages(true);
    try {
      const data = await getMessages(conversationId, 1, 100);
      setMessages([...data].reverse());
      await markAsRead(conversationId);
      await loadConversations();
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err, "Could not load messages."));
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }

  async function sendInActiveConversation() {
    if (!activeConversationId || !newMessageText.trim()) return;
    setSending(true);
    try {
      await sendMessage({
        conversation_id: activeConversationId,
        message: newMessageText.trim(),
      });
      setNewMessageText("");
      await loadMessages(activeConversationId);
    } catch (err: unknown) {
      Alert.alert("Send failed", getErrorMessage(err, "Failed to send message."));
    } finally {
      setSending(false);
    }
  }

  async function sendComposedMessage() {
    if (!compose.message.trim()) {
      Alert.alert("Validation", "Message is required.");
      return;
    }

    const payload: {
      target_type:
        | "direct"
        | "parent"
        | "teacher"
        | "class"
        | "section"
        | "broadcast"
        | "all_classes"
        | "all_sections"
        | "all_parents"
        | "all_teachers";
      recipient_user_id?: number;
      class_id?: number;
      section_id?: number;
      teacher_type?: "all" | "school" | "college";
      name?: string;
      message: string;
    } = {
      target_type: compose.target_type,
      message: compose.message.trim(),
    };

    if (["direct", "parent", "teacher"].includes(compose.target_type)) {
      if (!compose.recipient_user_id) {
        Alert.alert("Validation", "Recipient is required.");
        return;
      }
      payload.recipient_user_id = Number(compose.recipient_user_id);
    }

    if (compose.target_type === "class") {
      if (!compose.class_id) {
        Alert.alert("Validation", "Class is required.");
        return;
      }
      payload.class_id = Number(compose.class_id);
      payload.name = `Class ${targets.classes.find((c) => String(c.id) === compose.class_id)?.name || compose.class_id}`;
    }

    if (compose.target_type === "section") {
      if (!compose.section_id) {
        Alert.alert("Validation", "Section is required.");
        return;
      }
      payload.section_id = Number(compose.section_id);
      const section = targets.sections.find((s) => String(s.id) === compose.section_id);
      payload.name = `Section ${section?.class_name || ""} ${section?.name || compose.section_id}`.trim();
    }

    if (compose.target_type === "broadcast") {
      payload.name = "All Users";
    }
    if (compose.target_type === "all_classes") {
      payload.name = "All Classes";
    }
    if (compose.target_type === "all_sections") {
      payload.name = "All Sections";
    }
    if (compose.target_type === "all_parents") {
      payload.name = "All Parents";
    }
    if (compose.target_type === "all_teachers") {
      payload.teacher_type = compose.teacher_type;
      payload.name =
        compose.teacher_type === "school"
          ? "All School Teachers"
          : compose.teacher_type === "college"
            ? "All College Teachers"
            : "All Teachers";
    }

    setSending(true);
    try {
      const result = await sendMessage(payload);
      const conversationId = result.conversation_id;
      setComposeOpen(false);
      setCompose(EMPTY_COMPOSE);
      setRecipientFilters(EMPTY_FILTERS);
      await loadConversations();
      if (conversationId) {
        setActiveConversationId(conversationId);
        await loadMessages(conversationId);
      }
    } catch (err: unknown) {
      Alert.alert("Send failed", getErrorMessage(err, "Failed to send message."));
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.root}>
      {!activeConversationId ? (
        <>
          <View style={styles.toolbar}>
            <View style={styles.toolbarCopy}>
              <Text style={styles.title}>Messaging</Text>
              <Text style={styles.toolbarSubTitle}>Teacher chat, parent chat, and broadcast updates.</Text>
            </View>
            <Pressable style={styles.primaryBtn} onPress={() => setComposeOpen(true)}>
              <Text style={styles.primaryBtnText}>Compose</Text>
            </Pressable>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Conversations</Text>
            <TextInput
              style={[styles.input, styles.searchInput]}
              value={conversationSearch}
              onChangeText={setConversationSearch}
              placeholder="Search conversations"
              placeholderTextColor="#94a3b8"
            />
            {loadingConversations ? (
              <ActivityIndicator size="small" color="#0f172a" />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.conversationList}>
                {filteredConversations.map((c) => {
                  const active = Number(c.id) === Number(activeConversationId);
                  return (
                    <Pressable
                      key={c.id}
                      style={[styles.conversationCard, active && styles.conversationCardActive]}
                      onPress={() => setActiveConversationId(c.id)}
                    >
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{String(c.name || c.type).charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.conversationBody}>
                        <View style={styles.conversationTopRow}>
                          <Text style={[styles.conversationText, active && styles.conversationTextActive]}>
                            {c.name || c.type}
                          </Text>
                          <Text style={styles.conversationTime}>
                            {c.last_message_at ? formatTimeLabel(c.last_message_at) : ""}
                          </Text>
                        </View>
                        <View style={styles.conversationBottomRow}>
                          <Text style={styles.conversationPreview} numberOfLines={1}>
                            {c.last_message || "No messages yet"}
                          </Text>
                          {Number(c.unread) > 0 ? <Text style={styles.unread}>{c.unread}</Text> : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </>
      ) : (
        <View style={styles.chatScreen}>
          <View style={styles.chatHeaderBar}>
            <Pressable style={styles.backBtn} onPress={() => setActiveConversationId(null)}>
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
            <View style={styles.chatHeaderCopy}>
              <Text style={styles.panelTitle}>
                {activeConversation ? activeConversation.name || activeConversation.type : "Chat"}
              </Text>
              <Text style={styles.chatHeaderHint}>Conversation</Text>
            </View>
          </View>

          <View style={styles.chatPanel}>
            {loadingMessages ? (
              <View style={styles.centered}>
                <ActivityIndicator size="small" color="#0f172a" />
              </View>
            ) : (
              <ScrollView style={styles.messagesWrap} contentContainerStyle={styles.messagesContent}>
                {messages.length ? (
                  messages.map((m) => {
                    const mine = Number(m.sender_id) === Number(user?.id);
                    return (
                      <View key={m.id} style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
                        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                          {!mine ? <Text style={styles.bubbleUser}>{m.username}</Text> : null}
                          <Text style={styles.bubbleMessage}>{m.message}</Text>
                          <Text style={styles.bubbleTime}>{formatTimeLabel(m.created_at)}</Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>No messages yet.</Text>
                )}
              </ScrollView>
            )}

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={newMessageText}
                onChangeText={setNewMessageText}
                placeholder="Type message..."
                editable={!sending}
              />
              <Pressable style={styles.primaryBtn} onPress={sendInActiveConversation} disabled={sending}>
                <Text style={styles.primaryBtnText}>{sending ? "..." : "Send"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <Modal visible={composeOpen} transparent animationType="slide" onRequestClose={() => setComposeOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setComposeOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Compose Message</Text>
            <Text style={styles.modalSubTitle}>Choose a direct, class, section, or broadcast target.</Text>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Target Type *</Text>
              <View style={styles.chipWrap}>
                {(["direct", "parent", "teacher", "class", "section"] as const).map((type) => {
                  const active = compose.target_type === type;
                  return (
                    <Pressable
                      key={type}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() =>
                        setCompose((prev) => ({
                          ...prev,
                          target_type: type,
                          recipient_user_id: "",
                          class_id: "",
                          section_id: "",
                        }))
                      }
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{type}</Text>
                    </Pressable>
                  );
                })}
                {broadcastTargetOptions.map((target) => {
                  const active = compose.target_type === target.key;
                  return (
                    <Pressable
                      key={target.key}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() =>
                        setCompose((prev) => ({
                          ...prev,
                          target_type: target.key as ComposeState["target_type"],
                          recipient_user_id: "",
                          class_id: "",
                          section_id: "",
                        }))
                      }
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{target.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {["direct", "parent", "teacher"].includes(compose.target_type) ? (
                <>
                  <Text style={[styles.inputLabel, styles.spaceTop]}>Find Recipient</Text>
                  <TextInput
                    style={styles.input}
                    value={recipientFilters.search}
                    onChangeText={(value) => setRecipientFilters((prev) => ({ ...prev, search: value }))}
                    placeholder="Search by name, phone, email, class, section"
                  />

                  {compose.target_type === "direct" ? (
                    <>
                      <Text style={[styles.inputLabel, styles.spaceTop]}>Role Filter</Text>
                      <View style={styles.chipWrap}>
                        {(["all", "parent", "teacher"] as const).map((role) => {
                          const active = recipientFilters.role === role;
                          return (
                            <Pressable
                              key={role}
                              style={[styles.chip, active && styles.chipActive]}
                              onPress={() => setRecipientFilters((prev) => ({ ...prev, role }))}
                            >
                              <Text style={[styles.chipText, active && styles.chipTextActive]}>{role}</Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      <Text style={[styles.inputLabel, styles.spaceTop]}>Class Filter</Text>
                      <View style={styles.chipWrap}>
                        <Pressable
                          style={[styles.chip, recipientFilters.class_id === "" && styles.chipActive]}
                          onPress={() => setRecipientFilters((prev) => ({ ...prev, class_id: "", section_id: "" }))}
                        >
                          <Text style={[styles.chipText, recipientFilters.class_id === "" && styles.chipTextActive]}>
                            All Classes
                          </Text>
                        </Pressable>
                        {targets.classes.map((c) => (
                          <Pressable
                            key={c.id}
                            style={[styles.chip, recipientFilters.class_id === String(c.id) && styles.chipActive]}
                            onPress={() => setRecipientFilters((prev) => ({ ...prev, class_id: String(c.id), section_id: "" }))}
                          >
                            <Text style={[styles.chipText, recipientFilters.class_id === String(c.id) && styles.chipTextActive]}>
                              {c.name}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <Text style={[styles.inputLabel, styles.spaceTop]}>Section Filter</Text>
                      <View style={styles.chipWrap}>
                        <Pressable
                          style={[styles.chip, recipientFilters.section_id === "" && styles.chipActive]}
                          onPress={() => setRecipientFilters((prev) => ({ ...prev, section_id: "" }))}
                        >
                          <Text style={[styles.chipText, recipientFilters.section_id === "" && styles.chipTextActive]}>
                            All Sections
                          </Text>
                        </Pressable>
                        {sectionsByFilterClass.map((s) => (
                          <Pressable
                            key={s.id}
                            style={[styles.chip, recipientFilters.section_id === String(s.id) && styles.chipActive]}
                            onPress={() => setRecipientFilters((prev) => ({ ...prev, section_id: String(s.id) }))}
                          >
                            <Text style={[styles.chipText, recipientFilters.section_id === String(s.id) && styles.chipTextActive]}>
                              {s.class_name} - {s.name}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <Text style={[styles.inputLabel, styles.spaceTop]}>Medium Filter</Text>
                      <View style={styles.chipWrap}>
                        <Pressable
                          style={[styles.chip, recipientFilters.medium === "" && styles.chipActive]}
                          onPress={() => setRecipientFilters((prev) => ({ ...prev, medium: "" }))}
                        >
                          <Text style={[styles.chipText, recipientFilters.medium === "" && styles.chipTextActive]}>
                            All Medium
                          </Text>
                        </Pressable>
                        {availableMedia.map((item) => (
                          <Pressable
                            key={item}
                            style={[styles.chip, recipientFilters.medium === item && styles.chipActive]}
                            onPress={() => setRecipientFilters((prev) => ({ ...prev, medium: item }))}
                          >
                            <Text style={[styles.chipText, recipientFilters.medium === item && styles.chipTextActive]}>
                              {item}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  ) : null}

                  {(compose.target_type === "teacher" ||
                    (compose.target_type === "direct" && recipientFilters.role === "teacher")) ? (
                    <>
                      <Text style={[styles.inputLabel, styles.spaceTop]}>Teacher Type</Text>
                      <View style={styles.chipWrap}>
                        {(["all", "school", "college"] as const).map((item) => {
                          const active = recipientFilters.teacher_type === item;
                          return (
                            <Pressable
                              key={item}
                              style={[styles.chip, active && styles.chipActive]}
                              onPress={() => setRecipientFilters((prev) => ({ ...prev, teacher_type: item }))}
                            >
                              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  ) : null}

                  <Text style={[styles.inputLabel, styles.spaceTop]}>Recipients</Text>
                  <View style={styles.recipientWrap}>
                    {recipientOptions.length === 0 ? (
                      <Text style={styles.emptyText}>No users found for current filters.</Text>
                    ) : (
                      recipientOptions.map((r) => {
                        const active = String(compose.recipient_user_id) === String(r.user_id);
                        return (
                          <Pressable
                            key={r.user_id}
                            style={[styles.recipientCard, active && styles.recipientCardActive]}
                            onPress={() => setCompose((prev) => ({ ...prev, recipient_user_id: String(r.user_id) }))}
                          >
                            <Text style={[styles.recipientName, active && styles.recipientNameActive]}>
                              {r.name}
                            </Text>
                            <Text style={styles.recipientMeta}>
                              {r.roles.join(", ")}
                              {r.mobile ? ` | ${r.mobile}` : ""}
                            </Text>
                            <Text style={styles.recipientMeta}>
                              {r.classNames.join(", ")}
                              {r.sectionNames.length ? ` | ${r.sectionNames.join(", ")}` : ""}
                              {r.mediums.length ? ` | ${r.mediums.join(", ")}` : ""}
                            </Text>
                          </Pressable>
                        );
                      })
                    )}
                  </View>
                </>
              ) : null}

              {compose.target_type === "class" ? (
                <>
                  <Text style={[styles.inputLabel, styles.spaceTop]}>Class *</Text>
                  <View style={styles.chipWrap}>
                    {targets.classes.map((c) => {
                      const active = compose.class_id === String(c.id);
                      return (
                        <Pressable
                          key={c.id}
                          style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setCompose((prev) => ({ ...prev, class_id: String(c.id) }))}
                    >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {c.name}
                            {c.medium ? ` (${c.medium})` : ""}
                            {c.class_scope ? ` - ${formatScopeLabel(c.class_scope)}` : ""}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {compose.target_type === "section" ? (
                <>
                  <Text style={[styles.inputLabel, styles.spaceTop]}>Class *</Text>
                  <View style={styles.chipWrap}>
                    {targets.classes.map((c) => {
                      const active = compose.class_id === String(c.id);
                      return (
                        <Pressable
                          key={c.id}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setCompose((prev) => ({ ...prev, class_id: String(c.id), section_id: "" }))}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={[styles.inputLabel, styles.spaceTop]}>Section *</Text>
                  <View style={styles.chipWrap}>
                    {sectionsByClass.map((s) => {
                      const active = compose.section_id === String(s.id);
                      return (
                        <Pressable
                          key={s.id}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setCompose((prev) => ({ ...prev, section_id: String(s.id) }))}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {s.class_name} - {s.name}
                            {s.medium ? ` (${s.medium})` : ""}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {compose.target_type === "all_teachers" ? (
                <>
                  <Text style={[styles.inputLabel, styles.spaceTop]}>Teacher Type</Text>
                  <View style={styles.chipWrap}>
                    {(["all", "school", "college"] as const).map((item) => {
                      const active = compose.teacher_type === item;
                      return (
                        <Pressable
                          key={item}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setCompose((prev) => ({ ...prev, teacher_type: item }))}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <Text style={[styles.inputLabel, styles.spaceTop]}>Message *</Text>
              <TextInput
                style={[styles.input, styles.messageInput]}
                multiline
                value={compose.message}
                onChangeText={(value) => setCompose((prev) => ({ ...prev, message: value }))}
                placeholder="Type message..."
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable style={styles.secondaryBtn} onPress={() => setComposeOpen(false)} disabled={sending}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={sendComposedMessage} disabled={sending}>
                <Text style={styles.primaryBtnText}>{sending ? "Sending..." : "Send"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getErrorMessage(err: unknown, fallback: string) {
  if (
    typeof err === "object" &&
    err &&
    "response" in err &&
    typeof (err as { response?: { data?: { message?: string; error?: string } } }).response?.data
      ?.error === "string"
  ) {
    return (
      (err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error ||
      fallback
    );
  }
  if (
    typeof err === "object" &&
    err &&
    "response" in err &&
    typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
  ) {
    return (err as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
  }
  return fallback;
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  chatScreen: {
    gap: 12,
  },
  chatHeaderBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtnText: {
    color: "#334155",
    fontWeight: "700",
  },
  chatHeaderCopy: {
    flex: 1,
  },
  chatHeaderHint: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
  },
  toolbarCopy: {
    flex: 1,
  },
  title: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 20,
  },
  toolbarSubTitle: {
    marginTop: 4,
    color: "#64748b",
  },
  panel: {
    borderWidth: 1,
    borderColor: "#d9f99d",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  chatPanel: {
    borderWidth: 1,
    borderColor: "#d9f99d",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  panelTitle: {
    color: "#14532d",
    fontWeight: "700",
    marginBottom: 8,
  },
  conversationList: {
    gap: 8,
    paddingBottom: 6,
  },
  conversationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    padding: 10,
    backgroundColor: "#f8fafc",
  },
  conversationCardActive: {
    backgroundColor: "#dcfce7",
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#166534",
    fontWeight: "700",
    fontSize: 16,
  },
  conversationBody: {
    flex: 1,
  },
  conversationTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  conversationBottomRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  conversationText: {
    color: "#0f172a",
    fontWeight: "700",
    textTransform: "capitalize",
    flex: 1,
  },
  conversationTextActive: {
    color: "#166534",
  },
  conversationPreview: {
    color: "#475569",
    flex: 1,
  },
  conversationTime: {
    color: "#64748b",
    fontSize: 11,
  },
  unread: {
    color: "#fff",
    backgroundColor: "#16a34a",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "700",
    minWidth: 20,
    textAlign: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  centered: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  messagesWrap: {
    maxHeight: 360,
    backgroundColor: "#f0fdf4",
  },
  messagesContent: {
    gap: 8,
    paddingBottom: 8,
    paddingTop: 4,
  },
  messageRow: {
    flexDirection: "row",
  },
  messageRowMine: {
    justifyContent: "flex-end",
  },
  messageRowOther: {
    justifyContent: "flex-start",
  },
  bubble: {
    borderRadius: 18,
    padding: 10,
    maxWidth: "88%",
  },
  bubbleMine: {
    backgroundColor: "#dcfce7",
    borderTopRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 6,
  },
  bubbleUser: {
    fontSize: 11,
    color: "#166534",
    fontWeight: "700",
    marginBottom: 4,
  },
  bubbleMessage: {
    color: "#0f172a",
  },
  bubbleTime: {
    marginTop: 6,
    fontSize: 11,
    color: "#64748b",
  },
  inputRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0f172a",
  },
  searchInput: {
    marginBottom: 8,
  },
  messageInput: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  primaryBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "#334155",
    fontWeight: "600",
  },
  emptyText: {
    color: "#64748b",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
  },
  modalCard: {
    maxHeight: "86%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  modalTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 10,
  },
  modalSubTitle: {
    color: "#64748b",
    marginBottom: 10,
  },
  modalBody: {
    maxHeight: 470,
  },
  inputLabel: {
    color: "#334155",
    fontWeight: "600",
    marginBottom: 6,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  chipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#e2e8f0",
  },
  chipText: {
    color: "#334155",
    fontWeight: "600",
    textTransform: "capitalize",
  },
  chipTextActive: {
    color: "#0f172a",
  },
  recipientWrap: {
    gap: 8,
  },
  recipientCard: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fff",
  },
  recipientCardActive: {
    borderColor: "#0f172a",
    backgroundColor: "#e2e8f0",
  },
  recipientName: {
    color: "#1e293b",
    fontWeight: "700",
  },
  recipientNameActive: {
    color: "#0f172a",
  },
  recipientMeta: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 12,
  },
  spaceTop: {
    marginTop: 10,
  },
  modalFooter: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
});

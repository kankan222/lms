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
  target_type: "direct" | "parent" | "teacher" | "class" | "section";
  recipient_user_id: string;
  class_id: string;
  section_id: string;
  message: string;
};

type RecipientFilters = {
  search: string;
  role: "all" | "parent" | "teacher";
  class_id: string;
  section_id: string;
};

const EMPTY_COMPOSE: ComposeState = {
  target_type: "direct",
  recipient_user_id: "",
  class_id: "",
  section_id: "",
  message: "",
};

const EMPTY_FILTERS: RecipientFilters = {
  search: "",
  role: "all",
  class_id: "",
  section_id: "",
};

export default function MessagingTab() {
  const user = useAuthStore((state) => state.user);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [targets, setTargets] = useState<MessagingTargets>({
    parents: [],
    teachers: [],
    classes: [],
    sections: [],
  });

  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [newMessageText, setNewMessageText] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState<ComposeState>(EMPTY_COMPOSE);
  const [recipientFilters, setRecipientFilters] = useState<RecipientFilters>(EMPTY_FILTERS);

  const activeConversation = useMemo(
    () => conversations.find((c) => Number(c.id) === Number(activeConversationId)) ?? null,
    [conversations, activeConversationId]
  );

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
        });
      }
      const item = map.get(key)!;
      item.roles.add(row.role);
      if (row.class_id) item.classIds.add(row.class_id);
      if (row.section_id) item.sectionIds.add(row.section_id);
      if (row.class_name) item.classNames.add(row.class_name);
      if (row.section_name) item.sectionNames.add(row.section_name);
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
      }))
      .filter((item) => {
        if (targetRole !== "all" && !item.roles.includes(targetRole)) return false;
        if (recipientFilters.class_id && !item.classIds.includes(recipientFilters.class_id)) return false;
        if (recipientFilters.section_id && !item.sectionIds.includes(recipientFilters.section_id)) return false;
        if (!search) return true;
        const text = [
          item.name,
          item.email,
          item.mobile,
          item.roles.join(" "),
          item.classNames.join(" "),
          item.sectionNames.join(" "),
        ]
          .join(" ")
          .toLowerCase();
        return text.includes(search);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [targets.parents, targets.teachers, user?.id, compose.target_type, recipientFilters]);

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
      setTargets({ parents: [], teachers: [], classes: [], sections: [] });
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
      target_type: "direct" | "parent" | "teacher" | "class" | "section";
      recipient_user_id?: number;
      class_id?: number;
      section_id?: number;
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
      <View style={styles.toolbar}>
        <Text style={styles.title}>Messaging</Text>
        <Pressable style={styles.primaryBtn} onPress={() => setComposeOpen(true)}>
          <Text style={styles.primaryBtnText}>New Message</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Conversations</Text>
        {loadingConversations ? (
          <ActivityIndicator size="small" color="#0f172a" />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.conversationChips}>
            {conversations.map((c) => {
              const active = Number(c.id) === Number(activeConversationId);
              return (
                <Pressable
                  key={c.id}
                  style={[styles.conversationChip, active && styles.conversationChipActive]}
                  onPress={() => setActiveConversationId(c.id)}
                >
                  <Text style={[styles.conversationText, active && styles.conversationTextActive]}>
                    {c.name || c.type}
                  </Text>
                  {Number(c.unread) > 0 ? <Text style={styles.unread}>{c.unread}</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>
          {activeConversation ? activeConversation.name || activeConversation.type : "Chat"}
        </Text>

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
                  <View key={m.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                    <Text style={styles.bubbleUser}>{mine ? "You" : m.username}</Text>
                    <Text style={styles.bubbleMessage}>{m.message}</Text>
                    <Text style={styles.bubbleTime}>{formatTimeLabel(m.created_at)}</Text>
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
            placeholder={activeConversationId ? "Type message..." : "Select conversation"}
            editable={Boolean(activeConversationId) && !sending}
          />
          <Pressable style={styles.primaryBtn} onPress={sendInActiveConversation} disabled={sending || !activeConversationId}>
            <Text style={styles.primaryBtnText}>{sending ? "..." : "Send"}</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={composeOpen} transparent animationType="slide" onRequestClose={() => setComposeOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setComposeOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Compose Message</Text>
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
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
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
                          </Text>
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
  },
  title: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 18,
  },
  panel: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  panelTitle: {
    color: "#0f172a",
    fontWeight: "700",
    marginBottom: 8,
  },
  conversationChips: {
    gap: 8,
    paddingBottom: 4,
  },
  conversationChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  conversationChipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#e2e8f0",
  },
  conversationText: {
    color: "#334155",
    fontWeight: "600",
    textTransform: "capitalize",
  },
  conversationTextActive: {
    color: "#0f172a",
  },
  unread: {
    color: "#fff",
    backgroundColor: "#dc2626",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: "700",
    minWidth: 18,
    textAlign: "center",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  centered: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  messagesWrap: {
    maxHeight: 320,
  },
  messagesContent: {
    gap: 8,
    paddingBottom: 8,
  },
  bubble: {
    borderRadius: 10,
    padding: 10,
    maxWidth: "88%",
  },
  bubbleMine: {
    backgroundColor: "#e2e8f0",
    alignSelf: "flex-end",
  },
  bubbleOther: {
    backgroundColor: "#f1f5f9",
    alignSelf: "flex-start",
  },
  bubbleUser: {
    fontSize: 11,
    color: "#475569",
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
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0f172a",
  },
  messageInput: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  primaryBtn: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "600",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
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


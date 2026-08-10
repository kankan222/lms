import { useEffect, useEffectEvent, useMemo, useState } from "react";
import ChatList from "../components/Chats/ChatList";
import ChatWindow from "../components/Chats/ChatWindow";
import TopBar from "../components/TopBar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  addConversationMember,
  deleteConversation,
  deleteMessage,
  editMessage,
  exportConversation,
  getConversationMembers,
  getConversations,
  getMessagingAudit,
  getMessages,
  getModerationReports,
  getTargets,
  markAsRead,
  removeConversationMember,
  removeMessageAttachment,
  reportMessage,
  searchMessages,
  sendMessage,
  sendTyping,
  suspendMessagingUser,
  unsuspendMessagingUser,
  updateConversation,
  updateModerationReport,
  uploadMessageAttachments,
} from "../api/messaging.api";
import { usePermissions } from "../hooks/usePermissions";
import { formatReadableDateTime } from "../lib/dateTime";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
const FIELD_CLASSNAME =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-hidden transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

function targetTypeLabel(value) {
  if (value === "direct") return "One-to-One";
  if (value === "parent") return "One Parent";
  if (value === "teacher") return "One Teacher";
  if (value === "class") return "Class";
  if (value === "section") return "Section";
  if (value === "broadcast") return "All Users";
  if (value === "all_classes") return "All Classes";
  if (value === "all_sections") return "All Sections";
  if (value === "all_parents") return "All Parents";
  if (value === "all_teachers") return "All Staff";
  return value || "-";
}

function normalizeTeacherScope(value) {
  if (value === "college" || value === "hs") return "college";
  if (value === "school") return "school";
  return "all";
}

function normalizeStaffType(value) {
  return value === "non_teaching" ? "non_teaching" : value === "teaching" ? "teaching" : "all";
}

function formatTeacherAudienceName(scope, staffType) {
  const scopeLabel = scope === "college" ? "College" : scope === "school" ? "School" : "";
  const staffLabel = staffType === "non_teaching" ? "Non Teaching Staff" : staffType === "teaching" ? "Teaching Staff" : "Staff";
  return ["All", scopeLabel, staffLabel].filter(Boolean).join(" ");
}

export default function Messaging() {
  const { can, hasRole } = usePermissions();
  const isSuperAdmin = hasRole("super_admin");
  const isParentOrTeacher = !isSuperAdmin && (hasRole("parent") || hasRole("teacher"));
  const canStartMessages = !isParentOrTeacher && (isSuperAdmin || can("messages.send"));
  const [conversations, setConversations] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [targets, setTargets] = useState({
    parents: [],
    teachers: [],
    classes: [],
    sections: [],
    broadcast_targets: []
  });
  const [openCompose, setOpenCompose] = useState(false);
  const [compose, setCompose] = useState({
    target_type: "parent",
    recipient_user_id: "",
    class_id: "",
    section_id: "",
    teacher_scope: "all",
    staff_type: "all",
    name: ""
  });
  const [composeStep, setComposeStep] = useState("audience");
  const [recipientFilters, setRecipientFilters] = useState({
    search: "",
    role: "all",
    class_id: "",
    section_id: "",
    medium: "",
    teacher_scope: "all",
    staff_type: "all"
  });
  const [composeError, setComposeError] = useState("");
  const [pendingConversationTarget, setPendingConversationTarget] = useState(null);
  const [pendingConversationLabel, setPendingConversationLabel] = useState("Conversation");
  const [typingUser, setTypingUser] = useState(null);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [moderationReports, setModerationReports] = useState([]);
  const [moderationAudit, setModerationAudit] = useState([]);
  const [conversationMembers, setConversationMembers] = useState([]);
  const [conversationSettings, setConversationSettings] = useState({
    allow_parent_reply: false,
    allow_teacher_reply: false
  });
  const isRecipientTarget = ["direct", "parent", "teacher"].includes(compose.target_type);
  const broadcastTargetOptions = useMemo(() => {
    if ((targets.broadcast_targets || []).length > 0) {
      return targets.broadcast_targets;
    }

    return [
      { key: "broadcast", label: "All Users" },
      { key: "all_classes", label: "All Classes" },
      { key: "all_sections", label: "All Sections" },
      { key: "all_parents", label: "All Parents" },
      { key: "all_teachers", label: "All Staff" }
    ];
  }, [targets.broadcast_targets]);

  const targetTypeOptions = useMemo(
    () => [
      { label: "Parent of one student", value: "parent", description: "Search by student, parent, class, or section" },
      { label: "One teacher", value: "teacher", description: "Search by teacher name or type" },
      { label: "One class, one section", value: "section", description: "Parents in one selected section" },
      { label: "Whole class, all sections", value: "class", description: "Parents across the selected class" },
      ...broadcastTargetOptions.map((item) => ({
        label: item.label,
        value: item.key,
        description: "Group or broadcast conversation",
      })),
    ],
    [broadcastTargetOptions]
  );

  const activeChat = conversations.find((c) => Number(c.id) === Number(activeChatId)) || (
    pendingConversationTarget
      ? {
          id: null,
          name: pendingConversationLabel,
          type: pendingConversationTarget.target_type === "parent" || pendingConversationTarget.target_type === "teacher"
            ? "direct"
            : pendingConversationTarget.target_type,
        }
      : null
  );
  const canReplyMessages = canStartMessages || (
    isParentOrTeacher &&
    activeChat &&
    (
      activeChat.type === "direct" ||
      (hasRole("parent") && Number(activeChat.allow_parent_reply) === 1) ||
      (hasRole("teacher") && Number(activeChat.allow_teacher_reply) === 1)
    )
  ) || (!activeChatId && pendingConversationTarget?.target_type === "admin");

  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const peopleRows = useMemo(() => {
    const parents = targets.parents.map((p) => ({
      role: "parent",
      user_id: p.user_id,
      name: p.name,
      email: p.email || "",
      mobile: p.mobile || "",
      class_id: p.class_id ? String(p.class_id) : "",
      section_id: p.section_id ? String(p.section_id) : "",
      class_name: p.class_name || "",
      section_name: p.section_name || "",
      medium: p.medium || "",
      class_scope: p.class_scope || ""
    }));

    const teachers = targets.teachers.map((t) => ({
      role: "teacher",
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
      teacher_scope: normalizeTeacherScope(t.type || t.class_scope),
      staff_type: normalizeStaffType(t.staff_type || "teaching")
    }));

    return [...parents, ...teachers].filter((r) => r.user_id);
  }, [targets]);

  const recipientOptions = useMemo(() => {
    const map = new Map();

    for (const row of peopleRows) {
      if (!row.user_id) continue;
      if (currentUser?.id && Number(row.user_id) === Number(currentUser.id)) continue;

      const key = String(row.user_id);
      if (!map.has(key)) {
        map.set(key, {
          user_id: row.user_id,
          name: row.name || "Unknown",
          email: row.email || "",
          mobile: row.mobile || "",
          roles: new Set(),
          classIds: new Set(),
          sectionIds: new Set(),
          classNames: new Set(),
          sectionNames: new Set(),
          mediums: new Set(),
          classScopes: new Set(),
          teacherScopes: new Set(),
          staffTypes: new Set()
        });
      }

      const item = map.get(key);
      item.roles.add(row.role);
      if (row.class_id) item.classIds.add(row.class_id);
      if (row.section_id) item.sectionIds.add(row.section_id);
      if (row.class_name) item.classNames.add(row.class_name);
      if (row.section_name) item.sectionNames.add(row.section_name);
      if (row.medium) item.mediums.add(row.medium);
      if (row.class_scope) item.classScopes.add(row.class_scope);
      if (row.teacher_scope) item.teacherScopes.add(row.teacher_scope);
      if (row.staff_type) item.staffTypes.add(row.staff_type);
    }

    const targetRole =
      compose.target_type === "parent"
        ? "parent"
        : compose.target_type === "teacher"
          ? "teacher"
          : recipientFilters.role;

    const search = recipientFilters.search.trim().toLowerCase();

    return Array.from(map.values())
      .map((u) => ({
        ...u,
        roles: Array.from(u.roles),
        classIds: Array.from(u.classIds),
        sectionIds: Array.from(u.sectionIds),
        classNames: Array.from(u.classNames),
        sectionNames: Array.from(u.sectionNames),
        mediums: Array.from(u.mediums),
        classScopes: Array.from(u.classScopes),
        teacherScopes: Array.from(u.teacherScopes),
        staffTypes: Array.from(u.staffTypes)
      }))
      .filter((u) => {
        if (targetRole !== "all" && !u.roles.includes(targetRole)) return false;
        if (recipientFilters.class_id && !u.classIds.includes(recipientFilters.class_id)) return false;
        if (recipientFilters.section_id && !u.sectionIds.includes(recipientFilters.section_id)) return false;
        if (recipientFilters.medium && !u.mediums.includes(recipientFilters.medium)) return false;
        if (
          recipientFilters.teacher_scope !== "all" &&
          u.roles.includes("teacher") &&
          !u.teacherScopes.includes(recipientFilters.teacher_scope)
        ) {
          return false;
        }
        if (
          recipientFilters.staff_type !== "all" &&
          u.roles.includes("teacher") &&
          !u.staffTypes.includes(recipientFilters.staff_type)
        ) {
          return false;
        }

        if (!search) return true;
        const searchText = [
          u.name,
          u.email,
          u.mobile,
          u.roles.join(" "),
          u.classNames.join(" "),
          u.sectionNames.join(" "),
          u.mediums.join(" "),
          u.classScopes.join(" "),
          u.teacherScopes.join(" "),
          u.staffTypes.join(" ")
        ]
          .join(" ")
          .toLowerCase();
        return searchText.includes(search);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [peopleRows, compose.target_type, recipientFilters, currentUser?.id]);
  const selectedRecipient = useMemo(
    () =>
      recipientOptions.find(
        (option) => String(option.user_id) === String(compose.recipient_user_id)
      ) || null,
    [recipientOptions, compose.recipient_user_id]
  );

  const selectedClass = useMemo(
    () => targets.classes.find((item) => String(item.id) === String(compose.class_id)) || null,
    [targets.classes, compose.class_id]
  );

  const selectedSection = useMemo(
    () => targets.sections.find((item) => String(item.id) === String(compose.section_id)) || null,
    [targets.sections, compose.section_id]
  );

  const defaultConversationName = useMemo(() => {
    if (compose.target_type === "class") return selectedClass ? `Class ${selectedClass.name}` : "";
    if (compose.target_type === "section") return selectedSection ? `Section ${selectedSection.class_name || ""} ${selectedSection.name}`.trim() : "";
    if (compose.target_type === "broadcast") return "All Users";
    if (compose.target_type === "all_classes") return "All Classes";
    if (compose.target_type === "all_sections") return "All Sections";
    if (compose.target_type === "all_parents") return "All Parents";
    if (compose.target_type === "all_teachers") {
      return formatTeacherAudienceName(compose.teacher_scope, compose.staff_type);
    }
    return "";
  }, [compose.target_type, compose.teacher_scope, compose.staff_type, selectedClass, selectedSection]);

  const effectiveConversationName = compose.name?.trim() || defaultConversationName;

  const targetRecipientCount = useMemo(() => {
    if (isRecipientTarget) return selectedRecipient ? 1 : 0;
    if (compose.target_type === "class" && compose.class_id) {
      return new Set(
        targets.parents
          .filter((item) => String(item.class_id) === String(compose.class_id))
          .map((item) => item.user_id)
          .filter(Boolean)
      ).size;
    }
    if (compose.target_type === "section" && compose.section_id) {
      return new Set(
        targets.parents
          .filter((item) => String(item.section_id) === String(compose.section_id))
          .map((item) => item.user_id)
          .filter(Boolean)
      ).size;
    }
    if (compose.target_type === "all_teachers") {
      return new Set(
        targets.teachers
          .filter((item) => {
            const teacherScope = normalizeTeacherScope(item.type || item.class_scope);
            const staffType = normalizeStaffType(item.staff_type || "teaching");
            return (
              (compose.teacher_scope === "all" || teacherScope === compose.teacher_scope) &&
              (compose.staff_type === "all" || staffType === compose.staff_type)
            );
          })
          .map((item) => item.user_id)
          .filter(Boolean)
      ).size;
    }
    if (compose.target_type === "broadcast") {
      return new Set([...targets.parents, ...targets.teachers].map((item) => item.user_id).filter(Boolean)).size;
    }
    if (compose.target_type === "all_parents" || compose.target_type === "all_classes" || compose.target_type === "all_sections") {
      return new Set(targets.parents.map((item) => item.user_id).filter(Boolean)).size;
    }
    return 0;
  }, [compose, isRecipientTarget, selectedRecipient, targets.parents, targets.teachers]);

  const canOpenComposeTarget = useMemo(() => {
    if (isRecipientTarget) return Boolean(compose.recipient_user_id);
    if (compose.target_type === "class") return Boolean(compose.class_id);
    if (compose.target_type === "section") return Boolean(compose.section_id);
    return Boolean(effectiveConversationName);
  }, [compose, effectiveConversationName, isRecipientTarget]);

  const sectionsBySelectedClass = useMemo(() => {
    if (!compose.class_id) return [];
    return targets.sections.filter((s) => String(s.class_id) === String(compose.class_id));
  }, [targets.sections, compose.class_id]);

  const sectionsByFilterClass = useMemo(() => {
    if (!recipientFilters.class_id) return targets.sections;
    return targets.sections.filter((s) => String(s.class_id) === String(recipientFilters.class_id));
  }, [targets.sections, recipientFilters.class_id]);

  const availableMedia = useMemo(() => {
    const values = new Set();
    for (const item of [...targets.sections, ...targets.classes, ...targets.parents, ...targets.teachers]) {
      if (item?.medium) values.add(item.medium);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [targets]);

  async function fetchConversations() {
    const res = await getConversations();
    setConversations(res?.data || []);
  }

  async function fetchMessages(conversationId) {
    const res = await getMessages(conversationId);
    setMessages(res?.data || []);
    await markAsRead({ conversation_id: conversationId });
  }

  async function fetchTargets() {
    const res = await getTargets();
    setTargets(res?.data || {
      parents: [],
      teachers: [],
      classes: [],
      sections: [],
      broadcast_targets: []
    });
  }

  const refreshMessaging = useEffectEvent(() => {
    fetchConversations();
    if (activeChatId) {
      fetchMessages(activeChatId);
    }
  });

  const loadInitialMessaging = useEffectEvent(() => {
    fetchConversations();
    if (canStartMessages) {
      fetchTargets();
    }
  });

  const loadActiveConversation = useEffectEvent((conversationId) => {
    if (conversationId) {
      fetchMessages(conversationId);
    }
  });

  const applyPresenceUpdate = useEffectEvent((payload) => {
    const userId = Number(payload?.user_id);
    if (!userId) return;

    setConversations((prev) =>
      prev.map((conversation) =>
        Number(conversation.other_user_id) === userId
          ? {
              ...conversation,
              online: Boolean(payload.online),
              last_seen_at: payload.last_seen_at || null,
            }
          : conversation
      )
    );
  });

  const handleRealtimeMessage = useEffectEvent((payload) => {
    fetchConversations();
    if (Number(payload?.conversation_id) === Number(activeChatId)) {
      fetchMessages(activeChatId);
    }
  });

  const handleTypingUpdate = useEffectEvent((payload) => {
    if (Number(payload?.conversation_id) !== Number(activeChatId)) return;
    setTypingUser(payload?.is_typing ? payload.user_id : null);
  });

  const handleMessageStateEvent = useEffectEvent((payload) => {
    if (Number(payload?.conversation_id) === Number(activeChatId)) {
      fetchMessages(activeChatId);
    }
    fetchConversations();
  });

  async function handleSendMessage(payload) {
    if (!canReplyMessages) return;
    if (!activeChatId && !pendingConversationTarget) return;
    let attachmentIds = [];
    if (payload.files?.length) {
      const uploaded = await uploadMessageAttachments(payload.files, payload.category);
      attachmentIds = (uploaded?.data || []).map((item) => item.id);
    }

    const response = await sendMessage({
      ...(activeChatId ? { conversation_id: activeChatId } : pendingConversationTarget),
      message: payload.message,
      attachment_ids: attachmentIds,
      reply_to_message_id: payload.reply_to_message_id || undefined,
    });

    const conversationId = activeChatId || response?.conversation_id;
    if (conversationId) {
      setPendingConversationTarget(null);
      setPendingConversationLabel("Conversation");
      setActiveChatId(conversationId);
      await fetchMessages(conversationId);
    }
    await fetchConversations();
  }

  async function handleEditMessage(message) {
    if (!canStartMessages) return;
    const next = window.prompt("Edit message", message.message || "");
    if (next === null || !next.trim()) return;
    await editMessage(message.id, next.trim());
    await fetchMessages(activeChatId);
  }

  async function handleDeleteMessage(message) {
    const mode = window.prompt("Type 'self' or 'everyone'", "self");
    if (!["self", "everyone"].includes(mode)) return;
    await deleteMessage(message.id, mode);
    await fetchMessages(activeChatId);
    await fetchConversations();
  }

  async function handleDeleteConversation(conversation) {
    if (!conversation?.id) return;
    const confirmed = window.confirm("Delete this chat from your list only? Other people will still see it.");
    if (!confirmed) return;
    await deleteConversation(conversation.id);
    setConversations((prev) => prev.filter((item) => Number(item.id) !== Number(conversation.id)));
    if (Number(activeChatId) === Number(conversation.id)) {
      setActiveChatId(null);
      setMessages([]);
    }
  }

  async function handleReportMessage(message) {
    const reason = window.prompt("Reason for reporting this message");
    if (!reason?.trim()) return;
    await reportMessage(message.id, reason.trim());
    window.alert("Message reported.");
  }

  async function handleForwardMessage(message) {
    if (!canStartMessages) return;
    const options = conversations
      .filter((item) => Number(item.id) !== Number(message.conversation_id))
      .map((item) => `${item.id}: ${item.name}`)
      .join("\n");
    const targetId = Number(window.prompt(`Forward to conversation ID:\n${options}`));
    if (!targetId) return;
    await sendMessage({
      conversation_id: targetId,
      message: "",
      forwarded_from_message_id: message.id,
    });
    await fetchConversations();
  }

  async function handleSearch(query) {
    if (!activeChatId) return;
    if (!query.trim()) {
      await fetchMessages(activeChatId);
      return;
    }
    const response = await searchMessages(activeChatId, query.trim());
    setMessages(response?.data || []);
  }

  function handleTyping(isTyping) {
    if (!canReplyMessages) return;
    if (!activeChatId || activeChat?.type !== "direct") return;
    sendTyping(activeChatId, isTyping).catch(() => {});
  }

  function handleMessageAdmin() {
    setPendingConversationTarget({ target_type: "admin" });
    setPendingConversationLabel("Admin");
    setActiveChatId(null);
    setMessages([]);
  }

  async function loadModeration() {
    const [reportsResponse, auditResponse, membersResponse] = await Promise.all([
      getModerationReports(),
      getMessagingAudit(activeChatId || ""),
      activeChatId
        ? getConversationMembers(activeChatId)
        : Promise.resolve({ data: [] }),
    ]);
    setModerationReports(reportsResponse?.data || []);
    setModerationAudit(auditResponse?.data || []);
    setConversationMembers(membersResponse?.data || []);
    if (activeChat) {
      setConversationSettings({
        allow_parent_reply: Number(activeChat.allow_parent_reply) === 1,
        allow_teacher_reply: Number(activeChat.allow_teacher_reply) === 1
      });
    }
  }

  async function handleSaveConversationSettings() {
    if (!activeChatId || !activeChat) return;
    const response = await updateConversation(activeChatId, {
      name: activeChat.name || activeChat.type,
      allow_parent_reply: conversationSettings.allow_parent_reply,
      allow_teacher_reply: conversationSettings.allow_teacher_reply
    });
    const updated = response?.data || {};
    setConversations((prev) =>
      prev.map((item) =>
        Number(item.id) === Number(activeChatId)
          ? {
              ...item,
              allow_parent_reply: Number(updated.allow_parent_reply) || 0,
              allow_teacher_reply: Number(updated.allow_teacher_reply) || 0,
            }
          : item
      )
    );
    window.alert("Conversation settings saved.");
  }

  async function handleResolveReport(reportId, status) {
    const note = window.prompt("Moderation note", "") || "";
    await updateModerationReport(reportId, status, note);
    await loadModeration();
  }

  async function handleSuspendActiveUser() {
    const userId = activeChat?.other_user_id;
    if (!userId) return;
    const reason = window.prompt("Suspension reason");
    if (!reason?.trim()) return;
    await suspendMessagingUser(userId, reason.trim());
    await loadModeration();
  }

  async function handleAddMember() {
    if (!activeChatId) return;
    const userId = Number(window.prompt("User ID to add"));
    if (!userId) return;
    const response = await addConversationMember(activeChatId, userId);
    setConversationMembers(response?.data || []);
  }

  async function handleRemoveMember(userId) {
    if (!activeChatId) return;
    const response = await removeConversationMember(activeChatId, userId);
    setConversationMembers(response?.data || []);
  }

  async function handleExportConversation() {
    if (!activeChatId) return;
    const response = await exportConversation(activeChatId);
    const blob = new Blob([JSON.stringify(response?.data || {}, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `conversation-${activeChatId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleRemoveAttachment(attachment) {
    if (!window.confirm(`Remove ${attachment.original_name}?`)) return;
    await removeMessageAttachment(attachment.id);
    await fetchMessages(activeChatId);
  }

  function resetComposeState() {
    setCompose({
      target_type: "parent",
      recipient_user_id: "",
      class_id: "",
      section_id: "",
      teacher_scope: "all",
      staff_type: "all",
      name: ""
    });
    setRecipientFilters({
      search: "",
      role: "all",
      class_id: "",
      section_id: "",
      medium: "",
      teacher_scope: "all",
      staff_type: "all"
    });
    setComposeStep("audience");
    setComposeError("");
  }

  function selectComposeAudience(targetType) {
    setCompose({
      target_type: targetType,
      recipient_user_id: "",
      class_id: "",
      section_id: "",
      teacher_scope: "all",
      staff_type: "all",
      name: ""
    });
    setRecipientFilters({
      search: "",
      role: "all",
      class_id: "",
      section_id: "",
      medium: "",
      teacher_scope: "all",
      staff_type: "all"
    });
    setComposeError("");
    setComposeStep("target");
  }

  function buildConversationTargetPayload() {
    const payload = {
      target_type: compose.target_type
    };
    let label = "Conversation";

    if (isRecipientTarget) {
      if (!compose.recipient_user_id) {
        setComposeError("Recipient is required.");
        return null;
      }
      payload.recipient_user_id = Number(compose.recipient_user_id);
      label = selectedRecipient?.name || `User #${compose.recipient_user_id}`;
    }

    if (compose.target_type === "class") {
      if (!compose.class_id) {
        setComposeError("Class is required.");
        return null;
      }
      payload.class_id = Number(compose.class_id);
      payload.name = effectiveConversationName;
      label = effectiveConversationName;
    }

    if (compose.target_type === "section") {
      if (!compose.section_id) {
        setComposeError("Section is required.");
        return null;
      }
      payload.section_id = Number(compose.section_id);
      payload.name = effectiveConversationName;
      label = effectiveConversationName;
    }

    if (compose.target_type === "broadcast") {
      payload.name = effectiveConversationName || "All Users";
      label = payload.name;
    }

    if (compose.target_type === "all_classes") {
      payload.name = effectiveConversationName || "All Classes";
      label = payload.name;
    }

    if (compose.target_type === "all_sections") {
      payload.name = effectiveConversationName || "All Sections";
      label = payload.name;
    }

    if (compose.target_type === "all_parents") {
      payload.name = effectiveConversationName || "All Parents";
      label = payload.name;
    }

    if (compose.target_type === "all_teachers") {
      payload.teacher_scope = compose.teacher_scope;
      payload.staff_type = compose.staff_type;
      payload.name = effectiveConversationName || formatTeacherAudienceName(compose.teacher_scope, compose.staff_type);
      label = payload.name;
    }

    return { payload, label };
  }

  function findConversationForTarget(payload, rows = conversations) {
    if (!payload?.target_type) return null;
    if (["direct", "parent", "teacher"].includes(payload.target_type)) {
      return rows.find(
        (row) => row.type === "direct" && Number(row.other_user_id || 0) === Number(payload.recipient_user_id || 0)
      ) || null;
    }
    if (payload.target_type === "class") {
      return rows.find(
        (row) => row.type === "class" && Number(row.class_id || 0) === Number(payload.class_id || 0)
      ) || null;
    }
    if (payload.target_type === "section") {
      return rows.find(
        (row) => row.type === "section" && Number(row.section_id || 0) === Number(payload.section_id || 0)
      ) || null;
    }
    const targetName = String(payload.name || "").trim().toLowerCase();
    return rows.find(
      (row) => row.type === "broadcast" && String(row.name || "").trim().toLowerCase() === targetName
    ) || null;
  }

  async function handleOpenComposeTarget() {
    setComposeError("");
    const prepared = buildConversationTargetPayload();
    if (!prepared) return;
    const { payload, label } = prepared;
    const existing = findConversationForTarget(payload);

    resetComposeState();
    setOpenCompose(false);
    setPendingConversationLabel(label);
    setMessages([]);

    if (existing?.id) {
      setPendingConversationTarget(null);
      setPendingConversationLabel("Conversation");
      setActiveChatId(existing.id);
      await fetchMessages(existing.id);
      return;
    }

    setActiveChatId(null);
    setPendingConversationTarget(payload);
  }

  useEffect(() => {
    loadInitialMessaging();
  }, []);

  useEffect(() => {
    loadActiveConversation(activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) return undefined;

    const streamUrl = `${API_URL}/messages/stream?access_token=${encodeURIComponent(accessToken)}`;
    const stream = new EventSource(streamUrl);

    stream.addEventListener("message:new", (event) => {
      const payload = JSON.parse(event.data || "{}");
      handleRealtimeMessage(payload);
    });

    stream.addEventListener("presence:update", (event) => {
      const payload = JSON.parse(event.data || "{}");
      applyPresenceUpdate(payload);
    });

    stream.addEventListener("typing:update", (event) => {
      const payload = JSON.parse(event.data || "{}");
      handleTypingUpdate(payload);
    });

    for (const eventName of ["message:updated", "message:deleted", "message:read"]) {
      stream.addEventListener(eventName, (event) => {
        const payload = JSON.parse(event.data || "{}");
        handleMessageStateEvent(payload);
      });
    }

    stream.onerror = () => {
      refreshMessaging();
    };

    return () => {
      stream.close();
    };
  }, []);

  return (
    <>
      <TopBar
        title="Messaging"
        subTitle="One-to-one and group messaging"
        action={isSuperAdmin ? (
          <div className="flex gap-2">
          <Dialog
            open={openCompose}
            onOpenChange={(open) => {
              setOpenCompose(open);
              if (!open) resetComposeState();
            }}
          >
            <DialogTrigger asChild>
              <Button>New Message</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-3xl">
              <DialogHeader className="border-b bg-card px-6 py-5">
                <DialogTitle>New Conversation</DialogTitle>
                <DialogDescription>
                  Step {composeStep === "audience" ? "1" : "2"} of 2
                </DialogDescription>
              </DialogHeader>
              {composeStep === "audience" ? (
                <ScrollArea className="max-h-[calc(88vh-96px)]">
                  <div className="space-y-5 px-6 py-5">
                    {[
                      { title: "One Person", values: ["parent", "teacher"] },
                      { title: "Class Or Section", values: ["section", "class", "all_classes"] },
                      { title: "Whole Group", values: ["all_parents", "all_teachers", "broadcast", "all_sections"] },
                    ].map((group) => (
                      <section key={group.title} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
                        <div className="grid gap-2">
                          {group.values.map((value) => {
                            const option = targetTypeOptions.find((item) => item.value === value);
                            if (!option) return null;
                            return (
                              <button
                                key={value}
                                type="button"
                                className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-left transition hover:bg-muted/50"
                                onClick={() => selectComposeAudience(value)}
                              >
                                <span>
                                  <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                                  <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
                                </span>
                                <span className="text-lg text-muted-foreground">&gt;</span>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex h-[calc(88vh-96px)] min-h-0 flex-col">
                  <ScrollArea className="min-h-0 flex-1">
                    <div className="space-y-4 px-6 py-5">
                      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Sending To</p>
                        <p className="mt-1 font-semibold text-foreground">{targetTypeLabel(compose.target_type)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {targetRecipientCount ? `${targetRecipientCount} recipient${targetRecipientCount === 1 ? "" : "s"}` : "Select target details"}
                        </p>
                      </div>

                      {isRecipientTarget ? (
                        <div className="space-y-4">
                          <Input
                            placeholder="Search by name, phone, email, class or section"
                            value={recipientFilters.search}
                            onChange={(event) => setRecipientFilters((prev) => ({ ...prev, search: event.target.value }))}
                          />
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="grid gap-2">
                              <Label>Class</Label>
                              <select
                                className={FIELD_CLASSNAME}
                                value={recipientFilters.class_id}
                                onChange={(event) => setRecipientFilters((prev) => ({ ...prev, class_id: event.target.value, section_id: "" }))}
                              >
                                <option value="">All Classes</option>
                                {targets.classes.map((item) => (
                                  <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="grid gap-2">
                              <Label>Section</Label>
                              <select
                                className={FIELD_CLASSNAME}
                                value={recipientFilters.section_id}
                                onChange={(event) => setRecipientFilters((prev) => ({ ...prev, section_id: event.target.value }))}
                              >
                                <option value="">All Sections</option>
                                {sectionsByFilterClass.map((item) => (
                                  <option key={item.id} value={item.id}>{item.class_name} - {item.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="grid gap-2">
                              <Label>Medium</Label>
                              <select
                                className={FIELD_CLASSNAME}
                                value={recipientFilters.medium}
                                onChange={(event) => setRecipientFilters((prev) => ({ ...prev, medium: event.target.value }))}
                              >
                                <option value="">All Media</option>
                                {availableMedia.map((medium) => (
                                  <option key={medium} value={medium}>{medium}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          {compose.target_type === "teacher" ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="grid gap-2">
                                <Label>Scope</Label>
                                <select
                                  className={FIELD_CLASSNAME}
                                  value={recipientFilters.teacher_scope}
                                  onChange={(event) => setRecipientFilters((prev) => ({ ...prev, teacher_scope: event.target.value }))}
                                >
                                  <option value="all">All Scopes</option>
                                  <option value="school">School</option>
                                  <option value="college">College</option>
                                </select>
                              </div>
                              <div className="grid gap-2">
                                <Label>Staff Type</Label>
                                <select
                                  className={FIELD_CLASSNAME}
                                  value={recipientFilters.staff_type}
                                  onChange={(event) => setRecipientFilters((prev) => ({ ...prev, staff_type: event.target.value }))}
                                >
                                  <option value="all">All Staff Types</option>
                                  <option value="teaching">Teaching</option>
                                  <option value="non_teaching">Non Teaching</option>
                                </select>
                              </div>
                            </div>
                          ) : null}
                          <div className="space-y-2">
                            {recipientOptions.length ? recipientOptions.map((item) => {
                              const selected = String(compose.recipient_user_id) === String(item.user_id);
                              return (
                                <button
                                  key={item.user_id}
                                  type="button"
                                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${selected ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50"}`}
                                  onClick={() => {
                                    setCompose((prev) => ({ ...prev, recipient_user_id: String(item.user_id) }));
                                    setComposeError("");
                                  }}
                                >
                                  <span className="block font-semibold text-foreground">{item.name}</span>
                                  <span className="mt-1 block text-xs text-muted-foreground">
                                    {item.roles.map((role) => role[0].toUpperCase() + role.slice(1)).join(", ")}
                                    {item.mobile ? ` | ${item.mobile}` : ""}
                                    {item.email ? ` | ${item.email}` : ""}
                                  </span>
                                </button>
                              );
                            }) : (
                              <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">No matching recipients found.</p>
                            )}
                          </div>
                        </div>
                      ) : compose.target_type === "class" ? (
                        <div className="grid gap-3">
                          <Label>Class</Label>
                          <select
                            className={FIELD_CLASSNAME}
                            value={compose.class_id}
                            onChange={(event) => setCompose((prev) => ({ ...prev, class_id: event.target.value, name: "" }))}
                          >
                            <option value="">Select Class</option>
                            {targets.classes.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}{item.medium ? ` (${item.medium})` : ""}</option>
                            ))}
                          </select>
                        </div>
                      ) : compose.target_type === "section" ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="grid gap-2">
                            <Label>Class</Label>
                            <select
                              className={FIELD_CLASSNAME}
                              value={compose.class_id}
                              onChange={(event) => setCompose((prev) => ({ ...prev, class_id: event.target.value, section_id: "", name: "" }))}
                            >
                              <option value="">Select Class</option>
                              {targets.classes.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}{item.medium ? ` (${item.medium})` : ""}</option>
                              ))}
                            </select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Section</Label>
                            <select
                              className={FIELD_CLASSNAME}
                              value={compose.section_id}
                              onChange={(event) => setCompose((prev) => ({ ...prev, section_id: event.target.value, name: "" }))}
                            >
                              <option value="">Select Section</option>
                              {sectionsBySelectedClass.map((item) => (
                                <option key={item.id} value={item.id}>{item.class_name} - {item.name}{item.medium ? ` (${item.medium})` : ""}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : compose.target_type === "all_teachers" ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="grid gap-2">
                            <Label>Scope</Label>
                            <select
                              className={FIELD_CLASSNAME}
                              value={compose.teacher_scope}
                              onChange={(event) => setCompose((prev) => ({ ...prev, teacher_scope: event.target.value, name: "" }))}
                            >
                              <option value="all">All Scopes</option>
                              <option value="school">School</option>
                              <option value="college">College</option>
                            </select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Staff Type</Label>
                            <select
                              className={FIELD_CLASSNAME}
                              value={compose.staff_type}
                              onChange={(event) => setCompose((prev) => ({ ...prev, staff_type: event.target.value, name: "" }))}
                            >
                              <option value="all">All Staff Types</option>
                              <option value="teaching">Teaching</option>
                              <option value="non_teaching">Non Teaching</option>
                            </select>
                          </div>
                        </div>
                      ) : null}

                      {!isRecipientTarget ? (
                        <div className="grid gap-2">
                          <Label>Conversation Name</Label>
                          <Input
                            value={compose.name}
                            onChange={(event) => setCompose((prev) => ({ ...prev, name: event.target.value }))}
                            placeholder={defaultConversationName || "Name this conversation"}
                          />
                          <p className="text-xs text-muted-foreground">Will appear as: {effectiveConversationName || "-"}</p>
                        </div>
                      ) : null}

                      {composeError ? (
                        <div className="rounded-lg border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
                          {composeError}
                        </div>
                      ) : null}
                    </div>
                  </ScrollArea>
                  <div className="flex items-center justify-between gap-3 border-t bg-card px-6 py-4">
                    <Button type="button" variant="outline" onClick={() => setComposeStep("audience")}>
                      Change Audience
                    </Button>
                    <Button type="button" onClick={handleOpenComposeTarget} disabled={!canOpenComposeTarget}>
                      Open Chat
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
          <Dialog
            open={moderationOpen}
            onOpenChange={(open) => {
              setModerationOpen(open);
              if (open) loadModeration().catch((err) => window.alert(err.message));
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">Moderation</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-5xl">
              <DialogHeader>
                <DialogTitle>Messaging Moderation</DialogTitle>
                <DialogDescription>
                  Review reports, audit activity, manage the active conversation, and export records.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-5 lg:grid-cols-2">
                <section className="space-y-3 rounded-xl border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Open Reports</h3>
                    <Button size="sm" variant="outline" onClick={() => loadModeration()}>
                      Refresh
                    </Button>
                  </div>
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {moderationReports.length ? moderationReports.map((report) => (
                      <div key={report.id} className="rounded-lg border p-3 text-sm">
                        <p className="font-medium">{report.reason}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Message #{report.message_id} by {report.reporter_name}
                        </p>
                        <p className="mt-2 line-clamp-2">{report.message || report.message_type}</p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" onClick={() => handleResolveReport(report.id, "resolved")}>
                            Resolve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleResolveReport(report.id, "dismissed")}>
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No reports.</p>}
                  </div>
                </section>

                <section className="space-y-3 rounded-xl border p-4">
                  <h3 className="font-semibold">Active Conversation</h3>
                  {activeChat ? (
                    <>
                      <p className="text-sm">{activeChat.name}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={handleExportConversation}>
                          Export JSON
                        </Button>
                        {activeChat.type === "direct" && activeChat.other_user_id ? (
                          <>
                            <Button size="sm" variant="destructive" onClick={handleSuspendActiveUser}>
                              Suspend User
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => unsuspendMessagingUser(activeChat.other_user_id)}>
                              Lift Suspension
                            </Button>
                          </>
                        ) : null}
                        {activeChat.type !== "direct" ? (
                          <Button size="sm" variant="outline" onClick={handleAddMember}>
                            Add Member
                          </Button>
                        ) : null}
                      </div>
                      {activeChat.type !== "direct" ? (
                        <div className="space-y-3 rounded-lg border p-3">
                          <div>
                            <p className="text-sm font-medium">Reply Permissions</p>
                            <p className="text-xs text-muted-foreground">
                              Controls whether parents or teachers can reply in this selected group.
                            </p>
                          </div>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={conversationSettings.allow_parent_reply}
                              disabled={activeChat.type === "broadcast"}
                              onCheckedChange={(checked) =>
                                setConversationSettings((prev) => ({
                                  ...prev,
                                  allow_parent_reply: Boolean(checked)
                                }))
                              }
                            />
                            Allow parent replies
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={conversationSettings.allow_teacher_reply}
                              disabled={activeChat.type === "broadcast"}
                              onCheckedChange={(checked) =>
                                setConversationSettings((prev) => ({
                                  ...prev,
                                  allow_teacher_reply: Boolean(checked)
                                }))
                              }
                            />
                            Allow teacher replies
                          </label>
                          <Button size="sm" onClick={handleSaveConversationSettings}>
                            Save Settings
                          </Button>
                        </div>
                      ) : null}
                      <div className="max-h-48 space-y-2 overflow-y-auto">
                        {conversationMembers.map((member) => (
                          <div key={member.user_id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                            <span>{member.name || `User #${member.user_id}`}</span>
                            {activeChat.type !== "direct" && Number(member.user_id) !== Number(currentUser?.id) ? (
                              <Button size="sm" variant="ghost" onClick={() => handleRemoveMember(member.user_id)}>
                                Remove
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <p className="text-sm text-muted-foreground">Select a conversation first.</p>}
                </section>
              </div>

              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="font-semibold">Audit History</h3>
                <div className="max-h-64 overflow-y-auto">
                  {moderationAudit.length ? moderationAudit.map((entry) => (
                    <div key={entry.id} className="border-b py-2 text-xs">
                      <span className="font-medium">{entry.action}</span>
                      <span className="ml-2 text-muted-foreground">
                        {formatReadableDateTime(entry.created_at)}
                      </span>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No audit entries.</p>}
                </div>
              </section>
            </DialogContent>
          </Dialog>
          </div>
        ) : null}
      />

      <div className="flex h-[calc(100vh-160px)] bg-secondary border">
        <ChatList
          conversations={conversations}
          activeChatId={activeChatId}
          onSelect={(conversationId) => {
            setPendingConversationTarget(null);
            setPendingConversationLabel("Conversation");
            setActiveChatId(conversationId);
          }}
          onNewChat={isSuperAdmin ? () => setOpenCompose(true) : isParentOrTeacher ? handleMessageAdmin : null}
          newChatLabel={isParentOrTeacher ? "Admin" : "New"}
          onDeleteChat={handleDeleteConversation}
        />

        <ChatWindow
          chat={activeChat}
          messages={messages}
          currentUserId={currentUser?.id}
          conversations={conversations}
          typingUser={typingUser}
          onSendMessage={handleSendMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onReportMessage={handleReportMessage}
          onForwardMessage={handleForwardMessage}
          onSearch={handleSearch}
          onTyping={handleTyping}
          canModerate={isSuperAdmin}
          canSendMessages={Boolean(canReplyMessages)}
          onRemoveAttachment={handleRemoveAttachment}
        />
      </div>
    </>
  );
}

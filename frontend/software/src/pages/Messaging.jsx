import { useEffect, useEffectEvent, useMemo, useState } from "react";
import ChatList from "../components/Chats/ChatList";
import ChatWindow from "../components/Chats/ChatWindow";
import TopBar from "../components/TopBar";
import { Button } from "@/components/ui/button";
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
  getConversations,
  getMessages,
  getTargets,
  markAsRead,
  sendMessage
} from "../api/messaging.api";
import { usePermissions } from "../hooks/usePermissions";

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
  if (value === "all_teachers") return "All Teachers";
  return value || "-";
}

export default function Messaging() {
  const { hasRole } = usePermissions();
  const isSuperAdmin = hasRole("super_admin");
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
    target_type: "direct",
    recipient_user_id: "",
    class_id: "",
    section_id: "",
    teacher_type: "all",
    message: ""
  });
  const [recipientFilters, setRecipientFilters] = useState({
    search: "",
    role: "all",
    class_id: "",
    section_id: "",
    medium: "",
    teacher_type: "all"
  });
  const [composeError, setComposeError] = useState("");
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
      { key: "all_teachers", label: "All Teachers" }
    ];
  }, [targets.broadcast_targets]);

  const activeChat = conversations.find((c) => Number(c.id) === Number(activeChatId));

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
      teacher_type: t.type || "school"
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
          teacherTypes: new Set()
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
      .map((u) => ({
        ...u,
        roles: Array.from(u.roles),
        classIds: Array.from(u.classIds),
        sectionIds: Array.from(u.sectionIds),
        classNames: Array.from(u.classNames),
        sectionNames: Array.from(u.sectionNames),
        mediums: Array.from(u.mediums),
        classScopes: Array.from(u.classScopes),
        teacherTypes: Array.from(u.teacherTypes)
      }))
      .filter((u) => {
        if (targetRole !== "all" && !u.roles.includes(targetRole)) return false;
        if (recipientFilters.class_id && !u.classIds.includes(recipientFilters.class_id)) return false;
        if (recipientFilters.section_id && !u.sectionIds.includes(recipientFilters.section_id)) return false;
        if (recipientFilters.medium && !u.mediums.includes(recipientFilters.medium)) return false;
        if (
          recipientFilters.teacher_type !== "all" &&
          u.roles.includes("teacher") &&
          !u.teacherTypes.includes(recipientFilters.teacher_type)
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
          u.teacherTypes.join(" ")
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
    fetchTargets();
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

  async function handleSendMessage(text) {
    if (!activeChatId || !text.trim()) return;

    await sendMessage({
      conversation_id: activeChatId,
      message: text.trim()
    });

    await fetchMessages(activeChatId);
    await fetchConversations();
  }

  async function handleComposeSend(e) {
    e.preventDefault();
    setComposeError("");
    if (!compose.message.trim()) {
      setComposeError("Message is required.");
      return;
    }

    const payload = {
      target_type: compose.target_type,
      message: compose.message.trim()
    };

    if (isRecipientTarget) {
      if (!compose.recipient_user_id) {
        setComposeError("Recipient is required.");
        return;
      }
      payload.recipient_user_id = Number(compose.recipient_user_id);
    }

    if (compose.target_type === "class") {
      if (!compose.class_id) {
        setComposeError("Class is required.");
        return;
      }
      payload.class_id = Number(compose.class_id);
      payload.name = `Class ${targets.classes.find((c) => String(c.id) === String(compose.class_id))?.name || compose.class_id}`;
    }

    if (compose.target_type === "section") {
      if (!compose.section_id) {
        setComposeError("Section is required.");
        return;
      }
      payload.section_id = Number(compose.section_id);
      const section = targets.sections.find((s) => String(s.id) === String(compose.section_id));
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
        compose.teacher_type === "college"
          ? "All College Teachers"
          : compose.teacher_type === "school"
            ? "All School Teachers"
            : "All Teachers";
    }

    let res;
    try {
      res = await sendMessage(payload);
    } catch (err) {
      setComposeError(err?.message || "Failed to send message.");
      return;
    }
    const conversationId = res?.conversation_id;

    setCompose({
      target_type: "direct",
      recipient_user_id: "",
      class_id: "",
      section_id: "",
      teacher_type: "all",
      message: ""
    });
    setRecipientFilters({
      search: "",
      role: "all",
      class_id: "",
      section_id: "",
      medium: "",
      teacher_type: "all"
    });
    setOpenCompose(false);

    await fetchConversations();
    if (conversationId) {
      setActiveChatId(conversationId);
      await fetchMessages(conversationId);
    }
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
          <Dialog open={openCompose} onOpenChange={setOpenCompose}>
            <DialogTrigger asChild>
              <Button>New Message</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-4xl">
              <DialogHeader className="border-b bg-card px-6 py-5">
                <DialogTitle>Compose Message</DialogTitle>
                <DialogDescription>
                  Choose the audience, confirm the recipient, and send a clear message.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleComposeSend} className="flex max-h-[calc(88vh-88px)] flex-col">
                <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <div className="space-y-3 rounded-xl border bg-card p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Audience</p>
                    <p className="text-sm text-muted-foreground">
                      Select where this message should go before writing it.
                    </p>
                  </div>
                <div className="grid gap-2">
                  <Label>Target Type *</Label>
                  <select
                    className={FIELD_CLASSNAME}
                    value={compose.target_type}
                    onChange={(e) =>
                      {
                        setCompose((prev) => ({
                          ...prev,
                          target_type: e.target.value,
                          recipient_user_id: "",
                          class_id: "",
                          section_id: "",
                          teacher_type: "all"
                        }));
                        setComposeError("");
                      }
                    }
                  >
                    <option value="direct">One-to-One</option>
                    <option value="parent">One Parent</option>
                    <option value="teacher">One Teacher</option>
                    <option value="class">To Class</option>
                    <option value="section">To Section</option>
                    {broadcastTargetOptions.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {targetTypeLabel(compose.target_type)}
                  </span>
                  {compose.target_type === "all_teachers" ? (
                    <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      {compose.teacher_type === "college"
                        ? "College teachers"
                        : compose.teacher_type === "school"
                          ? "School teachers"
                          : "All teacher types"}
                    </span>
                  ) : null}
                </div>
                </div>

                {isRecipientTarget && (
                  <div className="space-y-4 rounded-xl border bg-card p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Recipient</p>
                      <p className="text-sm text-muted-foreground">
                        Filter the list and select one person.
                      </p>
                    </div>

                    <div className="grid gap-2">
                    <Label>Find Recipient</Label>

                    <Input
                      placeholder="Search by name, phone, email, class or section"
                      value={recipientFilters.search}
                      onChange={(e) =>
                        setRecipientFilters((prev) => ({ ...prev, search: e.target.value }))
                      }
                    />
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {compose.target_type === "direct" && (
                        <div className="grid gap-2">
                          <Label>User Type</Label>
                          <select
                            className={FIELD_CLASSNAME}
                            value={recipientFilters.role}
                            onChange={(e) =>
                              setRecipientFilters((prev) => ({
                                ...prev,
                                role: e.target.value
                              }))
                            }
                          >
                            <option value="all">All User Types</option>
                            <option value="parent">Parents</option>
                            <option value="teacher">Teachers</option>
                          </select>
                        </div>
                      )}

                      <div className="grid gap-2">
                        <Label>Class</Label>
                        <select
                          className={FIELD_CLASSNAME}
                          value={recipientFilters.class_id}
                          onChange={(e) =>
                            setRecipientFilters((prev) => ({
                              ...prev,
                              class_id: e.target.value,
                              section_id: ""
                            }))
                          }
                        >
                          <option value="">All Classes</option>
                          {targets.classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                              {c.medium ? ` (${c.medium})` : ""}
                              {c.class_scope ? ` - ${c.class_scope === "hs" ? "Higher Secondary" : "School"}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Section</Label>
                        <select
                          className={FIELD_CLASSNAME}
                          value={recipientFilters.section_id}
                          onChange={(e) =>
                            setRecipientFilters((prev) => ({
                              ...prev,
                              section_id: e.target.value
                            }))
                          }
                        >
                          <option value="">All Sections</option>
                          {sectionsByFilterClass.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.class_name} - {s.name}{s.medium ? ` (${s.medium})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Medium</Label>
                        <select
                          className={FIELD_CLASSNAME}
                          value={recipientFilters.medium}
                          onChange={(e) =>
                            setRecipientFilters((prev) => ({
                              ...prev,
                              medium: e.target.value
                            }))
                          }
                        >
                          <option value="">All Media</option>
                          {availableMedia.map((medium) => (
                            <option key={medium} value={medium}>
                              {medium}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {(compose.target_type === "teacher" ||
                      (compose.target_type === "direct" &&
                        (recipientFilters.role === "teacher" || recipientFilters.role === "all"))) && (
                      <div className="grid gap-2 md:max-w-xs">
                        <Label>Teacher Type</Label>
                        <select
                          className={FIELD_CLASSNAME}
                          value={recipientFilters.teacher_type}
                          onChange={(e) =>
                            setRecipientFilters((prev) => ({
                              ...prev,
                              teacher_type: e.target.value
                            }))
                          }
                        >
                          <option value="all">All Teacher Types</option>
                          <option value="school">School</option>
                          <option value="college">College</option>
                        </select>
                      </div>
                    )}

                    {selectedRecipient ? (
                      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-primary">
                          Selected Recipient
                        </p>
                        <p className="mt-1 font-medium">{selectedRecipient.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedRecipient.roles
                            .map((role) => role[0].toUpperCase() + role.slice(1))
                            .join(", ")}
                          {selectedRecipient.mobile ? ` | ${selectedRecipient.mobile}` : ""}
                          {selectedRecipient.email ? ` | ${selectedRecipient.email}` : ""}
                        </p>
                      </div>
                    ) : null}

                    <div className="overflow-hidden rounded-xl border">
                      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">Matching Recipients</p>
                          <p className="text-xs text-muted-foreground">
                            {recipientOptions.length} result{recipientOptions.length === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                    <ScrollArea className="h-64 w-full">
                      <div className="space-y-2 p-3">
                        {recipientOptions.length === 0 && (
                          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                            No users found for current filters.
                          </p>
                        )}

                        {recipientOptions.map((u) => {
                          const isSelected = String(compose.recipient_user_id) === String(u.user_id);
                          return (
                            <button
                              key={u.user_id}
                              type="button"
                              onClick={() =>
                                {
                                  setCompose((prev) => ({
                                    ...prev,
                                    recipient_user_id: String(u.user_id)
                                  }));
                                  setComposeError("");
                                }
                              }
                              className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                                isSelected
                                  ? "border-primary bg-primary/5 shadow-sm"
                                  : "bg-background hover:bg-muted/60"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{u.name}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {u.roles.map((r) => r[0].toUpperCase() + r.slice(1)).join(", ")}
                                  </p>
                                </div>
                                {isSelected ? (
                                  <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
                                    Selected
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                {u.mobile ? u.mobile : "No phone"}
                                {u.email ? ` | ${u.email}` : ""}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {u.classNames.length ? `Class: ${u.classNames.join(", ")}` : "No class mapping"}
                                {u.sectionNames.length ? ` | Section: ${u.sectionNames.join(", ")}` : ""}
                                {u.mediums.length ? ` | Medium: ${u.mediums.join(", ")}` : ""}
                                {u.teacherTypes.length ? ` | Type: ${u.teacherTypes.join(", ")}` : ""}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    </div>
                  </div>
                )}

                {compose.target_type === "class" && (
                  <div className="space-y-3 rounded-xl border bg-card p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Class Selection</p>
                      <p className="text-sm text-muted-foreground">
                        Send one message to everyone in a class.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label>Class</Label>
                      <select
                        className={FIELD_CLASSNAME}
                        value={compose.class_id}
                        onChange={(e) =>
                          setCompose((prev) => ({ ...prev, class_id: e.target.value }))
                        }
                      >
                        <option value="">Select Class</option>
                        {targets.classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.medium ? ` (${c.medium})` : ""}
                            {c.class_scope ? ` - ${c.class_scope === "hs" ? "Higher Secondary" : "School"}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {compose.target_type === "section" && (
                  <div className="space-y-3 rounded-xl border bg-card p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Section Selection</p>
                      <p className="text-sm text-muted-foreground">
                        Pick a class first, then choose the section.
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Class</Label>
                      <select
                        className={FIELD_CLASSNAME}
                        value={compose.class_id}
                        onChange={(e) =>
                          setCompose((prev) => ({
                            ...prev,
                            class_id: e.target.value,
                            section_id: ""
                          }))
                        }
                      >
                        <option value="">Select Class</option>
                        {targets.classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.medium ? ` (${c.medium})` : ""}
                            {c.class_scope ? ` - ${c.class_scope === "hs" ? "Higher Secondary" : "School"}` : ""}
                          </option>
                          ))}
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Section</Label>
                      <select
                        className={FIELD_CLASSNAME}
                        value={compose.section_id}
                        onChange={(e) =>
                          setCompose((prev) => ({ ...prev, section_id: e.target.value }))
                        }
                      >
                        <option value="">Select Section</option>
                        {sectionsBySelectedClass.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.class_name} - {s.name}{s.medium ? ` (${s.medium})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    </div>
                  </div>
                )}

                {compose.target_type === "all_teachers" && (
                  <div className="space-y-3 rounded-xl border bg-card p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Teacher Audience</p>
                      <p className="text-sm text-muted-foreground">
                        Limit the broadcast to school or college teachers when needed.
                      </p>
                    </div>
                    <div className="grid gap-2 md:max-w-xs">
                      <Label>Teacher Type</Label>
                      <select
                        className={FIELD_CLASSNAME}
                        value={compose.teacher_type}
                        onChange={(e) =>
                          setCompose((prev) => ({
                            ...prev,
                            teacher_type: e.target.value
                          }))
                        }
                      >
                        <option value="all">All Teachers</option>
                        <option value="school">School Teachers</option>
                        <option value="college">College Teachers</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="space-y-3 rounded-xl border bg-card p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Message</p>
                    <p className="text-sm text-muted-foreground">
                      Keep it short and action-oriented so the recipient knows what to do next.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Message *</Label>
                    <textarea
                      className="min-h-36 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground shadow-xs outline-hidden transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                      value={compose.message}
                      onChange={(e) =>
                        setCompose((prev) => ({ ...prev, message: e.target.value }))
                      }
                      placeholder="Write your message here..."
                    />
                  </div>
                </div>
                {composeError && (
                  <div className="rounded-lg border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
                    {composeError}
                  </div>
                )}
                </div>
                <div className="border-t bg-card px-6 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      {isRecipientTarget
                        ? selectedRecipient
                          ? `Ready to send to ${selectedRecipient.name}.`
                          : "Select one recipient before sending."
                        : "Review the target and send when ready."}
                    </p>
                    <div className="flex gap-2 sm:justify-end">
                      <Button type="button" variant="outline" onClick={() => setOpenCompose(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        Send Message
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      />

      <div className="flex h-[calc(100vh-160px)] bg-secondary border">
        <ChatList
          conversations={conversations}
          activeChatId={activeChatId}
          onSelect={setActiveChatId}
          onNewChat={isSuperAdmin ? () => setOpenCompose(true) : null}
        />

        <ChatWindow
          chat={activeChat}
          messages={messages}
          currentUserId={currentUser?.id}
          onSendMessage={handleSendMessage}
        />
      </div>
    </>
  );
}

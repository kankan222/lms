import { useEffect, useMemo, useState } from "react";
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

export default function Messaging() {
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

  async function loadConversations() {
    const res = await getConversations();
    setConversations(res?.data || []);
  }

  async function loadMessages(conversationId) {
    const res = await getMessages(conversationId);
    setMessages(res?.data || []);
    await markAsRead({ conversation_id: conversationId });
  }

  async function loadTargets() {
    const res = await getTargets();
    setTargets(res?.data || {
      parents: [],
      teachers: [],
      classes: [],
      sections: [],
      broadcast_targets: []
    });
  }

  async function handleSendMessage(text) {
    if (!activeChatId || !text.trim()) return;

    await sendMessage({
      conversation_id: activeChatId,
      message: text.trim()
    });

    await loadMessages(activeChatId);
    await loadConversations();
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

    await loadConversations();
    if (conversationId) {
      setActiveChatId(conversationId);
      await loadMessages(conversationId);
    }
  }

  useEffect(() => {
    loadConversations();
    loadTargets();
  }, []);

  useEffect(() => {
    if (activeChatId) loadMessages(activeChatId);
  }, [activeChatId]);

  return (
    <>
      <TopBar
        title="Messaging"
        subTitle="One-to-one and group messaging"
        action={
          <Dialog open={openCompose} onOpenChange={setOpenCompose}>
            <DialogTrigger asChild>
              <Button>New Message</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Compose Message</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleComposeSend} className="space-y-3">
                <div className="grid gap-1">
                  <Label>Target Type *</Label>
                  <select
                    className="border rounded p-2"
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

                {isRecipientTarget && (
                  <div className="space-y-2">
                    <Label>Find Recipient</Label>

                    <Input
                      placeholder="Search by name, phone, email, class or section"
                      value={recipientFilters.search}
                      onChange={(e) =>
                        setRecipientFilters((prev) => ({ ...prev, search: e.target.value }))
                      }
                    />

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      {compose.target_type === "direct" && (
                        <select
                          className="border rounded p-2"
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
                      )}

                      <select
                        className="border rounded p-2"
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

                      <select
                        className="border rounded p-2"
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

                      <select
                        className="border rounded p-2"
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

                    {(compose.target_type === "teacher" ||
                      (compose.target_type === "direct" &&
                        (recipientFilters.role === "teacher" || recipientFilters.role === "all"))) && (
                      <div className="grid gap-1">
                        <Label>Teacher Type</Label>
                        <select
                          className="border rounded p-2"
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

                    <ScrollArea className="h-48 w-full rounded-md border">
                      <div className="p-1 space-y-1">
                        {recipientOptions.length === 0 && (
                          <p className="text-sm text-muted-foreground p-2">
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
                              className={`w-full text-left rounded border p-2 transition ${
                                isSelected ? "bg-primary/10 border-primary" : "hover:bg-muted/70"
                              }`}
                            >
                              <div className="font-medium">{u.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {u.roles.map((r) => r[0].toUpperCase() + r.slice(1)).join(", ")}
                                {u.mobile ? ` | ${u.mobile}` : ""}
                                {u.email ? ` | ${u.email}` : ""}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {u.classNames.length ? `Class: ${u.classNames.join(", ")}` : ""}
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
                )}

                {compose.target_type === "class" && (
                  <div className="grid gap-1">
                    <Label>Class</Label>
                    <select
                      className="border rounded p-2"
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
                )}

                {compose.target_type === "section" && (
                  <>
                    <div className="grid gap-1">
                      <Label>Class</Label>
                      <select
                        className="border rounded p-2"
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

                    <div className="grid gap-1">
                      <Label>Section</Label>
                      <select
                        className="border rounded p-2"
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
                  </>
                )}

                {compose.target_type === "all_teachers" && (
                  <div className="grid gap-1">
                    <Label>Teacher Type</Label>
                    <select
                      className="border rounded p-2"
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
                )}

                <div className="grid gap-1">
                  <Label>Message *</Label>
                  <textarea
                    className="border rounded p-2 min-h-24"
                    value={compose.message}
                    onChange={(e) =>
                      setCompose((prev) => ({ ...prev, message: e.target.value }))
                    }
                    placeholder="Type message..."
                  />
                </div>
                {composeError && (
                  <p className="text-sm text-red-600">{composeError}</p>
                )}

                <Button type="submit" className="w-full">
                  Send
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex h-[calc(100vh-160px)] bg-secondary border">
        <ChatList
          conversations={conversations}
          activeChatId={activeChatId}
          onSelect={setActiveChatId}
          onNewChat={() => setOpenCompose(true)}
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

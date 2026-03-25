import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import TopNotice from "../../components/feedback/TopNotice";
import { useAuthStore } from "../../store/authStore";
import { assignTeacher, createTeacher, deleteTeacher, getTeacherAssignments, getTeachers, removeAssignment, resolveTeacherPhotoUrl, TeacherAssignment, TeacherItem, updateTeacher } from "../../services/teachersService";
import { ClassStructureItem, getClassStructure, getSessions, SessionItem } from "../../services/classesService";
import TeacherDetailsModule from "./teachers/TeacherDetailsModule";
import { useAppTheme } from "../../theme/AppThemeProvider";

type TeacherScope = "school" | "hs";
type ScopeFilter = "all" | TeacherScope;
type Notice = { title: string; message: string; tone: "success" | "error" } | null;
type TeacherPhoto = { uri: string; name?: string; type?: string } | null;
type TeacherForm = { id?: number | null; employee_id: string; name: string; phone: string; email: string; class_scope: TeacherScope; password?: string; photo: TeacherPhoto; photo_preview: string | null };
type AssignmentForm = { class_id: number | null; section_id: number | null; subject_id: number | null; session_id: number | null };
type AssignmentSelections = { sections: number[]; subjects: number[] };

const EMPTY_CREATE: TeacherForm = { employee_id: "", name: "", phone: "", email: "", class_scope: "school", password: "", photo: null, photo_preview: null };
const EMPTY_EDIT: TeacherForm = { id: null, employee_id: "", name: "", phone: "", email: "", class_scope: "school", photo: null, photo_preview: null };
const EMPTY_ASSIGNMENT: AssignmentForm = { class_id: null, section_id: null, subject_id: null, session_id: null };

const getErrorMessage = (err: unknown, fallback: string) => typeof err === "object" && err && "response" in err ? ((err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error || (err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message || fallback) : fallback;
const formatScope = (scope?: string | null) => scope === "hs" ? "Higher Secondary" : "School";
function isHsClassName(name: string) { const value = String(name || "").trim().toLowerCase(); return Boolean(value && (value.includes("higher secondary") || /\bhs\b/.test(value) || /\b(11|12|xi|xii)\b/.test(value) || value.includes("1st year") || value.includes("2nd year"))); }
function matchesScope(item: ClassStructureItem, scope: TeacherScope) { const resolved = item.class_scope ?? (isHsClassName(item.name) ? "hs" : "school"); return scope === "hs" ? resolved === "hs" : resolved !== "hs"; }
function deriveAssignmentSelections(rows: TeacherAssignment[], classId: number | null, sessionId: number | null): AssignmentSelections {
  const scopedRows = rows.filter((row) => {
    const matchesClass = classId ? Number(row.class_id) === Number(classId) : true;
    const matchesSession = sessionId ? Number(row.session_id) === Number(sessionId) : true;
    return matchesClass && matchesSession;
  });

  return {
    sections: Array.from(new Set(scopedRows.map((row) => Number(row.section_id)).filter(Boolean))),
    subjects: Array.from(new Set(scopedRows.map((row) => Number(row.subject_id)).filter(Boolean))),
  };
}

function validateTeacher(form: TeacherForm, requirePassword = false) {
  const name = String(form.name || "").trim();
  const phone = String(form.phone || "").trim();
  const email = String(form.email || "").trim();
  if (!name || /^\d+$/.test(name)) return "Valid teacher name required.";
  if (!phone && !email) return "Provide either phone or email.";
  if (phone && !/^\d{10}$/.test(phone)) return "Phone must be 10 digits.";
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return "Valid email required.";
  if (!["school", "hs"].includes(String(form.class_scope || ""))) return "Class scope is required.";
  if (requirePassword && String(form.password || "").length < 6) return "Password must be at least 6 characters.";
  return null;
}

function Sheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  return <View style={styles.modalOverlay}><Pressable style={styles.modalBackdrop} onPress={onClose} /><View style={styles.modalCard}><View style={styles.rowBetween}><View style={styles.sheetHeaderCopy}><Text style={styles.modalTitle}>{title}</Text>{subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}</View><Pressable style={styles.closeBtn} onPress={onClose}><Text style={styles.closeBtnText}>Close</Text></Pressable></View><ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>{children}</ScrollView></View></View>;
}

function FormInput({ label, value, onChangeText, placeholder, keyboardType = "default", autoCapitalize = "sentences", secureTextEntry = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; keyboardType?: "default" | "email-address" | "phone-pad"; autoCapitalize?: "none" | "sentences" | "words" | "characters"; secureTextEntry?: boolean }) {
  return <View style={styles.fieldBlock}><Text style={styles.inputLabel}>{label}</Text><TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} autoCapitalize={autoCapitalize} secureTextEntry={secureTextEntry} placeholderTextColor="#94a3b8" /></View>;
}

function PhotoField({ label, previewUri, onPick, onRemove }: { label: string; previewUri?: string | null; onPick: () => void; onRemove: () => void }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.photoField}>
        <View style={styles.photoPreviewWrap}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.photoPreview} />
          ) : (
            <View style={styles.photoPreviewEmpty}>
              <Ionicons name="person-outline" size={24} color="#64748b" />
            </View>
          )}
        </View>
        <View style={styles.photoActions}>
          <Pressable style={styles.photoActionBtn} onPress={onPick}>
            <Ionicons name="image-outline" size={16} color="#334155" />
            <Text style={styles.photoActionText}>{previewUri ? "Change Photo" : "Upload Photo"}</Text>
          </Pressable>
          {previewUri ? (
            <Pressable style={styles.photoRemoveBtn} onPress={onRemove}>
              <Ionicons name="trash-outline" size={16} color="#b91c1c" />
              <Text style={styles.photoRemoveText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function CardAction({ icon, label, onPress, tone = "default" }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; tone?: "default" | "danger" }) {
  const isDanger = tone === "danger";
  return <Pressable style={[styles.cardActionBtn, isDanger && styles.cardDeleteBtn]} onPress={onPress}><Ionicons name={icon} size={15} color={isDanger ? "#b91c1c" : "#334155"} /><Text style={[styles.cardActionText, isDanger && styles.cardDeleteText]}>{label}</Text></Pressable>;
}

export default function TeachersTab() {
  const { theme } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions || [];
  const canManageTeachers = permissions.includes("teacher.update");
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [classStructure, setClassStructure] = useState<ClassStructureItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [createForm, setCreateForm] = useState<TeacherForm>(EMPTY_CREATE);
  const [editForm, setEditForm] = useState<TeacherForm>(EMPTY_EDIT);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>(EMPTY_ASSIGNMENT);
  const [selectedAssignmentSections, setSelectedAssignmentSections] = useState<number[]>([]);
  const [selectedAssignmentSubjects, setSelectedAssignmentSubjects] = useState<number[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherItem | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);

  const activeSession = useMemo(() => sessions.find((s) => Number(s.is_active) === 1 || s.is_active === true) ?? null, [sessions]);
  const filteredTeachers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return teachers.filter((teacher) => {
      const matchesQuery = !query || [teacher.name, teacher.employee_id, teacher.phone, teacher.email].join(" ").toLowerCase().includes(query);
      const matches = scopeFilter === "all" || (teacher.class_scope ?? "school") === scopeFilter;
      return matchesQuery && matches;
    });
  }, [teachers, search, scopeFilter]);
  const selfTeacher = !canManageTeachers ? teachers[0] ?? null : null;
  const filteredAssignmentClasses = useMemo(() => classStructure.filter((item) => matchesScope(item, (selectedTeacher?.class_scope ?? "school") as TeacherScope)), [classStructure, selectedTeacher?.class_scope]);
  const selectedClass = useMemo(() => filteredAssignmentClasses.find((item) => item.id === assignmentForm.class_id) ?? null, [filteredAssignmentClasses, assignmentForm.class_id]);
  const stats = useMemo(() => {
    const school = teachers.filter((t) => (t.class_scope ?? "school") === "school").length;
    const hs = teachers.filter((t) => (t.class_scope ?? "school") === "hs").length;
    const withPhone = teachers.filter((t) => String(t.phone || "").trim()).length;
    return [
      { label: "Total Teachers", value: teachers.length, accent: "#dbeafe", tone: "#1d4ed8" },
      { label: "School", value: school, accent: "#dcfce7", tone: "#15803d" },
      { label: "Higher Secondary", value: hs, accent: "#ede9fe", tone: "#6d28d9" },
      { label: "Phone Linked", value: withPhone, accent: "#fef3c7", tone: "#b45309" },
    ];
  }, [teachers]);

  const loadData = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [teacherRows, structureRows, sessionRows] = await Promise.all([getTeachers(), getClassStructure(), getSessions()]);
      setTeachers(teacherRows.map((teacher) => ({ ...teacher, class_scope: (teacher.class_scope ?? "school") as TeacherScope })));
      setClassStructure(structureRows);
      setSessions(sessionRows);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not load teachers."));
    } finally {
      if (mode === "refresh") setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (activeSession && assignmentForm.session_id === null) setAssignmentForm((prev) => ({ ...prev, session_id: activeSession.id })); }, [activeSession, assignmentForm.session_id]);
  useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(null), 3200); return () => clearTimeout(timer); }, [notice]);

  function showNotice(title: string, message: string, tone: "success" | "error" = "success") { setNotice({ title, message, tone }); }

  async function pickTeacherPhoto(target: "create" | "edit") {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const fileName = asset.fileName || asset.uri.split("/").pop() || `teacher-photo-${Date.now()}.jpg`;
      const nextPhoto = {
        uri: asset.uri,
        name: fileName,
        type: asset.mimeType || "image/jpeg",
      };
      if (target === "create") {
        setCreateForm((prev) => ({ ...prev, photo: nextPhoto, photo_preview: asset.uri }));
      } else {
        setEditForm((prev) => ({ ...prev, photo: nextPhoto, photo_preview: asset.uri }));
      }
    } catch (err: unknown) {
      Alert.alert("Photo failed", getErrorMessage(err, "Could not open image library."));
    }
  }

  function clearTeacherPhoto(target: "create" | "edit") {
    if (target === "create") {
      setCreateForm((prev) => ({ ...prev, photo: null, photo_preview: null }));
    } else {
      setEditForm((prev) => ({ ...prev, photo: null, photo_preview: null }));
    }
  }

  async function handleCreate() {
    const validation = validateTeacher(createForm, true);
    if (validation) return Alert.alert("Validation", validation);
    setSaving(true);
    try {
      await createTeacher({ employee_id: createForm.employee_id.trim(), name: createForm.name.trim(), phone: createForm.phone.trim(), email: createForm.email.trim(), class_scope: createForm.class_scope, password: String(createForm.password || ""), photo: createForm.photo });
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
      await loadData("refresh");
      showNotice("Teacher Created", "Teacher record created successfully.");
    } catch (err: unknown) {
      Alert.alert("Create failed", getErrorMessage(err, "Could not create teacher."));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(teacher: TeacherItem) {
    setEditForm({ id: teacher.id, employee_id: teacher.employee_id ?? "", name: teacher.name ?? "", phone: teacher.phone ?? "", email: teacher.email ?? "", class_scope: (teacher.class_scope ?? "school") as TeacherScope, photo: null, photo_preview: resolveTeacherPhotoUrl(teacher.photo_url) });
    setEditOpen(true);
  }

  async function handleEdit() {
    const validation = validateTeacher(editForm, false);
    if (validation) return Alert.alert("Validation", validation);
    if (!editForm.id) return;
    setSaving(true);
    try {
      await updateTeacher(editForm.id, { employee_id: editForm.employee_id.trim(), name: editForm.name.trim(), phone: editForm.phone.trim(), email: editForm.email.trim(), class_scope: editForm.class_scope, photo: editForm.photo });
      setEditOpen(false);
      setEditForm(EMPTY_EDIT);
      await loadData("refresh");
      showNotice("Teacher Updated", "Teacher record updated successfully.");
    } catch (err: unknown) {
      Alert.alert("Update failed", getErrorMessage(err, "Could not update teacher."));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(id: number) {
    Alert.alert("Delete teacher", "Do you want to delete this teacher?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { await deleteTeacher(id); setTeachers((prev) => prev.filter((item) => item.id !== id)); showNotice("Teacher Deleted", "Teacher record deleted successfully."); } catch (err: unknown) { Alert.alert("Delete failed", getErrorMessage(err, "Could not delete teacher.")); } } },
    ]);
  }

  async function openAssignments(teacher: TeacherItem) {
    setSelectedTeacher(teacher);
    setAssignmentOpen(true);
    setLoadingAssignments(true);
    try {
      const rows = await getTeacherAssignments(teacher.id);
      setAssignments(rows);
      const initialSessionId = Number(activeSession?.id || rows[0]?.session_id || 0) || null;
      const initialClassId = Number(rows[0]?.class_id || 0) || null;
      const initialSelections = deriveAssignmentSelections(rows, initialClassId, initialSessionId);
      setAssignmentForm({
        class_id: initialClassId,
        section_id: initialSelections.sections[0] ?? null,
        subject_id: initialSelections.subjects[0] ?? null,
        session_id: initialSessionId,
      });
      setSelectedAssignmentSections(initialSelections.sections);
      setSelectedAssignmentSubjects(initialSelections.subjects);
    } catch (err: unknown) {
      setAssignments([]);
      setAssignmentForm({ ...EMPTY_ASSIGNMENT, session_id: activeSession?.id ?? null });
      setSelectedAssignmentSections([]);
      setSelectedAssignmentSubjects([]);
      Alert.alert("Load failed", getErrorMessage(err, "Could not load assignments."));
    } finally {
      setLoadingAssignments(false);
    }
  }

  function openDetails(teacher: TeacherItem) {
    setSelectedTeacherId(teacher.id);
    setDetailsOpen(true);
  }

  async function submitAssignment() {
    if (!selectedTeacher) return;
    const { class_id, session_id } = assignmentForm;
    if (!class_id || !session_id || !selectedAssignmentSections.length || !selectedAssignmentSubjects.length) return Alert.alert("Validation", "Class, section, subject and session are required.");
    setSaving(true);
    try {
      await Promise.all(
        selectedAssignmentSubjects.flatMap((subjectId) =>
          selectedAssignmentSections.map((sectionId) =>
            assignTeacher(selectedTeacher.id, { class_id, section_id: sectionId, subject_id: subjectId, session_id }),
          ),
        ),
      );
      const rows = await getTeacherAssignments(selectedTeacher.id);
      setAssignments(rows);
      const nextSelections = deriveAssignmentSelections(rows, class_id, session_id);
      setAssignmentForm((prev) => ({ ...prev, section_id: nextSelections.sections[0] ?? null, subject_id: nextSelections.subjects[0] ?? null }));
      setSelectedAssignmentSections(nextSelections.sections);
      setSelectedAssignmentSubjects(nextSelections.subjects);
      showNotice("Assignment Added", "Teacher assignment saved successfully.");
    } catch (err: unknown) {
      Alert.alert("Assign failed", getErrorMessage(err, "Could not assign teacher."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAssignment(assignmentId: number) {
    try {
      await removeAssignment(assignmentId);
      setAssignments((prev) => prev.filter((item) => item.id !== assignmentId));
      showNotice("Assignment Removed", "Teacher assignment removed successfully.");
    } catch (err: unknown) {
      Alert.alert("Delete failed", getErrorMessage(err, "Could not remove assignment."));
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData("refresh")} />}>
      <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.heroCopy}>
          <Text style={[styles.title, { color: theme.text }]}>{canManageTeachers ? "Teachers" : "My Profile"}</Text>
          <Text style={[styles.subtitle, { color: theme.subText }]}>{canManageTeachers ? "Manage teacher records and assignment scopes with the live backend data." : "View your teacher profile and assignments."}</Text>
        </View>
        <View style={styles.heroActions}>
          <View style={styles.heroPrimaryActions}>
            <Pressable style={styles.iconUtilityBtn} onPress={() => loadData("refresh")}>
              <Ionicons name="refresh-outline" size={18} color="#334155" />
            </Pressable>
            {canManageTeachers ? <Pressable style={styles.heroPrimaryBtn} onPress={() => setCreateOpen(true)}><Text style={styles.primaryBtnText}>Add Teacher</Text></Pressable> : null}
          </View>
        </View>
      </View>

      <TopNotice notice={notice} />

      {canManageTeachers ? <View style={styles.statsGrid}>{stats.map((item) => <View key={item.label} style={[styles.statCard, { backgroundColor: item.accent }]}><Text style={styles.statLabel}>{item.label}</Text><Text style={[styles.statValue, { color: item.tone }]}>{item.value}</Text></View>)}</View> : null}

      {loading ? <View style={styles.centered}><ActivityIndicator size="large" color={theme.text} /></View> : <>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {canManageTeachers ? <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.rowBetween}><Text style={[styles.sectionTitle, { color: theme.text }]}>Teacher Directory</Text><Text style={[styles.hint, { color: theme.subText }]}>{filteredTeachers.length} visible</Text></View>
          <FormInput label="Search" value={search} onChangeText={setSearch} placeholder="Name, employee ID, phone or email" autoCapitalize="none" />
          <Text style={styles.inputLabel}>Scope</Text>
          <View style={styles.filterRow}>{(["all", "school", "hs"] as ScopeFilter[]).map((scope) => <Pressable key={scope} style={[styles.filterChip, scopeFilter === scope && styles.filterChipActive]} onPress={() => setScopeFilter(scope)}><Text style={[styles.filterChipText, scopeFilter === scope && styles.filterChipTextActive]}>{scope === "all" ? "All" : formatScope(scope)}</Text></Pressable>)}</View>
        </View> : null}

        {selfTeacher ? <View style={[styles.teacherCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardTop}><View style={[styles.avatarBadge, { backgroundColor: theme.cardMuted }]}>{resolveTeacherPhotoUrl(selfTeacher.photo_url) ? <Image source={{ uri: resolveTeacherPhotoUrl(selfTeacher.photo_url)! }} style={styles.avatarImage} /> : <Text style={[styles.avatarText, { color: theme.text }]}>{selfTeacher.name?.slice(0, 1)?.toUpperCase() || "T"}</Text>}</View><View style={styles.cardCopy}><Text style={[styles.teacherName, { color: theme.text }]}>{selfTeacher.name}</Text><Text style={[styles.teacherMeta, { color: theme.subText }]}>{formatScope(selfTeacher.class_scope)}</Text></View></View>
          <View style={styles.detailList}><Text style={styles.detailText}>Employee ID: {selfTeacher.employee_id || "-"}</Text><Text style={styles.detailText}>Phone: {selfTeacher.phone || "-"}</Text><Text style={styles.detailText}>Email: {selfTeacher.email || "-"}</Text></View>
          <View style={styles.cardActions}>
            <CardAction icon="eye-outline" label="Details" onPress={() => openDetails(selfTeacher)} />
            <CardAction icon="git-network-outline" label="Assignments" onPress={() => openAssignments(selfTeacher)} />
          </View>
        </View> : <View style={styles.grid}>
          {filteredTeachers.map((teacher) => <View key={teacher.id} style={[styles.teacherCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardTop}><View style={[styles.avatarBadge, { backgroundColor: theme.cardMuted }]}>{resolveTeacherPhotoUrl(teacher.photo_url) ? <Image source={{ uri: resolveTeacherPhotoUrl(teacher.photo_url)! }} style={styles.avatarImage} /> : <Text style={[styles.avatarText, { color: theme.text }]}>{teacher.name?.slice(0, 1)?.toUpperCase() || "T"}</Text>}</View><View style={styles.cardCopy}><Text style={[styles.teacherName, { color: theme.text }]}>{teacher.name}</Text><Text style={[styles.teacherMeta, { color: theme.subText }]}>{formatScope(teacher.class_scope)}</Text></View></View>
            <View style={styles.detailList}><Text style={styles.detailText}>Employee ID: {teacher.employee_id || "-"}</Text><Text style={styles.detailText}>Phone: {teacher.phone || "-"}</Text><Text style={styles.detailText}>Email: {teacher.email || "-"}</Text></View>
            <View style={styles.cardActions}>
              <CardAction icon="eye-outline" label="Details" onPress={() => openDetails(teacher)} />
              <CardAction icon="git-network-outline" label="Assignments" onPress={() => openAssignments(teacher)} />
              {canManageTeachers ? <>
                <CardAction icon="create-outline" label="Edit" onPress={() => openEdit(teacher)} />
                <CardAction icon="trash-outline" label="Delete" tone="danger" onPress={() => confirmDelete(teacher.id)} />
              </> : null}
            </View>
          </View>)}
          {!filteredTeachers.length ? <View style={[styles.emptyCard, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}><Text style={[styles.emptyTitle, { color: theme.text }]}>No teachers found</Text><Text style={[styles.emptyText, { color: theme.subText }]}>Adjust the search or scope filter.</Text></View> : null}
        </View>}
      </>}

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <Sheet title="Add Teacher" subtitle="Create a teacher profile and linked user account." onClose={() => { setCreateOpen(false); setCreateForm(EMPTY_CREATE); }}>
          <PhotoField label="Photo" previewUri={createForm.photo_preview} onPick={() => pickTeacherPhoto("create")} onRemove={() => clearTeacherPhoto("create")} />
          <FormInput label="Employee ID" value={createForm.employee_id} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, employee_id: value }))} placeholder="EMP001" />
          <FormInput label="Name *" value={createForm.name} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, name: value }))} placeholder="Teacher name" />
          <FormInput label="Phone" value={createForm.phone} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, phone: value }))} placeholder="10 digit phone" keyboardType="phone-pad" />
          <FormInput label="Email" value={createForm.email} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, email: value }))} placeholder="teacher@school.com" keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.inputLabel}>Class Scope *</Text>
          <View style={styles.filterRow}>{(["school", "hs"] as TeacherScope[]).map((scope) => <Pressable key={scope} style={[styles.filterChip, createForm.class_scope === scope && styles.filterChipActive]} onPress={() => setCreateForm((prev) => ({ ...prev, class_scope: scope }))}><Text style={[styles.filterChipText, createForm.class_scope === scope && styles.filterChipTextActive]}>{formatScope(scope)}</Text></Pressable>)}</View>
          <FormInput label="Password *" value={String(createForm.password || "")} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, password: value }))} placeholder="Minimum 6 characters" secureTextEntry />
          <View style={styles.rowActions}><Pressable style={styles.secondaryBtn} onPress={() => setCreateOpen(false)}><Text style={styles.secondaryBtnText}>Cancel</Text></Pressable><Pressable style={styles.successBtn} onPress={handleCreate} disabled={saving}><Text style={styles.successBtnText}>{saving ? "Saving..." : "Save"}</Text></Pressable></View>
        </Sheet>
      </Modal>

      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <Sheet title="Edit Teacher" subtitle="Update teacher details to match the backend profile." onClose={() => { setEditOpen(false); setEditForm(EMPTY_EDIT); }}>
          <PhotoField label="Photo" previewUri={editForm.photo_preview} onPick={() => pickTeacherPhoto("edit")} onRemove={() => clearTeacherPhoto("edit")} />
          <FormInput label="Employee ID" value={editForm.employee_id} onChangeText={(value) => setEditForm((prev) => ({ ...prev, employee_id: value }))} placeholder="EMP001" />
          <FormInput label="Name *" value={editForm.name} onChangeText={(value) => setEditForm((prev) => ({ ...prev, name: value }))} placeholder="Teacher name" />
          <FormInput label="Phone" value={editForm.phone} onChangeText={(value) => setEditForm((prev) => ({ ...prev, phone: value }))} placeholder="10 digit phone" keyboardType="phone-pad" />
          <FormInput label="Email" value={editForm.email} onChangeText={(value) => setEditForm((prev) => ({ ...prev, email: value }))} placeholder="teacher@school.com" keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.inputLabel}>Class Scope *</Text>
          <View style={styles.filterRow}>{(["school", "hs"] as TeacherScope[]).map((scope) => <Pressable key={scope} style={[styles.filterChip, editForm.class_scope === scope && styles.filterChipActive]} onPress={() => setEditForm((prev) => ({ ...prev, class_scope: scope }))}><Text style={[styles.filterChipText, editForm.class_scope === scope && styles.filterChipTextActive]}>{formatScope(scope)}</Text></Pressable>)}</View>
          <View style={styles.rowActions}><Pressable style={styles.secondaryBtn} onPress={() => setEditOpen(false)}><Text style={styles.secondaryBtnText}>Cancel</Text></Pressable><Pressable style={styles.successBtn} onPress={handleEdit} disabled={saving}><Text style={styles.successBtnText}>{saving ? "Saving..." : "Update"}</Text></Pressable></View>
        </Sheet>
      </Modal>

      <Modal visible={assignmentOpen} transparent animationType="slide" onRequestClose={() => setAssignmentOpen(false)}>
        <Sheet title={`Assignments: ${selectedTeacher?.name ?? "Teacher"}`} subtitle="Assign class, section, subject, and session from the live academic structure." onClose={() => setAssignmentOpen(false)}>
          <Text style={styles.inputLabel}>Class *</Text>
          <View style={styles.filterRow}>{filteredAssignmentClasses.map((item) => <Pressable key={item.id} style={[styles.filterChip, assignmentForm.class_id === item.id && styles.filterChipActive]} onPress={() => { const nextSelections = deriveAssignmentSelections(assignments, item.id, assignmentForm.session_id); setAssignmentForm((prev) => ({ ...prev, class_id: item.id, section_id: nextSelections.sections[0] ?? null, subject_id: nextSelections.subjects[0] ?? null })); setSelectedAssignmentSections(nextSelections.sections); setSelectedAssignmentSubjects(nextSelections.subjects); }}><Text style={[styles.filterChipText, assignmentForm.class_id === item.id && styles.filterChipTextActive]}>{item.name}</Text></Pressable>)}</View>
          <Text style={[styles.inputLabel, styles.spaceTop]}>Section *</Text>
          <View style={styles.filterRow}>{(selectedClass?.sections ?? []).map((section) => <Pressable key={section.id} style={[styles.filterChip, selectedAssignmentSections.includes(section.id) && styles.filterChipActive]} onPress={() => setSelectedAssignmentSections((prev) => prev.includes(section.id) ? prev.filter((value) => value !== section.id) : [...prev, section.id])}><Text style={[styles.filterChipText, selectedAssignmentSections.includes(section.id) && styles.filterChipTextActive]}>{section.name}{section.medium ? ` (${section.medium})` : ""}</Text></Pressable>)}</View>
          <Text style={[styles.inputLabel, styles.spaceTop]}>Subject *</Text>
          <View style={styles.filterRow}>{(selectedClass?.subjects ?? []).map((subject) => <Pressable key={subject.id} style={[styles.filterChip, selectedAssignmentSubjects.includes(subject.id) && styles.filterChipActive]} onPress={() => setSelectedAssignmentSubjects((prev) => prev.includes(subject.id) ? prev.filter((value) => value !== subject.id) : [...prev, subject.id])}><Text style={[styles.filterChipText, selectedAssignmentSubjects.includes(subject.id) && styles.filterChipTextActive]}>{subject.name}</Text></Pressable>)}</View>
          <Text style={[styles.inputLabel, styles.spaceTop]}>Session *</Text>
          <View style={styles.filterRow}>{sessions.map((session) => <Pressable key={session.id} style={[styles.filterChip, assignmentForm.session_id === session.id && styles.filterChipActive]} onPress={() => { const nextSelections = deriveAssignmentSelections(assignments, assignmentForm.class_id, session.id); setAssignmentForm((prev) => ({ ...prev, session_id: session.id, section_id: nextSelections.sections[0] ?? null, subject_id: nextSelections.subjects[0] ?? null })); setSelectedAssignmentSections(nextSelections.sections); setSelectedAssignmentSubjects(nextSelections.subjects); }}><Text style={[styles.filterChipText, assignmentForm.session_id === session.id && styles.filterChipTextActive]}>{session.name}</Text></Pressable>)}</View>
          {canManageTeachers ? <Pressable style={[styles.successBtn, styles.spaceTop]} onPress={submitAssignment} disabled={saving}><Text style={styles.successBtnText}>{saving ? "Saving..." : "Assign to Teacher"}</Text></Pressable> : null}
          <Text style={[styles.inputLabel, styles.spaceTop]}>Current Assignments</Text>
          {loadingAssignments ? <ActivityIndicator size="small" color="#0f172a" /> : assignments.length ? assignments.map((assignment) => <View key={assignment.id} style={styles.assignmentCard}><Text style={styles.assignmentText}>{assignment.class} - {assignment.section} - {assignment.subject}</Text><Text style={styles.assignmentSubText}>Session: {assignment.session}</Text>{canManageTeachers ? <Pressable onPress={() => deleteAssignment(assignment.id)} style={styles.assignmentDelete}><Text style={styles.assignmentDeleteText}>Remove</Text></Pressable> : null}</View>) : <Text style={styles.emptyText}>No assignments found.</Text>}
        </Sheet>
      </Modal>

      <Modal visible={detailsOpen} transparent animationType="slide" onRequestClose={() => setDetailsOpen(false)}>
        <Sheet title="Teacher Details" subtitle="Teacher profile, assignments, attendance, and security." onClose={() => setDetailsOpen(false)}>
          <TeacherDetailsModule teacherId={selectedTeacherId} canManageTeachers={canManageTeachers} />
        </Sheet>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 14, paddingBottom: 8 },
  heroCard: { backgroundColor: "#fff", borderRadius: 24, borderWidth: 1, borderColor: "#e2e8f0", padding: 18, gap: 14 },
  heroCopy: { gap: 6 },
  heroActions: { gap: 10 },
  heroPrimaryActions: { flexDirection: "row", gap: 10 },
  title: { color: "#0f172a", fontWeight: "800", fontSize: 22 },
  subtitle: { color: "#64748b", lineHeight: 20 },
  noticeCard: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1 },
  noticeSuccess: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  noticeError: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  noticeTitle: { color: "#0f172a", fontWeight: "800", marginBottom: 2 },
  noticeMessage: { color: "#475569" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "48%", minHeight: 92, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, justifyContent: "space-between" },
  statLabel: { color: "#334155", fontSize: 12, fontWeight: "700" },
  statValue: { fontSize: 26, fontWeight: "800" },
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  errorText: { color: "#dc2626", fontWeight: "700" },
  sectionCard: { backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#e2e8f0", padding: 16, gap: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  sectionTitle: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  hint: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  fieldBlock: { gap: 6 },
  inputLabel: { color: "#334155", fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 11, color: "#0f172a" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f8fafc" },
  filterChipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  filterChipText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  filterChipTextActive: { color: "#fff" },
  grid: { gap: 12 },
  teacherCard: { backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#e2e8f0", padding: 16, gap: 14 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarBadge: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  avatarImage: { width: "100%", height: "100%", borderRadius: 14 },
  avatarText: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  cardCopy: { flex: 1, gap: 3 },
  teacherName: { color: "#0f172a", fontWeight: "800", fontSize: 18 },
  teacherMeta: { color: "#475569", fontWeight: "700", fontSize: 12 },
  detailList: { gap: 4 },
  detailText: { color: "#475569", lineHeight: 20 },
  rowActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  cardActionBtn: { width: "48%", borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  cardActionText: { color: "#334155", fontWeight: "700", fontSize: 12 },
  cardDeleteBtn: { width: "48%", backgroundColor: "#fee2e2", borderWidth: 1, borderColor: "#fecaca", paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  cardDeleteText: { color: "#b91c1c", fontWeight: "700", fontSize: 12 },
  primaryBtn: { backgroundColor: "#0f172a", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  heroPrimaryBtn: { flex: 1, backgroundColor: "#0f172a", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  ghostBtn: { borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  ghostBtnText: { color: "#334155", fontWeight: "700" },
  iconUtilityBtn: { width: 42, height: 42, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: "#334155", fontWeight: "700" },
  deleteBtn: { flex: 1, backgroundColor: "#fee2e2", borderWidth: 1, borderColor: "#fecaca", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  deleteBtnText: { color: "#b91c1c", fontWeight: "700" },
  successBtn: { flex: 1, backgroundColor: "#15803d", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  successBtnText: { color: "#fff", fontWeight: "700" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.28)" },
  modalCard: { maxHeight: "90%", backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  modalBody: { maxHeight: 620 },
  sheetHeaderCopy: { flex: 1, gap: 4 },
  sheetSubtitle: { color: "#64748b", lineHeight: 18 },
  closeBtn: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
  closeBtnText: { color: "#334155", fontWeight: "700" },
  photoField: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16, padding: 12, backgroundColor: "#f8fafc", gap: 12 },
  photoPreviewWrap: { alignItems: "center", justifyContent: "center" },
  photoPreview: { width: 84, height: 84, borderRadius: 18, backgroundColor: "#e2e8f0" },
  photoPreviewEmpty: { width: 84, height: 84, borderRadius: 18, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  photoActions: { flexDirection: "row", gap: 10 },
  photoActionBtn: { flex: 1, flexDirection: "row", gap: 8, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  photoActionText: { color: "#334155", fontWeight: "700" },
  photoRemoveBtn: { flex: 1, flexDirection: "row", gap: 8, borderWidth: 1, borderColor: "#fecaca", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fee2e2", alignItems: "center", justifyContent: "center" },
  photoRemoveText: { color: "#b91c1c", fontWeight: "700" },
  assignmentCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16, padding: 12, backgroundColor: "#f8fafc", marginTop: 8 },
  assignmentText: { color: "#1e293b", fontWeight: "700" },
  assignmentSubText: { marginTop: 2, color: "#64748b" },
  assignmentDelete: { marginTop: 8, alignSelf: "flex-start", borderWidth: 1, borderColor: "#fecaca", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#fee2e2" },
  assignmentDeleteText: { color: "#b91c1c", fontWeight: "700", fontSize: 12 },
  emptyCard: { borderWidth: 1, borderColor: "#e2e8f0", borderStyle: "dashed", borderRadius: 18, backgroundColor: "#f8fafc", padding: 20 },
  emptyTitle: { color: "#0f172a", fontWeight: "700", fontSize: 15 },
  emptyText: { color: "#64748b", marginTop: 8 },
  spaceTop: { marginTop: 10 },
});

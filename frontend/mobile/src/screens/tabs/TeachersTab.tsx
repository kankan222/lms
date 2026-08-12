import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import TopNotice from "../../components/feedback/TopNotice";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { useAuthStore } from "../../store/authStore";
import {
  assignTeacher,
  createTeacher,
  deleteTeacher,
  getAttendanceDevices,
  getAttendanceDeviceUsers,
  getTeacherAssignments,
  getTeachers,
  removeAssignment,
  resolveTeacherPhotoUrl,
  TeacherAssignment,
  TeacherItem,
  updateTeacher,
  upsertAttendanceDeviceUser,
  type AttendanceDevice,
} from "../../services/teachersService";
import { ClassStructureItem, getClassStructure, getScopes, getSessions, SessionItem } from "../../services/classesService";
import { getTargets } from "../../services/messagingService";
import { useAppTheme } from "../../theme/AppThemeProvider";

type TeacherScope = "school" | "hs";
type ScopeFilter = "all" | TeacherScope;
type ScopeOption = { code: TeacherScope; name: string };
type Notice = { title: string; message: string; tone: "success" | "error" } | null;
type DeleteTarget = { id: number; name: string } | null;
type TeacherPhoto = { uri: string; name?: string; type?: string } | null;
type TeacherForm = { id?: number | null; employee_id: string; name: string; phone: string; email: string; class_scope: TeacherScope; password?: string; device_id: string; device_user_id: string; photo: TeacherPhoto; photo_preview: string | null };
type AssignmentForm = { class_id: number | null; section_id: number | null; subject_id: number | null; session_id: number | null };
type AssignmentSelections = { sections: number[]; subjects: number[] };
export type TeacherConversationRequest = {
  recipientUserId: number;
  recipientName?: string;
  classId?: number | null;
  sectionId?: number | null;
};
type Props = {
  onStartTeacherMessage?: (payload: TeacherConversationRequest) => void;
};

const DEFAULT_SCOPE_OPTIONS: ScopeOption[] = [
  { code: "school", name: "School" },
  { code: "hs", name: "Higher Secondary" },
];
const EMPTY_CREATE: TeacherForm = { employee_id: "", name: "", phone: "", email: "", class_scope: "school", password: "", device_id: "", device_user_id: "", photo: null, photo_preview: null };
const EMPTY_EDIT: TeacherForm = { id: null, employee_id: "", name: "", phone: "", email: "", class_scope: "school", password: "", device_id: "", device_user_id: "", photo: null, photo_preview: null };
const EMPTY_ASSIGNMENT: AssignmentForm = { class_id: null, section_id: null, subject_id: null, session_id: null };
const TEACHERS_PAGE_SIZE = 30;

const getErrorMessage = (err: unknown, fallback: string) => typeof err === "object" && err && "response" in err ? ((err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error || (err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message || fallback) : fallback;
const normalizePhone = (value?: string | null) => String(value || "").replace(/\D/g, "");
const normalizeText = (value?: string | null) => String(value || "").trim().toLowerCase();
function normalizeMachineUserId(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/^\d+$/.test(raw)) return raw;
  const normalized = raw.replace(/^0+(?=\d)/, "");
  return normalized || "0";
}
function resolveScopeCode(scopeCode?: string | null, scopeName?: string | null): TeacherScope {
  const code = String(scopeCode || "").trim().toLowerCase();
  if (code === "hs" || code === "school") return code;
  if (code.includes("higher secondary")) return "hs";
  if (code.includes("school")) return "school";

  const name = String(scopeName || "").trim().toLowerCase();
  if (name.includes("higher secondary")) return "hs";
  if (name.includes("school")) return "school";
  return "school";
}
function formatScopeLabel(scopeCode?: string | null) { return resolveScopeCode(scopeCode) === "hs" ? "Higher Secondary" : "School"; }
function matchesScope(item: ClassStructureItem, scope: TeacherScope) { return resolveScopeCode(item.class_scope, item.scope_name) === scope; }
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

function validateTeacher(form: TeacherForm, allowedScopeCodes: TeacherScope[], requirePassword = false) {
  const name = String(form.name || "").trim();
  const phone = String(form.phone || "").trim();
  const email = String(form.email || "").trim();
  if (!name || /^\d+$/.test(name)) return "Valid teacher name required.";
  if (!phone && !email) return "Provide either phone or email.";
  if (phone && !/^\d{10}$/.test(phone)) return "Phone must be 10 digits.";
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return "Valid email required.";
  if (!allowedScopeCodes.includes(resolveScopeCode(form.class_scope))) return "Class scope is required.";
  if (requirePassword && String(form.password || "").length < 6) return "Password must be at least 6 characters.";
  const deviceId = String(form.device_id || "").trim();
  const deviceUserId = normalizeMachineUserId(form.device_user_id);
  if ((deviceId && !deviceUserId) || (!deviceId && deviceUserId)) return "Select both device and machine user ID for mapping.";
  if (deviceUserId && !/^\d+$/.test(deviceUserId)) return "Machine user ID must be numeric.";
  return null;
}

function Sheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  const { theme, isDark } = useAppTheme();
  return <View style={styles.modalOverlay}><Pressable style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]} onPress={onClose} /><View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}><View style={styles.rowBetween}><View style={styles.sheetHeaderCopy}><Text style={[styles.modalTitle, { color: theme.text }]}>{title}</Text>{subtitle ? <Text style={[styles.sheetSubtitle, { color: theme.subText }]}>{subtitle}</Text> : null}</View><Pressable style={[styles.closeBtn, { borderColor: theme.border, backgroundColor: isDark ? theme.cardMuted : theme.card }]} onPress={onClose}><Text style={[styles.closeBtnText, { color: theme.text }]}>Close</Text></Pressable></View><ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>{children}</ScrollView></View></View>;
}

function FormInput({ label, value, onChangeText, placeholder, keyboardType = "default", autoCapitalize = "sentences", secureTextEntry = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; keyboardType?: "default" | "email-address" | "phone-pad"; autoCapitalize?: "none" | "sentences" | "words" | "characters"; secureTextEntry?: boolean }) {
  const { theme } = useAppTheme();
  return <View style={styles.fieldBlock}><Text style={[styles.inputLabel, { color: theme.subText }]}>{label}</Text><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} autoCapitalize={autoCapitalize} secureTextEntry={secureTextEntry} placeholderTextColor={theme.mutedText} /></View>;
}

function PhotoField({ label, previewUri, onPick, onRemove }: { label: string; previewUri?: string | null; onPick: () => void; onRemove: () => void }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.inputLabel, { color: theme.subText }]}>{label}</Text>
      <View style={[styles.photoField, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
        <View style={styles.photoPreviewWrap}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.photoPreview} />
          ) : (
            <View style={[styles.photoPreviewEmpty, { backgroundColor: theme.card }]}>
              <Ionicons name="person-outline" size={24} color={theme.subText} />
            </View>
          )}
        </View>
        <View style={styles.photoActions}>
          <Pressable style={[styles.photoActionBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={onPick}>
            <Ionicons name="image-outline" size={16} color={theme.text} />
            <Text style={[styles.photoActionText, { color: theme.text }]}>{previewUri ? "Change Photo" : "Upload Photo"}</Text>
          </Pressable>
          {previewUri ? (
            <Pressable style={[styles.photoRemoveBtn, { borderColor: theme.dangerBorder, backgroundColor: theme.dangerSoft }]} onPress={onRemove}>
              <Ionicons name="trash-outline" size={16} color={theme.danger} />
              <Text style={[styles.photoRemoveText, { color: theme.danger }]}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function CardAction({ icon, label, onPress, tone = "default" }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; tone?: "default" | "danger" }) {
  const { theme } = useAppTheme();
  const isDanger = tone === "danger";
  return <Pressable accessibilityRole="button" accessibilityLabel={label} style={[styles.cardActionBtn, { borderColor: isDanger ? theme.dangerBorder : theme.border, backgroundColor: isDanger ? theme.dangerSoft : theme.card }, isDanger && styles.cardDeleteBtn]} onPress={onPress}><Ionicons name={icon} size={18} color={isDanger ? theme.danger : theme.text} /></Pressable>;
}

function TeacherListBadge({ label, tone = "neutral" }: { label: string; tone?: "accent" | "neutral" | "success" }) {
  const { theme } = useAppTheme();
  const palette = tone === "accent"
    ? { backgroundColor: theme.successSoft, borderColor: theme.successBorder, color: theme.success }
    : tone === "success"
      ? { backgroundColor: theme.infoSoft, borderColor: theme.infoBorder, color: theme.infoText }
      : { backgroundColor: theme.cardMuted, borderColor: theme.border, color: theme.subText };
  return (
    <View style={[styles.teacherListBadge, { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }]}>
      <Text style={[styles.teacherListBadgeText, { color: palette.color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default function TeachersTab({ onStartTeacherMessage }: Props) {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions || [];
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const isSuperAdmin = roles.some((role) => {
    const normalized = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    return normalized === "super_admin" || normalized === "superadmin";
  });
  const canManageTeachers = permissions.includes("teacher.update");
  const canManageDeviceMappings = permissions.includes("teacher.assign");
  const canSendMessages = isSuperAdmin || permissions.includes("messages.send");
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [teachersPage, setTeachersPage] = useState(1);
  const [teachersTotal, setTeachersTotal] = useState<number | null>(null);
  const [teachersHasMore, setTeachersHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [classStructure, setClassStructure] = useState<ClassStructureItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [attendanceDevices, setAttendanceDevices] = useState<AttendanceDevice[]>([]);
  const [scopeOptions, setScopeOptions] = useState<ScopeOption[]>(DEFAULT_SCOPE_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [createForm, setCreateForm] = useState<TeacherForm>(EMPTY_CREATE);
  const [editForm, setEditForm] = useState<TeacherForm>(EMPTY_EDIT);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>(EMPTY_ASSIGNMENT);
  const [selectedAssignmentSections, setSelectedAssignmentSections] = useState<number[]>([]);
  const [selectedAssignmentSubjects, setSelectedAssignmentSubjects] = useState<number[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);

  const allowedScopeCodes = useMemo(() => scopeOptions.map((item) => item.code), [scopeOptions]);
  const defaultScopeCode = allowedScopeCodes[0] ?? "school";
  const scopeLabelByCode = useMemo(() => Object.fromEntries(scopeOptions.map((item) => [item.code, item.name])) as Record<TeacherScope, string>, [scopeOptions]);
  const getScopeLabel = useCallback(
    (scopeCode?: string | null, scopeName?: string | null) => {
      const resolved = resolveScopeCode(scopeCode, scopeName);
      return scopeLabelByCode[resolved] || String(scopeName || "").trim() || formatScopeLabel(resolved);
    },
    [scopeLabelByCode],
  );
  const scopeFilterOptions = useMemo(() => [{ code: "all", name: "All" } as const, ...scopeOptions], [scopeOptions]);
  const activeSession = useMemo(() => sessions.find((s) => Number(s.is_active) === 1 || s.is_active === true) ?? null, [sessions]);
  const filteredTeachers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return teachers.filter((teacher) => {
      const matchesQuery = !query || [teacher.name, teacher.employee_id, teacher.phone, teacher.email].join(" ").toLowerCase().includes(query);
      const matches = scopeFilter === "all" || resolveScopeCode(teacher.class_scope, teacher.scope_name) === scopeFilter;
      return matchesQuery && matches;
    });
  }, [teachers, search, scopeFilter]);
  const selfTeacher = !canManageTeachers ? teachers[0] ?? null : null;
  const filteredAssignmentClasses = useMemo(() => classStructure.filter((item) => matchesScope(item, resolveScopeCode(selectedTeacher?.class_scope, selectedTeacher?.scope_name))), [classStructure, selectedTeacher?.class_scope, selectedTeacher?.scope_name]);
  const selectedClass = useMemo(() => filteredAssignmentClasses.find((item) => item.id === assignmentForm.class_id) ?? null, [filteredAssignmentClasses, assignmentForm.class_id]);
  const stats = useMemo(() => {
    const school = teachers.filter((t) => resolveScopeCode(t.class_scope, t.scope_name) === "school").length;
    const hs = teachers.filter((t) => resolveScopeCode(t.class_scope, t.scope_name) === "hs").length;
    const withPhone = teachers.filter((t) => String(t.phone || "").trim()).length;
    return { total: teachers.length, school, hs, withPhone };
  }, [teachers]);
  const activeFilterCount = scopeFilter === "all" ? 0 : 1;

  const loadTeacherRows = useCallback(async (mode: "initial" | "refresh" | "loadMore" = "initial") => {
    if (mode === "loadMore") {
      if (loadingMore || !teachersHasMore) return;
      setLoadingMore(true);
    } else if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);
    const nextPage = mode === "loadMore" ? teachersPage + 1 : 1;

    try {
      const result = await getTeachers({ page: nextPage, limit: TEACHERS_PAGE_SIZE });
      const rows = (result?.data || []).map((teacher) => ({ ...teacher, class_scope: resolveScopeCode(teacher.class_scope, teacher.scope_name) }));

      if (mode === "loadMore") {
        setTeachers((prev) => {
          const seen = new Set(prev.map((item) => Number(item.id)));
          const incoming = rows.filter((item) => !seen.has(Number(item.id)));
          return [...prev, ...incoming];
        });
      } else {
        setTeachers(rows);
      }

      setTeachersPage(nextPage);
      setTeachersTotal(result?.pagination?.total ?? null);
      if (result?.pagination) {
        setTeachersHasMore(nextPage < Number(result.pagination.totalPages || 0));
      } else {
        setTeachersHasMore(rows.length >= TEACHERS_PAGE_SIZE);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not load teachers."));
      if (mode !== "loadMore") {
        setTeachers([]);
        setTeachersTotal(null);
        setTeachersHasMore(false);
      }
    } finally {
      if (mode === "loadMore") setLoadingMore(false);
      else if (mode === "refresh") setRefreshing(false);
      else setLoading(false);
    }
  }, [loadingMore, teachersHasMore, teachersPage]);

  const loadData = useCallback(async (mode: "initial" | "refresh" | "loadMore" = "initial") => {
    if (mode === "loadMore") {
      await loadTeacherRows("loadMore");
      return;
    }

    try {
      const [structureRows, sessionRows, scopeRows, deviceRows] = await Promise.all([
        getClassStructure(),
        getSessions(),
        getScopes(),
        canManageDeviceMappings ? getAttendanceDevices() : Promise.resolve([]),
      ]);
      const mappedScopeOptions = Array.from(
        new Map(
          scopeRows
            .filter((row) => row.is_active === undefined || row.is_active === null || Number(row.is_active) === 1 || row.is_active === true)
            .map((row) => {
              const code = resolveScopeCode(row.code, row.name);
              return { code, name: String(row.name || "").trim() || formatScopeLabel(code) };
            })
            .filter((row) => row.code === "school" || row.code === "hs")
            .map((row) => [row.code, row] as const),
        ).values(),
      );
      setScopeOptions(mappedScopeOptions.length ? mappedScopeOptions : DEFAULT_SCOPE_OPTIONS);
      setClassStructure(structureRows);
      setSessions(sessionRows);
      setAttendanceDevices(deviceRows);
    } catch (err: unknown) {
      setScopeOptions(DEFAULT_SCOPE_OPTIONS);
      setError(getErrorMessage(err, "Could not load teacher filters."));
    }

    await loadTeacherRows(mode);
  }, [loadTeacherRows]);

  useEffect(() => { void loadData("initial"); }, []);
  useEffect(() => { if (activeSession && assignmentForm.session_id === null) setAssignmentForm((prev) => ({ ...prev, session_id: activeSession.id })); }, [activeSession, assignmentForm.session_id]);
  useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(null), 3200); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    const fallbackScope = allowedScopeCodes[0] ?? "school";
    if (!allowedScopeCodes.length) return;
    if (!allowedScopeCodes.includes(createForm.class_scope)) setCreateForm((prev) => ({ ...prev, class_scope: fallbackScope }));
    if (editForm.id && !allowedScopeCodes.includes(editForm.class_scope)) setEditForm((prev) => ({ ...prev, class_scope: fallbackScope }));
    if (scopeFilter !== "all" && !allowedScopeCodes.includes(scopeFilter)) setScopeFilter("all");
  }, [allowedScopeCodes, createForm.class_scope, editForm.class_scope, editForm.id, scopeFilter]);

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

  async function validateDeviceMapping(form: TeacherForm, currentTeacherId?: number | null) {
    if (!canManageDeviceMappings) return null;
    const selectedDeviceId = String(form.device_id || "").trim();
    const selectedDeviceUserId = normalizeMachineUserId(form.device_user_id);
    if (!selectedDeviceId || !selectedDeviceUserId) return null;

    const rows = await getAttendanceDeviceUsers({ device_id: selectedDeviceId });
    const conflict = rows.find(
      (row) =>
        normalizeMachineUserId(row.device_user_id) === selectedDeviceUserId &&
        (!currentTeacherId || Number(row.teacher_id) !== Number(currentTeacherId)),
    );
    return conflict ? `Machine User ID already mapped to ${conflict.teacher_name || "another teacher"}.` : null;
  }

  async function resolveCreatedTeacherId(createResponse: unknown, sourceTeacher: TeacherForm) {
    const response = createResponse as { data?: { teacherId?: number; id?: number }; teacherId?: number; id?: number };
    const immediateId = Number(response?.data?.teacherId || response?.teacherId || response?.data?.id || response?.id || 0);
    if (immediateId > 0) return immediateId;

    const employeeId = String(sourceTeacher.employee_id || "").trim();
    const name = normalizeText(sourceTeacher.name);
    const phone = String(sourceTeacher.phone || "").trim();
    const email = normalizeText(sourceTeacher.email);
    const currentRows = [...teachers];
    if (!currentRows.length || immediateId <= 0) {
      try {
        const result = await getTeachers({ page: 1, limit: TEACHERS_PAGE_SIZE });
        currentRows.push(...(result.data || []));
      } catch {
        // Keep the local list fallback below.
      }
    }
    const matched = currentRows.find((row) => {
      if (employeeId && String(row.employee_id || "").trim() === employeeId) return true;
      const rowName = normalizeText(row.name);
      const rowPhone = String(row.phone || "").trim();
      const rowEmail = normalizeText(row.email);
      return rowName === name && ((phone && rowPhone === phone) || (email && rowEmail === email));
    });
    return Number(matched?.id || 0);
  }

  async function handleCreate() {
    const validation = validateTeacher(createForm, allowedScopeCodes, true);
    if (validation) return Alert.alert("Validation", validation);
    setSaving(true);
    try {
      const mappingConflict = await validateDeviceMapping(createForm);
      if (mappingConflict) {
        Alert.alert("Device mapping", mappingConflict);
        return;
      }
      const createResponse = await createTeacher({ employee_id: createForm.employee_id.trim(), name: createForm.name.trim(), phone: createForm.phone.trim(), email: createForm.email.trim(), class_scope: createForm.class_scope, password: String(createForm.password || ""), photo: createForm.photo });
      const selectedDeviceId = String(createForm.device_id || "").trim();
      const selectedDeviceUserId = normalizeMachineUserId(createForm.device_user_id);
      if (canManageDeviceMappings && selectedDeviceId && selectedDeviceUserId) {
        const createdTeacherId = await resolveCreatedTeacherId(createResponse, createForm);
        if (!createdTeacherId) {
          showNotice("Teacher Created, Mapping Failed", "Teacher was created, but the app could not resolve the new teacher id for device mapping.", "error");
        } else {
          await upsertAttendanceDeviceUser({
            device_id: Number(selectedDeviceId),
            device_user_id: selectedDeviceUserId,
            teacher_id: createdTeacherId,
          });
        }
      }
      setCreateOpen(false);
      setCreateForm({ ...EMPTY_CREATE, class_scope: defaultScopeCode });
      await loadData("refresh");
      showNotice("Teacher Created", "Teacher record created successfully.");
    } catch (err: unknown) {
      Alert.alert("Create failed", getErrorMessage(err, "Could not create teacher."));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(teacher: TeacherItem) {
    setEditForm({ id: teacher.id, employee_id: teacher.employee_id ?? "", name: teacher.name ?? "", phone: teacher.phone ?? "", email: teacher.email ?? "", class_scope: resolveScopeCode(teacher.class_scope, teacher.scope_name), password: "", device_id: "", device_user_id: "", photo: null, photo_preview: resolveTeacherPhotoUrl(teacher.photo_url) });
    setEditOpen(true);
    if (canManageDeviceMappings) {
      void (async () => {
        try {
          const mappings = await getAttendanceDeviceUsers();
          const mapping = mappings.find((item) => Number(item.teacher_id) === Number(teacher.id));
          if (mapping) {
            setEditForm((prev) => prev.id === teacher.id ? {
              ...prev,
              device_id: String(mapping.device_id || ""),
              device_user_id: String(mapping.device_user_id || ""),
            } : prev);
          }
        } catch {
          // Keep edit usable if mappings cannot be loaded.
        }
      })();
    }
  }

  async function handleEdit() {
    const validation = validateTeacher(editForm, allowedScopeCodes, false);
    if (validation) return Alert.alert("Validation", validation);
    if (!editForm.id) return;
    setSaving(true);
    try {
      const mappingConflict = await validateDeviceMapping(editForm, editForm.id);
      if (mappingConflict) {
        Alert.alert("Device mapping", mappingConflict);
        return;
      }
      await updateTeacher(editForm.id, { employee_id: editForm.employee_id.trim(), name: editForm.name.trim(), phone: editForm.phone.trim(), email: editForm.email.trim(), class_scope: editForm.class_scope, photo: editForm.photo });
      const selectedDeviceId = String(editForm.device_id || "").trim();
      const selectedDeviceUserId = normalizeMachineUserId(editForm.device_user_id);
      if (canManageDeviceMappings && selectedDeviceId && selectedDeviceUserId) {
        await upsertAttendanceDeviceUser({
          device_id: Number(selectedDeviceId),
          device_user_id: selectedDeviceUserId,
          teacher_id: Number(editForm.id),
        });
      }
      setEditOpen(false);
      setEditForm({ ...EMPTY_EDIT, class_scope: defaultScopeCode });
      await loadData("refresh");
      showNotice("Teacher Updated", "Teacher record updated successfully.");
    } catch (err: unknown) {
      Alert.alert("Update failed", getErrorMessage(err, "Could not update teacher."));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(id: number) {
    const teacher = teachers.find((item) => item.id === id);
    setDeleteTarget({ id, name: teacher?.name || "this teacher" });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteTeacher(deleteTarget.id);
      setTeachers((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setTeachersTotal((prev) => (prev === null ? null : Math.max(0, prev - 1)));
      setDeleteTarget(null);
      showNotice("Teacher Deleted", "Teacher record deleted successfully.");
    } catch (err: unknown) {
      showNotice("Delete Failed", getErrorMessage(err, "Could not delete teacher."), "error");
    } finally {
      setSaving(false);
    }
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
    navigation.navigate("TeacherDetails", {
      teacherId: Number(teacher.id),
      teacherName: teacher.name || "Teacher profile",
    });
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

  async function handleMessageTeacher(teacher: TeacherItem) {
    if (!canSendMessages || !onStartTeacherMessage) return;

    try {
      const targets = await getTargets();
      const teacherTargets = Array.isArray(targets?.teachers) ? targets.teachers : [];
      if (!teacherTargets.length) {
        showNotice("Teacher Not Found", "No teacher recipients are available in messaging targets.", "error");
        return;
      }

      const teacherUserId = Number(teacher.user_id);
      const teacherPhone = normalizePhone(teacher.phone);
      const teacherEmail = normalizeText(teacher.email);
      const teacherName = normalizeText(teacher.name);

      const byUserId = teacherUserId > 0
        ? teacherTargets.find((target) => Number(target.user_id) === teacherUserId && Number(target.user_id) > 0)
        : null;
      const byTeacherId = teacherTargets.find((target) => Number(target.teacher_id) === Number(teacher.id) && Number(target.user_id) > 0) || null;
      const byPhone = teacherPhone
        ? teacherTargets.find((target) => normalizePhone(target.phone) === teacherPhone && Number(target.user_id) > 0)
        : null;
      const byEmail = teacherEmail
        ? teacherTargets.find((target) => normalizeText(target.email) === teacherEmail && Number(target.user_id) > 0)
        : null;
      const exactNameMatches = teacherName
        ? teacherTargets.filter((target) => normalizeText(target.name) === teacherName && Number(target.user_id) > 0)
        : [];
      const partialNameMatches = teacherName
        ? teacherTargets.filter((target) => normalizeText(target.name).includes(teacherName) && Number(target.user_id) > 0)
        : [];

      const selected =
        byUserId ||
        byTeacherId ||
        byPhone ||
        byEmail ||
        (exactNameMatches.length === 1 ? exactNameMatches[0] : null) ||
        (partialNameMatches.length === 1 ? partialNameMatches[0] : null);

      if (!selected?.user_id) {
        showNotice("Teacher Not Found", "Could not resolve the teacher messaging recipient.", "error");
        return;
      }

      onStartTeacherMessage({
        recipientUserId: Number(selected.user_id),
        recipientName: selected.name || teacher.name || undefined,
        classId: selected.class_id ?? null,
        sectionId: selected.section_id ?? null,
      });
    } catch (err: unknown) {
      showNotice("Open Messaging Failed", getErrorMessage(err, "Could not prepare teacher conversation."), "error");
    }
  }

  return (
    <View style={styles.screen}>
      <TopNotice notice={notice} style={styles.topNoticeOverlay} />
      <FlatList
        style={styles.root}
        contentContainerStyle={styles.content}
        data={loading ? [] : (selfTeacher ? [selfTeacher] : filteredTeachers)}
        keyExtractor={(item) => String(item.id)}
        refreshing={refreshing}
        onRefresh={() => loadData("refresh")}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        ListHeaderComponent={
          <View style={styles.innerContent}>
            <Text style={[styles.title, { color: theme.subText }]}>{canManageTeachers ? "TEACHERS" : "MY PROFILE"}</Text>

            <View style={[styles.overviewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.rowBetween}>
                <View style={styles.overviewTitleCopy}>
                  <Text style={[styles.overviewTitle, { color: theme.text }]}>{canManageTeachers ? "Teacher Directory" : "Teacher Profile"}</Text>
                  <Text style={[styles.overviewMeta, { color: theme.subText }]}>
                    {selfTeacher ? "Linked teacher account" : `${filteredTeachers.length} visible${teachersTotal !== null ? ` | ${teachers.length}/${teachersTotal} loaded` : ""}`}
                  </Text>
                </View>
                <Text style={[styles.overviewCount, { color: theme.text }]}>{selfTeacher ? 1 : teachersTotal ?? stats.total}</Text>
              </View>
              {canManageTeachers ? (
                <View style={styles.compactStatsRow}>
                  <TeacherListBadge label={`${stats.total} Loaded`} tone="accent" />
                  <TeacherListBadge label={`${stats.school} ${getScopeLabel("school")}`} />
                  <TeacherListBadge label={`${stats.hs} ${getScopeLabel("hs")}`} />
                  <TeacherListBadge label={`${stats.withPhone} Phone`} tone="success" />
                </View>
              ) : null}
            </View>

            {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}

            {canManageTeachers ? (
              <>
                <View style={styles.toolbarRow}>
                  <Pressable style={[styles.toolbarBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setFiltersOpen((prev) => !prev)}>
                    <Ionicons name="options-outline" size={16} color={theme.icon} />
                    <Text style={[styles.toolbarBtnText, { color: theme.text }]}>Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}</Text>
                  </Pressable>
                  <Pressable style={[styles.toolbarBtn, styles.toolbarPrimaryBtn, { backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={() => setCreateOpen(true)}>
                    <Ionicons name="add" size={16} color={theme.primaryText} />
                    <Text style={[styles.toolbarBtnText, { color: theme.primaryText }]}>Add</Text>
                  </Pressable>
                </View>

                {filtersOpen ? (
                  <View style={[styles.compactFilterCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={styles.compactPanelHeader}>
                      <Text style={[styles.compactPanelTitle, { color: theme.text }]}>Filters</Text>
                      <View style={styles.compactHeaderActions}>
                        <Pressable onPress={() => setScopeFilter("all")} hitSlop={8}>
                          <Text style={[styles.resetText, { color: theme.subText }]}>Reset</Text>
                        </Pressable>
                        <Pressable onPress={() => setFiltersOpen(false)} hitSlop={8}>
                          <Ionicons name="chevron-up-outline" size={18} color={theme.icon} />
                        </Pressable>
                      </View>
                    </View>
                    <Text style={[styles.inputLabel, { color: theme.subText }]}>Scope</Text>
                    <View style={styles.filterRow}>
                      {scopeFilterOptions.map((scope) => (
                        <Pressable
                          key={scope.code}
                          style={[styles.filterChip, { borderColor: theme.border, backgroundColor: theme.cardMuted }, scopeFilter === scope.code && { borderColor: theme.primary, backgroundColor: theme.isDark ? "#f8fafc" : theme.primary }]}
                          onPress={() => setScopeFilter(scope.code as ScopeFilter)}
                        >
                          <Text style={[styles.filterChipText, { color: theme.subText }, scopeFilter === scope.code && { color: theme.isDark ? "#0f172a" : theme.primaryText }]}>{scope.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable style={[styles.compactApplyBtn, { backgroundColor: theme.primary }]} onPress={() => setFiltersOpen(false)}>
                      <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>Apply Filters</Text>
                    </Pressable>
                  </View>
                ) : null}

                <View style={[styles.searchWrap, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
                  <Ionicons name="search-outline" size={16} color={theme.icon} />
                  <TextInput style={[styles.searchInput, { color: theme.text }]} value={search} onChangeText={setSearch} placeholder="Search teachers..." placeholderTextColor={theme.mutedText} autoCapitalize="none" />
                </View>
                {scopeFilter !== "all" ? <Text style={[styles.activeFiltersText, { color: theme.subText }]}>Scope: {getScopeLabel(scopeFilter)}</Text> : null}
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={theme.text} /></View>
          ) : selfTeacher ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}><Text style={[styles.emptyTitle, { color: theme.text }]}>No teacher profile found</Text><Text style={[styles.emptyText, { color: theme.subText }]}>No linked teacher account is available for this user.</Text></View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}><Text style={[styles.emptyTitle, { color: theme.text }]}>No teachers found</Text><Text style={[styles.emptyText, { color: theme.subText }]}>Adjust the search or scope filter.</Text></View>
          )
        }
        ListFooterComponent={
          <View style={styles.listFooter}>
            {loadingMore ? (
              <ActivityIndicator size="small" color={theme.text} />
            ) : !loading && !selfTeacher && teachersHasMore ? (
              <Pressable
                style={[styles.ghostBtn, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}
                onPress={() => void loadData("loadMore")}
              >
                <Text style={[styles.ghostBtnText, { color: theme.text }]}>
                  Load More
                  {teachersTotal !== null ? ` (${teachers.length}/${teachersTotal})` : ""}
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (!loading && !selfTeacher && !loadingMore && teachersHasMore) {
            void loadData("loadMore");
          }
        }}
        ItemSeparatorComponent={() => <View style={styles.rowGap} />}
        renderItem={({ item: teacher }) => {
          const scopeLabel = getScopeLabel(teacher.class_scope, teacher.scope_name);
          const identityLine = [`Emp ${teacher.employee_id || "-"}`, teacher.phone ? `Phone ${teacher.phone}` : ""].filter(Boolean).join(" | ");
          const contactLine = teacher.email ? `Email ${teacher.email}` : "";

          return (
            <View style={styles.rowWrap}>
              <View style={[styles.teacherCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.avatarBadge, { backgroundColor: theme.cardMuted }]}>
                    {resolveTeacherPhotoUrl(teacher.photo_url) ? (
                      <Image source={{ uri: resolveTeacherPhotoUrl(teacher.photo_url)! }} style={styles.avatarImage} />
                    ) : (
                      <Text style={[styles.avatarText, { color: theme.text }]}>{teacher.name?.slice(0, 1)?.toUpperCase() || "T"}</Text>
                    )}
                  </View>
                  <View style={styles.cardCopy}>
                    <Text style={[styles.teacherName, { color: theme.text }]} numberOfLines={1}>{teacher.name}</Text>
                    <Text style={[styles.teacherMeta, { color: theme.subText }]} numberOfLines={1}>{identityLine}</Text>
                  </View>
                </View>

                <View style={styles.metaStack}>
                  <View style={styles.teacherBadgeRow}>
                    <TeacherListBadge label={scopeLabel} tone="accent" />
                    {teacher.user_id ? <TeacherListBadge label="User linked" tone="success" /> : null}
                  </View>
                  {contactLine ? <Text style={[styles.detailText, styles.metaLineText, { color: theme.subText }]} numberOfLines={1}>{contactLine}</Text> : null}
                </View>

                <View style={styles.cardActions}>
                  <CardAction icon="eye-outline" label="Details" onPress={() => openDetails(teacher)} />
                  <CardAction icon="git-network-outline" label="Assignments" onPress={() => openAssignments(teacher)} />
                  {canSendMessages ? <CardAction icon="chatbubble-ellipses-outline" label="Message" onPress={() => void handleMessageTeacher(teacher)} /> : null}
                  {!selfTeacher && canManageTeachers ? (
                    <>
                      <CardAction icon="create-outline" label="Edit" onPress={() => openEdit(teacher)} />
                      <CardAction icon="trash-outline" label="Delete" tone="danger" onPress={() => confirmDelete(teacher.id)} />
                    </>
                  ) : null}
                </View>
              </View>
            </View>
          );
        }}
      />

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <Sheet title="Add Teacher" subtitle="Create a teacher profile and linked user account." onClose={() => { setCreateOpen(false); setCreateForm({ ...EMPTY_CREATE, class_scope: defaultScopeCode }); }}>
          <PhotoField label="Photo" previewUri={createForm.photo_preview} onPick={() => pickTeacherPhoto("create")} onRemove={() => clearTeacherPhoto("create")} />
          <FormInput label="Employee ID" value={createForm.employee_id} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, employee_id: value }))} placeholder="EMP001" />
          <FormInput label="Name *" value={createForm.name} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, name: value }))} placeholder="Teacher name" />
          <FormInput label="Phone" value={createForm.phone} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, phone: value }))} placeholder="10 digit phone" keyboardType="phone-pad" />
          <FormInput label="Email" value={createForm.email} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, email: value }))} placeholder="teacher@school.com" keyboardType="email-address" autoCapitalize="none" />
          <Text style={[styles.inputLabel, { color: theme.subText }]}>Class Scope *</Text>
          <View style={styles.filterRow}>{scopeOptions.map((scope) => <Pressable key={scope.code} style={[styles.filterChip, { borderColor: theme.border, backgroundColor: theme.cardMuted }, createForm.class_scope === scope.code && { borderColor: theme.primary, backgroundColor: theme.isDark ? "#f8fafc" : theme.primary }]} onPress={() => setCreateForm((prev) => ({ ...prev, class_scope: scope.code }))}><Text style={[styles.filterChipText, { color: theme.subText }, createForm.class_scope === scope.code && { color: theme.isDark ? "#0f172a" : theme.primaryText }]}>{scope.name}</Text></Pressable>)}</View>
          {canManageDeviceMappings ? (
            <>
              <Text style={[styles.inputLabel, styles.spaceTop, { color: theme.subText }]}>Attendance Device (Optional)</Text>
              <View style={styles.filterRow}>
                <Pressable style={[styles.filterChip, { borderColor: theme.border, backgroundColor: theme.cardMuted }, !createForm.device_id && { borderColor: theme.primary, backgroundColor: theme.isDark ? "#f8fafc" : theme.primary }]} onPress={() => setCreateForm((prev) => ({ ...prev, device_id: "", device_user_id: "" }))}>
                  <Text style={[styles.filterChipText, { color: theme.subText }, !createForm.device_id && { color: theme.isDark ? "#0f172a" : theme.primaryText }]}>No mapping</Text>
                </Pressable>
                {attendanceDevices.map((device) => {
                  const label = device.name || device.device_name || device.device_code || `Device #${device.id}`;
                  const active = createForm.device_id === String(device.id);
                  return (
                    <Pressable key={device.id} style={[styles.filterChip, { borderColor: theme.border, backgroundColor: theme.cardMuted }, active && { borderColor: theme.primary, backgroundColor: theme.isDark ? "#f8fafc" : theme.primary }]} onPress={() => setCreateForm((prev) => ({ ...prev, device_id: String(device.id) }))}>
                      <Text style={[styles.filterChipText, { color: theme.subText }, active && { color: theme.isDark ? "#0f172a" : theme.primaryText }]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <FormInput label="Machine User ID (Optional)" value={createForm.device_user_id} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, device_user_id: value }))} placeholder="e.g. 00000001" keyboardType="phone-pad" />
            </>
          ) : null}
          <FormInput label="Password *" value={String(createForm.password || "")} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, password: value }))} placeholder="Minimum 6 characters" secureTextEntry />
          <View style={styles.rowActions}><Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setCreateOpen(false)}><Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text></Pressable><Pressable style={[styles.successBtn, { backgroundColor: theme.success, borderColor: theme.successBorder }]} onPress={handleCreate} disabled={saving}><Text style={[styles.successBtnText, { color: theme.successText }]}>{saving ? "Saving..." : "Save"}</Text></Pressable></View>
        </Sheet>
      </Modal>

      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <Sheet title="Edit Teacher" subtitle="Update teacher details to match the backend profile." onClose={() => { setEditOpen(false); setEditForm({ ...EMPTY_EDIT, class_scope: defaultScopeCode }); }}>
          <PhotoField label="Photo" previewUri={editForm.photo_preview} onPick={() => pickTeacherPhoto("edit")} onRemove={() => clearTeacherPhoto("edit")} />
          <FormInput label="Employee ID" value={editForm.employee_id} onChangeText={(value) => setEditForm((prev) => ({ ...prev, employee_id: value }))} placeholder="EMP001" />
          <FormInput label="Name *" value={editForm.name} onChangeText={(value) => setEditForm((prev) => ({ ...prev, name: value }))} placeholder="Teacher name" />
          <FormInput label="Phone" value={editForm.phone} onChangeText={(value) => setEditForm((prev) => ({ ...prev, phone: value }))} placeholder="10 digit phone" keyboardType="phone-pad" />
          <FormInput label="Email" value={editForm.email} onChangeText={(value) => setEditForm((prev) => ({ ...prev, email: value }))} placeholder="teacher@school.com" keyboardType="email-address" autoCapitalize="none" />
          <Text style={[styles.inputLabel, { color: theme.subText }]}>Class Scope *</Text>
          <View style={styles.filterRow}>{scopeOptions.map((scope) => <Pressable key={scope.code} style={[styles.filterChip, { borderColor: theme.border, backgroundColor: theme.cardMuted }, editForm.class_scope === scope.code && { borderColor: theme.primary, backgroundColor: theme.isDark ? "#f8fafc" : theme.primary }]} onPress={() => setEditForm((prev) => ({ ...prev, class_scope: scope.code }))}><Text style={[styles.filterChipText, { color: theme.subText }, editForm.class_scope === scope.code && { color: theme.isDark ? "#0f172a" : theme.primaryText }]}>{scope.name}</Text></Pressable>)}</View>
          {canManageDeviceMappings ? (
            <>
              <Text style={[styles.inputLabel, styles.spaceTop, { color: theme.subText }]}>Attendance Device (Optional)</Text>
              <View style={styles.filterRow}>
                <Pressable style={[styles.filterChip, { borderColor: theme.border, backgroundColor: theme.cardMuted }, !editForm.device_id && { borderColor: theme.primary, backgroundColor: theme.isDark ? "#f8fafc" : theme.primary }]} onPress={() => setEditForm((prev) => ({ ...prev, device_id: "", device_user_id: "" }))}>
                  <Text style={[styles.filterChipText, { color: theme.subText }, !editForm.device_id && { color: theme.isDark ? "#0f172a" : theme.primaryText }]}>No mapping change</Text>
                </Pressable>
                {attendanceDevices.map((device) => {
                  const label = device.name || device.device_name || device.device_code || `Device #${device.id}`;
                  const active = editForm.device_id === String(device.id);
                  return (
                    <Pressable key={device.id} style={[styles.filterChip, { borderColor: theme.border, backgroundColor: theme.cardMuted }, active && { borderColor: theme.primary, backgroundColor: theme.isDark ? "#f8fafc" : theme.primary }]} onPress={() => setEditForm((prev) => ({ ...prev, device_id: String(device.id) }))}>
                      <Text style={[styles.filterChipText, { color: theme.subText }, active && { color: theme.isDark ? "#0f172a" : theme.primaryText }]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <FormInput label="Machine User ID (Optional)" value={editForm.device_user_id} onChangeText={(value) => setEditForm((prev) => ({ ...prev, device_user_id: value }))} placeholder="e.g. 00000001" keyboardType="phone-pad" />
            </>
          ) : null}
          <View style={styles.rowActions}><Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setEditOpen(false)}><Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text></Pressable><Pressable style={[styles.successBtn, { backgroundColor: theme.success, borderColor: theme.successBorder }]} onPress={handleEdit} disabled={saving}><Text style={[styles.successBtnText, { color: theme.successText }]}>{saving ? "Saving..." : "Update"}</Text></Pressable></View>
        </Sheet>
      </Modal>

      <Modal visible={assignmentOpen} transparent animationType="slide" onRequestClose={() => setAssignmentOpen(false)}>
        <Sheet title={`Assignments: ${selectedTeacher?.name ?? "Teacher"}`} subtitle="Assign class, section, subject, and session from the live academic structure." onClose={() => setAssignmentOpen(false)}>
          <Text style={[styles.inputLabel, { color: theme.subText }]}>Class *</Text>
          <View style={styles.filterRow}>{filteredAssignmentClasses.map((item) => <Pressable key={item.id} style={[styles.filterChip, { borderColor: theme.border, backgroundColor: theme.cardMuted }, assignmentForm.class_id === item.id && { borderColor: theme.primary, backgroundColor: theme.isDark ? "#f8fafc" : theme.primary }]} onPress={() => { const nextSelections = deriveAssignmentSelections(assignments, item.id, assignmentForm.session_id); setAssignmentForm((prev) => ({ ...prev, class_id: item.id, section_id: nextSelections.sections[0] ?? null, subject_id: nextSelections.subjects[0] ?? null })); setSelectedAssignmentSections(nextSelections.sections); setSelectedAssignmentSubjects(nextSelections.subjects); }}><Text style={[styles.filterChipText, { color: theme.subText }, assignmentForm.class_id === item.id && { color: theme.isDark ? "#0f172a" : theme.primaryText }]}>{item.name}</Text></Pressable>)}</View>
          <Text style={[styles.inputLabel, styles.spaceTop, { color: theme.subText }]}>Section *</Text>
          <View style={styles.filterRow}>{(selectedClass?.sections ?? []).map((section) => <Pressable key={section.id} style={[styles.filterChip, { borderColor: theme.border, backgroundColor: theme.cardMuted }, selectedAssignmentSections.includes(section.id) && { borderColor: theme.primary, backgroundColor: theme.isDark ? "#f8fafc" : theme.primary }]} onPress={() => setSelectedAssignmentSections((prev) => prev.includes(section.id) ? prev.filter((value) => value !== section.id) : [...prev, section.id])}><Text style={[styles.filterChipText, { color: theme.subText }, selectedAssignmentSections.includes(section.id) && { color: theme.isDark ? "#0f172a" : theme.primaryText }]}>{section.name}{section.medium ? ` (${section.medium})` : ""}</Text></Pressable>)}</View>
          <Text style={[styles.inputLabel, styles.spaceTop, { color: theme.subText }]}>Subject *</Text>
          <View style={styles.filterRow}>{(selectedClass?.subjects ?? []).map((subject) => <Pressable key={subject.id} style={[styles.filterChip, { borderColor: theme.border, backgroundColor: theme.cardMuted }, selectedAssignmentSubjects.includes(subject.id) && { borderColor: theme.primary, backgroundColor: theme.isDark ? "#f8fafc" : theme.primary }]} onPress={() => setSelectedAssignmentSubjects((prev) => prev.includes(subject.id) ? prev.filter((value) => value !== subject.id) : [...prev, subject.id])}><Text style={[styles.filterChipText, { color: theme.subText }, selectedAssignmentSubjects.includes(subject.id) && { color: theme.isDark ? "#0f172a" : theme.primaryText }]}>{subject.name}</Text></Pressable>)}</View>
          <Text style={[styles.inputLabel, styles.spaceTop, { color: theme.subText }]}>Session *</Text>
          <View style={styles.filterRow}>{sessions.map((session) => <Pressable key={session.id} style={[styles.filterChip, { borderColor: theme.border, backgroundColor: theme.cardMuted }, assignmentForm.session_id === session.id && { borderColor: theme.primary, backgroundColor: theme.isDark ? "#f8fafc" : theme.primary }]} onPress={() => { const nextSelections = deriveAssignmentSelections(assignments, assignmentForm.class_id, session.id); setAssignmentForm((prev) => ({ ...prev, session_id: session.id, section_id: nextSelections.sections[0] ?? null, subject_id: nextSelections.subjects[0] ?? null })); setSelectedAssignmentSections(nextSelections.sections); setSelectedAssignmentSubjects(nextSelections.subjects); }}><Text style={[styles.filterChipText, { color: theme.subText }, assignmentForm.session_id === session.id && { color: theme.isDark ? "#0f172a" : theme.primaryText }]}>{session.name}</Text></Pressable>)}</View>
          {canManageTeachers ? <Pressable style={[styles.successBtn, styles.spaceTop, { backgroundColor: theme.success, borderColor: theme.successBorder }]} onPress={submitAssignment} disabled={saving}><Text style={[styles.successBtnText, { color: theme.successText }]}>{saving ? "Saving..." : "Assign to Teacher"}</Text></Pressable> : null}
          <Text style={[styles.inputLabel, styles.spaceTop, { color: theme.subText }]}>Current Assignments</Text>
          {loadingAssignments ? <ActivityIndicator size="small" color={theme.primary} /> : assignments.length ? assignments.map((assignment) => <View key={assignment.id} style={[styles.assignmentCard, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}><Text style={[styles.assignmentText, { color: theme.text }]}>{assignment.class} - {assignment.section} - {assignment.subject}</Text><Text style={[styles.assignmentSubText, { color: theme.subText }]}>Session: {assignment.session}</Text>{canManageTeachers ? <Pressable onPress={() => deleteAssignment(assignment.id)} style={[styles.assignmentDelete, { borderColor: theme.dangerBorder, backgroundColor: theme.dangerSoft }]}><Text style={[styles.assignmentDeleteText, { color: theme.danger }]}>Remove</Text></Pressable> : null}</View>) : <Text style={[styles.emptyText, { color: theme.subText }]}>No assignments found.</Text>}
        </Sheet>
      </Modal>

      <Modal visible={deleteTarget !== null} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]} onPress={() => setDeleteTarget(null)} />
          <View style={[styles.confirmCard, { backgroundColor: theme.card, borderColor: theme.dangerBorder }]}>
            <View style={[styles.confirmIcon, { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder }]}>
              <Text style={[styles.confirmIconText, { color: theme.danger }]}>X</Text>
            </View>
            <Text style={[styles.confirmTitle, { color: theme.text }]}>Delete Teacher</Text>
            <Text style={[styles.confirmMessage, { color: theme.subText }]}>
              {deleteTarget ? `This will remove ${deleteTarget.name} from the teachers list.` : ""}
            </Text>
            <View style={styles.rowActions}>
              <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setDeleteTarget(null)} disabled={saving}>
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.deleteBtn, { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder }, saving && styles.disabledBtn]} onPress={handleDelete} disabled={saving}>
                <Text style={[styles.deleteBtnText, { color: theme.danger }]}>{saving ? "Deleting..." : "Delete"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  root: { flex: 1 },
  content: { gap: 10, paddingBottom: 120 },
  innerContent: { gap: 10, paddingHorizontal: 14, paddingTop: 10 },
  topNoticeOverlay: { position: "absolute", top: 0, left: 14, right: 14, zIndex: 20 },
  overviewCard: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 10 },
  overviewTitleCopy: { flex: 1, minWidth: 0 },
  overviewTitle: { fontSize: 15, lineHeight: 19, fontWeight: "900" },
  overviewMeta: { marginTop: 2, fontSize: 11, lineHeight: 15, fontWeight: "700" },
  overviewCount: { fontSize: 20, fontWeight: "900" },
  compactStatsRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  toolbarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  toolbarBtn: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  toolbarPrimaryBtn: { flex: 0.7 },
  toolbarBtnText: { fontSize: 12, fontWeight: "800" },
  compactFilterCard: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 10 },
  compactPanelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  compactPanelTitle: { fontSize: 14, fontWeight: "900" },
  compactHeaderActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  compactApplyBtn: { minHeight: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  heroEyebrow: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  title: { color: "#0f172a", fontWeight: "900", fontSize: 13, lineHeight: 16, letterSpacing: 0.8 },
  subtitle: { color: "#64748b", lineHeight: 20 },
  noticeCard: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1 },
  noticeSuccess: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  noticeError: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  noticeTitle: { color: "#0f172a", fontWeight: "800", marginBottom: 2 },
  noticeMessage: { color: "#475569" },
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  errorText: { color: "#dc2626", fontWeight: "700" },
  sectionCard: { backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  sectionTitle: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  hint: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  fieldBlock: { gap: 6 },
  inputLabel: { color: "#334155", fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 11, color: "#0f172a" },
  searchWrap: { minHeight: 42, borderWidth: 1, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 9, fontSize: 14, fontWeight: "700" },
  activeFiltersText: { fontSize: 12, lineHeight: 17, fontWeight: "700" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f8fafc" },
  filterChipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  filterChipText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  filterChipTextActive: { color: "#fff" },
  rowWrap: { paddingHorizontal: 14 },
  rowGap: { height: 10 },
  listFooter: { paddingHorizontal: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  grid: { gap: 12 },
  teacherCard: { backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 12, paddingVertical: 11, gap: 8 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarBadge: { width: 40, height: 40, borderRadius: 8, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%", borderRadius: 8 },
  avatarText: { color: "#0f172a", fontWeight: "900", fontSize: 15 },
  cardCopy: { flex: 1, minWidth: 0, gap: 2 },
  teacherName: { color: "#0f172a", fontWeight: "900", fontSize: 15, lineHeight: 19 },
  teacherMeta: { color: "#475569", fontWeight: "700", fontSize: 12 },
  detailList: { gap: 4 },
  metaStack: { gap: 6 },
  metaLineText: { fontSize: 12 },
  detailText: { color: "#475569", lineHeight: 20 },
  teacherBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, alignItems: "center" },
  teacherListBadge: { maxWidth: "100%", borderWidth: 1, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  teacherListBadgeText: { fontSize: 11, lineHeight: 14, fontWeight: "800" },
  rowActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  cardActions: { flexDirection: "row", flexWrap: "nowrap", justifyContent: "flex-end", gap: 7, marginTop: 2 },
  cardActionBtn: { width: 36, height: 36, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cardActionText: { color: "#334155", fontWeight: "700", fontSize: 12 },
  cardDeleteBtn: { backgroundColor: "#fee2e2", borderWidth: 1, borderColor: "#fecaca" },
  cardDeleteText: { color: "#b91c1c", fontWeight: "700", fontSize: 12 },
  primaryBtn: { backgroundColor: "#0f172a", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  heroPrimaryBtn: { flex: 1, backgroundColor: "#0f172a", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  ghostBtn: { borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  ghostBtnText: { color: "#334155", fontWeight: "700" },
  iconUtilityBtn: { width: 42, height: 42, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: "#334155", fontWeight: "700" },
  deleteBtn: { flex: 1, backgroundColor: "#fee2e2", borderWidth: 1, borderColor: "#fecaca", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  deleteBtnText: { color: "#b91c1c", fontWeight: "700" },
  successBtn: { flex: 1, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  successBtnText: { color: "#fff", fontWeight: "700" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.28)" },
  resetText: { color: "#15803d", fontWeight: "700" },
  modalCard: { maxHeight: "88%", backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, marginBottom: 12, gap: 10 },
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
  emptyCard: { borderWidth: 1, borderColor: "#e2e8f0", borderStyle: "dashed", borderRadius: 8, backgroundColor: "#f8fafc", padding: 20, marginHorizontal: 14 },
  emptyTitle: { color: "#0f172a", fontWeight: "700", fontSize: 15 },
  emptyText: { color: "#64748b", marginTop: 8 },
  spaceTop: { marginTop: 10 },
  confirmCard: { marginHorizontal: 18, marginBottom: 120, borderWidth: 1, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 20, gap: 12 },
  confirmIcon: { width: 44, height: 44, borderWidth: 1, borderRadius: 16, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  confirmIconText: { fontSize: 22, fontWeight: "800" },
  confirmTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  confirmMessage: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  disabledBtn: { opacity: 0.7 },
});


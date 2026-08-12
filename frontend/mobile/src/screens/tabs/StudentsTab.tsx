import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getClassStructure, getSessions, type ClassStructureItem } from "../../services/classesService";
import { getExams } from "../../services/examsService";
import { createStudent, deleteStudent, getStudentById, getStudents, updateStudent, type Student } from "../../services/studentsService";
import { getTargets } from "../../services/messagingService";
import StudentDetailsModule from "./students/StudentDetailsModule";
import SelectField from "../../components/form/SelectField";
import DateField from "../../components/form/DateField";
import TopNotice from "../../components/feedback/TopNotice";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { useAuthStore } from "../../store/authStore";

export type ParentConversationRequest = {
  recipientUserId: number;
  recipientName?: string;
  classId?: number | null;
  sectionId?: number | null;
};

type Props = {
  onStartParentMessage?: (payload: ParentConversationRequest) => void;
};

type SessionItem = { id: number; name: string; is_active?: number | boolean };
type StudentScope = "school" | "hs";
type Notice = { title: string; message: string; tone: "success" | "error" } | null;
type DeleteTarget = { id: number; name: string } | null;
type CreateForm = {
  admission_no: string;
  name: string;
  mobile: string;
  gender: string;
  dob: string;
  date_of_admission: string;
  session_id: number | null;
  class_id: number | null;
  section_id: number | null;
  roll_number: string;
  stream: string;
  father_name: string;
  father_mobile: string;
  father_email: string;
  father_occupation: string;
  father_qualification: string;
  mother_name: string;
  mother_mobile: string;
  mother_email: string;
  mother_occupation: string;
  mother_qualification: string;
};
type CreateErrorKey = keyof CreateForm | "parent_mobile";
type EditForm = { id: number | null; admission_no: string; name: string; mobile: string; gender: string; dob: string; date_of_admission: string; session_id: number | null; class_id: number | null; section_id: number | null; roll_number: string; stream: string; class_scope: StudentScope };

const EMPTY_CREATE: CreateForm = {
  admission_no: "",
  name: "",
  mobile: "",
  gender: "",
  dob: "",
  date_of_admission: "",
  session_id: null,
  class_id: null,
  section_id: null,
  roll_number: "",
  stream: "",
  father_name: "",
  father_mobile: "",
  father_email: "",
  father_occupation: "",
  father_qualification: "",
  mother_name: "",
  mother_mobile: "",
  mother_email: "",
  mother_occupation: "",
  mother_qualification: "",
};
const EMPTY_EDIT: EditForm = { id: null, admission_no: "", name: "", mobile: "", gender: "", dob: "", date_of_admission: "", session_id: null, class_id: null, section_id: null, roll_number: "", stream: "", class_scope: "school" };
const STREAM_OPTIONS = ["Arts", "Commerce", "Science"] as const;
const STUDENTS_PAGE_SIZE = 30;
const resolveScopeCodeFromClass = (item?: { class_scope?: string | null; scope_name?: string | null } | null): StudentScope => {
  const code = String(item?.class_scope || "").trim().toLowerCase();
  if (code === "hs" || code === "school") return code;
  const scopeName = String(item?.scope_name || "").trim().toLowerCase();
  if (scopeName.includes("higher secondary")) return "hs";
  if (scopeName.includes("school")) return "school";
  return "school";
};
const fmtScope = (v?: string | null) => String(v || "").trim().toLowerCase() === "hs" ? "Higher Secondary" : "School";
const fmtDate = (v?: string | null) => { if (!v) return "-"; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(); };
const inputDate = (v?: string | null) => { const raw = String(v || "").trim(); if (!raw) return ""; if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw; const m = raw.match(/^(\d{4}-\d{2}-\d{2})/); if (m) return m[1]; const d = new Date(raw); return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10); };
const getErr = (err: unknown, fallback: string) => typeof err === "object" && err && "response" in err ? ((err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error || (err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message || fallback) : fallback;
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim());
const normalizePhone = (value?: string | null) => String(value || "").replace(/\D/g, "");
const normalizeText = (value?: string | null) => String(value || "").trim().toLowerCase();

function FormLabel({ label }: { label: string }) {
  const { theme } = useAppTheme();
  return <Text style={[styles.formLabel, { color: theme.subText }]}>{label}</Text>;
}
function FieldError({ message }: { message?: string }) {
  const { theme } = useAppTheme();
  return message ? <Text style={[styles.fieldError, { color: theme.danger }]}>{message}</Text> : null;
}

function Sheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  const { theme, isDark } = useAppTheme();
  return <View style={styles.modalOverlay}><Pressable style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]} onPress={onClose} /><View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}><View style={styles.rowBetween}><View style={styles.sheetHeaderCopy}><Text style={[styles.modalTitle, { color: theme.text }]}>{title}</Text>{subtitle ? <Text style={[styles.sheetSubtitle, { color: theme.subText }]}>{subtitle}</Text> : null}</View><Pressable style={[styles.closeBtn, { borderColor: theme.border, backgroundColor: isDark ? theme.cardMuted : theme.card }]} onPress={onClose}><Text style={[styles.closeBtnText, { color: theme.text }]}>Close</Text></Pressable></View><ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>{children}</ScrollView></View></View>;
}

function CardIconAction({ icon, tone = "default", onPress }: { icon: keyof typeof Ionicons.glyphMap; tone?: "default" | "danger"; onPress: () => void }) {
  const { theme } = useAppTheme();
  const isDanger = tone === "danger";
  return <Pressable style={[styles.iconActionBtn, { borderColor: isDanger ? theme.dangerBorder : theme.border, backgroundColor: isDanger ? theme.dangerSoft : theme.card }, isDanger && styles.iconActionBtnDanger]} onPress={onPress}><Ionicons name={icon} size={18} color={isDanger ? theme.danger : theme.text} /></Pressable>;
}

function StudentListBadge({ label, tone = "neutral" }: { label: string; tone?: "accent" | "neutral" | "success" }) {
  const { theme } = useAppTheme();
  const palette = tone === "accent"
    ? { backgroundColor: theme.successSoft, borderColor: theme.successBorder, color: theme.success }
    : tone === "success"
      ? { backgroundColor: theme.successSoft, borderColor: theme.successBorder, color: theme.success }
      : { backgroundColor: theme.cardMuted, borderColor: theme.border, color: theme.subText };
  return (
    <View style={[styles.studentListBadge, { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }]}>
      <Text style={[styles.studentListBadgeText, { color: palette.color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function ClassSectionBlock({ className, section }: { className?: string | number | null; section?: string | number | null }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.classSectionWrap}>
      <View style={styles.classSectionValues}>
        <View style={styles.classSectionItem}>
          <Text style={[styles.classSectionValue, { color: theme.text }]} numberOfLines={1}>{className || "-"}</Text>
          <Text style={[styles.classSectionLabel, { color: theme.subText }]}>Class</Text>
        </View>
        <View style={[styles.classSectionDivider, { backgroundColor: theme.border }]} />
        <View style={styles.classSectionItem}>
          <Text style={[styles.classSectionValue, { color: theme.text }]} numberOfLines={1}>{section || "-"}</Text>
          <Text style={[styles.classSectionLabel, { color: theme.subText }]}>Section</Text>
        </View>
      </View>
    </View>
  );
}

export default function StudentsTab({ onStartParentMessage }: Props) {
  const { theme, isDark } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const isSuperAdmin = roles.some((role) => {
    const normalized = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    return normalized === "super_admin" || normalized === "superadmin";
  });
  const isParent = roles.some((role) => String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_") === "parent");
  const canSendMessages = isSuperAdmin || permissions.includes("messages.send");
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsTotal, setStudentsTotal] = useState<number | null>(null);
  const [studentsHasMore, setStudentsHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [classes, setClasses] = useState<ClassStructureItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [exams, setExams] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT);
  const [createErrors, setCreateErrors] = useState<Partial<Record<CreateErrorKey, string>>>({});
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof EditForm, string>>>({});
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const selectedClass = useMemo(() => classes.find((x) => x.id === classId) ?? null, [classes, classId]);
  const createClass = useMemo(() => classes.find((x) => x.id === createForm.class_id) ?? null, [classes, createForm.class_id]);
  const editClass = useMemo(() => classes.find((x) => x.id === editForm.class_id) ?? null, [classes, editForm.class_id]);
  const activeSession = useMemo(() => sessions.find((x) => Number(x.is_active) === 1 || x.is_active === true), [sessions]);
  const classById = useMemo(
    () => new Map<number, ClassStructureItem>(classes.map((item) => [Number(item.id), item])),
    [classes],
  );
  const classByName = useMemo(() => {
    const map = new Map<string, ClassStructureItem>();
    for (const item of classes) {
      const key = String(item.name || "").trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, item);
      }
    }
    return map;
  }, [classes]);
  const resolveMatchedClass = useCallback(
    (student: Student) => {
      const byId = student.class_id ? classById.get(Number(student.class_id)) : null;
      if (byId) return byId;
      const key = String(student.class || "").trim().toLowerCase();
      return key ? classByName.get(key) ?? null : null;
    },
    [classById, classByName],
  );

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => !q || [s.name, s.phone || s.mobile, s.class, s.section, s.roll_number, s.stream_name, s.admission_no].join(" ").toLowerCase().includes(q));
  }, [students, search]);

  const stats = useMemo(() => {
    const total = students.length;
    const school = students.filter((s) => String(s.class_scope || "").toLowerCase() === "school").length;
    const hs = students.filter((s) => String(s.class_scope || "").toLowerCase() === "hs").length;
    const girls = students.filter((s) => String(s.gender || "").toLowerCase() === "female").length;
    return [
      { label: "Total Students", value: total, accent: theme.infoSoft, border: theme.infoBorder, tone: theme.infoText },
      { label: "School", value: school, accent: theme.successSoft, border: theme.successBorder, tone: theme.success },
      { label: "Higher Secondary", value: hs, accent: theme.card, border: theme.border, tone: theme.text },
      { label: "Girls", value: girls, accent: theme.warningSoft, border: theme.warningBorder, tone: theme.warningText },
    ];
  }, [students, theme]);

  const loadStudentsList = useCallback(async (mode: "initial" | "refresh" | "loadMore" = "initial") => {
    if (mode === "loadMore") {
      if (loadingMore || !studentsHasMore) return;
      setLoadingMore(true);
    } else if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const nextPage = mode === "loadMore" ? studentsPage + 1 : 1;

    try {
      const result = await getStudents({
        class_id: classId ? String(classId) : undefined,
        section_id: sectionId ? String(sectionId) : undefined,
        page: nextPage,
        limit: STUDENTS_PAGE_SIZE,
      });

      const rows = Array.isArray(result?.data) ? result.data : [];
      if (mode === "loadMore") {
        setStudents((prev) => {
          const seen = new Set(prev.map((item) => Number(item.id)));
          const incoming = rows.filter((item) => !seen.has(Number(item.id)));
          return [...prev, ...incoming];
        });
      } else {
        setStudents(rows);
      }

      setStudentsPage(nextPage);
      setStudentsTotal(result?.pagination?.total ?? null);
      if (result?.pagination) {
        setStudentsHasMore(nextPage < Number(result.pagination.totalPages || 0));
      } else {
        setStudentsHasMore(rows.length >= STUDENTS_PAGE_SIZE);
      }
    } catch (err: unknown) {
      Alert.alert("Error", getErr(err, "Failed to load students."));
      if (mode !== "loadMore") {
        setStudents([]);
        setStudentsTotal(null);
        setStudentsHasMore(false);
      }
    } finally {
      if (mode === "loadMore") setLoadingMore(false);
      else if (mode === "refresh") setRefreshing(false);
      else setLoading(false);
    }
  }, [classId, loadingMore, sectionId, studentsHasMore, studentsPage]);

  useEffect(() => { if (!notice) return undefined; const t = setTimeout(() => setNotice(null), 3200); return () => clearTimeout(t); }, [notice]);
  useEffect(() => { (async () => { try { const [c, s, e] = await Promise.all([getClassStructure(), getSessions(), getExams()]); setClasses(c as ClassStructureItem[]); setSessions((s || []).map((x) => ({ id: Number(x.id), name: x.name, is_active: x.is_active }))); setExams((e || []).map((x) => ({ id: Number(x.id), name: x.name }))); } catch { setClasses([]); setSessions([]); setExams([]); } })(); }, []);
  useEffect(() => { loadStudentsList(); }, [classId, sectionId]);

  function showNotice(title: string, message: string, tone: "success" | "error" = "success") { setNotice({ title, message, tone }); }

  function validateCreate(form: CreateForm) {
    const e: Partial<Record<CreateErrorKey, string>> = {};
    if (!form.name.trim()) e.name = "Student name is required.";
    if (form.mobile.trim() && !/^\d{10}$/.test(form.mobile.trim())) e.mobile = "Student phone must be 10 digits.";
    if (!form.gender.trim()) e.gender = "Gender is required.";
    if (!isDate(form.dob)) e.dob = "DOB must be YYYY-MM-DD.";
    if (form.date_of_admission.trim() && !isDate(form.date_of_admission)) e.date_of_admission = "Admission date must be YYYY-MM-DD.";
    if (!form.session_id) e.session_id = "Session is required.";
    if (!form.class_id) e.class_id = "Class is required.";
    if (!form.roll_number.trim()) e.roll_number = "Roll number is required.";
    const chosen = form.class_id ? classById.get(Number(form.class_id)) ?? null : null;
    if (resolveScopeCodeFromClass(chosen) === "hs" && !form.stream.trim()) e.stream = "Stream is required for higher secondary classes.";
    if (!form.father_mobile.trim() && !form.mother_mobile.trim()) e.parent_mobile = "Enter at least one parent phone number.";
    if (form.father_mobile.trim() && !form.father_name.trim()) e.father_name = "Father name is required when father phone is entered.";
    if (form.father_mobile.trim() && !/^\d{10}$/.test(form.father_mobile.trim())) e.father_mobile = "Father phone must be 10 digits.";
    if (form.father_email.trim() && !/^\S+@\S+\.\S+$/.test(form.father_email.trim())) e.father_email = "Father email is invalid.";
    if (form.mother_mobile.trim() && !form.mother_name.trim()) e.mother_name = "Mother name is required when mother phone is entered.";
    if (form.mother_mobile.trim() && !/^\d{10}$/.test(form.mother_mobile.trim())) e.mother_mobile = "Mother phone must be 10 digits.";
    if (form.mother_email.trim() && !/^\S+@\S+\.\S+$/.test(form.mother_email.trim())) e.mother_email = "Mother email is invalid.";
    return e;
  }

  function validateEdit(form: EditForm) {
    const e: Partial<Record<keyof EditForm, string>> = {};
    if (!form.name.trim()) e.name = "Name is required.";
    if (form.mobile.trim() && !/^\d{10}$/.test(form.mobile.trim())) e.mobile = "Phone must be 10 digits.";
    if (!form.gender.trim()) e.gender = "Gender is required.";
    if (!isDate(form.dob)) e.dob = "DOB must be YYYY-MM-DD.";
    if (form.date_of_admission.trim() && !isDate(form.date_of_admission)) e.date_of_admission = "Admission date must be YYYY-MM-DD.";
    if (!form.session_id) e.session_id = "Session is required.";
    if (!form.class_id) e.class_id = "Class is required.";
    if (!form.roll_number.trim()) e.roll_number = "Roll number is required.";
    if (form.class_scope === "hs" && !form.stream.trim()) e.stream = "Stream is required for higher secondary classes.";
    return e;
  }

  async function handleCreate() {
    const errors = validateCreate(createForm);
    setCreateErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      await createStudent({
        student: {
          admission_no: createForm.admission_no.trim() || undefined,
          name: createForm.name.trim(),
          mobile: createForm.mobile.trim() || undefined,
          gender: createForm.gender.trim().toLowerCase(),
          dob: createForm.dob.trim(),
          date_of_admission: createForm.date_of_admission.trim() || new Date().toISOString().slice(0, 10),
        },
        enrollment: {
          session_id: Number(createForm.session_id),
          class_id: Number(createForm.class_id),
          section_id: createForm.section_id ? Number(createForm.section_id) : undefined,
          medium: String((classes.find((x) => x.id === createForm.class_id)?.sections || []).find((s) => s.id === createForm.section_id)?.medium || "").trim() || undefined,
          roll_number: createForm.roll_number.trim(),
          stream: createForm.stream.trim() || undefined,
        },
        father: {
          name: createForm.father_name.trim() || undefined,
          mobile: createForm.father_mobile.trim() || undefined,
          email: createForm.father_email.trim() || undefined,
          occupation: createForm.father_occupation.trim() || undefined,
          qualification: createForm.father_qualification.trim() || undefined,
        },
        mother: {
          name: createForm.mother_name.trim() || undefined,
          mobile: createForm.mother_mobile.trim() || undefined,
          email: createForm.mother_email.trim() || undefined,
          occupation: createForm.mother_occupation.trim() || undefined,
          qualification: createForm.mother_qualification.trim() || undefined,
        },
      });
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
      setCreateErrors({});
      await loadStudentsList("refresh");
      showNotice("Student Created", "The student has been added successfully.");
    } catch (err: unknown) {
      Alert.alert("Create failed", getErr(err, "Failed to create student."));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(student: Student) {
    const matched = resolveMatchedClass(student);
    setEditForm({
      id: student.id,
      admission_no: student.admission_no || "",
      name: student.name || "",
      mobile: student.phone || student.mobile || "",
      gender: student.gender || "",
      dob: inputDate(student.dob),
      date_of_admission: inputDate(student.date_of_admission),
      session_id: student.session_id || null,
      class_id: student.class_id || matched?.id || null,
      section_id: student.section_id || null,
      roll_number: String(student.roll_number || ""),
      stream: student.stream_name || "",
      class_scope: resolveScopeCodeFromClass({
        class_scope: student.class_scope || matched?.class_scope,
        scope_name: (student as Student & { scope_name?: string | null }).scope_name || matched?.scope_name,
      }),
    });
    setEditErrors({});
    setEditOpen(true);
  }

  async function handleUpdate() {
    if (!editForm.id) return;
    const errors = validateEdit(editForm);
    setEditErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      await updateStudent(editForm.id, {
        admission_no: editForm.admission_no.trim() || null,
        name: editForm.name.trim(),
        mobile: editForm.mobile.trim(),
        gender: editForm.gender.trim().toLowerCase(),
        dob: editForm.dob.trim(),
        date_of_admission: editForm.date_of_admission.trim() || undefined,
        session_id: Number(editForm.session_id),
        class_id: Number(editForm.class_id),
        section_id: editForm.section_id ? Number(editForm.section_id) : undefined,
        roll_number: editForm.roll_number.trim(),
        stream: editForm.class_scope === "hs" ? editForm.stream.trim() || undefined : "",
      });
      setEditOpen(false);
      setEditForm(EMPTY_EDIT);
      setEditErrors({});
      await loadStudentsList("refresh");
      showNotice("Student Updated", "The student details have been updated.");
    } catch (err: unknown) {
      Alert.alert("Update failed", getErr(err, "Failed to update student."));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(student: Student) {
    setDeleteTarget({ id: student.id, name: student.name });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteStudent(deleteTarget.id);
      setDeleteTarget(null);
      await loadStudentsList("refresh");
      showNotice("Student Deleted", "The student has been removed.");
    } catch (err: unknown) {
      showNotice("Delete Failed", getErr(err, "Failed to delete student."), "error");
    } finally {
      setSaving(false);
    }
  }

  function openDetails(student: Student) {
    setSelectedStudentId(student.id);
    setDetailOpen(true);
  }

  async function handleMessageParent(student: Student) {
    if (!canSendMessages || !onStartParentMessage) return;

    try {
      const details = await getStudentById(student.id);
      const parents = Array.isArray(details?.parents) ? details.parents : [];
      if (!parents.length) {
        showNotice("Parent Not Found", "No linked parent found for this student.", "error");
        return;
      }

      const preferredParent =
        parents.find((parent) => normalizeText(parent.relationship) === "father") ||
        parents.find((parent) => normalizeText(parent.relationship) === "mother") ||
        parents[0];

      const parentMobiles = parents
        .map((parent) => normalizePhone(parent.mobile))
        .filter(Boolean);
      const preferredMobile = normalizePhone(preferredParent?.mobile);
      const preferredName = normalizeText(preferredParent?.name);
      const hasIdentityHint = Boolean(preferredMobile || preferredName || parentMobiles.length);

      const targets = await getTargets();
      const parentTargets = Array.isArray(targets?.parents) ? targets.parents : [];
      if (!parentTargets.length) {
        showNotice("Parent Not Found", "No parent recipients are available in messaging targets.", "error");
        return;
      }

      const ranked = parentTargets
        .map((target) => {
          let score = 0;
          let identityMatched = false;
          const targetMobile = normalizePhone(target.mobile);
          const targetName = normalizeText(target.name);

          if (student.class_id && Number(target.class_id) === Number(student.class_id)) score += 30;
          if (student.section_id && Number(target.section_id) === Number(student.section_id)) score += 20;
          if (preferredMobile && targetMobile === preferredMobile) {
            score += 100;
            identityMatched = true;
          } else if (targetMobile && parentMobiles.includes(targetMobile)) {
            score += 60;
            identityMatched = true;
          }
          if (preferredName && targetName === preferredName) {
            score += 40;
            identityMatched = true;
          } else if (preferredName && targetName.includes(preferredName)) {
            score += 20;
            identityMatched = true;
          }

          return { target, score, identityMatched };
        })
        .sort((a, b) => b.score - a.score);

      const inScope = parentTargets.filter((target) => {
        if (student.class_id && Number(target.class_id) !== Number(student.class_id)) return false;
        if (student.section_id && Number(target.section_id) !== Number(student.section_id)) return false;
        return Number(target.user_id) > 0;
      });

      const selected = hasIdentityHint
        ? ranked.find((item) => Number(item.target.user_id) > 0 && item.identityMatched)?.target
        : inScope.length === 1
          ? inScope[0]
          : null;
      if (!selected?.user_id) {
        showNotice("Parent Not Found", "Could not resolve the parent messaging recipient for this student.", "error");
        return;
      }

      onStartParentMessage({
        recipientUserId: Number(selected.user_id),
        recipientName: selected.name || preferredParent?.name || undefined,
        classId: student.class_id ?? null,
        sectionId: student.section_id ?? null,
      });
    } catch (err: unknown) {
      showNotice("Open Messaging Failed", getErr(err, "Could not prepare parent conversation."), "error");
    }
  }

  const selectedStudent = useMemo(
    () => students.find((student) => Number(student.id) === Number(selectedStudentId)) ?? null,
    [selectedStudentId, students],
  );

  function closeDetails() {
    setDetailOpen(false);
    setSelectedStudentId(null);
  }

  useEffect(() => {
    if (!detailOpen) return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closeDetails();
      return true;
    });
    return () => subscription.remove();
  }, [detailOpen]);

  function resetBrowseFilters() {
    setClassId(null);
    setSectionId(null);
    setSearch("");
  }

  if (detailOpen) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.bg }]}>
        <TopNotice notice={notice} style={styles.topNoticeOverlay} />
        <View style={[styles.detailHeader, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
          <Pressable style={[styles.detailBackBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={closeDetails}>
            <Ionicons name="arrow-back" size={18} color={theme.icon} />
          </Pressable>
          <View style={styles.detailHeaderCopy}>
            <Text style={[styles.detailHeaderTitle, { color: theme.text }]} numberOfLines={1}>Student Details</Text>
            <Text style={[styles.detailHeaderSubtitle, { color: theme.subText }]} numberOfLines={1}>
              {selectedStudent?.name || "Detailed record, marks, and linked data"}
            </Text>
          </View>
        </View>
        <ScrollView
          style={styles.detailScreenBody}
          contentContainerStyle={styles.detailScreenContent}
          showsVerticalScrollIndicator={false}
        >
          <StudentDetailsModule studentId={selectedStudentId} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TopNotice notice={notice} style={styles.topNoticeOverlay} />
      <FlatList
        style={styles.root}
        contentContainerStyle={styles.content}
        data={loading ? [] : filteredStudents}
        keyExtractor={(item) => String(item.id)}
        refreshing={refreshing}
        onRefresh={() => loadStudentsList("refresh")}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        ListHeaderComponent={
          <View style={styles.innerContent}>
            <View style={styles.heroCard}>
              <View style={styles.heroCopy}>
                <Text style={[styles.title, { color: theme.text }]}>Students</Text>
                <Text style={[styles.subtitle, { color: theme.subText }]}>
                  {isParent
                    ? "View your child records, attendance, fees, and results"
                    : "Manage admissions, class placement, and parent linkage"}
                </Text>
              </View>
              <View style={styles.heroPrimaryActions}>
                {!isParent ? (
                  <Pressable style={[styles.heroPrimaryBtn, { backgroundColor: theme.primary }]} onPress={() => { setCreateOpen(true); setCreateErrors({}); setCreateForm((p) => ({ ...p, session_id: p.session_id ?? activeSession?.id ?? null })); }}><Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>Add Student</Text></Pressable>
                ) : null}
              </View>
            </View>

            {!isParent ? (
              <View style={styles.statsGrid}>
                {stats.map((item) => <View key={item.label} style={[styles.statCard, { backgroundColor: item.accent, borderColor: item.border }]}><Text style={[styles.statLabel, { color: theme.subText }]}>{item.label}</Text><Text style={[styles.statValue, { color: item.tone }]}>{item.value}</Text></View>)}
              </View>
            ) : null}

            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }] }>
              <View style={styles.rowBetween}><Text style={[styles.sectionTitle, { color: theme.text }]}>{isParent ? "My Students" : "Browse Students"}</Text><Text style={[styles.hint, { color: theme.subText }]}>{filteredStudents.length} visible{studentsTotal !== null ? ` | ${students.length}/${studentsTotal} loaded` : ""}</Text></View>
              <View style={styles.searchRow}>
                <View style={styles.searchWrap}>
                  <TextInput style={[styles.input, styles.searchInput, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={search} onChangeText={setSearch} placeholder={isParent ? "Search child..." : "Search..."} placeholderTextColor={theme.mutedText} />
                </View>
                <Pressable style={[styles.iconUtilityBtn, { borderColor: theme.successBorder, backgroundColor: theme.successSoft }]} onPress={() => setFiltersOpen(true)}>
                  <Ionicons name="options-outline" size={18} color={theme.success} />
                </Pressable>
              </View>
              {(classId !== null || sectionId !== null) ? (
                <Text style={[styles.activeFiltersText, { color: theme.subText }]}>
                  {classId !== null ? `Class: ${selectedClass?.name || "-"}` : "All classes"}
                  {sectionId !== null ? ` | Section: ${selectedClass?.sections?.find((section) => section.id === sectionId)?.name || "-"}` : ""}
                </Text>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={theme.text} /></View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={[styles.emptyTitle, { color: theme.text }]}>No students found</Text><Text style={[styles.emptyText, { color: theme.subText }]}>{isParent ? "No linked student records are available right now." : "Try changing the search or class filters, or add a new student."}</Text></View>
          )
        }
        ListFooterComponent={
          <View style={styles.listFooter}>
            {loadingMore ? (
              <ActivityIndicator size="small" color={theme.text} />
            ) : !loading && studentsHasMore ? (
              <Pressable
                style={[styles.inlineGhostBtn, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}
                onPress={() => void loadStudentsList("loadMore")}
              >
                <Text style={[styles.ghostBtnText, { color: theme.text }]}>
                  Load More
                  {studentsTotal !== null ? ` (${students.length}/${studentsTotal})` : ""}
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (!loading && !loadingMore && studentsHasMore) {
            void loadStudentsList("loadMore");
          }
        }}
        ItemSeparatorComponent={() => <View style={styles.rowGap} />}
        renderItem={({ item: student }) => {
          const matched = resolveMatchedClass(student);
          const matchedSection = (matched?.sections || []).find((section) => String(section.id) === String(student.section_id || ""));
          const medium = student.medium || matchedSection?.medium || "Not set";
          const scopeLabel = fmtScope(resolveScopeCodeFromClass({
            class_scope: student.class_scope || matched?.class_scope,
            scope_name: (student as Student & { scope_name?: string | null }).scope_name || matched?.scope_name,
          }));
          const isHsScope = resolveScopeCodeFromClass({
            class_scope: student.class_scope || matched?.class_scope,
            scope_name: (student as Student & { scope_name?: string | null }).scope_name || matched?.scope_name,
          }) === "hs";
          const contactLine = [
            `Phone ${student.phone || student.mobile || "-"}`,
            `Admission ${fmtDate(student.date_of_admission)}`,
          ].join(" | ");
          return (
            <View style={styles.rowWrap}>
              <Pressable style={[styles.studentCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => openDetails(student)}>
                <View style={styles.cardTop}>
                  <View style={[styles.avatarBadge, { backgroundColor: theme.successSoft, borderColor: theme.successBorder }]}>
                    <Text style={[styles.avatarText, { color: theme.success }]}>{student.name?.slice(0, 1)?.toUpperCase() || "S"}</Text>
                  </View>
                  <View style={styles.cardCopy}>
                    <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>
                      {student.name}
                    </Text>
                    <Text style={[styles.studentMeta, { color: theme.subText }]} numberOfLines={1}>
                      {student.admission_no ? `Adm ${student.admission_no}` : `KKV-${student.id}`}
                    </Text>
                  </View>
                  <ClassSectionBlock className={student.class} section={student.section} />
                </View>

                <View style={styles.metaStack}>
                  <View style={styles.studentBadgeRow}>
                    <StudentListBadge label={`Roll No - ${student.roll_number || "-"}`} tone="accent" />
                    <StudentListBadge label={scopeLabel} />
                    <StudentListBadge label={`Medium - ${medium}`} />
                    {isHsScope ? <StudentListBadge label={`Stream ${student.stream_name || "-"}`} tone="success" /> : null}
                  </View>
                  <Text style={[styles.detailText, styles.metaLineText, { color: theme.subText }]} numberOfLines={1}>
                    {contactLine}
                  </Text>
                </View>

                {!isParent ? (
                  <View style={styles.cardIconActions}>
                    <CardIconAction icon="eye-outline" onPress={() => openDetails(student)} />
                    {canSendMessages ? (
                      <CardIconAction icon="chatbubble-ellipses-outline" onPress={() => void handleMessageParent(student)} />
                    ) : null}
                    <CardIconAction icon="create-outline" onPress={() => openEdit(student)} />
                    <CardIconAction icon="trash-outline" tone="danger" onPress={() => confirmDelete(student)} />
                  </View>
                ) : null}
              </Pressable>
            </View>
          );
        }}
      />

      <Modal visible={filtersOpen} transparent animationType="fade" onRequestClose={() => setFiltersOpen(false)}>
        <View style={styles.popoverOverlay}>
          <Pressable style={styles.popoverBackdrop} onPress={() => setFiltersOpen(false)} />
          <View style={[styles.filterPopover, { backgroundColor: theme.card, borderColor: theme.border }] }>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Filters</Text>
              <Pressable onPress={resetBrowseFilters}>
                <Text style={[styles.resetText, { color: theme.success }]}>Reset</Text>
              </Pressable>
            </View>
            <SelectField
              label="Class"
              value={classId === null ? "" : String(classId)}
              onChange={(value) => {
                if (!value) {
                  setClassId(null);
                  setSectionId(null);
                  return;
                }
                setClassId(Number(value));
                setSectionId(null);
              }}
              options={classes.map((item) => ({ label: item.name, value: String(item.id) }))}
              placeholder="All classes"
              allowClear
              clearLabel="All classes"
            />
            <SelectField
              label="Section"
              value={sectionId === null ? "" : String(sectionId)}
              onChange={(value) => setSectionId(value ? Number(value) : null)}
              options={(selectedClass?.sections || []).map((section) => ({
                label: `${section.name}${section.medium ? ` (${section.medium})` : ""}`,
                value: String(section.id),
              }))}
              placeholder="All sections"
              allowClear
              clearLabel="All sections"
              disabled={!selectedClass}
            />
            <View style={styles.rowActions}>
              <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setFiltersOpen(false)}>
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <Sheet title="Add Student" subtitle="Create a student, enrollment, and parent linkage in one flow." onClose={() => setCreateOpen(false)}>
          <FormLabel label="Student name *" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={createForm.name} onChangeText={(v) => setCreateForm((p) => ({ ...p, name: v }))} placeholderTextColor={theme.mutedText} /><FieldError message={createErrors.name} />
          <FormLabel label="Admission No" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={createForm.admission_no} onChangeText={(v) => setCreateForm((p) => ({ ...p, admission_no: v }))} placeholderTextColor={theme.mutedText} />
          <FormLabel label="Student phone" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={createForm.mobile} onChangeText={(v) => setCreateForm((p) => ({ ...p, mobile: v }))} keyboardType="phone-pad" placeholderTextColor={theme.mutedText} /><FieldError message={createErrors.mobile} />
          <FormLabel label="Gender * (male/female/other)" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={createForm.gender} onChangeText={(v) => setCreateForm((p) => ({ ...p, gender: v }))} placeholderTextColor={theme.mutedText} /><FieldError message={createErrors.gender} />
          <DateField label="DOB *" value={createForm.dob} onChange={(v) => setCreateForm((p) => ({ ...p, dob: v }))} placeholder="Select DOB" /><FieldError message={createErrors.dob} />
          <DateField label="Admission Date" value={createForm.date_of_admission} onChange={(v) => setCreateForm((p) => ({ ...p, date_of_admission: v }))} placeholder="Select admission date" /><FieldError message={createErrors.date_of_admission} />
          <FormLabel label="Roll number *" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={createForm.roll_number} onChangeText={(v) => setCreateForm((p) => ({ ...p, roll_number: v }))} placeholderTextColor={theme.mutedText} /><FieldError message={createErrors.roll_number} />
          <FormLabel label="Father name" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={createForm.father_name} onChangeText={(v) => setCreateForm((p) => ({ ...p, father_name: v }))} placeholderTextColor={theme.mutedText} /><FieldError message={createErrors.father_name} />
          <FormLabel label="Father phone" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={createForm.father_mobile} onChangeText={(v) => setCreateForm((p) => ({ ...p, father_mobile: v }))} keyboardType="phone-pad" placeholderTextColor={theme.mutedText} /><FieldError message={createErrors.father_mobile} />
          <FormLabel label="Father email" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={createForm.father_email} onChangeText={(v) => setCreateForm((p) => ({ ...p, father_email: v }))} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={theme.mutedText} /><FieldError message={createErrors.father_email} />
          <FormLabel label="Father occupation" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={createForm.father_occupation} onChangeText={(v) => setCreateForm((p) => ({ ...p, father_occupation: v }))} placeholderTextColor={theme.mutedText} />
          <FormLabel label="Father qualification" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={createForm.father_qualification} onChangeText={(v) => setCreateForm((p) => ({ ...p, father_qualification: v }))} placeholderTextColor={theme.mutedText} />
          <FormLabel label="Mother name" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={createForm.mother_name} onChangeText={(v) => setCreateForm((p) => ({ ...p, mother_name: v }))} placeholderTextColor={theme.mutedText} /><FieldError message={createErrors.mother_name} />
          <FormLabel label="Mother phone" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={createForm.mother_mobile} onChangeText={(v) => setCreateForm((p) => ({ ...p, mother_mobile: v }))} keyboardType="phone-pad" placeholderTextColor={theme.mutedText} /><FieldError message={createErrors.mother_mobile} /><FieldError message={createErrors.parent_mobile} />
          <FormLabel label="Mother email" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={createForm.mother_email} onChangeText={(v) => setCreateForm((p) => ({ ...p, mother_email: v }))} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={theme.mutedText} /><FieldError message={createErrors.mother_email} />
          <FormLabel label="Mother occupation" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={createForm.mother_occupation} onChangeText={(v) => setCreateForm((p) => ({ ...p, mother_occupation: v }))} placeholderTextColor={theme.mutedText} />
          <FormLabel label="Mother qualification" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={createForm.mother_qualification} onChangeText={(v) => setCreateForm((p) => ({ ...p, mother_qualification: v }))} placeholderTextColor={theme.mutedText} />
          <SelectField label="Session *" value={createForm.session_id === null ? "" : String(createForm.session_id)} onChange={(value) => setCreateForm((p) => ({ ...p, session_id: value ? Number(value) : null }))} options={sessions.map((item) => ({ label: item.name, value: String(item.id) }))} placeholder="Choose session" /><FieldError message={createErrors.session_id} />
          <SelectField label="Class *" value={createForm.class_id === null ? "" : String(createForm.class_id)} onChange={(value) => setCreateForm((p) => ({ ...p, class_id: value ? Number(value) : null, section_id: null, stream: "" }))} options={classes.map((item) => ({ label: item.name, value: String(item.id) }))} placeholder="Choose class" /><FieldError message={createErrors.class_id} />
          <SelectField label="Section (Optional)" value={createForm.section_id === null ? "" : String(createForm.section_id)} onChange={(value) => setCreateForm((p) => ({ ...p, section_id: value ? Number(value) : null }))} options={(createClass?.sections || []).map((section) => ({ label: `${section.name}${section.medium ? ` (${section.medium})` : ""}`, value: String(section.id) }))} placeholder="Choose section" disabled={!createClass} />
          {resolveScopeCodeFromClass(createClass) === "hs" ? <><SelectField label="Stream *" value={createForm.stream} onChange={(value) => setCreateForm((p) => ({ ...p, stream: value }))} options={STREAM_OPTIONS.map((item) => ({ label: item, value: item }))} placeholder="Choose stream" /><FieldError message={createErrors.stream} /></> : null}
          <View style={styles.rowActions}><Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setCreateOpen(false)}><Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text></Pressable><Pressable style={[styles.successBtn, { backgroundColor: theme.success, borderColor: theme.successBorder }]} onPress={handleCreate} disabled={saving}><Text style={[styles.successBtnText, { color: theme.successText }]}>{saving ? "Saving..." : "Save"}</Text></Pressable></View>
        </Sheet>
      </Modal>

      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <Sheet title="Edit Student" subtitle="Update student identity and enrollment details." onClose={() => setEditOpen(false)}>
          <FormLabel label="Name *" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={editForm.name} onChangeText={(v) => setEditForm((p) => ({ ...p, name: v }))} placeholderTextColor={theme.mutedText} /><FieldError message={editErrors.name} />
          <FormLabel label="Admission No" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={editForm.admission_no} onChangeText={(v) => setEditForm((p) => ({ ...p, admission_no: v }))} placeholderTextColor={theme.mutedText} />
          <FormLabel label="Phone" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={editForm.mobile} onChangeText={(v) => setEditForm((p) => ({ ...p, mobile: v }))} keyboardType="phone-pad" placeholderTextColor={theme.mutedText} /><FieldError message={editErrors.mobile} />
          <FormLabel label="Gender *" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={editForm.gender} onChangeText={(v) => setEditForm((p) => ({ ...p, gender: v }))} placeholderTextColor={theme.mutedText} /><FieldError message={editErrors.gender} />
          <DateField label="DOB *" value={editForm.dob} onChange={(v) => setEditForm((p) => ({ ...p, dob: v }))} placeholder="Select DOB" /><FieldError message={editErrors.dob} />
          <DateField label="Admission Date" value={editForm.date_of_admission} onChange={(v) => setEditForm((p) => ({ ...p, date_of_admission: v }))} placeholder="Select admission date" /><FieldError message={editErrors.date_of_admission} />
          <SelectField label="Session *" value={editForm.session_id === null ? "" : String(editForm.session_id)} onChange={(value) => setEditForm((p) => ({ ...p, session_id: value ? Number(value) : null }))} options={sessions.map((item) => ({ label: item.name, value: String(item.id) }))} placeholder="Choose session" /><FieldError message={editErrors.session_id} />
          <SelectField label="Class *" value={editForm.class_id === null ? "" : String(editForm.class_id)} onChange={(value) => {
            const item = classes.find((row) => String(row.id) === String(value));
            const scope = resolveScopeCodeFromClass(item);
            setEditForm((p) => ({ ...p, class_id: value ? Number(value) : null, section_id: null, class_scope: scope, stream: scope === "hs" ? p.stream : "" }));
          }} options={classes.map((item) => ({ label: item.name, value: String(item.id) }))} placeholder="Choose class" /><FieldError message={editErrors.class_id} />
          <SelectField label="Section (Optional)" value={editForm.section_id === null ? "" : String(editForm.section_id)} onChange={(value) => setEditForm((p) => ({ ...p, section_id: value ? Number(value) : null }))} options={(editClass?.sections || []).map((section) => ({ label: `${section.name}${section.medium ? ` (${section.medium})` : ""}`, value: String(section.id) }))} placeholder="Choose section" disabled={!editClass} />
          <FormLabel label="Roll number *" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={editForm.roll_number} onChangeText={(v) => setEditForm((p) => ({ ...p, roll_number: v }))} placeholderTextColor={theme.mutedText} /><FieldError message={editErrors.roll_number} />
          {editForm.class_scope === "hs" ? <><SelectField label="Stream *" value={editForm.stream} onChange={(value) => setEditForm((p) => ({ ...p, stream: value }))} options={STREAM_OPTIONS.map((item) => ({ label: item, value: item }))} placeholder="Choose stream" /><FieldError message={editErrors.stream} /></> : null}
          <View style={styles.rowActions}><Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setEditOpen(false)}><Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text></Pressable><Pressable style={[styles.successBtn, { backgroundColor: theme.success, borderColor: theme.successBorder }]} onPress={handleUpdate} disabled={saving}><Text style={[styles.successBtnText, { color: theme.successText }]}>{saving ? "Saving..." : "Update"}</Text></Pressable></View>
        </Sheet>
      </Modal>

      <Modal visible={deleteTarget !== null} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]} onPress={() => setDeleteTarget(null)} />
          <View style={[styles.confirmCard, { backgroundColor: theme.card, borderColor: theme.dangerBorder }]}>
            <View style={[styles.confirmIcon, { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder }]}>
              <Text style={[styles.confirmIconText, { color: theme.danger }]}>×</Text>
            </View>
            <Text style={[styles.confirmTitle, { color: theme.text }]}>Delete Student</Text>
            <Text style={[styles.confirmMessage, { color: theme.subText }]}>
              {deleteTarget ? `This will remove ${deleteTarget.name} from the students list.` : ""}
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
  content: { gap: 14, paddingBottom: 120 },
  detailHeader: { minHeight: 62, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  detailBackBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  detailHeaderCopy: { flex: 1, minWidth: 0 },
  detailHeaderTitle: { fontSize: 18, fontWeight: "800" },
  detailHeaderSubtitle: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  detailScreenBody: { flex: 1 },
  detailScreenContent: { gap: 14, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 120 },
  innerContent: { gap: 14, paddingHorizontal: 14, paddingTop: 10 },
  topNoticeOverlay: { position: "absolute", top: 0, left: 14, right: 14, zIndex: 20 },
  heroCard: { borderRadius: 24, paddingVertical: 0, gap: 8 },
  heroCopy: { gap: 6 },
  heroPrimaryActions: { flexDirection: "row", gap: 10 },
  heroEyebrow: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchWrap: { flex: 1 },
  searchInput: { marginBottom: 0 },
  title: { color: "#0f172a", fontWeight: "800", fontSize: 22 },
  subtitle: { color: "#64748b", lineHeight: 20 },
  noticeCard: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1 },
  noticeSuccess: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  noticeError: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  noticeTitle: { color: "#0f172a", fontWeight: "800", marginBottom: 2 },
  noticeMessage: { color: "#475569" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "48%", minHeight: 92, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, justifyContent: "space-between" },
  statLabel: { color: "#334155", fontSize: 12, fontWeight: "700" },
  statValue: { fontSize: 26, fontWeight: "800" },
  sectionCard: { backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#e2e8f0", padding: 16, gap: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  sectionTitle: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  hint: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  filterLabel: { color: "#334155", fontWeight: "700", marginTop: 2 },
  chipRow: { gap: 8, paddingVertical: 2 },
  filterChip: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f8fafc" },
  filterChipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  filterChipText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  filterChipTextActive: { color: "#fff" },
  activeFiltersText: { fontSize: 12, fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 11, color: "#0f172a" },
  textarea: { minHeight: 240 },
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyCard: { backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#e2e8f0", padding: 18, gap: 6 },
  emptyTitle: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  emptyText: { color: "#64748b", lineHeight: 20 },
  rowWrap: { paddingHorizontal: 14 },
  rowGap: { height: 12 },
  listFooter: { paddingHorizontal: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  grid: { gap: 12 },
  studentCard: { backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#e2e8f0", padding: 14, gap: 8 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarBadge: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  cardCopy: { flex: 1, minWidth: 0, gap: 3 },
  studentName: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  studentMeta: { color: "#475569", fontWeight: "700", fontSize: 12 },
  classSectionWrap: { flexDirection: "row", alignItems: "center", flexShrink: 0, maxWidth: 92 },
  classSectionValues: { alignItems: "center", gap: 4, minWidth: 46 },
  classSectionItem: { alignItems: "center", maxWidth: 76 },
  classSectionValue: { fontSize: 14, lineHeight: 17, fontWeight: "800" },
  classSectionLabel: { fontSize: 10, lineHeight: 13, fontWeight: "700" },
  classSectionDivider: { width: 18, height: 1 },
  metaStack: { gap: 7 },
  metaLine: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  studentBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, alignItems: "center" },
  studentListBadge: { maxWidth: "100%", borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
  studentListBadgeText: { fontSize: 12, lineHeight: 15, fontWeight: "700" },
  detailText: { color: "#475569", lineHeight: 18 },
  metaLineText: { fontSize: 12 },
  rowActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  cardIconActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  iconActionBtn: { width: 38, height: 38, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  iconActionBtnDanger: { borderColor: "#fecaca", backgroundColor: "#fff5f5" },
  primaryBtn: { backgroundColor: "#0f172a", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  ghostBtn: { borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  ghostBtnText: { color: "#334155", fontWeight: "700" },
  inlineGhostBtn: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  iconUtilityBtn: { width: 42, height: 42, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", borderRadius: 12, alignItems: "center", justifyContent: "center" },
  heroPrimaryBtn: { flex: 1, backgroundColor: "#0f172a", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  heroSecondaryBtn: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: "#334155", fontWeight: "700" },
  deleteBtn: { flex: 1, backgroundColor: "#fee2e2", borderWidth: 1, borderColor: "#fecaca", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  deleteBtnText: { color: "#b91c1c", fontWeight: "700" },
  successBtn: { flex: 1, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  successBtnText: { color: "#fff", fontWeight: "700" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.28)" },
  popoverOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-start", paddingTop: 250, paddingHorizontal: 24 },
  popoverBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent" },
  filterPopover: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12, marginLeft: "auto", width: "82%" },
  resetText: { color: "#15803d", fontWeight: "700" },
  modalCard: { maxHeight: "88%", backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, marginBottom: 12, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  modalBody: { maxHeight: 620 },
  sheetHeaderCopy: { flex: 1, gap: 4 },
  sheetSubtitle: { color: "#64748b", lineHeight: 18 },
  closeBtn: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
  closeBtnText: { color: "#334155", fontWeight: "700" },
  formLabel: { color: "#334155", fontWeight: "700", marginTop: 8, marginBottom: 6 },
  fieldError: { color: "#b91c1c", marginTop: 4, marginBottom: 4, fontSize: 12 },
  confirmCard: { marginHorizontal: 18, marginBottom: 120, borderWidth: 1, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 20, gap: 12 },
  confirmIcon: { width: 44, height: 44, borderWidth: 1, borderRadius: 16, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  confirmIconText: { fontSize: 22, fontWeight: "800" },
  confirmTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  confirmMessage: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  disabledBtn: { opacity: 0.7 },
});


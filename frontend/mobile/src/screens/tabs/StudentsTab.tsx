import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getClassStructure, getSessions, type ClassStructureItem } from "../../services/classesService";
import { getExams } from "../../services/examsService";
import { createStudent, deleteStudent, getStudents, updateStudent, type Student } from "../../services/studentsService";
import StudentDetailsModule from "./students/StudentDetailsModule";
import SelectField from "../../components/form/SelectField";
import DateField from "../../components/form/DateField";
import TopNotice from "../../components/feedback/TopNotice";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { useAuthStore } from "../../store/authStore";

type SessionItem = { id: number; name: string; is_active?: number | boolean };
type StudentScope = "school" | "hs";
type Notice = { title: string; message: string; tone: "success" | "error" } | null;
type CreateForm = { admission_no: string; name: string; mobile: string; gender: string; dob: string; date_of_admission: string; session_id: number | null; class_id: number | null; section_id: number | null; roll_number: string; stream: string; father_name: string; father_mobile: string; mother_name: string; mother_mobile: string };
type CreateErrorKey = keyof CreateForm | "parent_mobile";
type EditForm = { id: number | null; admission_no: string; name: string; mobile: string; gender: string; dob: string; date_of_admission: string; session_id: number | null; class_id: number | null; section_id: number | null; roll_number: string; stream: string; class_scope: StudentScope };

const EMPTY_CREATE: CreateForm = { admission_no: "", name: "", mobile: "", gender: "", dob: "", date_of_admission: "", session_id: null, class_id: null, section_id: null, roll_number: "", stream: "", father_name: "", father_mobile: "", mother_name: "", mother_mobile: "" };
const EMPTY_EDIT: EditForm = { id: null, admission_no: "", name: "", mobile: "", gender: "", dob: "", date_of_admission: "", session_id: null, class_id: null, section_id: null, roll_number: "", stream: "", class_scope: "school" };
const STREAM_OPTIONS = ["Arts", "Commerce", "Science"] as const;
const fmtScope = (v?: string | null) => String(v || "").trim().toLowerCase() === "hs" ? "Higher Secondary" : "School";
const fmtDate = (v?: string | null) => { if (!v) return "-"; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(); };
const inputDate = (v?: string | null) => { const raw = String(v || "").trim(); if (!raw) return ""; if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw; const m = raw.match(/^(\d{4}-\d{2}-\d{2})/); if (m) return m[1]; const d = new Date(raw); return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10); };
const getErr = (err: unknown, fallback: string) => typeof err === "object" && err && "response" in err ? ((err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error || (err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message || fallback) : fallback;
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim());

function FormLabel({ label }: { label: string }) { return <Text style={styles.formLabel}>{label}</Text>; }
function FieldError({ message }: { message?: string }) { return message ? <Text style={styles.fieldError}>{message}</Text> : null; }

function Sheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  const { theme, isDark } = useAppTheme();
  return <View style={styles.modalOverlay}><Pressable style={styles.modalBackdrop} onPress={onClose} /><View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}><View style={styles.rowBetween}><View style={styles.sheetHeaderCopy}><Text style={[styles.modalTitle, { color: theme.text }]}>{title}</Text>{subtitle ? <Text style={[styles.sheetSubtitle, { color: theme.subText }]}>{subtitle}</Text> : null}</View><Pressable style={[styles.closeBtn, { borderColor: theme.border, backgroundColor: isDark ? theme.cardMuted : "#fff" }]} onPress={onClose}><Text style={[styles.closeBtnText, { color: theme.text }]}>Close</Text></Pressable></View><ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>{children}</ScrollView></View></View>;
}

function CardIconAction({ icon, tone = "default", onPress }: { icon: keyof typeof Ionicons.glyphMap; tone?: "default" | "danger"; onPress: () => void }) {
  const isDanger = tone === "danger";
  return <Pressable style={[styles.iconActionBtn, isDanger && styles.iconActionBtnDanger]} onPress={onPress}><Ionicons name={icon} size={18} color={isDanger ? "#b91c1c" : "#334155"} /></Pressable>;
}

export default function StudentsTab() {
  const { theme, isDark } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const isParent = Array.isArray(user?.roles) && user.roles.includes("parent");
  const [students, setStudents] = useState<Student[]>([]);
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

  const selectedClass = useMemo(() => classes.find((x) => x.id === classId) ?? null, [classes, classId]);
  const createClass = useMemo(() => classes.find((x) => x.id === createForm.class_id) ?? null, [classes, createForm.class_id]);
  const editClass = useMemo(() => classes.find((x) => x.id === editForm.class_id) ?? null, [classes, editForm.class_id]);
  const activeSession = useMemo(() => sessions.find((x) => Number(x.is_active) === 1 || x.is_active === true), [sessions]);

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
      { label: "Total Students", value: total, accent: "#dbeafe", tone: "#1d4ed8" },
      { label: "School", value: school, accent: "#dcfce7", tone: "#15803d" },
      { label: "Higher Secondary", value: hs, accent: "#ede9fe", tone: "#6d28d9" },
      { label: "Girls", value: girls, accent: "#fce7f3", tone: "#be185d" },
    ];
  }, [students]);

  const loadStudentsList = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") setRefreshing(true); else setLoading(true);
    try {
      const rows = await getStudents({ class_id: classId ? String(classId) : undefined, section_id: sectionId ? String(sectionId) : undefined });
      setStudents(rows);
    } catch (err: unknown) {
      Alert.alert("Error", getErr(err, "Failed to load students."));
      setStudents([]);
    } finally {
      if (mode === "refresh") setRefreshing(false); else setLoading(false);
    }
  }, [classId, sectionId]);

  useEffect(() => { if (!notice) return undefined; const t = setTimeout(() => setNotice(null), 3200); return () => clearTimeout(t); }, [notice]);
  useEffect(() => { (async () => { try { const [c, s, e] = await Promise.all([getClassStructure(), getSessions(), getExams()]); setClasses(c as ClassStructureItem[]); setSessions((s || []).map((x) => ({ id: Number(x.id), name: x.name, is_active: x.is_active }))); setExams((e || []).map((x) => ({ id: Number(x.id), name: x.name }))); } catch { setClasses([]); setSessions([]); setExams([]); } await loadStudentsList(); })(); }, []);
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
    if (!form.section_id) e.section_id = "Section is required.";
    if (!form.roll_number.trim()) e.roll_number = "Roll number is required.";
    const chosen = classes.find((x) => x.id === form.class_id);
    if (chosen?.class_scope === "hs" && !form.stream.trim()) e.stream = "Stream is required for higher secondary classes.";
    if (!form.father_mobile.trim() && !form.mother_mobile.trim()) e.parent_mobile = "Enter at least one parent phone number.";
    if (form.father_mobile.trim() && !form.father_name.trim()) e.father_name = "Father name is required when father phone is entered.";
    if (form.father_mobile.trim() && !/^\d{10}$/.test(form.father_mobile.trim())) e.father_mobile = "Father phone must be 10 digits.";
    if (form.mother_mobile.trim() && !form.mother_name.trim()) e.mother_name = "Mother name is required when mother phone is entered.";
    if (form.mother_mobile.trim() && !/^\d{10}$/.test(form.mother_mobile.trim())) e.mother_mobile = "Mother phone must be 10 digits.";
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
    if (!form.section_id) e.section_id = "Section is required.";
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
          section_id: Number(createForm.section_id),
          medium: String((classes.find((x) => x.id === createForm.class_id)?.sections || []).find((s) => s.id === createForm.section_id)?.medium || "").trim() || undefined,
          roll_number: createForm.roll_number.trim(),
          stream: createForm.stream.trim() || undefined,
        },
        father: { name: createForm.father_name.trim() || undefined, mobile: createForm.father_mobile.trim() || undefined },
        mother: { name: createForm.mother_name.trim() || undefined, mobile: createForm.mother_mobile.trim() || undefined },
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
    const matched = classes.find((x) => x.id === student.class_id) || classes.find((x) => x.name?.toLowerCase() === String(student.class || "").toLowerCase()) || null;
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
      class_scope: (student.class_scope || matched?.class_scope || "school") as StudentScope,
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
        section_id: Number(editForm.section_id),
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
    Alert.alert("Delete student", `Delete ${student.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteStudent(student.id);
            await loadStudentsList("refresh");
            showNotice("Student Deleted", "The student has been removed.");
          } catch (err: unknown) {
            Alert.alert("Delete failed", getErr(err, "Failed to delete student."));
          }
        },
      },
    ]);
  }

  function openDetails(student: Student) {
    setSelectedStudentId(student.id);
    setDetailOpen(true);
  }

  function resetBrowseFilters() {
    setClassId(null);
    setSectionId(null);
    setSearch("");
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadStudentsList("refresh")} />}>
      <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.heroCopy}>
          <Text style={[styles.title, { color: theme.text }]}>Students</Text>
          <Text style={[styles.subtitle, { color: theme.subText }]}>
            {isParent
              ? "View your child records, attendance, fees, and results"
              : "Manage admissions, class placement, and parent linkage"}
          </Text>
        </View>
        <View style={styles.heroActions}>
          <View style={styles.heroPrimaryActions}>
            <Pressable style={[styles.iconUtilityBtn, { borderColor: theme.border, backgroundColor: isDark ? theme.cardMuted : "#fff" }]} onPress={() => loadStudentsList("refresh")}>
              <Ionicons name="refresh-outline" size={18} color={theme.icon} />
            </Pressable>
            {!isParent ? (
              <Pressable style={[styles.heroPrimaryBtn, { backgroundColor: isDark ? "#e2e8f0" : "#0f172a" }]} onPress={() => { setCreateOpen(true); setCreateErrors({}); setCreateForm((p) => ({ ...p, session_id: p.session_id ?? activeSession?.id ?? null })); }}><Text style={[styles.primaryBtnText, { color: isDark ? "#0f172a" : "#fff" }]}>Add Student</Text></Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <TopNotice notice={notice} />

      {!isParent ? (
        <View style={styles.statsGrid}>
          {stats.map((item) => <View key={item.label} style={[styles.statCard, { backgroundColor: item.accent }]}><Text style={styles.statLabel}>{item.label}</Text><Text style={[styles.statValue, { color: item.tone }]}>{item.value}</Text></View>)}
        </View>
      ) : null}

      <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.rowBetween}><Text style={[styles.sectionTitle, { color: theme.text }]}>{isParent ? "My Students" : "Browse Students"}</Text><Text style={[styles.hint, { color: theme.subText }]}>{filteredStudents.length} visible</Text></View>
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <TextInput style={[styles.input, styles.searchInput, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={search} onChangeText={setSearch} placeholder={isParent ? "Search child..." : "Search..."} placeholderTextColor={theme.mutedText} />
          </View>
          <Pressable style={[styles.iconUtilityBtn, { borderColor: theme.border, backgroundColor: isDark ? theme.cardMuted : "#fff" }]} onPress={() => setFiltersOpen(true)}>
            <Ionicons name="options-outline" size={18} color={theme.icon} />
          </Pressable>
        </View>
        {(classId !== null || sectionId !== null) ? (
          <Text style={[styles.activeFiltersText, { color: theme.subText }]}>
            {classId !== null ? `Class: ${selectedClass?.name || "-"}` : "All classes"}
            {sectionId !== null ? ` • Section: ${selectedClass?.sections?.find((section) => section.id === sectionId)?.name || "-"}` : ""}
          </Text>
        ) : null}
      </View>

      <Modal visible={filtersOpen} transparent animationType="fade" onRequestClose={() => setFiltersOpen(false)}>
        <View style={styles.popoverOverlay}>
          <Pressable style={styles.popoverBackdrop} onPress={() => setFiltersOpen(false)} />
          <View style={[styles.filterPopover, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Filters</Text>
              <Pressable onPress={resetBrowseFilters}>
                <Text style={styles.resetText}>Reset</Text>
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
              <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: isDark ? theme.cardMuted : "#fff" }]} onPress={() => setFiltersOpen(false)}>
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {loading ? <View style={styles.centered}><ActivityIndicator size="large" color={theme.text} /></View> : !filteredStudents.length ? <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={[styles.emptyTitle, { color: theme.text }]}>No students found</Text><Text style={[styles.emptyText, { color: theme.subText }]}>{isParent ? "No linked student records are available right now." : "Try changing the search or class filters, or add a new student."}</Text></View> : <View style={styles.grid}>
        {filteredStudents.map((student) => {
          const matched = classes.find((x) => x.id === student.class_id) || classes.find((x) => x.name?.toLowerCase() === String(student.class || "").toLowerCase()) || null;
          const matchedSection = (matched?.sections || []).find((section) => String(section.id) === String(student.section_id || ""));
          const medium = student.medium || matchedSection?.medium || "Not set";
          const scopeLabel = fmtScope(student.class_scope || matched?.class_scope || "school");
          return (
            <Pressable key={student.id} style={[styles.studentCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => openDetails(student)}>
              <View style={styles.cardTop}>
                <View style={[styles.avatarBadge, { backgroundColor: theme.cardMuted }]}><Text style={[styles.avatarText, { color: theme.text }]}>{student.name?.slice(0, 1)?.toUpperCase() || "S"}</Text></View>
                <View style={styles.cardCopy}>
                  <Text style={[styles.studentName, { color: theme.text }]}>{student.name}</Text>
                  <Text style={[styles.studentMeta, { color: theme.subText }]}>{student.admission_no ? `Adm ${student.admission_no}` : `KKV-${student.id}`}</Text>
                </View>
                <View style={styles.compactClassBlock}>
                  <Text style={[styles.compactClassValue, { color: theme.text }]}>{student.class || "-"}</Text>
                  <Text style={[styles.compactClassMeta, { color: theme.subText }]}>{student.section || "-"}</Text>
                </View>
              </View>

              <View style={styles.metaStack}>
                <View style={styles.metaLine}>
                  <Text style={[styles.detailText, styles.metaLineText, { color: theme.subText }]}>Roll: {student.roll_number || "-"}</Text>
                  <Text style={[styles.detailText, styles.metaLineText, { color: theme.subText }]}>Scope: {scopeLabel}</Text>
                </View>
                <View style={styles.metaLine}>
                  <Text style={[styles.detailText, styles.metaLineText, { color: theme.subText }]}>Medium: {medium}</Text>
                  {String(student.class_scope || matched?.class_scope || "school").toLowerCase() === "hs" ? <Text style={[styles.detailText, styles.metaLineText, { color: theme.subText }]}>Stream: {student.stream_name || "-"}</Text> : null}
                </View>
                <View style={styles.metaLine}>
                  <Text style={[styles.detailText, styles.metaLineText, { color: theme.subText }]}>Phone: {student.phone || student.mobile || "-"}</Text>
                </View>
                <View style={styles.metaLine}>
                  <Text style={[styles.detailText, styles.metaLineText, { color: theme.subText }]}>Admission: {fmtDate(student.date_of_admission)}</Text>
                </View>
              </View>
              {!isParent ? (
                <View style={styles.cardIconActions}>
                  <CardIconAction icon="eye-outline" onPress={() => openDetails(student)} />
                  <CardIconAction icon="create-outline" onPress={() => openEdit(student)} />
                  <CardIconAction icon="trash-outline" tone="danger" onPress={() => confirmDelete(student)} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>}

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
          <FormLabel label="Mother name" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={createForm.mother_name} onChangeText={(v) => setCreateForm((p) => ({ ...p, mother_name: v }))} placeholderTextColor={theme.mutedText} /><FieldError message={createErrors.mother_name} />
          <FormLabel label="Mother phone" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={createForm.mother_mobile} onChangeText={(v) => setCreateForm((p) => ({ ...p, mother_mobile: v }))} keyboardType="phone-pad" placeholderTextColor={theme.mutedText} /><FieldError message={createErrors.mother_mobile} /><FieldError message={createErrors.parent_mobile} />
          <SelectField label="Session *" value={createForm.session_id === null ? "" : String(createForm.session_id)} onChange={(value) => setCreateForm((p) => ({ ...p, session_id: value ? Number(value) : null }))} options={sessions.map((item) => ({ label: item.name, value: String(item.id) }))} placeholder="Choose session" /><FieldError message={createErrors.session_id} />
          <SelectField label="Class *" value={createForm.class_id === null ? "" : String(createForm.class_id)} onChange={(value) => setCreateForm((p) => ({ ...p, class_id: value ? Number(value) : null, section_id: null, stream: "" }))} options={classes.map((item) => ({ label: item.name, value: String(item.id) }))} placeholder="Choose class" /><FieldError message={createErrors.class_id} />
          <SelectField label="Section *" value={createForm.section_id === null ? "" : String(createForm.section_id)} onChange={(value) => setCreateForm((p) => ({ ...p, section_id: value ? Number(value) : null }))} options={(createClass?.sections || []).map((section) => ({ label: `${section.name}${section.medium ? ` (${section.medium})` : ""}`, value: String(section.id) }))} placeholder="Choose section" disabled={!createClass} /><FieldError message={createErrors.section_id} />
          {createClass?.class_scope === "hs" ? <><SelectField label="Stream *" value={createForm.stream} onChange={(value) => setCreateForm((p) => ({ ...p, stream: value }))} options={STREAM_OPTIONS.map((item) => ({ label: item, value: item }))} placeholder="Choose stream" /><FieldError message={createErrors.stream} /></> : null}
          <View style={styles.rowActions}><Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: isDark ? theme.cardMuted : "#fff" }]} onPress={() => setCreateOpen(false)}><Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text></Pressable><Pressable style={styles.successBtn} onPress={handleCreate} disabled={saving}><Text style={styles.successBtnText}>{saving ? "Saving..." : "Save"}</Text></Pressable></View>
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
            setEditForm((p) => ({ ...p, class_id: value ? Number(value) : null, section_id: null, class_scope: ((item?.class_scope || "school") as StudentScope), stream: item?.class_scope === "hs" ? p.stream : "" }));
          }} options={classes.map((item) => ({ label: item.name, value: String(item.id) }))} placeholder="Choose class" /><FieldError message={editErrors.class_id} />
          <SelectField label="Section *" value={editForm.section_id === null ? "" : String(editForm.section_id)} onChange={(value) => setEditForm((p) => ({ ...p, section_id: value ? Number(value) : null }))} options={(editClass?.sections || []).map((section) => ({ label: `${section.name}${section.medium ? ` (${section.medium})` : ""}`, value: String(section.id) }))} placeholder="Choose section" disabled={!editClass} /><FieldError message={editErrors.section_id} />
          <FormLabel label="Roll number *" /><TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={editForm.roll_number} onChangeText={(v) => setEditForm((p) => ({ ...p, roll_number: v }))} placeholderTextColor={theme.mutedText} /><FieldError message={editErrors.roll_number} />
          {editForm.class_scope === "hs" ? <><SelectField label="Stream *" value={editForm.stream} onChange={(value) => setEditForm((p) => ({ ...p, stream: value }))} options={STREAM_OPTIONS.map((item) => ({ label: item, value: item }))} placeholder="Choose stream" /><FieldError message={editErrors.stream} /></> : null}
          <View style={styles.rowActions}><Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: isDark ? theme.cardMuted : "#fff" }]} onPress={() => setEditOpen(false)}><Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text></Pressable><Pressable style={styles.successBtn} onPress={handleUpdate} disabled={saving}><Text style={styles.successBtnText}>{saving ? "Saving..." : "Update"}</Text></Pressable></View>
        </Sheet>
      </Modal>

      <Modal visible={detailOpen} transparent animationType="slide" onRequestClose={() => setDetailOpen(false)}>
        <Sheet title="Student Details" subtitle="Detailed record, marks, and linked data." onClose={() => setDetailOpen(false)}>
          <StudentDetailsModule studentId={selectedStudentId} exams={exams} />
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
  statCard: { width: "48%", minHeight: 92, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, justifyContent: "space-between" },
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
  grid: { gap: 12 },
  studentCard: { backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#e2e8f0", padding: 14, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarBadge: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  cardCopy: { flex: 1, gap: 3 },
  studentName: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  studentMeta: { color: "#475569", fontWeight: "700", fontSize: 12 },
  compactClassBlock: { alignItems: "flex-end", gap: 2 },
  compactClassValue: { fontSize: 14, fontWeight: "800" },
  compactClassMeta: { fontSize: 11, fontWeight: "700" },
  metaStack: { gap: 4 },
  metaLine: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  detailText: { color: "#475569", lineHeight: 18 },
  metaLineText: { fontSize: 12 },
  rowActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  cardIconActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 0 },
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
  successBtn: { flex: 1, backgroundColor: "#15803d", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  successBtnText: { color: "#fff", fontWeight: "700" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.28)" },
  popoverOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-start", paddingTop: 250, paddingHorizontal: 24 },
  popoverBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent" },
  filterPopover: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12, marginLeft: "auto", width: "82%" },
  resetText: { color: "#15803d", fontWeight: "700" },
  modalCard: { maxHeight: "90%", backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  modalBody: { maxHeight: 620 },
  sheetHeaderCopy: { flex: 1, gap: 4 },
  sheetSubtitle: { color: "#64748b", lineHeight: 18 },
  closeBtn: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
  closeBtnText: { color: "#334155", fontWeight: "700" },
  formLabel: { color: "#334155", fontWeight: "700", marginTop: 8, marginBottom: 6 },
  fieldError: { color: "#b91c1c", marginTop: 4, marginBottom: 4, fontSize: 12 },
});

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TopNotice from "../../components/feedback/TopNotice";
import { getClassStructure, getSessions } from "../../services/classesService";
import {
  createExam,
  deleteExam,
  getExamById,
  getExams,
  updateExam,
  type ExamDetails,
  type ExamItem,
} from "../../services/examsService";
import { getSubjects, type SubjectItem } from "../../services/subjectsService";
import { useAuthStore } from "../../store/authStore";
import SelectField from "../../components/form/SelectField";
import { useAppTheme } from "../../theme/AppThemeProvider";

type ClassItem = {
  id: number;
  name: string;
  class_scope?: string | null;
  sections: Array<{ id: number; name: string; medium?: string | null }>;
};

type ExamDetailsMap = Record<number, ExamDetails>;

type ScopeRow = {
  class_id: string;
  section_id: string;
};

type SubjectRow = {
  subject_id: number;
  subject_name: string;
  max_marks: number;
};

type NoticeState = {
  tone: "success" | "error";
  title: string;
  message: string;
};

type FormState = {
  name: string;
  session_id: string;
  scopes: ScopeRow[];
  subjects: SubjectRow[];
};

const EMPTY_FORM: FormState = {
  name: "",
  session_id: "",
  scopes: [{ class_id: "", section_id: "" }],
  subjects: [],
};

function toWholeNumber(value: string) {
  const digitsOnly = String(value || "").replace(/[^\d]/g, "");
  if (!digitsOnly) return 0;
  return Number.parseInt(digitsOnly, 10);
}

function formatScopeLabel(scope?: string | null) {
  return scope === "hs" ? "Higher Secondary" : "School";
}

export default function ExamsTab() {
  const { theme, isDark } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions || [];
  const roles = user?.roles || [];
  const isSuperAdmin = roles.includes("super_admin");
  const canCreate = isSuperAdmin || permissions.includes("exams.create");
  const canUpdate = isSuperAdmin || permissions.includes("exams.update");
  const canDelete = isSuperAdmin || permissions.includes("exams.delete");

  const [exams, setExams] = useState<ExamItem[]>([]);
  const [examDetailsMap, setExamDetailsMap] = useState<ExamDetailsMap>({});
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sessions, setSessions] = useState<Array<{ id: number; name: string; is_active?: number | boolean }>>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const classMap = useMemo(() => new Map(classes.map((c) => [String(c.id), c])), [classes]);
  const selectedClass = useMemo(
    () => classes.find((c) => String(c.id) === String(classFilter)),
    [classes, classFilter]
  );
  const filterSections = selectedClass?.sections || [];
  const activeSession = useMemo(
    () => sessions.find((s) => Number(s.is_active) === 1 || s.is_active === true) ?? null,
    [sessions]
  );
  const filteredExams = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return exams;
    return exams.filter((exam) => {
      const details = examDetailsMap[exam.id];
      const scopes = (details?.scopes || [])
        .map((scope) => `${scope.class_name || ""} ${scope.section_name || ""}`)
        .join(" ")
        .toLowerCase();
      return (
        String(exam.name || "").toLowerCase().includes(query) ||
        String(exam.session_name || "").toLowerCase().includes(query) ||
        scopes.includes(query)
      );
    });
  }, [examDetailsMap, exams, search]);
  const totalScopes = useMemo(
    () => filteredExams.reduce((sum, exam) => sum + (examDetailsMap[exam.id]?.scopes?.length || 0), 0),
    [examDetailsMap, filteredExams]
  );
  const totalSubjects = useMemo(
    () => filteredExams.reduce((sum, exam) => sum + (examDetailsMap[exam.id]?.subjects?.length || 0), 0),
    [examDetailsMap, filteredExams]
  );
  const activeFilterCount = [search, sessionFilter, classFilter, sectionFilter].filter(Boolean).length;

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    loadExamList();
  }, [sessionFilter, classFilter, sectionFilter]);

  async function loadInitial() {
    setLoading(true);
    try {
      const [classesRes, subjectsRes, sessionsRes] = await Promise.all([
        getClassStructure(),
        getSubjects(),
        getSessions(),
      ]);
      setClasses(classesRes as ClassItem[]);
      setAllSubjects(subjectsRes || []);
      setSessions(
        (sessionsRes || []).map((s) => ({
          id: Number(s.id),
          name: s.name,
          is_active: s.is_active,
        }))
      );
      await loadExamList();
    } catch (err: unknown) {
      Alert.alert("Load failed", getErrorMessage(err, "Could not load exams module data."));
    } finally {
      setLoading(false);
    }
  }

  function showNotice(title: string, message: string, tone: "success" | "error" = "success") {
    setNotice({ title, message, tone });
  }

  async function loadExamList() {
    setLoading(true);
    try {
      const examsRes = await getExams({
        session_id: sessionFilter || undefined,
        class_id: classFilter || undefined,
        section_id: sectionFilter || undefined,
      });
      setExams(examsRes || []);

      const detailResults = await Promise.all(
        (examsRes || []).map(async (exam) => {
          try {
            const details = await getExamById(exam.id);
            return [exam.id, details] as const;
          } catch {
            return [exam.id, null] as const;
          }
        })
      );

      const nextMap: ExamDetailsMap = {};
      detailResults.forEach(([examId, details]) => {
        if (details) nextMap[examId] = details;
      });
      setExamDetailsMap(nextMap);
    } catch (err: unknown) {
      Alert.alert("Load failed", getErrorMessage(err, "Could not load exams."));
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      session_id: activeSession ? String(activeSession.id) : "",
    });
  }

  function resetFilters() {
    setSearch("");
    setSessionFilter("");
    setClassFilter("");
    setSectionFilter("");
  }

  function setScope(idx: number, key: "class_id" | "section_id", value: string) {
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.map((s, i) =>
        i === idx
          ? key === "class_id"
            ? { class_id: value, section_id: "" }
            : { ...s, section_id: value }
          : s
      ),
    }));
  }

  function addScopeRow() {
    setForm((prev) => ({
      ...prev,
      scopes: [...prev.scopes, { class_id: "", section_id: "" }],
    }));
  }

  function removeScopeRow(idx: number) {
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.filter((_, i) => i !== idx),
    }));
  }

  function toggleSubject(subject: SubjectItem) {
    const exists = form.subjects.find((s) => Number(s.subject_id) === Number(subject.id));
    if (exists) {
      setForm((prev) => ({
        ...prev,
        subjects: prev.subjects.filter((s) => Number(s.subject_id) !== Number(subject.id)),
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      subjects: [
        ...prev.subjects,
        {
          subject_id: Number(subject.id),
          subject_name: subject.name,
          max_marks: 100,
        },
      ],
    }));
  }

  function updateSubjectField(subjectId: number, key: "max_marks", value: string) {
    const numeric = toWholeNumber(value);
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) =>
        Number(s.subject_id) === Number(subjectId) ? { ...s, [key]: numeric } : s
      ),
    }));
  }

  async function submitForm() {
    const cleanName = String(form.name || "").trim();
    if (!cleanName) {
      Alert.alert("Validation", "Exam name is required.");
      return;
    }

    const cleanScopes = form.scopes
      .map((s) => ({
        class_id: Number(s.class_id),
        section_id: Number(s.section_id),
      }))
      .filter((s) => s.class_id && s.section_id);
    if (!cleanScopes.length) {
      Alert.alert("Validation", "At least one valid class-section scope is required.");
      return;
    }

    const cleanSubjects = form.subjects
      .map((s) => ({
        subject_id: Number(s.subject_id),
        max_marks: Math.trunc(Number(s.max_marks))
      }))
      .filter((s) => s.subject_id && s.max_marks > 0);
    if (!cleanSubjects.length) {
      Alert.alert("Validation", "At least one subject with valid max marks is required.");
      return;
    }

    const payload = {
      name: cleanName,
      scopes: cleanScopes,
      subjects: cleanSubjects,
      session_id: form.session_id ? Number(form.session_id) : undefined,
    };

    setSaving(true);
    try {
      if (editingId) {
        await updateExam(editingId, payload);
      } else {
        await createExam(payload);
      }
      await loadExamList();
      setOpen(false);
      resetForm();
      showNotice(
        editingId ? "Exam Updated" : "Exam Created",
        editingId ? "Exam updated successfully." : "Exam created successfully."
      );
    } catch (err: unknown) {
      showNotice("Save Failed", getErrorMessage(err, "Failed to save exam."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function onEdit(examId: number) {
    try {
      const exam = (await getExamById(examId)) as ExamDetails;
      setEditingId(exam.id);
      setForm({
        name: exam.name || "",
        session_id: exam.session_id ? String(exam.session_id) : "",
        scopes:
          (exam.scopes || []).map((s) => ({
            class_id: String(s.class_id),
            section_id: String(s.section_id),
          })) || [{ class_id: "", section_id: "" }],
        subjects: (exam.subjects || []).map((s) => ({
          subject_id: Number(s.subject_id),
          subject_name: s.subject_name || `Subject ${s.subject_id}`,
          max_marks: Math.trunc(Number(s.max_marks || 0))
        })),
      });
      setOpen(true);
    } catch (err: unknown) {
      Alert.alert("Load failed", getErrorMessage(err, "Failed to load exam details."));
    }
  }

  function onDelete(examId: number) {
    Alert.alert("Delete exam", "Delete this exam?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteExam(examId);
            await loadExamList();
            showNotice("Exam Deleted", "Exam deleted successfully.");
          } catch (err: unknown) {
            showNotice("Delete Failed", getErrorMessage(err, "Failed to delete exam."), "error");
          }
        },
      },
    ]);
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadInitial();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border, borderRadius: 24, padding: 18, gap: 14 }]}>
        <View style={styles.heroText}>
          <Text style={[styles.title, { color: theme.text, fontWeight: "800", fontSize: 22 }]}>Exams</Text>
          <Text style={[styles.subtitle, { color: theme.subText, lineHeight: 20 }]}>
            Manage exam setup, scopes, and subject marks
          </Text>
        </View>
        <View style={styles.heroActions}>
          <View style={styles.heroPrimaryActions}>
            <Pressable
              style={[styles.iconUtilityBtn, { borderColor: theme.border, backgroundColor: isDark ? theme.cardMuted : "#fff" }]}
              onPress={handleRefresh}
            >
              <Ionicons name="refresh-outline" size={18} color={theme.icon} />
            </Pressable>
            {canCreate ? (
              <Pressable
                style={[styles.heroPrimaryBtn, { backgroundColor: isDark ? "#e2e8f0" : "#0f172a" }]}
                onPress={() => {
                  resetForm();
                  setOpen(true);
                }}
              >
                <Text style={[styles.primaryBtnText, { color: isDark ? "#0f172a" : "#fff" }]}>Add Exam</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <TopNotice notice={notice} />

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: "#dbeafe" }]}>
          <Text style={styles.summaryLabel}>Visible Exams</Text>
          <Text style={[styles.summaryValue, { color: "#1d4ed8" }]}>{filteredExams.length}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "#dcfce7" }]}>
          <Text style={styles.summaryLabel}>Scopes</Text>
          <Text style={[styles.summaryValue, { color: "#15803d" }]}>{totalScopes}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "#fef3c7" }]}>
          <Text style={styles.summaryLabel}>Subjects</Text>
          <Text style={[styles.summaryValue, { color: "#b45309" }]}>{totalSubjects}</Text>
        </View>
      </View>

      <View style={styles.filterCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.filterTitle}>Browse Exams</Text>
          <Text style={styles.filterHint}>{filteredExams.length} visible</Text>
        </View>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, styles.searchInput]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by exam, session, class, or section"
            placeholderTextColor="#94a3b8"
          />
          <Pressable style={styles.iconUtilityBtn} onPress={() => setFiltersOpen(true)}>
            <Ionicons name="options-outline" size={18} color="#334155" />
          </Pressable>
        </View>
        {activeFilterCount ? (
          <Text style={styles.activeFiltersText}>
            {sessionFilter ? `Session: ${sessions.find((s) => String(s.id) === sessionFilter)?.name || "-"}` : "All sessions"}
            {classFilter ? ` - Class: ${selectedClass?.name || "-"}` : ""}
            {sectionFilter ? ` - Section: ${filterSections.find((s) => String(s.id) === sectionFilter)?.name || "-"}` : ""}
          </Text>
        ) : null}
      </View>

      <Modal visible={filtersOpen} transparent animationType="fade" onRequestClose={() => setFiltersOpen(false)}>
        <View style={styles.popoverOverlay}>
          <Pressable style={styles.popoverBackdrop} onPress={() => setFiltersOpen(false)} />
          <View style={styles.filterPopover}>
            <View style={styles.sectionHeader}>
              <Text style={styles.filterTitle}>Filters</Text>
              <Pressable onPress={resetFilters}>
                <Text style={styles.resetText}>Reset</Text>
              </Pressable>
            </View>

            <SelectField
              label="Session"
              value={sessionFilter}
              onChange={setSessionFilter}
              options={sessions.map((s) => ({ label: s.name, value: String(s.id) }))}
              placeholder="All sessions"
              allowClear
              clearLabel="All sessions"
            />

            <SelectField
              label="Class"
              value={classFilter}
              onChange={(value: string) => {
                setClassFilter(value);
                setSectionFilter("");
              }}
              options={classes.map((c) => ({ label: c.name, value: String(c.id) }))}
              placeholder="All classes"
              allowClear
              clearLabel="All classes"
            />

            <SelectField
              label="Section"
              value={sectionFilter}
              onChange={setSectionFilter}
              options={filterSections.map((s) => ({
                label: `${s.name}${s.medium ? ` (${s.medium})` : ""}`,
                value: String(s.id),
              }))}
              placeholder="All sections"
              allowClear
              clearLabel="All sections"
              disabled={!selectedClass}
            />

            <View style={styles.rowActions}>
              <Pressable style={styles.secondaryBtn} onPress={() => setFiltersOpen(false)}>
                <Text style={styles.secondaryBtnText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : (
        <View style={styles.listContent}>
          {filteredExams.length ? (
            filteredExams.map((exam) => {
              const details = examDetailsMap[exam.id];
              const scopePreview = (details?.scopes || [])
                .slice(0, 2)
                .map((scope) => {
                  const classItem = classMap.get(String(scope.class_id));
                  return `${scope.class_name} - ${scope.section_name}${classItem?.class_scope ? ` • ${formatScopeLabel(classItem.class_scope)}` : ""}`;
                })
                .join(" • ");
              const subjectPreview = (details?.subjects || [])
                .slice(0, 3)
                .map((subject) => `${subject.subject_name} (${subject.max_marks})`)
                .join(" • ");
              return (
              <View key={exam.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle}>{exam.name}</Text>
                    <Text style={styles.metaCompact}>Session: {exam.session_name || "-"}</Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{details?.subjects?.length || 0} subjects</Text>
                  </View>
                </View>

                <View style={styles.metaStack}>
                  <Text style={styles.metaCompact}>
                    Scopes: {(details?.scopes || []).length || 0}
                    {scopePreview ? ` • ${scopePreview}` : " • No scope details"}
                  </Text>
                  <Text style={styles.metaCompact}>
                    Subjects: {(details?.subjects || []).length || 0}
                    {subjectPreview ? ` • ${subjectPreview}` : ""}
                  </Text>
                </View>

                {(canUpdate || canDelete) ? (
                  <View style={styles.rowActions}>
                    {canUpdate ? (
                      <Pressable style={styles.secondaryBtn} onPress={() => onEdit(exam.id)}>
                        <Text style={styles.secondaryBtnText}>Edit</Text>
                      </Pressable>
                    ) : null}
                    {canDelete ? (
                      <Pressable style={styles.deleteBtn} onPress={() => onDelete(exam.id)}>
                        <Text style={styles.deleteBtnText}>Delete</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No exams found.</Text>
              <Text style={styles.emptyText}>Try a different filter or create a new exam.</Text>
            </View>
          )}
        </View>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingId ? "Update Exam" : "Create Exam"}</Text>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Exam Name *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
              />

              <Text style={[styles.inputLabel, styles.spaceTop]}>Session</Text>
              <ScrollView horizontal contentContainerStyle={styles.row}>
                {sessions.map((s) => (
                  <Pressable
                    key={s.id}
                    style={[styles.chip, form.session_id === String(s.id) && styles.chipActive]}
                    onPress={() => setForm((prev) => ({ ...prev, session_id: String(s.id) }))}
                  >
                    <Text style={[styles.chipText, form.session_id === String(s.id) && styles.chipTextActive]}>
                      {s.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={[styles.sectionHeader, styles.spaceTop]}>
                <Text style={styles.inputLabel}>Class-Section Scopes *</Text>
                <Pressable style={styles.secondaryBtn} onPress={addScopeRow}>
                  <Text style={styles.secondaryBtnText}>Add Scope</Text>
                </Pressable>
              </View>

              {form.scopes.map((scope, idx) => {
                const selectedClass = classMap.get(String(scope.class_id));
                const sections = selectedClass?.sections || [];
                return (
                  <View key={`${idx}-${scope.class_id}-${scope.section_id}`} style={styles.scopeRow}>
                    <ScrollView horizontal contentContainerStyle={styles.row}>
                      {classes.map((c) => (
                        <Pressable
                          key={`c-${idx}-${c.id}`}
                          style={[styles.chip, scope.class_id === String(c.id) && styles.chipActive]}
                          onPress={() => setScope(idx, "class_id", String(c.id))}
                        >
                          <Text style={[styles.chipText, scope.class_id === String(c.id) && styles.chipTextActive]}>
                            {c.name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    <ScrollView horizontal contentContainerStyle={[styles.row, styles.spaceTop]}>
                      {sections.map((s) => (
                        <Pressable
                          key={`s-${idx}-${s.id}`}
                          style={[styles.chip, scope.section_id === String(s.id) && styles.chipActive]}
                          onPress={() => setScope(idx, "section_id", String(s.id))}
                        >
                          <Text style={[styles.chipText, scope.section_id === String(s.id) && styles.chipTextActive]}>
                            {s.name}{s.medium ? ` (${s.medium})` : ""}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    <Pressable
                      style={[styles.scopeRemoveBtn, styles.spaceTop]}
                      onPress={() => removeScopeRow(idx)}
                      disabled={form.scopes.length === 1}
                    >
                      <Text style={styles.scopeRemoveText}>Remove Scope</Text>
                    </Pressable>
                  </View>
                );
              })}

              <Text style={[styles.inputLabel, styles.spaceTop]}>Subjects (select and set marks) *</Text>
              <View style={styles.subjectWrap}>
                {allSubjects.map((subject) => {
                  const checked = form.subjects.some((s) => Number(s.subject_id) === Number(subject.id));
                  return (
                    <Pressable
                      key={subject.id}
                      style={[styles.subjectChip, checked && styles.subjectChipActive]}
                      onPress={() => toggleSubject(subject)}
                    >
                      <Text style={[styles.chipText, checked && styles.chipTextActive]}>{subject.name}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {form.subjects.length ? (
                <View style={styles.spaceTop}>
                  {form.subjects.map((s) => (
                    <View key={s.subject_id} style={styles.subjectRow}>
                      <Text style={styles.subjectName}>{s.subject_name}</Text>
                      <TextInput
                        style={styles.marksInput}
                        keyboardType="number-pad"
                        value={String(s.max_marks)}
                        onChangeText={(v) => updateSubjectField(s.subject_id, "max_marks", v)}
                        placeholder="Max"
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.modalSecondaryBtn} onPress={() => setOpen(false)} disabled={saving}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalPrimaryBtn} onPress={submitForm} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? "Saving..." : editingId ? "Update" : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
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
    flex: 1,
  },
  content: {
    gap: 12,
    paddingBottom: 8,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 12,
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
  },
  heroPrimaryActions: {
    flexDirection: "row",
    gap: 10,
    flex: 1,
    alignItems: "center",
  },
  heroText: {
    flex: 1,
  },
  noticeCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  noticeSuccessCard: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  noticeErrorCard: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  noticeTitle: {
    color: "#0f172a",
    fontWeight: "800",
    marginBottom: 2,
  },
  noticeMessage: {
    color: "#475569",
  },
  title: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 20,
  },
  subtitle: {
    marginTop: 4,
    color: "#64748b",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  summaryValue: {
    marginTop: 6,
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "700",
  },
  filterCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 14,
  },
  filterTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
  filterHint: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
  },
  searchInput: {
    flex: 1,
  },
  activeFiltersText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  primaryBtn: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  heroPrimaryBtn: {
    flex: 1,
    backgroundColor: "#0f172a",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnCompact: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  iconUtilityBtn: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  popoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-start",
    paddingTop: 250,
    paddingHorizontal: 24,
  },
  popoverBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  filterPopover: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 12,
    marginLeft: "auto",
    width: "82%",
  },
  resetText: {
    color: "#15803d",
    fontWeight: "700",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  secondaryBtnText: {
    color: "#334155",
    fontWeight: "600",
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    color: "#b91c1c",
    fontWeight: "700",
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 30,
  },
  listWrap: {
    maxHeight: 560,
  },
  listContent: {
    gap: 12,
    paddingBottom: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16,
  },
  meta: {
    marginTop: 4,
    color: "#64748b",
  },
  metaCompact: {
    color: "#64748b",
    lineHeight: 17,
    fontSize: 12.5,
  },
  metaStack: {
    gap: 3,
  },
  countBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#e2e8f0",
    alignSelf: "flex-start",
  },
  countBadgeText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 12,
  },
  cardSectionTitle: {
    marginTop: 10,
    color: "#0f172a",
    fontWeight: "700",
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  scopePill: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f8fafc",
  },
  subjectPill: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#eff6ff",
  },
  scopePillText: {
    color: "#334155",
    fontWeight: "600",
  },
  rowActions: {
    marginTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 18,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
  emptyText: {
    color: "#64748b",
    textAlign: "center",
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
    maxHeight: "92%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  modalTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 18,
  },
  modalBody: {
    maxHeight: 560,
  },
  inputLabel: {
    color: "#334155",
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0f172a",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  row: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  chip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  chipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#e2e8f0",
  },
  chipText: {
    color: "#334155",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#0f172a",
  },
  resetFiltersBtn: {
    alignSelf: "flex-start",
    marginTop: 12,
  },
  scopeRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    backgroundColor: "#f8fafc",
  },
  scopeRemoveBtn: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  scopeRemoveText: {
    color: "#475569",
    fontWeight: "600",
  },
  subjectWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  subjectChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  subjectChipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#e2e8f0",
  },
  subjectRow: {
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    padding: 10,
    marginBottom: 8,
    alignItems: "center",
  },
  subjectName: {
    flex: 1,
    color: "#0f172a",
    fontWeight: "600",
  },
  marksInput: {
    width: 90,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: "#0f172a",
    textAlign: "center",
  },
  modalFooter: {
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
  },
  modalPrimaryBtn: {
    flex: 1,
    backgroundColor: "#0f172a",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  spaceTop: {
    marginTop: 10,
  },
});








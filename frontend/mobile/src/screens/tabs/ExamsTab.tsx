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

type ClassItem = {
  id: number;
  name: string;
  sections: Array<{ id: number; name: string; medium?: string | null }>;
};

type ScopeRow = {
  class_id: string;
  section_id: string;
};

type SubjectRow = {
  subject_id: number;
  subject_name: string;
  max_marks: number;
  
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

export default function ExamsTab() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sessions, setSessions] = useState<Array<{ id: number; name: string; is_active?: number | boolean }>>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const classMap = useMemo(() => new Map(classes.map((c) => [String(c.id), c])), [classes]);
  const activeSession = useMemo(
    () => sessions.find((s) => Number(s.is_active) === 1 || s.is_active === true) ?? null,
    [sessions]
  );

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadInitial() {
    setLoading(true);
    try {
      const [examsRes, classesRes, subjectsRes, sessionsRes] = await Promise.all([
        getExams(),
        getClassStructure(),
        getSubjects(),
        getSessions(),
      ]);
      setExams(examsRes || []);
      setClasses(classesRes as ClassItem[]);
      setAllSubjects(subjectsRes || []);
      setSessions(
        (sessionsRes || []).map((s) => ({
          id: Number(s.id),
          name: s.name,
          is_active: s.is_active,
        }))
      );
    } catch (err: unknown) {
      Alert.alert("Load failed", getErrorMessage(err, "Could not load exams module data."));
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
      await loadInitial();
      setOpen(false);
      resetForm();
    } catch (err: unknown) {
      Alert.alert("Save failed", getErrorMessage(err, "Failed to save exam."));
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
            await loadInitial();
          } catch (err: unknown) {
            Alert.alert("Delete failed", getErrorMessage(err, "Failed to delete exam."));
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>Exams</Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            resetForm();
            setOpen(true);
          }}
        >
          <Text style={styles.primaryBtnText}>{editingId ? "Edit Exam" : "Add Exam"}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : (
        <ScrollView style={styles.listWrap} contentContainerStyle={styles.listContent}>
          {exams.length ? (
            exams.map((exam) => (
              <View key={exam.id} style={styles.card}>
                <Text style={styles.cardTitle}>{exam.name}</Text>
                <Text style={styles.meta}>Session: {exam.session_name || "-"}</Text>
                <Text style={styles.meta}>Exam ID: {exam.id}</Text>
                <View style={styles.rowActions}>
                  <Pressable style={styles.secondaryBtn} onPress={() => onEdit(exam.id)}>
                    <Text style={styles.secondaryBtnText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.deleteBtn} onPress={() => onDelete(exam.id)}>
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No exams found.</Text>
          )}
        </ScrollView>
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
              <Pressable style={styles.secondaryBtn} onPress={() => setOpen(false)} disabled={saving}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={submitForm} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? "Saving..." : editingId ? "Update" : "Save"}</Text>
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
  primaryBtn: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
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
    borderRadius: 8,
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
    maxHeight: 520,
  },
  listContent: {
    gap: 10,
    paddingBottom: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  cardTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
  meta: {
    marginTop: 4,
    color: "#475569",
  },
  rowActions: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
    maxHeight: "90%",
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
    maxHeight: 510,
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
  },
  chipTextActive: {
    color: "#0f172a",
  },  scopeRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
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
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    borderRadius: 10,
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
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  spaceTop: {
    marginTop: 10,
  },
});









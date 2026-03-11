import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ClassItem, getClasses } from "../../services/classesService";
import {
  SubjectItem,
  assignSubjects,
  createSubject,
  deleteSubject,
  getClassSubjects,
  getSubjects,
  updateSubject,
} from "../../services/subjectsService";

type SubjectForm = {
  name: string;
  code: string;
};

const EMPTY_SUBJECT_FORM: SubjectForm = {
  name: "",
  code: "",
};

export default function SubjectsTab() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const [createForm, setCreateForm] = useState<SubjectForm>(EMPTY_SUBJECT_FORM);
  const [editForm, setEditForm] = useState<SubjectForm>(EMPTY_SUBJECT_FORM);
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);

  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [assignedPreview, setAssignedPreview] = useState<SubjectItem[]>([]);

  const canCreate = useMemo(() => !saving, [saving]);
  const canEdit = useMemo(() => !saving && editingSubjectId !== null, [saving, editingSubjectId]);
  const canAssign = useMemo(
    () => !saving && selectedClassId !== null && selectedSubjectIds.length > 0,
    [saving, selectedClassId, selectedSubjectIds]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subjectRows, classRows] = await Promise.all([getSubjects(), getClasses()]);
      setSubjects(subjectRows);
      setClasses(classRows);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not load subjects."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function previewClassSubjects(classId: number) {
    try {
      const assigned = await getClassSubjects(classId);
      setAssignedPreview(assigned);
      setSelectedSubjectIds(assigned.map((s) => Number(s.id)));
    } catch {
      setAssignedPreview([]);
      setSelectedSubjectIds([]);
    }
  }

  function validateSubjectForm(form: SubjectForm) {
    const name = form.name.trim();
    const code = form.code.trim();
    if (!name) return { ok: false as const, message: "Subject name is required." };
    if (!code) return { ok: false as const, message: "Subject code is required." };
    return { ok: true as const, name, code };
  }

  async function handleCreate() {
    const validation = validateSubjectForm(createForm);
    if (!validation.ok) {
      Alert.alert("Validation", validation.message);
      return;
    }
    setSaving(true);
    try {
      await createSubject({ name: validation.name, code: validation.code });
      setCreateOpen(false);
      setCreateForm(EMPTY_SUBJECT_FORM);
      await loadData();
    } catch (err: unknown) {
      Alert.alert("Create failed", getErrorMessage(err, "Could not create subject."));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(subject: SubjectItem) {
    setEditingSubjectId(subject.id);
    setEditForm({ name: subject.name, code: subject.code });
    setEditOpen(true);
  }

  async function handleEdit() {
    const validation = validateSubjectForm(editForm);
    if (!validation.ok) {
      Alert.alert("Validation", validation.message);
      return;
    }
    if (editingSubjectId === null) return;

    setSaving(true);
    try {
      await updateSubject(editingSubjectId, {
        name: validation.name,
        code: validation.code,
      });
      setEditOpen(false);
      setEditForm(EMPTY_SUBJECT_FORM);
      setEditingSubjectId(null);
      await loadData();
    } catch (err: unknown) {
      Alert.alert("Update failed", getErrorMessage(err, "Could not update subject."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    Alert.alert("Delete subject", "Do you want to deactivate this subject?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteSubject(id);
            setSubjects((prev) => prev.filter((item) => item.id !== id));
            setSelectedSubjectIds((prev) => prev.filter((subjectId) => subjectId !== id));
            setAssignedPreview((prev) => prev.filter((item) => item.id !== id));
          } catch (err: unknown) {
            Alert.alert("Delete failed", getErrorMessage(err, "Could not delete subject."));
          }
        },
      },
    ]);
  }

  async function handleAssign() {
    if (selectedClassId === null || selectedSubjectIds.length === 0) {
      Alert.alert("Validation", "Select class and at least one subject.");
      return;
    }
    setSaving(true);
    try {
      await assignSubjects({
        classId: selectedClassId,
        subjectIds: selectedSubjectIds,
      });
      setAssignOpen(false);
      Alert.alert("Success", "Subjects assigned successfully.");
    } catch (err: unknown) {
      Alert.alert("Assign failed", getErrorMessage(err, "Could not assign subjects."));
    } finally {
      setSaving(false);
    }
  }

  function toggleSubjectSelection(subjectId: number) {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>Subjects</Text>
        <View style={styles.toolbarActions}>
          <Pressable style={styles.secondaryBtn} onPress={() => setAssignOpen(true)}>
            <Text style={styles.secondaryBtnText}>Assign</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={() => setCreateOpen(true)}>
            <Text style={styles.primaryBtnText}>Add Subject</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : (
        <>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <View style={styles.grid}>
            {subjects.map((subject) => (
              <View key={subject.id} style={styles.card}>
                <Text style={styles.subjectName}>{subject.name}</Text>
                <Text style={styles.meta}>Code: {subject.code}</Text>
                <View style={styles.rowActions}>
                  <Pressable style={styles.secondaryBtn} onPress={() => openEdit(subject)}>
                    <Text style={styles.secondaryBtnText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.deleteBtn} onPress={() => handleDelete(subject.id)}>
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      <SubjectFormModal
        visible={createOpen}
        title="Add Subject"
        submitText="Save"
        form={createForm}
        saving={saving}
        canSubmit={canCreate}
        onClose={() => {
          setCreateOpen(false);
          setCreateForm(EMPTY_SUBJECT_FORM);
        }}
        onChange={setCreateForm}
        onSubmit={handleCreate}
      />

      <SubjectFormModal
        visible={editOpen}
        title="Edit Subject"
        submitText="Update"
        form={editForm}
        saving={saving}
        canSubmit={canEdit}
        onClose={() => {
          setEditOpen(false);
          setEditingSubjectId(null);
          setEditForm(EMPTY_SUBJECT_FORM);
        }}
        onChange={setEditForm}
        onSubmit={handleEdit}
      />

      <Modal visible={assignOpen} transparent animationType="slide" onRequestClose={() => setAssignOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setAssignOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Assign Subjects to Class</Text>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Class *</Text>
              <View style={styles.classList}>
                {classes.map((item) => {
                  const isSelected = Number(item.id) === selectedClassId;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.classItem, isSelected && styles.classItemActive]}
                      onPress={() => {
                        const classId = Number(item.id);
                        setSelectedClassId(classId);
                        previewClassSubjects(classId);
                      }}
                    >
                      <Text style={[styles.classItemText, isSelected && styles.classItemTextActive]}>
                        Class {item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, styles.spaceTop]}>Subjects *</Text>
              {subjects.map((item) => {
                const checked = selectedSubjectIds.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    style={styles.checkboxRow}
                    onPress={() => toggleSubjectSelection(item.id)}
                  >
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]} />
                    <Text style={styles.checkboxText}>
                      {item.name} ({item.code})
                    </Text>
                  </Pressable>
                );
              })}

              {selectedClassId !== null && (
                <View style={styles.assignedBlock}>
                  <Text style={styles.assignedTitle}>Currently Assigned</Text>
                  <Text style={styles.assignedText}>
                    {assignedPreview.length
                      ? assignedPreview.map((item) => item.name).join(", ")
                      : "No subjects assigned."}
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.secondaryBtn} onPress={() => setAssignOpen(false)} disabled={saving}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, !canAssign && styles.disabledBtn]}
                onPress={handleAssign}
                disabled={!canAssign}
              >
                <Text style={styles.primaryBtnText}>{saving ? "Saving..." : "Assign"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

type SubjectFormModalProps = {
  visible: boolean;
  title: string;
  submitText: string;
  form: SubjectForm;
  saving: boolean;
  canSubmit: boolean;
  onClose: () => void;
  onChange: (next: SubjectForm) => void;
  onSubmit: () => void;
};

function SubjectFormModal({
  visible,
  title,
  submitText,
  form,
  saving,
  canSubmit,
  onClose,
  onChange,
  onSubmit,
}: SubjectFormModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>Subject Name *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(value) => onChange({ ...form, name: value })}
              placeholder="Subject name"
            />

            <Text style={[styles.inputLabel, styles.spaceTop]}>Code *</Text>
            <TextInput
              style={styles.input}
              value={form.code}
              onChangeText={(value) => onChange({ ...form, code: value })}
              placeholder="Subject code"
            />
          </View>

          <View style={styles.modalFooter}>
            <Pressable style={styles.secondaryBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryBtn, !canSubmit && styles.disabledBtn]}
              onPress={onSubmit}
              disabled={!canSubmit}
            >
              <Text style={styles.primaryBtnText}>{saving ? "Saving..." : submitText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function getErrorMessage(err: unknown, fallback: string) {
  if (
    typeof err === "object" &&
    err &&
    "response" in err &&
    typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message ===
      "string"
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
    gap: 8,
  },
  toolbarActions: {
    flexDirection: "row",
    gap: 8,
  },
  title: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 18,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 30,
  },
  errorText: {
    color: "#dc2626",
    fontWeight: "600",
  },
  grid: {
    gap: 10,
  },
  card: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  subjectName: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
  meta: {
    color: "#475569",
    marginTop: 6,
  },
  rowActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
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
    color: "#ffffff",
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
  },
  modalCard: {
    maxHeight: "85%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
  },
  modalBody: {
    maxHeight: 450,
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
  },
  classList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  classItem: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
  },
  classItemActive: {
    borderColor: "#0f172a",
    backgroundColor: "#e2e8f0",
  },
  classItemText: {
    color: "#334155",
    fontWeight: "600",
  },
  classItemTextActive: {
    color: "#0f172a",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: "#ffffff",
  },
  checkboxChecked: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  checkboxText: {
    color: "#334155",
    fontWeight: "500",
  },
  assignedBlock: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#f8fafc",
  },
  assignedTitle: {
    color: "#0f172a",
    fontWeight: "700",
    marginBottom: 6,
  },
  assignedText: {
    color: "#475569",
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
  disabledBtn: {
    opacity: 0.7,
  },
});


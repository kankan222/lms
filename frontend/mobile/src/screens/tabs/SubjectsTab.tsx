import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ClassStructureItem, getClassStructure } from "../../services/classesService";
import {
  SubjectItem,
  assignSubjects,
  createSubject,
  deleteSubject,
  getClassSubjects,
  getSubjects,
  updateSubject,
} from "../../services/subjectsService";
import SelectField from "../../components/form/SelectField";
import { useAppTheme } from "../../theme/AppThemeProvider";

type SubjectForm = { name: string; code: string };
type Notice = { title: string; message: string; tone: "success" | "error" } | null;
type AssignmentFilter = "all" | "assigned" | "unassigned";
type DeleteTarget = { id: number; name: string } | null;

const EMPTY_FORM: SubjectForm = { name: "", code: "" };

function getErrorMessage(err: unknown, fallback: string) {
  if (
    typeof err === "object" &&
    err &&
    "response" in err &&
    typeof (err as { response?: { data?: { message?: string; error?: string } } }).response?.data === "object"
  ) {
    const data = (err as { response?: { data?: { message?: string; error?: string } } }).response?.data;
    return data?.error || data?.message || fallback;
  }
  return fallback;
}

function validateForm(form: SubjectForm) {
  const name = String(form.name || "").trim();
  const code = String(form.code || "").trim();
  if (!name) return { ok: false as const, message: "Subject name is required." };
  if (!code) return { ok: false as const, message: "Subject code is required." };
  return { ok: true as const, payload: { name, code } };
}

function SubjectModal({
  visible,
  title,
  submitText,
  form,
  saving,
  canSubmit,
  onClose,
  onChange,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  submitText: string;
  form: SubjectForm;
  saving: boolean;
  canSubmit: boolean;
  onClose: () => void;
  onChange: (next: SubjectForm) => void;
  onSubmit: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]} onPress={onClose} />
        <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>{title}</Text>
          <View style={styles.modalBody}>
            <Text style={[styles.inputLabel, { color: theme.subText }]}>Subject Name *</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
              value={form.name}
              onChangeText={(value) => onChange({ ...form, name: value })}
              placeholder="Subject name"
              placeholderTextColor={theme.mutedText}
            />
            <Text style={[styles.inputLabel, styles.spaceTop, { color: theme.subText }]}>Code *</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
              value={form.code}
              onChangeText={(value) => onChange({ ...form, code: value })}
              placeholder="Subject code"
              placeholderTextColor={theme.mutedText}
              autoCapitalize="characters"
            />
          </View>
          <View style={styles.modalFooter}>
            <Pressable
              style={[styles.secondaryBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.successBtn,
                { backgroundColor: theme.success, borderColor: theme.successBorder },
                !canSubmit && styles.disabledBtn,
              ]}
              onPress={onSubmit}
              disabled={!canSubmit}
            >
              <Text style={[styles.successBtnText, { color: theme.successText }]}>{saving ? "Saving..." : submitText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function SubjectsTab() {
  const { theme } = useAppTheme();
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classStructure, setClassStructure] = useState<ClassStructureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const [search, setSearch] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [createForm, setCreateForm] = useState<SubjectForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<SubjectForm>(EMPTY_FORM);
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [assignedPreview, setAssignedPreview] = useState<SubjectItem[]>([]);

  const loadData = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [subjectRows, structureRows] = await Promise.all([getSubjects(), getClassStructure()]);
      setSubjects(subjectRows);
      setClassStructure(structureRows);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not load subjects."));
    } finally {
      if (mode === "refresh") setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  const classCards = useMemo(
    () =>
      classStructure
        .map((row) => ({
          id: Number(row.id),
          name: row.name,
          scope: row.class_scope === "hs" ? "Higher Secondary" : "School",
          subjects: (row.subjects || []).map((subject) => subject.name),
          sections: (row.sections || []).map((section) =>
            section.medium ? `${section.name} (${section.medium})` : section.name,
          ),
        }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [classStructure],
  );

  useEffect(() => {
    if (!assignOpen) {
      setSelectedClassId(null);
      setSelectedSubjectIds([]);
      setAssignedPreview([]);
      return;
    }
    if (!classCards.length) return;
    const nextClassId = selectedClassId && classCards.some((row) => row.id === selectedClassId)
      ? selectedClassId
      : classCards[0].id;
    setSelectedClassId(nextClassId);
    previewClassSubjects(nextClassId);
  }, [assignOpen, classCards]);

  const assignedIds = useMemo(() => {
    const ids = new Set<number>();
    classStructure.forEach((row) => {
      (row.subjects || []).forEach((subject) => ids.add(Number(subject.id)));
    });
    return ids;
  }, [classStructure]);

  const filteredSubjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return subjects.filter((subject) => {
      const matchesSearch =
        !query ||
        subject.name.toLowerCase().includes(query) ||
        String(subject.code || "").toLowerCase().includes(query);
      if (!matchesSearch) return false;
      const assigned = assignedIds.has(Number(subject.id));
      if (assignmentFilter === "assigned") return assigned;
      if (assignmentFilter === "unassigned") return !assigned;
      return true;
    });
  }, [subjects, search, assignmentFilter, assignedIds]);

  const stats = useMemo(() => {
    const assigned = subjects.filter((subject) => assignedIds.has(Number(subject.id))).length;
    const unassigned = Math.max(subjects.length - assigned, 0);
    const mappedClasses = classCards.filter((row) => row.subjects.length > 0).length;
    return [
      { label: "Total Subjects", value: subjects.length, accent: theme.infoSoft, border: theme.infoBorder, tone: theme.infoText },
      { label: "Assigned", value: assigned, accent: theme.successSoft, border: theme.successBorder, tone: theme.success },
      { label: "Unassigned", value: unassigned, accent: theme.warningSoft, border: theme.warningBorder, tone: theme.warningText },
      { label: "Classes With Subjects", value: `${mappedClasses}/${classCards.length}`, accent: theme.card, border: theme.border, tone: theme.text },
    ];
  }, [subjects, assignedIds, classCards, theme]);

  const canCreate = !saving;
  const canEdit = !saving && editingSubjectId !== null;
  const canAssign = !saving && selectedClassId !== null && selectedSubjectIds.length > 0;

  function showNotice(title: string, message: string, tone: "success" | "error" = "success") {
    setNotice({ title, message, tone });
  }

  async function previewClassSubjects(classId: number) {
    setPreviewLoading(true);
    try {
      const data = await getClassSubjects(classId);
      setAssignedPreview(data);
      setSelectedSubjectIds(data.map((subject) => Number(subject.id)));
    } catch {
      setAssignedPreview([]);
      setSelectedSubjectIds([]);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleCreate() {
    const validation = validateForm(createForm);
    if (!validation.ok) {
      Alert.alert("Validation", validation.message);
      return;
    }
    setSaving(true);
    try {
      await createSubject(validation.payload);
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
      await loadData("refresh");
      showNotice("Subject Created", "The subject has been added successfully.");
    } catch (err: unknown) {
      showNotice("Create Failed", getErrorMessage(err, "Could not create subject."), "error");
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
    const validation = validateForm(editForm);
    if (!validation.ok) {
      Alert.alert("Validation", validation.message);
      return;
    }
    if (editingSubjectId === null) return;
    setSaving(true);
    try {
      await updateSubject(editingSubjectId, validation.payload);
      setEditOpen(false);
      setEditForm(EMPTY_FORM);
      setEditingSubjectId(null);
      await loadData("refresh");
      showNotice("Subject Updated", "The subject details have been updated.");
    } catch (err: unknown) {
      showNotice("Update Failed", getErrorMessage(err, "Could not update subject."), "error");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: number, name: string) {
    setDeleteTarget({ id, name });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteSubject(deleteTarget.id);
      setSubjects((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setSelectedSubjectIds((prev) => prev.filter((value) => value !== deleteTarget.id));
      setAssignedPreview((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      showNotice("Subject Deleted", "The subject has been removed.");
    } catch (err: unknown) {
      showNotice("Delete Failed", getErrorMessage(err, "Could not delete subject."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign() {
    if (selectedClassId === null || selectedSubjectIds.length === 0) {
      Alert.alert("Validation", "Select class and at least one subject.");
      return;
    }
    setSaving(true);
    try {
      await assignSubjects({ classId: selectedClassId, subjectIds: selectedSubjectIds });
      const latest = await getClassSubjects(selectedClassId);
      setAssignedPreview(latest);
      setSelectedSubjectIds(latest.map((subject) => Number(subject.id)));
      setAssignOpen(false);
      await loadData("refresh");
      showNotice("Subjects Assigned", "The subject allocation has been updated.");
    } catch (err: unknown) {
      showNotice("Assign Failed", getErrorMessage(err, "Could not assign subjects."), "error");
    } finally {
      setSaving(false);
    }
  }

  const selectedClassName = classCards.find((row) => row.id === selectedClassId)?.name || "";

  return (
    <View style={styles.screen}>
      <TopNotice notice={notice} style={styles.topNoticeOverlay} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData("refresh")} />}
      >
        <View style={styles.innerContent}>
          <View style={styles.heroCard}>
            <View style={styles.heroCopy}>
              <Text style={[styles.heroEyebrow, { color: theme.subText }]}>Overview</Text>
              <Text style={[styles.title, { color: theme.text }]}>Subjects</Text>
              <Text style={[styles.subtitle, { color: theme.subText }]}>Create subjects, review class coverage, and assign them</Text>
            </View>
          </View>

          <View style={styles.heroPrimaryActions}>
            <Pressable style={[styles.heroSecondaryBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setAssignOpen(true)}>
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Assign</Text>
            </Pressable>
            <Pressable style={[styles.heroPrimaryBtn, { backgroundColor: theme.primary }]} onPress={() => setCreateOpen(true)}>
              <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>Add Subject</Text>
            </Pressable>
          </View>
          <View style={styles.statsGrid}>
            {stats.map((item) => (
              <View key={item.label} style={[styles.statCard, { backgroundColor: item.accent, borderColor: item.border }]}>
                <Text style={[styles.statLabel, { color: theme.subText }]}>{item.label}</Text>
                <Text style={[styles.statValue, { color: item.tone }]}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Subject Directory</Text>
              <Text style={[styles.hint, { color: theme.subText }]}>{filteredSubjects.length} visible</Text>
            </View>
            <TextInput
              style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name or code"
              placeholderTextColor={theme.mutedText}
            />
            <View style={styles.filterRow}>
              {(["all", "assigned", "unassigned"] as const).map((filter) => {
                const active = assignmentFilter === filter;
                const label = filter === "all" ? "All" : filter === "assigned" ? "Assigned" : "Unassigned";
                return (
                  <Pressable
                    key={filter}
                    style={[
                      styles.filterChip,
                      { borderColor: theme.border, backgroundColor: theme.cardMuted },
                      active && [styles.filterChipActive, { borderColor: theme.primary, backgroundColor: theme.primary }],
                    ]}
                    onPress={() => setAssignmentFilter(filter)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: theme.subText },
                        active && [styles.filterChipTextActive, { color: theme.primaryText }],
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <>
          {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}
          {!error && filteredSubjects.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No subjects found</Text>
              <Text style={[styles.emptyText, { color: theme.subText }]}>
                {search || assignmentFilter !== "all"
                  ? "Try changing the search or assignment filter."
                  : "Add your first subject to start building the module."}
              </Text>
            </View>
          ) : null}

          <View style={styles.grid}>
            {filteredSubjects.map((subject) => {
              const coverage = classCards.filter((row) =>
                row.subjects.some((name) => name.toLowerCase() === subject.name.toLowerCase()),
              );
              return (
                <View key={subject.id} style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={styles.cardTop}>
                    <View style={[styles.iconBadge, { backgroundColor: theme.cardMuted }]}>
                      <Text style={[styles.iconBadgeText, { color: theme.text }]}>{subject.name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View style={styles.cardCopy}>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>{subject.name}</Text>
                      <Text style={[styles.itemMeta, { color: theme.subText }]}>Code: {subject.code}</Text>
                    </View>
                  </View>

                  <View style={styles.miniStatsRow}>
                    <View style={[styles.miniStat, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                      <Text style={[styles.miniStatLabel, { color: theme.subText }]}>Assigned Classes</Text>
                      <Text style={[styles.miniStatValue, { color: theme.text }]}>{coverage.length}</Text>
                    </View>
                    <View style={[styles.miniStat, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                      <Text style={[styles.miniStatLabel, { color: theme.subText }]}>Status</Text>
                      <Text style={[styles.miniStatValue, { color: theme.text }]}>{coverage.length ? "In Use" : "Not Assigned"}</Text>
                    </View>
                  </View>

                  <View style={styles.pillWrap}>
                    {coverage.length ? (
                      coverage.map((row) => (
                        <View key={`${subject.id}-${row.id}`} style={[styles.pill, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                          <Text style={[styles.pillText, { color: theme.text }]}>{row.name}</Text>
                        </View>
                      ))
                    ) : (
                      <View style={[styles.pill, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                        <Text style={[styles.pillText, { color: theme.text }]}>Not assigned yet</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.rowActions}>
                    <Pressable style={[styles.secondaryBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => openEdit(subject)}>
                      <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Edit</Text>
                    </Pressable>
                    <Pressable style={[styles.deleteBtn, { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder }]} onPress={() => handleDelete(subject.id, subject.name)}>
                      <Text style={[styles.deleteBtnText, { color: theme.danger }]}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

          <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Class Assignment View</Text>
              <Text style={[styles.hint, { color: theme.subText }]}>{classCards.length} classes</Text>
            </View>
            <View style={styles.grid}>
              {classCards.map((row) => (
                <View key={row.id} style={[styles.assignmentCard, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.assignmentTitle, { color: theme.text }]}>{row.name}</Text>
                    <Text style={[styles.assignmentScope, { color: theme.subText }]}>{row.scope}</Text>
                  </View>
                  <Text style={[styles.assignmentText, { color: theme.subText }]}>Sections: {row.sections.length ? row.sections.join(", ") : "No sections"}</Text>
                  <Text style={[styles.assignmentSubjects, { color: theme.text }]}>{row.subjects.length ? row.subjects.join(", ") : "No subjects assigned"}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <SubjectModal
        visible={createOpen}
        title="Add Subject"
        submitText="Save"
        form={createForm}
        saving={saving}
        canSubmit={canCreate}
        onClose={() => {
          setCreateOpen(false);
          setCreateForm(EMPTY_FORM);
        }}
        onChange={setCreateForm}
        onSubmit={handleCreate}
      />

        <SubjectModal
        visible={editOpen}
        title="Edit Subject"
        submitText="Update"
        form={editForm}
        saving={saving}
        canSubmit={canEdit}
        onClose={() => {
          setEditOpen(false);
          setEditingSubjectId(null);
          setEditForm(EMPTY_FORM);
        }}
        onChange={setEditForm}
        onSubmit={handleEdit}
      />

        <Modal visible={assignOpen} transparent animationType="slide" onRequestClose={() => setAssignOpen(false)}>
          <View style={styles.modalOverlay}>
            <Pressable style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]} onPress={() => setAssignOpen(false)} />
            <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Assign Subjects</Text>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <SelectField
                label="Class *"
                value={selectedClassId === null ? "" : String(selectedClassId)}
                onChange={(value) => {
                  const nextClassId = Number(value);
                  setSelectedClassId(nextClassId);
                  previewClassSubjects(nextClassId);
                }}
                options={classCards.map((row) => ({
                  label: row.name,
                  value: String(row.id),
                  description: row.scope,
                }))}
                placeholder="Choose class"
              />

              <Text style={[styles.inputLabel, styles.spaceTop, { color: theme.subText }]}>Subjects *</Text>
              <View style={styles.grid}>
                {subjects.map((item) => {
                  const checked = selectedSubjectIds.includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.checkboxRow,
                        { borderColor: theme.border, backgroundColor: theme.card },
                        checked && [styles.checkboxRowActive, { backgroundColor: theme.successSoft, borderColor: theme.success }],
                      ]}
                      onPress={() =>
                        setSelectedSubjectIds((prev) =>
                          prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id],
                        )
                      }
                    >
                      <View style={[styles.checkbox, { borderColor: theme.mutedText, backgroundColor: theme.card }, checked && [styles.checkboxChecked, { backgroundColor: theme.success, borderColor: theme.success }]]}>
                        {checked ? <Ionicons name="checkmark" size={12} color="#ffffff" /> : null}
                      </View>
                      <View style={styles.cardCopy}>
                        <Text style={[styles.itemTitle, { color: theme.text }]}>{item.name}</Text>
                        <Text style={[styles.itemMeta, { color: theme.subText }]}>{item.code}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {selectedClassId !== null ? (
                <View style={[styles.assignedBlock, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
                  <Text style={[styles.assignedTitle, { color: theme.text }]}>
                    {selectedClassName ? `${selectedClassName} Current Subjects` : "Current Subjects"}
                  </Text>
                  {previewLoading ? (
                    <ActivityIndicator size="small" color={theme.text} />
                  ) : (
                    <Text style={[styles.assignedText, { color: theme.subText }]}>
                      {assignedPreview.length ? assignedPreview.map((item) => item.name).join(", ") : "No subjects assigned."}
                    </Text>
                  )}
                </View>
              ) : null}
            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable style={[styles.secondaryBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setAssignOpen(false)} disabled={saving}>
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.successBtn, { backgroundColor: theme.success, borderColor: theme.successBorder }, !canAssign && styles.disabledBtn]} onPress={handleAssign} disabled={!canAssign}>
                <Text style={[styles.successBtnText, { color: theme.successText }]}>{saving ? "Saving..." : "Assign"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
        </Modal>

        <Modal visible={deleteTarget !== null} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
          <View style={styles.modalOverlay}>
            <Pressable style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]} onPress={() => setDeleteTarget(null)} />
            <View style={[styles.confirmCard, { backgroundColor: theme.card, borderColor: theme.dangerBorder }]}>
              <View style={[styles.confirmIcon, { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder }]}>
                <Ionicons name="close" size={20} color={theme.danger} />
              </View>
              <Text style={[styles.confirmTitle, { color: theme.text }]}>Delete Subject</Text>
              <Text style={[styles.confirmMessage, { color: theme.subText }]}>
                {deleteTarget ? `This will remove ${deleteTarget.name} from the subjects list.` : ""}
              </Text>
              <View style={styles.modalFooter}>
                <Pressable
                  style={[styles.secondaryBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => setDeleteTarget(null)}
                  disabled={saving}
                >
                  <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.deleteBtn, { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder }, saving && styles.disabledBtn]}
                  onPress={confirmDelete}
                  disabled={saving}
                >
                  <Text style={[styles.deleteBtnText, { color: theme.danger }]}>{saving ? "Deleting..." : "Delete"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  root: { flex: 1 },
  content: { gap: 14, paddingBottom: 120 },
  innerContent: { gap: 14, paddingHorizontal: 14, paddingTop: 10 },
  topNoticeOverlay: { position: "absolute", top: 0, left: 14, right: 14, zIndex: 20 },
  heroCard: { borderRadius: 24, paddingVertical: 0, gap: 8 },
  heroCopy: { gap: 6 },
  heroPrimaryActions: { flexDirection: "row", gap: 10 },
  heroEyebrow: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
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
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 11, color: "#0f172a" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f8fafc" },
  filterChipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  filterChipText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  filterChipTextActive: { color: "#fff" },
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  errorText: { color: "#dc2626", fontWeight: "700" },
  emptyCard: { backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#e2e8f0", padding: 18, gap: 6 },
  emptyTitle: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  emptyText: { color: "#64748b", lineHeight: 20 },
  grid: { gap: 12 },
  itemCard: { backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#e2e8f0", padding: 16, gap: 14 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBadge: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  iconBadgeText: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  cardCopy: { flex: 1, gap: 3 },
  itemTitle: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  itemMeta: { color: "#475569", fontWeight: "700", fontSize: 12 },
  miniStatsRow: { flexDirection: "row", gap: 10 },
  miniStat: { flex: 1, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  miniStatLabel: { color: "#64748b", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  miniStatValue: { color: "#0f172a", fontSize: 14, fontWeight: "800" },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { backgroundColor: "#f8fafc", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#e2e8f0" },
  pillText: { color: "#334155", fontSize: 12, fontWeight: "600" },
  rowActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  primaryBtn: { backgroundColor: "#0f172a", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  ghostBtn: { borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  ghostBtnText: { color: "#334155", fontWeight: "700" },
  inlineGhostBtn: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  heroPrimaryBtn: { flex: 1, backgroundColor: "#0f172a", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  heroSecondaryBtn: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: "#334155", fontWeight: "700" },
  deleteBtn: { flex: 1, backgroundColor: "#fee2e2", borderWidth: 1, borderColor: "#fecaca", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  deleteBtnText: { color: "#b91c1c", fontWeight: "700" },
  successBtn: { flex: 1, backgroundColor: "#15803d", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  successBtnText: { color: "#fff", fontWeight: "700" },
  assignmentCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 18, padding: 14, backgroundColor: "#f8fafc", gap: 8 },
  assignmentTitle: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  assignmentScope: { color: "#475569", fontSize: 12, fontWeight: "700" },
  assignmentText: { color: "#64748b", lineHeight: 18 },
  assignmentSubjects: { color: "#334155", lineHeight: 20, fontWeight: "600" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.28)" },
  modalCard: { maxHeight: "88%", backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  modalBody: { maxHeight: 500 },
  inputLabel: { color: "#334155", fontWeight: "700", marginBottom: 6 },
  classList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  classItem: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#fff", minWidth: "48%", gap: 3 },
  classItemActive: { borderColor: "#0f172a", backgroundColor: "#e2e8f0" },
  classItemText: { color: "#334155", fontWeight: "700" },
  classItemMeta: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  classItemTextActive: { color: "#0f172a" },
  checkboxRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff" },
  checkboxRowActive: { backgroundColor: "#f0fdf4", borderColor: "#15803d" },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: "#94a3b8", borderRadius: 4, marginRight: 10, backgroundColor: "#fff" },
  checkboxChecked: { backgroundColor: "#15803d", borderColor: "#15803d", alignItems: "center", justifyContent: "center" },
  assignedBlock: { marginTop: 12, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, padding: 12, backgroundColor: "#f8fafc", gap: 6 },
  assignedTitle: { color: "#0f172a", fontWeight: "800" },
  assignedText: { color: "#475569", lineHeight: 20 },
  confirmCard: { marginHorizontal: 18, marginBottom: 120, borderWidth: 1, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 20, gap: 12 },
  confirmIcon: { width: 44, height: 44, borderWidth: 1, borderRadius: 16, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  confirmTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  confirmMessage: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  spaceTop: { marginTop: 10 },
  modalFooter: { marginTop: 14, flexDirection: "row", gap: 10 },
  disabledBtn: { opacity: 0.7 },
});

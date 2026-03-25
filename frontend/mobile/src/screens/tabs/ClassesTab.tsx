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
import {
  ClassItem,
  ClassPayload,
  ClassScope,
  ClassStructureItem,
  SectionMedium,
  createClass,
  deleteClass,
  getClasses,
  getClassStructure,
  updateClass,
} from "../../services/classesService";

type SectionForm = {
  name: string;
  medium: SectionMedium | "";
};

type ClassForm = {
  name: string;
  class_scope: ClassScope;
  sections: SectionForm[];
};

type ClassView = {
  id: number;
  name: string;
  class_scope: ClassScope;
  sections: SectionForm[];
  subjects: string[];
};

type ValidationResult =
  | { ok: false; message: string }
  | { ok: true; payload: ClassPayload };

type SectionRowError = {
  medium?: string;
};

type NoticeState = {
  tone: "success" | "error";
  title: string;
  message: string;
} | null;

const EMPTY_FORM: ClassForm = {
  name: "",
  class_scope: "school",
  sections: [{ name: "", medium: "" }],
};

function makeEmptyForm(): ClassForm {
  return {
    name: "",
    class_scope: "school",
    sections: [{ name: "", medium: "" }],
  };
}

function formatScope(scope: ClassScope) {
  return scope === "hs" ? "Higher Secondary" : "School";
}

function splitCsv(raw: string) {
  return String(raw || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeSections(item: ClassItem, structureMap: Map<number, ClassStructureItem>): SectionForm[] {
  const structure = structureMap.get(Number(item.id));
  if (structure?.sections?.length) {
    return structure.sections.map((section) => ({
      name: String(section.name || "").trim(),
      medium: (String(section.medium || "").trim() as SectionMedium | "") || "",
    }));
  }

  if (Array.isArray(item.section_details) && item.section_details.length) {
    return item.section_details.map((section) => ({
      name: String(section?.name || "").trim(),
      medium: (String(section?.medium || "").trim() as SectionMedium | "") || "",
    }));
  }

  return splitCsv(item.sections).map((name) => ({ name, medium: "" }));
}

function normalizeSubjects(item: ClassItem, structureMap: Map<number, ClassStructureItem>): string[] {
  const structure = structureMap.get(Number(item.id));
  if (structure?.subjects?.length) {
    return structure.subjects.map((subject) => String(subject.name || "").trim()).filter(Boolean);
  }

  return splitCsv(item.subjects);
}

function buildClassRows(items: ClassItem[], structures: ClassStructureItem[]): ClassView[] {
  const structureMap = new Map<number, ClassStructureItem>(
    structures.map((entry) => [Number(entry.id), entry]),
  );

  return items
    .map((item) => ({
      id: Number(item.id),
      name: String(item.name || "").trim(),
      class_scope: (item.class_scope || structureMap.get(Number(item.id))?.class_scope || "school") as ClassScope,
      sections: normalizeSections(item, structureMap),
      subjects: normalizeSubjects(item, structureMap),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function ClassesTab() {
  const [rows, setRows] = useState<ClassView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  const [scopeFilter, setScopeFilter] = useState<ClassScope | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ClassForm>(makeEmptyForm());
  const [editForm, setEditForm] = useState<ClassForm>(makeEmptyForm());
  const [createSectionErrors, setCreateSectionErrors] = useState<SectionRowError[]>([]);
  const [editSectionErrors, setEditSectionErrors] = useState<SectionRowError[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const canSubmitCreate = useMemo(() => !saving, [saving]);
  const canSubmitEdit = useMemo(() => !saving && editingId !== null, [saving, editingId]);

  const loadClasses = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const [items, structure] = await Promise.all([getClasses(), getClassStructure()]);
      setRows(buildClassRows(items, structure));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not load classes."));
    } finally {
      if (mode === "refresh") {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timeout);
  }, [notice]);

  const filteredRows = useMemo(() => {
    if (scopeFilter === "all") return rows;
    return rows.filter((row) => row.class_scope === scopeFilter);
  }, [rows, scopeFilter]);

  const stats = useMemo(() => {
    const totalClasses = rows.length;
    const totalSections = rows.reduce((sum, row) => sum + row.sections.length, 0);
    const schoolCount = rows.filter((row) => row.class_scope === "school").length;
    const higherSecondaryCount = rows.filter((row) => row.class_scope === "hs").length;
    return [
      { label: "Total Classes", value: totalClasses, accent: "#dbeafe", tone: "#1d4ed8" },
      { label: "Sections", value: totalSections, accent: "#dcfce7", tone: "#15803d" },
      { label: "School", value: schoolCount, accent: "#fef3c7", tone: "#b45309" },
      { label: "Higher Secondary", value: higherSecondaryCount, accent: "#ede9fe", tone: "#6d28d9" },
    ];
  }, [rows]);

  function showNotice(title: string, message: string, tone: "success" | "error" = "success") {
    setNotice({ title, message, tone });
  }

  function validateForm(form: ClassForm): ValidationResult {
    const name = form.name.trim();
    const sections = (form.sections || [])
      .map((section) => ({
        name: String(section?.name || "").trim(),
        medium: String(section?.medium || "").trim() as SectionMedium | "",
      }))
      .filter((section) => section.name);

    if (!name) return { ok: false, message: "Class name is required." };
    if (!["school", "hs"].includes(form.class_scope)) {
      return { ok: false, message: "Class scope is required." };
    }
    if (!sections.length) return { ok: false, message: "At least one section is required." };
    if (sections.some((section) => section.medium !== "English" && section.medium !== "Assamese")) {
      return { ok: false, message: "Each section must have a medium." };
    }

    return {
      ok: true,
      payload: {
        name,
        class_scope: form.class_scope,
        sections: sections as Array<{ name: string; medium: SectionMedium }>,
      },
    };
  }

  function buildSectionErrors(form: ClassForm): SectionRowError[] {
    return (form.sections || []).map((section) => {
      const name = String(section?.name || "").trim();
      const medium = String(section?.medium || "").trim();
      if (name && medium !== "English" && medium !== "Assamese") {
        return { medium: "Select section medium." };
      }
      return {};
    });
  }

  async function handleCreate() {
    setCreateSectionErrors(buildSectionErrors(createForm));
    const result = validateForm(createForm);
    if (!result.ok) {
      Alert.alert("Validation", result.message);
      return;
    }

    setSaving(true);
    try {
      await createClass(result.payload);
      setCreateOpen(false);
      setCreateForm(makeEmptyForm());
      setCreateSectionErrors([]);
      await loadClasses("refresh");
      showNotice("Class Created", "The class has been added successfully.");
    } catch (err: unknown) {
      showNotice("Create Failed", getErrorMessage(err, "Could not create class."), "error");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(row: ClassView) {
    setEditingId(row.id);
    setEditForm({
      name: row.name,
      class_scope: row.class_scope,
      sections: row.sections.length ? row.sections : [{ name: "", medium: "" }],
    });
    setEditSectionErrors([]);
    setEditOpen(true);
  }

  async function handleEdit() {
    setEditSectionErrors(buildSectionErrors(editForm));
    const result = validateForm(editForm);
    if (!result.ok) {
      Alert.alert("Validation", result.message);
      return;
    }
    if (editingId === null) return;

    setSaving(true);
    try {
      await updateClass(editingId, result.payload);
      setEditOpen(false);
      setEditingId(null);
      setEditForm(makeEmptyForm());
      setEditSectionErrors([]);
      await loadClasses("refresh");
      showNotice("Class Updated", "The class details have been updated.");
    } catch (err: unknown) {
      showNotice("Update Failed", getErrorMessage(err, "Could not update class."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(id: number, className: string) {
    Alert.alert("Delete class", `This will remove ${className} from the active classes list.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteClass(id);
            setRows((prev) => prev.filter((item) => item.id !== id));
            showNotice("Class Deleted", "The class has been removed.");
          } catch (err: unknown) {
            showNotice("Delete Failed", getErrorMessage(err, "Could not delete class."), "error");
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadClasses("refresh")} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>Classes</Text>
          <Text style={styles.subtitle}>Manage classes, sections, and scope with the live academic structure.</Text>
        </View>
        <View style={styles.heroActions}>
          <View style={styles.heroPrimaryActions}>
            <Pressable style={styles.iconUtilityBtn} onPress={() => loadClasses("refresh")}>
              <Ionicons name="refresh-outline" size={18} color="#334155" />
            </Pressable>
            <Pressable style={styles.heroPrimaryBtn} onPress={() => setCreateOpen(true)}>
              <Text style={styles.primaryBtnText}>Add Class</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <TopNotice notice={notice} />

      <View style={styles.statsGrid}>
        {stats.map((item) => (
          <View key={item.label} style={[styles.statCard, { backgroundColor: item.accent }]}>
            <Text style={styles.statLabel}>{item.label}</Text>
            <Text style={[styles.statValue, { color: item.tone }]}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.filterCard}>
        <View style={styles.filterHeader}>
          <Text style={styles.sectionTitle}>Browse</Text>
          <Text style={styles.filterHint}>{filteredRows.length} visible</Text>
        </View>
        <View style={styles.scopeRow}>
          {(["all", "school", "hs"] as const).map((scope) => {
            const active = scopeFilter === scope;
            return (
              <Pressable
                key={scope}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setScopeFilter(scope)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {scope === "all" ? "All" : formatScope(scope)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : (
        <>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {!error && filteredRows.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No classes found</Text>
              <Text style={styles.emptyText}>
                {scopeFilter === "all"
                  ? "Add your first class to start building the academic structure."
                  : "No classes are available for the selected scope."}
              </Text>
            </View>
          ) : null}

          <View style={styles.grid}>
            {filteredRows.map((row) => (
              <View key={row.id} style={styles.classCard}>
                <View style={styles.cardTop}>
                  <View style={styles.iconBadge}>
                    <Text style={styles.iconBadgeText}>{row.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.className}>{row.name}</Text>
                    <Text style={styles.scopeBadge}>{formatScope(row.class_scope)}</Text>
                  </View>
                </View>

                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Sections</Text>
                  <View style={styles.pillWrap}>
                    {row.sections.length ? (
                      row.sections.map((section, index) => (
                        <View key={`${row.id}-section-${index}`} style={styles.detailPill}>
                          <Text style={styles.detailPillText}>
                            {section.name}
                            {section.medium ? ` • ${section.medium}` : ""}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <View style={styles.detailPill}>
                        <Text style={styles.detailPillText}>No sections</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Subjects</Text>
                  <Text style={styles.subjectText}>
                    {row.subjects.length ? row.subjects.join(", ") : "No subjects linked yet."}
                  </Text>
                </View>

                <View style={styles.rowActions}>
                  <Pressable style={styles.secondaryBtn} onPress={() => openEdit(row)}>
                    <Text style={styles.secondaryBtnText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.deleteBtn} onPress={() => confirmDelete(row.id, row.name)}>
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      <ClassFormModal
        visible={createOpen}
        title="Add Class"
        submitText="Save"
        form={createForm}
        saving={saving}
        onClose={() => {
          setCreateOpen(false);
          setCreateForm(makeEmptyForm());
          setCreateSectionErrors([]);
        }}
        onChange={setCreateForm}
        onSubmit={handleCreate}
        canSubmit={canSubmitCreate}
        sectionErrors={createSectionErrors}
      />

      <ClassFormModal
        visible={editOpen}
        title="Edit Class"
        submitText="Update"
        form={editForm}
        saving={saving}
        onClose={() => {
          setEditOpen(false);
          setEditingId(null);
          setEditForm(makeEmptyForm());
          setEditSectionErrors([]);
        }}
        onChange={setEditForm}
        onSubmit={handleEdit}
        canSubmit={canSubmitEdit}
        sectionErrors={editSectionErrors}
      />
    </ScrollView>
  );
}

type ClassFormModalProps = {
  visible: boolean;
  title: string;
  submitText: string;
  form: ClassForm;
  saving: boolean;
  canSubmit: boolean;
  onClose: () => void;
  onChange: (next: ClassForm) => void;
  onSubmit: () => void;
  sectionErrors: SectionRowError[];
};

function ClassFormModal({
  visible,
  title,
  submitText,
  form,
  saving,
  canSubmit,
  onClose,
  onChange,
  onSubmit,
  sectionErrors,
}: ClassFormModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.inputLabel}>Class Name *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(value) => onChange({ ...form, name: value })}
              placeholder="Class name"
              placeholderTextColor="#94a3b8"
            />

            <Text style={[styles.inputLabel, styles.spaceTop]}>Class Scope *</Text>
            <View style={styles.scopeRow}>
              {(["school", "hs"] as const).map((scope) => {
                const active = form.class_scope === scope;
                return (
                  <Pressable
                    key={scope}
                    style={[styles.scopeChip, active && styles.scopeChipActive]}
                    onPress={() => onChange({ ...form, class_scope: scope })}
                  >
                    <Text style={[styles.scopeChipText, active && styles.scopeChipTextActive]}>
                      {formatScope(scope)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.inputLabel, styles.spaceTop]}>Sections *</Text>
            {form.sections.map((section, index) => (
              <View key={`section-${index}`} style={styles.sectionRow}>
                <TextInput
                  style={[styles.input, styles.sectionInput]}
                  value={section.name}
                  onChangeText={(value) => {
                    const nextSections = [...form.sections];
                    nextSections[index] = { ...nextSections[index], name: value };
                    onChange({ ...form, sections: nextSections });
                  }}
                  placeholder={`Section ${index + 1}`}
                  placeholderTextColor="#94a3b8"
                />
                <View style={styles.mediumRow}>
                  {(["English", "Assamese"] as const).map((medium) => {
                    const active = section.medium === medium;
                    return (
                      <Pressable
                        key={medium}
                        style={[
                          styles.mediumChip,
                          active && styles.mediumChipActive,
                          sectionErrors[index]?.medium && styles.mediumChipError,
                        ]}
                        onPress={() => {
                          const nextSections = [...form.sections];
                          nextSections[index] = { ...nextSections[index], medium };
                          onChange({ ...form, sections: nextSections });
                        }}
                      >
                        <Text style={[styles.mediumChipText, active && styles.mediumChipTextActive]}>
                          {medium}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {sectionErrors[index]?.medium ? (
                  <Text style={styles.fieldError}>{sectionErrors[index]?.medium}</Text>
                ) : null}
              </View>
            ))}

            <Pressable
              style={styles.addSectionBtn}
              onPress={() => onChange({ ...form, sections: [...form.sections, { name: "", medium: "" }] })}
            >
              <Text style={styles.addSectionBtnText}>Add Section</Text>
            </Pressable>
          </ScrollView>
          <View style={styles.modalFooter}>
            <Pressable style={styles.secondaryBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.successBtn, !canSubmit && styles.disabledBtn]}
              onPress={onSubmit}
              disabled={!canSubmit}
            >
              <Text style={styles.successBtnText}>{saving ? "Saving..." : submitText}</Text>
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
    typeof (
      err as { response?: { data?: { message?: string; error?: string } } }
    ).response?.data === "object"
  ) {
    const data = (
      err as { response?: { data?: { message?: string; error?: string } } }
    ).response?.data;
    return data?.error || data?.message || fallback;
  }
  return fallback;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    gap: 14,
    paddingBottom: 8,
  },
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 18,
    gap: 14,
  },
  heroCopy: {
    gap: 6,
  },
  heroActions: {
    gap: 10,
  },
  heroPrimaryActions: {
    flexDirection: "row",
    gap: 10,
  },
  title: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 22,
  },
  subtitle: {
    color: "#64748b",
    lineHeight: 20,
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
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "48%",
    minHeight: 92,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "space-between",
  },
  statLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  statValue: {
    fontSize: 26,
    fontWeight: "800",
  },
  filterCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    gap: 12,
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16,
  },
  filterHint: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  scopeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
  },
  filterChipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#0f172a",
  },
  filterChipText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 12,
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  errorText: {
    color: "#dc2626",
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 18,
    gap: 6,
  },
  emptyTitle: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16,
  },
  emptyText: {
    color: "#64748b",
    lineHeight: 20,
  },
  grid: {
    gap: 12,
  },
  classCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    gap: 14,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadgeText: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16,
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  className: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 18,
  },
  scopeBadge: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 12,
  },
  detailBlock: {
    gap: 8,
  },
  detailLabel: {
    color: "#334155",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailPill: {
    backgroundColor: "#f8fafc",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  detailPillText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  subjectText: {
    color: "#475569",
    lineHeight: 20,
  },
  rowActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  primaryBtn: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  heroPrimaryBtn: {
    flex: 1,
    backgroundColor: "#0f172a",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  ghostBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnText: {
    color: "#334155",
    fontWeight: "700",
  },
  iconUtilityBtn: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "#334155",
    fontWeight: "700",
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    color: "#b91c1c",
    fontWeight: "700",
  },
  successBtn: {
    flex: 1,
    backgroundColor: "#15803d",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  successBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.28)",
  },
  modalCard: {
    maxHeight: "88%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  modalBody: {
    maxHeight: 500,
  },
  inputLabel: {
    color: "#334155",
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
    color: "#0f172a",
  },
  scopeChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
  },
  scopeChipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#0f172a",
  },
  scopeChipText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
  },
  scopeChipTextActive: {
    color: "#ffffff",
  },
  sectionRow: {
    marginBottom: 10,
  },
  sectionInput: {
    marginBottom: 6,
  },
  spaceTop: {
    marginTop: 8,
  },
  addSectionBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: "flex-start",
    backgroundColor: "#f8fafc",
  },
  addSectionBtnText: {
    color: "#334155",
    fontWeight: "700",
  },
  mediumRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 4,
  },
  mediumChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#f8fafc",
  },
  mediumChipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#0f172a",
  },
  mediumChipError: {
    borderColor: "#dc2626",
  },
  mediumChipText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
  },
  mediumChipTextActive: {
    color: "#ffffff",
  },
  fieldError: {
    color: "#b91c1c",
    marginBottom: 4,
    fontSize: 12,
  },
  modalFooter: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  disabledBtn: {
    opacity: 0.7,
  },
});

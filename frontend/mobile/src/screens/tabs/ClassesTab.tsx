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
import {
  ClassItem,
  createClass,
  deleteClass,
  getClasses,
  updateClass,
} from "../../services/classesService";

type SectionMedium = "English" | "Assamese";

type SectionForm = {
  name: string;
  medium: SectionMedium | "";
};

type ClassForm = {
  name: string;
  sections: SectionForm[];
};

type ClassView = {
  id: number;
  name: string;
  sections: SectionForm[];
  subjects: string[];
};

type ValidationResult =
  | { ok: false; message: string }
  | { ok: true; name: string; sections: Array<{ name: string; medium: SectionMedium }> };

type SectionRowError = {
  medium?: string;
};

const EMPTY_FORM: ClassForm = {
  name: "",
  sections: [{ name: "", medium: "" }],
};

export default function ClassesTab() {
  const [rows, setRows] = useState<ClassView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ClassForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<ClassForm>(EMPTY_FORM);
  const [createSectionErrors, setCreateSectionErrors] = useState<SectionRowError[]>([]);
  const [editSectionErrors, setEditSectionErrors] = useState<SectionRowError[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const canSubmitCreate = useMemo(() => !saving, [saving]);
  const canSubmitEdit = useMemo(() => !saving && editingId !== null, [saving, editingId]);

  const loadClasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClasses();
      setRows(data.map(normalizeClassRow));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not load classes."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  function splitCsv(raw: string) {
    return String(raw || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function normalizeClassRow(item: ClassItem): ClassView {
    const sections: SectionForm[] = Array.isArray(item.section_details)
      ? item.section_details.map((s) => ({
          name: String(s?.name || "").trim(),
          medium: (String(s?.medium || "").trim() as SectionMedium | "") || "",
        }))
      : splitCsv(item.sections).map((name) => ({ name, medium: "" }));

    return {
      id: Number(item.id),
      name: item.name,
      sections,
      subjects: splitCsv(item.subjects),
    };
  }

  function validateForm(form: ClassForm): ValidationResult {
    const name = form.name.trim();
    const sections = (form.sections || [])
      .map((s) => ({
        name: String(s?.name || "").trim(),
        medium: String(s?.medium || "").trim() as SectionMedium | "",
      }))
      .filter((s) => s.name);

    if (!name) return { ok: false, message: "Class name is required." };
    if (!sections.length) return { ok: false, message: "At least one section is required." };
    if (sections.some((s) => s.medium !== "English" && s.medium !== "Assamese")) {
      return { ok: false, message: "Each section must have a medium." };
    }

    return { ok: true, name, sections: sections as Array<{ name: string; medium: SectionMedium }> };
  }

  function buildSectionErrors(form: ClassForm): SectionRowError[] {
    return (form.sections || []).map((s) => {
      const name = String(s?.name || "").trim();
      const medium = String(s?.medium || "").trim();
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
      await createClass({
        name: result.name,
        sections: result.sections,
      });
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
      setCreateSectionErrors([]);
      await loadClasses();
    } catch (err: unknown) {
      Alert.alert("Create failed", getErrorMessage(err, "Could not create class."));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(row: ClassView) {
    setEditingId(row.id);
    setEditForm({
      name: row.name,
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
      await updateClass(editingId, {
        name: result.name,
        sections: result.sections,
      });
      setEditOpen(false);
      setEditingId(null);
      setEditForm(EMPTY_FORM);
      setEditSectionErrors([]);
      await loadClasses();
    } catch (err: unknown) {
      Alert.alert("Update failed", getErrorMessage(err, "Could not update class."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(id: number) {
    Alert.alert("Delete class", "Do you want to deactivate this class?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteClass(id);
            setRows((prev) => prev.filter((item) => item.id !== id));
          } catch (err: unknown) {
            Alert.alert("Delete failed", getErrorMessage(err, "Could not delete class."));
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>Classes</Text>
        <Pressable style={styles.primaryBtn} onPress={() => setCreateOpen(true)}>
          <Text style={styles.primaryBtnText}>Add Class</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : (
        <>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <View style={styles.grid}>
            {rows.map((row) => (
              <View key={row.id} style={styles.card}>
                <Text style={styles.className}>Class {row.name}</Text>
                <Text style={styles.meta}>
                  Sections: {row.sections.length ? row.sections.map((s) => `${s.name}${s.medium ? ` (${s.medium})` : ""}`).join(", ") : "-"}
                </Text>
                <Text style={styles.meta}>
                  Subjects: {row.subjects.length ? row.subjects.join(", ") : "None"}
                </Text>
                <View style={styles.rowActions}>
                  <Pressable style={styles.secondaryBtn} onPress={() => openEdit(row)}>
                    <Text style={styles.secondaryBtnText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.deleteBtn} onPress={() => confirmDelete(row.id)}>
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
          setCreateForm(EMPTY_FORM);
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
          setEditForm(EMPTY_FORM);
          setEditSectionErrors([]);
        }}
        onChange={setEditForm}
        onSubmit={handleEdit}
        canSubmit={canSubmitEdit}
        sectionErrors={editSectionErrors}
      />
    </View>
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
          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Class Name *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(value) => onChange({ ...form, name: value })}
              placeholder="Class name"
            />

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
                />
                <View style={styles.mediumRow}>
                  <Pressable
                    style={[
                      styles.mediumChip,
                      section.medium === "English" && styles.mediumChipActive,
                      sectionErrors[index]?.medium && styles.mediumChipError,
                    ]}
                    onPress={() => {
                      const nextSections = [...form.sections];
                      nextSections[index] = { ...nextSections[index], medium: "English" };
                      onChange({ ...form, sections: nextSections });
                    }}
                  >
                    <Text style={[styles.mediumChipText, section.medium === "English" && styles.mediumChipTextActive]}>English</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.mediumChip,
                      section.medium === "Assamese" && styles.mediumChipActive,
                      sectionErrors[index]?.medium && styles.mediumChipError,
                    ]}
                    onPress={() => {
                      const nextSections = [...form.sections];
                      nextSections[index] = { ...nextSections[index], medium: "Assamese" };
                      onChange({ ...form, sections: nextSections });
                    }}
                  >
                    <Text style={[styles.mediumChipText, section.medium === "Assamese" && styles.mediumChipTextActive]}>Assamese</Text>
                  </Pressable>
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
  root: { gap: 12 },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: "#0f172a", fontWeight: "700", fontSize: 18 },
  centered: { alignItems: "center", justifyContent: "center", paddingTop: 30 },
  errorText: { color: "#dc2626", fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  className: { color: "#0f172a", fontWeight: "700", fontSize: 16 },
  meta: { color: "#475569", marginTop: 6 },
  rowActions: { marginTop: 12, flexDirection: "row", gap: 8 },
  primaryBtn: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#ffffff", fontWeight: "600" },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { color: "#334155", fontWeight: "600" },
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
  deleteBtnText: { color: "#b91c1c", fontWeight: "700" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
  },
  modalCard: {
    maxHeight: "82%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a", marginBottom: 10 },
  modalBody: { maxHeight: 420 },
  inputLabel: { color: "#334155", fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  sectionRow: { marginBottom: 8 },
  sectionInput: { marginBottom: 6 },
  spaceTop: { marginTop: 8 },
  addSectionBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  addSectionBtnText: { color: "#334155", fontWeight: "600" },
  mediumRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 4 },
  mediumChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mediumChipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  mediumChipError: { borderColor: "#dc2626" },
  mediumChipText: { color: "#334155", fontWeight: "600", fontSize: 12 },
  mediumChipTextActive: { color: "#ffffff" },
  fieldError: { color: "#b91c1c", marginBottom: 6, fontSize: 12 },
  modalFooter: { marginTop: 12, flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  disabledBtn: { opacity: 0.7 },
});


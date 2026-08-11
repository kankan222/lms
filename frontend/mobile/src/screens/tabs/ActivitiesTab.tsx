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
import { getClassStructure, type ClassStructureItem } from "../../services/classesService";
import {
  createActivity,
  deleteActivity,
  getActivities,
  updateActivity,
  type ActivityPayload,
  type MarksheetActivity,
} from "../../services/marksheetService";
import SelectField from "../../components/form/SelectField";
import TopNotice from "../../components/feedback/TopNotice";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { useAuthStore } from "../../store/authStore";

type NoticeState = { tone: "success" | "error"; title: string; message: string } | null;
type ActivityForm = {
  name: string;
  class_id: number | null;
  section_id: number | null;
  sort_order: string;
  max_marks: string;
  is_active: boolean;
};
type ActivityGroup = MarksheetActivity & { rows: MarksheetActivity[] };

const EMPTY_FORM: ActivityForm = {
  name: "",
  class_id: null,
  section_id: null,
  sort_order: "0",
  max_marks: "10",
  is_active: true,
};

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err && "response" in err) {
    const data = (err as { response?: { data?: { message?: string; error?: string } } }).response?.data;
    return data?.error || data?.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function wholeNumber(value?: string | number | null) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const number = Number(text);
  return Number.isFinite(number) ? String(Math.round(number)) : text.replace(/\D/g, "");
}

function scopeLabel(activity: MarksheetActivity) {
  if (activity.class_id) {
    return `${activity.class_name || "Class"}${activity.section_id ? ` - ${activity.section_name || "Section"}` : " (All Sections)"}`;
  }
  if (activity.scope_key) return activity.scope_key;
  return "All Classes";
}

function statusValue(activity: MarksheetActivity) {
  return Number(activity.is_active) === 0 || activity.is_active === false ? "inactive" : "active";
}

function StatusBadge({ value }: { value: string }) {
  const palette =
    value === "active"
      ? { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", color: "#15803d" }
      : { borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#b91c1c" };
  return (
    <View style={[styles.statusBadge, { borderColor: palette.borderColor, backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.statusText, { color: palette.color }]}>{value === "active" ? "Active" : "Inactive"}</Text>
    </View>
  );
}

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.rowBetween}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
        {hint ? <Text style={[styles.sectionHint, { color: theme.subText }]}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export default function ActivitiesTab() {
  const { theme } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions || [];
  const canCreate = permissions.includes("academic.create");
  const canUpdate = permissions.includes("academic.update");
  const canDelete = permissions.includes("academic.delete");

  const [activities, setActivities] = useState<MarksheetActivity[]>([]);
  const [classes, setClasses] = useState<ClassStructureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ActivityForm>(EMPTY_FORM);
  const [editingGroup, setEditingGroup] = useState<ActivityGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActivityGroup | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  const selectedClass = useMemo(
    () => classes.find((item) => Number(item.id) === Number(form.class_id)) || null,
    [classes, form.class_id],
  );

  const groupedActivities = useMemo<ActivityGroup[]>(() => {
    const map = new Map<string, ActivityGroup>();
    activities.forEach((activity) => {
      const key = [
        String(activity.name || "").trim().toLowerCase(),
        wholeNumber(activity.max_marks),
        String(activity.sort_order || 0),
        statusValue(activity),
      ].join("|");
      if (!map.has(key)) map.set(key, { ...activity, rows: [] });
      map.get(key)?.rows.push(activity);
    });
    return [...map.values()].map((group) => ({
      ...group,
      rows: [...group.rows].sort((a, b) => {
        const classCompare = String(a.class_name || "").localeCompare(String(b.class_name || ""));
        if (classCompare) return classCompare;
        return String(a.section_name || "").localeCompare(String(b.section_name || ""));
      }),
    }));
  }, [activities]);

  useEffect(() => {
    void loadAll("initial");
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  async function loadAll(mode: "initial" | "refresh" = "initial") {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);

    try {
      const [activityRows, classRows] = await Promise.all([getActivities(), getClassStructure()]);
      setActivities(activityRows);
      setClasses(classRows);
    } catch (err: unknown) {
      showNotice("Load Failed", getErrorMessage(err, "Could not load activities."), "error");
    } finally {
      if (mode === "refresh") setRefreshing(false);
      else setLoading(false);
    }
  }

  function showNotice(title: string, message: string, tone: "success" | "error" = "success") {
    setNotice({ title, message, tone });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingGroup(null);
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
  }

  function openEdit(group: ActivityGroup) {
    const first = group.rows[0] || group;
    setEditingGroup(group);
    setForm({
      name: first.name || "",
      class_id: first.class_id ? Number(first.class_id) : null,
      section_id: first.section_id ? Number(first.section_id) : null,
      sort_order: wholeNumber(first.sort_order || 0) || "0",
      max_marks: wholeNumber(first.max_marks || 10) || "10",
      is_active: statusValue(first) === "active",
    });
    setFormOpen(true);
  }

  function buildPayload(): ActivityPayload {
    return {
      name: form.name.trim(),
      scope_key: null,
      class_id: form.class_id || null,
      section_id: form.section_id || null,
      sort_order: Number(wholeNumber(form.sort_order) || 0),
      max_marks: Number(wholeNumber(form.max_marks) || 0),
      is_active: form.is_active,
    };
  }

  async function handleSave() {
    if (!form.name.trim()) return Alert.alert("Validation", "Activity name is required.");
    if (!Number(wholeNumber(form.max_marks))) return Alert.alert("Validation", "Max marks is required.");

    setSaving(true);
    try {
      const payload = buildPayload();
      if (editingGroup?.rows?.length) {
        await updateActivity(editingGroup.rows[0].id, payload);
        await Promise.all(editingGroup.rows.slice(1).map((row) => deleteActivity(row.id)));
      } else {
        await createActivity(payload);
      }
      setFormOpen(false);
      resetForm();
      await loadAll("refresh");
      showNotice(editingGroup ? "Activity Updated" : "Activity Created", editingGroup ? "Activity updated successfully." : "Activity created successfully.");
    } catch (err: unknown) {
      showNotice("Save Failed", getErrorMessage(err, "Failed to save activity."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await Promise.all(deleteTarget.rows.map((row) => deleteActivity(row.id)));
      setDeleteTarget(null);
      await loadAll("refresh");
      showNotice("Activity Deleted", "Activity deleted successfully.");
    } catch (err: unknown) {
      showNotice("Delete Failed", getErrorMessage(err, "Failed to delete activity."), "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.text} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <TopNotice notice={notice} style={styles.topNoticeOverlay} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadAll("refresh")} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: theme.subText }]}>Academics</Text>
            <Text style={[styles.title, { color: theme.text }]}>Activities</Text>
            <Text style={[styles.subtitle, { color: theme.subText }]}>Configure class-scoped activities for the final marksheet.</Text>
          </View>
          {canCreate ? (
            <Pressable style={[styles.primaryBtn, { backgroundColor: theme.primary }]} onPress={openCreate}>
              <Ionicons name="add" size={18} color={theme.primaryText} />
              <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>Add Activity</Text>
            </Pressable>
          ) : null}
        </View>

        <SectionCard title="Activity Definitions" hint={`${groupedActivities.length} groups`}>
          {groupedActivities.map((group) => (
            <View key={`${group.id}-${group.name}`} style={[styles.activityCard, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
              <View style={styles.rowBetween}>
                <View style={styles.cardCopy}>
                  <Text style={[styles.activityTitle, { color: theme.text }]}>{group.name}</Text>
                  <Text style={[styles.activityMeta, { color: theme.subText }]}>Max {wholeNumber(group.max_marks)} | Order {group.sort_order || 0}</Text>
                </View>
                <StatusBadge value={statusValue(group)} />
              </View>

              <View style={styles.scopeWrap}>
                {group.rows.map((row) => (
                  <View key={row.id} style={[styles.scopePill, { borderColor: theme.border, backgroundColor: theme.card }]}>
                    <Text style={[styles.scopePillText, { color: theme.text }]}>{scopeLabel(row)}</Text>
                  </View>
                ))}
              </View>

              {(canUpdate || canDelete) ? (
                <View style={styles.actionRow}>
                  {canUpdate ? (
                    <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => openEdit(group)}>
                      <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Edit</Text>
                    </Pressable>
                  ) : null}
                  {canDelete ? (
                    <Pressable style={[styles.secondaryBtn, { borderColor: theme.dangerBorder, backgroundColor: theme.dangerSoft }]} onPress={() => setDeleteTarget(group)}>
                      <Text style={[styles.secondaryBtnText, { color: theme.danger }]}>Delete</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
          {!groupedActivities.length ? <Text style={[styles.emptyText, { color: theme.subText }]}>No activities found.</Text> : null}
        </SectionCard>
      </ScrollView>

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]} onPress={() => setFormOpen(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{editingGroup ? "Edit Activity" : "Add Activity"}</Text>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Name</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
                value={form.name}
                onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
                placeholder="Activity name"
                placeholderTextColor={theme.mutedText}
              />

              <SelectField
                label="Class Scope"
                value={form.class_id === null ? "" : String(form.class_id)}
                onChange={(value) => setForm((prev) => ({ ...prev, class_id: value ? Number(value) : null, section_id: null }))}
                options={classes.map((item) => ({ label: item.name, value: String(item.id) }))}
                placeholder="All classes"
                allowClear
                clearLabel="All classes"
              />

              <SelectField
                label="Section Scope"
                value={form.section_id === null ? "" : String(form.section_id)}
                onChange={(value) => setForm((prev) => ({ ...prev, section_id: value ? Number(value) : null }))}
                options={(selectedClass?.sections || []).map((section) => ({
                  label: `${section.name}${section.medium ? ` (${section.medium})` : ""}`,
                  value: String(section.id),
                }))}
                placeholder={selectedClass ? "All sections" : "Select a class first"}
                allowClear
                clearLabel="All sections"
                disabled={!selectedClass}
              />

              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Max Marks</Text>
                  <TextInput
                    style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
                    value={form.max_marks}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, max_marks: value.replace(/\D/g, "") }))}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Order</Text>
                  <TextInput
                    style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
                    value={form.sort_order}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, sort_order: value.replace(/\D/g, "") }))}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Pressable
                style={[styles.checkRow, { borderColor: form.is_active ? theme.primary : theme.border, backgroundColor: theme.cardMuted }]}
                onPress={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
              >
                <View style={[styles.checkboxBox, { borderColor: form.is_active ? theme.primary : theme.border, backgroundColor: form.is_active ? theme.primary : "transparent" }]} />
                <Text style={[styles.checkText, { color: theme.text }]}>Active</Text>
              </Pressable>
            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setFormOpen(false)} disabled={saving}>
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, { backgroundColor: theme.primary }, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
                <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>{saving ? "Saving..." : editingGroup ? "Update" : "Create"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]} onPress={() => setDeleteTarget(null)} />
          <View style={[styles.confirmCard, { backgroundColor: theme.card, borderColor: theme.dangerBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Delete Activity</Text>
            <Text style={[styles.confirmText, { color: theme.subText }]}>This will delete all scoped rows for {deleteTarget?.name || "this activity"}.</Text>
            <View style={styles.modalFooter}>
              <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setDeleteTarget(null)} disabled={saving}>
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.secondaryBtn, { borderColor: theme.dangerBorder, backgroundColor: theme.dangerSoft }, saving && styles.disabled]} onPress={handleDelete} disabled={saving}>
                <Text style={[styles.secondaryBtnText, { color: theme.danger }]}>{saving ? "Deleting..." : "Delete"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  topNoticeOverlay: { position: "absolute", top: 0, left: 14, right: 14, zIndex: 20 },
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 120, gap: 14 },
  hero: { gap: 12 },
  heroCopy: { gap: 5 },
  eyebrow: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  title: { fontSize: 22, fontWeight: "800" },
  subtitle: { lineHeight: 20 },
  sectionCard: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  sectionHint: { fontSize: 12, fontWeight: "700" },
  activityCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 9 },
  cardCopy: { flex: 1, minWidth: 0, gap: 2 },
  activityTitle: { fontSize: 16, fontWeight: "800" },
  activityMeta: { fontSize: 12.5, fontWeight: "600" },
  scopeWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  scopePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  scopePillText: { fontSize: 12, fontWeight: "700" },
  statusBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: "700" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  primaryBtn: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  primaryBtnText: { fontWeight: "700" },
  secondaryBtn: { minHeight: 42, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, alignItems: "center", justifyContent: "center", flex: 1 },
  secondaryBtnText: { fontWeight: "700" },
  emptyText: { lineHeight: 20 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalCard: { maxHeight: "86%", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, marginBottom: 12, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  modalBody: { maxHeight: 540 },
  modalFooter: { flexDirection: "row", gap: 10, marginTop: 10 },
  inputLabel: { marginTop: 8, marginBottom: 6, fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11 },
  inputRow: { flexDirection: "row", gap: 10 },
  inputHalf: { flex: 1 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, marginTop: 10 },
  checkboxBox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1 },
  checkText: { fontWeight: "700" },
  confirmCard: { marginHorizontal: 18, marginBottom: 100, borderWidth: 1, borderRadius: 22, padding: 18, gap: 10 },
  confirmText: { lineHeight: 20 },
  disabled: { opacity: 0.55 },
});

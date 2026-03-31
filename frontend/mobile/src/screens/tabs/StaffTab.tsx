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
  Image,
} from "react-native";
import {
  createStaff,
  deleteStaff,
  getStaffList,
  resolveStaffImageUrl,
  updateStaff,
  type StaffItem,
} from "../../services/staffService";
import TopNotice from "../../components/feedback/TopNotice";
import { getUsers, type UserListItem } from "../../services/usersService";
import { useAuthStore } from "../../store/authStore";

type NoticeTone = "success" | "error";
type StaffSection = "head" | "teaching" | "non_teaching";
type StaffType = "school" | "college";

const SECTION_OPTIONS: Array<{ label: string; value: StaffSection }> = [
  { label: "Head Staff", value: "head" },
  { label: "Teaching Staff", value: "teaching" },
  { label: "Non Teaching Staff", value: "non_teaching" },
];

const TYPE_OPTIONS: Array<{ label: string; value: StaffType }> = [
  { label: "School", value: "school" },
  { label: "College", value: "college" },
];

const EMPTY_FORM = {
  user_id: "",
  image_url: "",
  name: "",
  section: "head" as StaffSection,
  type: "school" as StaffType,
};

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err && "response" in err) {
    const data = (err as { response?: { data?: { message?: string; error?: string } } }).response?.data;
    return data?.error || data?.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function noticeToneStyle(tone: NoticeTone) {
  return tone === "success"
    ? { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4" }
    : { borderColor: "#fecaca", backgroundColor: "#fef2f2" };
}

function summaryCardTone(tone: "default" | "green" | "amber" | "violet") {
  if (tone === "green") return { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4" };
  if (tone === "amber") return { borderColor: "#fde68a", backgroundColor: "#fffbeb" };
  if (tone === "violet") return { borderColor: "#ddd6fe", backgroundColor: "#f5f3ff" };
  return { borderColor: "#e2e8f0", backgroundColor: "#ffffff" };
}

function summaryValueTone(tone: "default" | "green" | "amber" | "violet") {
  if (tone === "green") return { color: "#15803d" };
  if (tone === "amber") return { color: "#b45309" };
  if (tone === "violet") return { color: "#6d28d9" };
  return { color: "#0f172a" };
}

function formatSectionLabel(value?: string | null) {
  return SECTION_OPTIONS.find((item) => item.value === value)?.label || "Head Staff";
}

function getUserLabel(user: UserListItem) {
  return `#${user.id} ${user.username || user.email || user.phone || "Staff User"}`;
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "green" | "amber" | "violet";
}) {
  return (
    <View style={[styles.summaryCard, summaryCardTone(tone)]}>
      <Text style={[styles.summaryValue, summaryValueTone(tone)]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipWrap}>
        {options.map((item) => {
          const active = value === item.value;
          return (
            <Pressable
              key={`${label}-${item.value || "all"}`}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(item.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function StaffTab() {
  const user = useAuthStore((state) => state.user);
  const canManageStaff = Boolean(user?.permissions?.includes("dashboard.view"));

  const [rows, setRows] = useState<StaffItem[]>([]);
  const [staffUsers, setStaffUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string; tone: NoticeTone } | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentForm, setCurrentForm] = useState(EMPTY_FORM);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [deletingRow, setDeletingRow] = useState<StaffItem | null>(null);

  useEffect(() => {
    loadStaff();
    if (canManageStaff) loadStaffUsers();
  }, [canManageStaff]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter && row.type !== typeFilter) return false;
      if (sectionFilter && row.section !== sectionFilter) return false;
      if (!query) return true;
      return [row.name, row.type, formatSectionLabel(row.section)]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(query));
    });
  }, [rows, search, typeFilter, sectionFilter]);

  const headCount = filteredRows.filter((row) => row.section === "head").length;
  const teachingCount = filteredRows.filter((row) => row.section === "teaching").length;
  const nonTeachingCount = filteredRows.filter((row) => row.section === "non_teaching").length;

  async function loadStaff() {
    setLoading(true);
    try {
      setRows(await getStaffList());
    } catch (err: unknown) {
      Alert.alert("Staff unavailable", getErrorMessage(err, "Failed to load staff."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadStaffUsers() {
    try {
      const res = await getUsers({ role: "staff", limit: 50 });
      setStaffUsers(Array.isArray(res.data) ? res.data : []);
    } catch {
      setStaffUsers([]);
    }
  }

  async function refreshCurrentTab() {
    setRefreshing(true);
    try {
      await loadStaff();
      if (canManageStaff) await loadStaffUsers();
    } finally {
      setRefreshing(false);
    }
  }

  function showNotice(title: string, message: string, tone: NoticeTone = "success") {
    setNotice({ title, message, tone });
  }

  function resetForm() {
    setCurrentForm(EMPTY_FORM);
    setEditingRowId(null);
  }

  function validateForm() {
    if (!currentForm.name.trim()) return "Name is required.";
    if (!currentForm.image_url.trim()) return "Image URL is required.";
    return "";
  }

  async function handleSave() {
    const error = validateForm();
    if (error) {
      showNotice("Validation", error, "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: currentForm.user_id || null,
        image_url: currentForm.image_url.trim(),
        name: currentForm.name.trim(),
        section: currentForm.section,
        type: currentForm.type,
      };

      if (editingRowId) {
        await updateStaff(editingRowId, payload);
        showNotice("Staff Updated", "Staff record updated successfully.");
      } else {
        await createStaff(payload);
        showNotice("Staff Added", "Staff record created successfully.");
      }

      setCreateOpen(false);
      setEditOpen(false);
      resetForm();
      await loadStaff();
    } catch (err: unknown) {
      showNotice("Save Failed", getErrorMessage(err, "Failed to save staff."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingRow?.id) return;
    try {
      await deleteStaff(deletingRow.id);
      setDeletingRow(null);
      showNotice("Staff Deleted", "Staff record deleted successfully.");
      await loadStaff();
    } catch (err: unknown) {
      showNotice("Delete Failed", getErrorMessage(err, "Failed to delete staff."), "error");
    }
  }

  function openEdit(row: StaffItem) {
    setEditingRowId(row.id);
    setCurrentForm({
      user_id: row.user_id ? String(row.user_id) : "",
      image_url: row.image_url || "",
      name: row.name || "",
      section: row.section || "head",
      type: row.type || "school",
    });
    setEditOpen(true);
  }

  const selfRow = rows[0] || null;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshCurrentTab} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>{canManageStaff ? "Staff" : "My Staff Profile"}</Text>
        <Text style={styles.heroSubtitle}>
          {canManageStaff
            ? "Manage staff records, linked staff users, and profile details with the live backend staff module."
            : "View your linked staff profile from the live backend staff module."}
        </Text>
      </View>

      <TopNotice notice={notice} />

      {canManageStaff ? (
        <>
          <View style={styles.summaryGrid}>
            <SummaryCard label="Visible Staff" value={filteredRows.length} />
            <SummaryCard label="Head Staff" value={headCount} tone="violet" />
            <SummaryCard label="Teaching" value={teachingCount} tone="green" />
            <SummaryCard label="Non Teaching" value={nonTeachingCount} tone="amber" />
          </View>

          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.sectionTitle}>Staff Workspace</Text>
                <Text style={styles.muted}>Filter staff records, add new entries, and update linked staff profiles.</Text>
              </View>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  resetForm();
                  setCreateOpen(true);
                }}
              >
                <Text style={styles.primaryBtnText}>Add Staff</Text>
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Search</Text>
            <TextInput
              style={styles.input}
              placeholder="Search staff name or section"
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
            />

            <FilterGroup
              label="Campus"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[{ label: "All", value: "" }, ...TYPE_OPTIONS]}
            />

            <FilterGroup
              label="Section"
              value={sectionFilter}
              onChange={setSectionFilter}
              options={[{ label: "All", value: "" }, ...SECTION_OPTIONS]}
            />

            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                setSearch("");
                setTypeFilter("");
                setSectionFilter("");
              }}
            >
              <Text style={styles.secondaryBtnText}>Reset Filters</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Staff Directory</Text>
            <Text style={styles.muted}>Manage section, campus, image link, and linked staff user from one list.</Text>

            {loading ? (
              <ActivityIndicator size="small" color="#0f172a" />
            ) : filteredRows.length ? (
              filteredRows.map((row) => {
                const imageUri = resolveStaffImageUrl(row.image_url);
                return (
                  <View key={row.id} style={styles.staffCard}>
                    <View style={styles.staffHeader}>
                      {imageUri ? <Image source={{ uri: imageUri }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder}><Text style={styles.avatarPlaceholderText}>{row.name?.charAt(0)?.toUpperCase() || "S"}</Text></View>}
                      <View style={styles.staffCopy}>
                        <Text style={styles.staffName}>{row.name}</Text>
                        <Text style={styles.muted}>#{row.id} • {formatSectionLabel(row.section)}</Text>
                        <Text style={styles.muted}>{row.type === "college" ? "College" : "School"}</Text>
                      </View>
                    </View>
                    <InfoRow label="Linked User" value={row.user_id ? String(row.user_id) : "-"} />
                    <InfoRow label="Image URL" value={row.image_url || "-"} />
                    <View style={styles.actionRow}>
                      <Pressable style={styles.secondaryBtn} onPress={() => openEdit(row)}>
                        <Text style={styles.secondaryBtnText}>Edit</Text>
                      </Pressable>
                      <Pressable style={styles.deleteBtn} onPress={() => setDeletingRow(row)}>
                        <Text style={styles.deleteBtnText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.muted}>No staff records found for the current filters.</Text>
            )}
          </View>
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Linked Staff Profile</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#0f172a" />
          ) : selfRow ? (
            <>
              {resolveStaffImageUrl(selfRow.image_url) ? (
                <Image source={{ uri: resolveStaffImageUrl(selfRow.image_url)! }} style={styles.profileImage} />
              ) : null}
              <Text style={styles.profileName}>{selfRow.name}</Text>
              <InfoRow label="Campus" value={selfRow.type === "college" ? "College" : "School"} />
              <InfoRow label="Section" value={formatSectionLabel(selfRow.section)} />
              <InfoRow label="Linked User" value={selfRow.user_id ? String(selfRow.user_id) : "-"} />
            </>
          ) : (
            <Text style={styles.muted}>Staff profile not found. Link this account to a staff record first.</Text>
          )}
        </View>
      )}

      <Modal visible={createOpen || editOpen} transparent animationType="slide" onRequestClose={() => {
        setCreateOpen(false);
        setEditOpen(false);
      }}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => {
            setCreateOpen(false);
            setEditOpen(false);
          }} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingRowId ? "Edit Staff" : "Add Staff"}</Text>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.muted}>
                {editingRowId
                  ? "Update the staff record, linked user, section, campus, or image URL."
                  : "Create a staff record with a linked user, campus, section, and image URL."}
              </Text>

              <Text style={styles.inputLabel}>Name</Text>
              <TextInput style={styles.input} value={currentForm.name} onChangeText={(value) => setCurrentForm((prev) => ({ ...prev, name: value }))} />

              <Text style={styles.inputLabel}>Image URL</Text>
              <TextInput
                style={styles.input}
                value={currentForm.image_url}
                onChangeText={(value) => setCurrentForm((prev) => ({ ...prev, image_url: value }))}
                placeholder="https://... or /uploads/..."
                placeholderTextColor="#94a3b8"
              />

              <FilterGroup
                label="Campus"
                value={currentForm.type}
                onChange={(value) => setCurrentForm((prev) => ({ ...prev, type: value as StaffType }))}
                options={TYPE_OPTIONS}
              />

              <FilterGroup
                label="Section"
                value={currentForm.section}
                onChange={(value) => setCurrentForm((prev) => ({ ...prev, section: value as StaffSection }))}
                options={SECTION_OPTIONS}
              />

              <FilterGroup
                label="Linked Staff User"
                value={currentForm.user_id}
                onChange={(value) => setCurrentForm((prev) => ({ ...prev, user_id: value }))}
                options={[
                  { label: "No Linked User", value: "" },
                  ...staffUsers.map((user) => ({ label: getUserLabel(user), value: String(user.id) })),
                ]}
              />
            </ScrollView>

            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryBtn} onPress={() => {
                setCreateOpen(false);
                setEditOpen(false);
              }}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={handleSave} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? "Saving..." : editingRowId ? "Update Staff" : "Create Staff"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!deletingRow} transparent animationType="fade" onRequestClose={() => setDeletingRow(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setDeletingRow(null)} />
          <View style={styles.confirmCard}>
            <Text style={styles.modalTitle}>Delete staff record?</Text>
            <Text style={styles.muted}>
              {deletingRow ? `This will delete ${deletingRow.name} and remove the staff record.` : "This action cannot be undone."}
            </Text>
            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryBtn} onPress={() => setDeletingRow(null)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.deleteBtn} onPress={handleDelete}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingBottom: 120 },
  heroCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 24, backgroundColor: "#ffffff", padding: 18, gap: 6 },
  heroTitle: { color: "#0f172a", fontWeight: "800", fontSize: 22 },
  heroSubtitle: { color: "#64748b", lineHeight: 20 },
  noticeCard: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  noticeTitle: { color: "#0f172a", fontWeight: "800", marginBottom: 2 },
  noticeMessage: { color: "#475569" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { width: "48%", minHeight: 84, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, justifyContent: "space-between" },
  summaryValue: { fontSize: 24, fontWeight: "800" },
  summaryLabel: { color: "#64748b", fontSize: 12, fontWeight: "700" },
  card: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 22, backgroundColor: "#ffffff", padding: 16, gap: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  headerCopy: { flex: 1, gap: 4 },
  sectionTitle: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  muted: { color: "#64748b", fontSize: 12 },
  inputLabel: { color: "#334155", fontWeight: "700", fontSize: 12 },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, backgroundColor: "#ffffff", paddingHorizontal: 12, paddingVertical: 11, color: "#0f172a" },
  filterGroup: { gap: 8 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f8fafc" },
  chipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  chipText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#ffffff" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  primaryBtn: { backgroundColor: "#0f172a", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "#ffffff", fontWeight: "700" },
  secondaryBtn: { borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: "#334155", fontWeight: "700" },
  deleteBtn: { borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fee2e2", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  deleteBtnText: { color: "#b91c1c", fontWeight: "700" },
  staffCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16, backgroundColor: "#f8fafc", padding: 12, gap: 10 },
  staffHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
  avatar: { width: 56, height: 56, borderRadius: 16, backgroundColor: "#e2e8f0" },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 16, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  avatarPlaceholderText: { color: "#334155", fontWeight: "800", fontSize: 20 },
  staffCopy: { flex: 1, gap: 2 },
  staffName: { color: "#0f172a", fontWeight: "700", fontSize: 15 },
  infoRow: { gap: 3 },
  infoLabel: { color: "#64748b", fontSize: 12, textTransform: "uppercase" },
  infoValue: { color: "#0f172a", fontWeight: "600" },
  profileImage: { width: 108, height: 108, borderRadius: 24, alignSelf: "center", backgroundColor: "#e2e8f0" },
  profileName: { color: "#0f172a", fontWeight: "800", fontSize: 20, textAlign: "center" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.35)" },
  modalCard: { maxHeight: "86%", backgroundColor: "#ffffff", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, gap: 12 },
  modalTitle: { color: "#0f172a", fontWeight: "800", fontSize: 18 },
  modalBody: { maxHeight: 500 },
  confirmCard: { marginHorizontal: 16, marginBottom: 24, borderRadius: 22, backgroundColor: "#ffffff", padding: 16, gap: 12 },
});

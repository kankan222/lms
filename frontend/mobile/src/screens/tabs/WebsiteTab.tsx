import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createWebsiteStaff,
  deleteWebsiteStaff,
  getWebsiteContactSubmissions,
  getWebsiteStaff,
  resolveWebsiteImageUrl,
  updateWebsiteStaff,
  type WebsiteCampus,
  type WebsiteContactSubmission,
  type WebsiteSection,
  type WebsiteStaffItem,
} from "../../services/websiteService";
import TopNotice from "../../components/feedback/TopNotice";
import { useAuthStore } from "../../store/authStore";

type NoticeTone = "success" | "error";
type WebsiteTabKey = "school" | "college" | "contact";

const SECTION_OPTIONS: Array<{ label: string; value: WebsiteSection }> = [
  { label: "Head Staff", value: "head" },
  { label: "Teaching Staff", value: "teaching" },
  { label: "Non Teaching Staff", value: "non_teaching" },
];

const EMPTY_FORM = {
  name: "",
  section: "head" as WebsiteSection,
  type: "school" as WebsiteCampus,
  image_url: "",
};

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err && "response" in err) {
    const data = (err as { response?: { data?: { message?: string; error?: string } } }).response?.data;
    return data?.error || data?.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
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
              key={`${label}-${item.value}`}
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

export default function WebsiteTab() {
  const user = useAuthStore((state) => state.user);
  const canManageWebsite = Boolean(user?.permissions?.includes("dashboard.view"));

  const [activeTab, setActiveTab] = useState<WebsiteTabKey>("school");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ title: string; message: string; tone: NoticeTone } | null>(null);
  const [rows, setRows] = useState<WebsiteStaffItem[]>([]);
  const [contactRows, setContactRows] = useState<WebsiteContactSubmission[]>([]);

  const [singleOpen, setSingleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [currentForm, setCurrentForm] = useState(EMPTY_FORM);
  const [sectionFilter, setSectionFilter] = useState("");
  const [deletingRow, setDeletingRow] = useState<WebsiteStaffItem | null>(null);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  const filteredRows = useMemo(() => {
    if (activeTab === "contact") return [];
    return rows.filter((row) => !sectionFilter || row.section === sectionFilter);
  }, [rows, sectionFilter, activeTab]);

  const groupedCounts = useMemo(() => {
    return SECTION_OPTIONS.reduce<Record<WebsiteSection, number>>(
      (acc, option) => {
        acc[option.value] = filteredRows.filter((row) => row.section === option.value).length;
        return acc;
      },
      { head: 0, teaching: 0, non_teaching: 0 },
    );
  }, [filteredRows]);

  async function loadTabData(tab: WebsiteTabKey) {
    setLoading(true);
    try {
      if (tab === "contact") {
        setContactRows(await getWebsiteContactSubmissions());
        setRows([]);
      } else {
        setRows(await getWebsiteStaff(tab));
        setContactRows([]);
      }
    } catch (err: unknown) {
      Alert.alert("Website module unavailable", getErrorMessage(err, "Failed to load website data."));
      setRows([]);
      setContactRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function refreshCurrentTab() {
    setRefreshing(true);
    try {
      await loadTabData(activeTab);
    } finally {
      setRefreshing(false);
    }
  }

  function showNotice(title: string, message: string, tone: NoticeTone = "success") {
    setNotice({ title, message, tone });
  }

  function resetForm(type: WebsiteCampus) {
    setCurrentForm({ ...EMPTY_FORM, type });
    setEditingRowId(null);
  }

  async function handleSave() {
    if (!currentForm.name.trim()) {
      showNotice("Validation", "Name is required.", "error");
      return;
    }
    if (!currentForm.image_url.trim()) {
      showNotice("Validation", "Image URL is required.", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: currentForm.name.trim(),
        section: currentForm.section,
        image_url: currentForm.image_url.trim(),
      };

      if (editingRowId) {
        await updateWebsiteStaff(editingRowId, currentForm.type, payload);
        showNotice("Staff Updated", "Website staff card updated successfully.");
      } else {
        await createWebsiteStaff(currentForm.type, payload);
        showNotice("Staff Added", "Website staff card created successfully.");
      }

      setSingleOpen(false);
      setEditOpen(false);
      resetForm(currentForm.type);
      if (activeTab !== currentForm.type) {
        setActiveTab(currentForm.type);
      } else {
        await loadTabData(activeTab);
      }
    } catch (err: unknown) {
      showNotice("Save Failed", getErrorMessage(err, "Failed to save website staff."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingRow?.id) return;
    try {
      await deleteWebsiteStaff(deletingRow.id, deletingRow.type);
      setDeletingRow(null);
      showNotice("Staff Deleted", "Website staff card deleted successfully.");
      await loadTabData(activeTab);
    } catch (err: unknown) {
      showNotice("Delete Failed", getErrorMessage(err, "Failed to delete website staff."), "error");
    }
  }

  function openEdit(row: WebsiteStaffItem) {
    setEditingRowId(row.id);
    setCurrentForm({
      name: row.name,
      section: row.section,
      type: row.type,
      image_url: row.image_url || "",
    });
    setEditOpen(true);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshCurrentTab} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Website Module</Text>
        <Text style={styles.heroSubtitle}>
          Manage school and college website staff cards and review contact form submissions from the live backend website APIs.
        </Text>
      </View>

      <TopNotice notice={notice} />

      <View style={styles.tabsRow}>
        {(["school", "college", "contact"] as WebsiteTabKey[]).map((tab) => {
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              style={[styles.tabChip, active && styles.tabChipActive]}
              onPress={() => {
                setActiveTab(tab);
                setSectionFilter("");
              }}
            >
              <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{capitalize(tab === "contact" ? "contact" : tab)}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === "contact" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact Submissions</Text>
          <Text style={styles.muted}>Review contact requests submitted from the public website.</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#0f172a" />
          ) : contactRows.length ? (
            contactRows.map((row) => (
              <View key={row.id} style={styles.contactCard}>
                <Text style={styles.contactName}>{row.name}</Text>
                <Text style={styles.muted}>{row.contact_number}</Text>
                <Text style={styles.contactMessage}>{row.message || "No message provided."}</Text>
                <Text style={styles.contactMeta}>{formatDateTime(row.created_at)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>No contact submissions found.</Text>
          )}
        </View>
      ) : (
        <>
          <View style={styles.summaryGrid}>
            <SummaryCard label="Visible Cards" value={filteredRows.length} />
            <SummaryCard label="Head Staff" value={groupedCounts.head} tone="violet" />
            <SummaryCard label="Teaching" value={groupedCounts.teaching} tone="green" />
            <SummaryCard label="Non Teaching" value={groupedCounts.non_teaching} tone="amber" />
          </View>

          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.sectionTitle}>{capitalize(activeTab)} Website Staff</Text>
                <Text style={styles.muted}>Manage staff cards shown on the public website for this campus.</Text>
              </View>
              {canManageWebsite ? (
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => {
                    resetForm(activeTab);
                    setSingleOpen(true);
                  }}
                >
                  <Text style={styles.primaryBtnText}>Add Staff</Text>
                </Pressable>
              ) : null}
            </View>

            <FilterGroup
              label="Section"
              value={sectionFilter}
              onChange={setSectionFilter}
              options={[{ label: "All", value: "" }, ...SECTION_OPTIONS]}
            />

            {loading ? (
              <ActivityIndicator size="small" color="#0f172a" />
            ) : filteredRows.length ? (
              filteredRows.map((row) => {
                const imageUri = resolveWebsiteImageUrl(row.image_url);
                return (
                  <View key={row.id} style={styles.staffCard}>
                    {imageUri ? <Image source={{ uri: imageUri }} style={styles.staffImage} /> : null}
                    <Text style={styles.staffName}>{row.name}</Text>
                    <Text style={styles.muted}>{SECTION_OPTIONS.find((item) => item.value === row.section)?.label || row.section}</Text>
                    <Text style={styles.muted}>{capitalize(row.type)}</Text>
                    {canManageWebsite ? (
                      <View style={styles.actionRow}>
                        <Pressable style={styles.secondaryBtn} onPress={() => openEdit(row)}>
                          <Text style={styles.secondaryBtnText}>Edit</Text>
                        </Pressable>
                        <Pressable style={styles.deleteBtn} onPress={() => setDeletingRow(row)}>
                          <Text style={styles.deleteBtnText}>Delete</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <Text style={styles.muted}>No website staff cards found.</Text>
            )}
          </View>
        </>
      )}

      <Modal visible={singleOpen || editOpen} transparent animationType="slide" onRequestClose={() => {
        setSingleOpen(false);
        setEditOpen(false);
      }}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => {
            setSingleOpen(false);
            setEditOpen(false);
          }} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingRowId ? "Edit Website Staff" : "Add Website Staff"}</Text>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.muted}>
                {editingRowId
                  ? "Update the name, section, campus, or image URL for this website card."
                  : "Create a website staff card for the public school or college site."}
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
                onChange={(value) => setCurrentForm((prev) => ({ ...prev, type: value as WebsiteCampus }))}
                options={[
                  { label: "School", value: "school" },
                  { label: "College", value: "college" },
                ]}
              />

              <FilterGroup
                label="Section"
                value={currentForm.section}
                onChange={(value) => setCurrentForm((prev) => ({ ...prev, section: value as WebsiteSection }))}
                options={SECTION_OPTIONS}
              />
            </ScrollView>

            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryBtn} onPress={() => {
                setSingleOpen(false);
                setEditOpen(false);
              }}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={handleSave} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? "Saving..." : editingRowId ? "Update" : "Create"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!deletingRow} transparent animationType="fade" onRequestClose={() => setDeletingRow(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setDeletingRow(null)} />
          <View style={styles.confirmCard}>
            <Text style={styles.modalTitle}>Delete staff card?</Text>
            <Text style={styles.muted}>
              {deletingRow ? `This will delete ${deletingRow.name} from the website staff list.` : "This action cannot be undone."}
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

const styles = StyleSheet.create({
  container: { gap: 14, paddingBottom: 24 },
  heroCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 24, backgroundColor: "#ffffff", padding: 18, gap: 6 },
  heroTitle: { color: "#0f172a", fontWeight: "800", fontSize: 22 },
  heroSubtitle: { color: "#64748b", lineHeight: 20 },
  noticeCard: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  noticeTitle: { color: "#0f172a", fontWeight: "800", marginBottom: 2 },
  noticeMessage: { color: "#475569" },
  tabsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tabChip: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#ffffff" },
  tabChipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  tabChipText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  tabChipTextActive: { color: "#ffffff" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { width: "48%", minHeight: 84, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, justifyContent: "space-between" },
  summaryValue: { fontSize: 24, fontWeight: "800" },
  summaryLabel: { color: "#64748b", fontSize: 12, fontWeight: "700" },
  card: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 22, backgroundColor: "#ffffff", padding: 16, gap: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  headerCopy: { flex: 1, gap: 4 },
  sectionTitle: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  muted: { color: "#64748b", fontSize: 12 },
  filterGroup: { gap: 8 },
  inputLabel: { color: "#334155", fontWeight: "700", fontSize: 12 },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, backgroundColor: "#ffffff", paddingHorizontal: 12, paddingVertical: 11, color: "#0f172a" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f8fafc" },
  chipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  chipText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#ffffff" },
  primaryBtn: { backgroundColor: "#0f172a", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "#ffffff", fontWeight: "700" },
  secondaryBtn: { borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: "#334155", fontWeight: "700" },
  deleteBtn: { borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fee2e2", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  deleteBtnText: { color: "#b91c1c", fontWeight: "700" },
  staffCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 18, backgroundColor: "#f8fafc", padding: 12, gap: 8 },
  staffImage: { width: "100%", height: 180, borderRadius: 14, backgroundColor: "#e2e8f0" },
  staffName: { color: "#0f172a", fontWeight: "700", fontSize: 15 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  contactCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16, backgroundColor: "#f8fafc", padding: 12, gap: 6 },
  contactName: { color: "#0f172a", fontWeight: "700", fontSize: 15 },
  contactMessage: { color: "#334155", lineHeight: 18 },
  contactMeta: { color: "#64748b", fontSize: 12 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.35)" },
  modalCard: { maxHeight: "86%", backgroundColor: "#ffffff", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, gap: 12 },
  modalTitle: { color: "#0f172a", fontWeight: "800", fontSize: 18 },
  modalBody: { maxHeight: 500 },
  confirmCard: { marginHorizontal: 16, marginBottom: 24, borderRadius: 22, backgroundColor: "#ffffff", padding: 16, gap: 12 },
});

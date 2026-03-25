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
import { useAuthStore } from "../../store/authStore";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { getClassStructure, getSessions } from "../../services/classesService";
import DateField from "../../components/form/DateField";
import SelectField from "../../components/form/SelectField";
import {
  createFeeStructure,
  createInstallment,
  deleteFeeStructure,
  deleteInstallment,
  FeeStructure,
  getAllFeeStructures,
  updateFeeStructure,
  updateInstallment,
} from "../../services/feesService";
import { formatDateLabel } from "../../utils/format";

type ClassItem = {
  id: number;
  name: string;
  class_scope?: "school" | "hs";
  sections?: Array<{ id: number; name: string; medium?: string | null }>;
};

type SessionItem = {
  id: number;
  name: string;
  is_active?: boolean | number;
};

type NoticeState = {
  tone: "success" | "error";
  title: string;
  message: string;
} | null;

type FeeFormState = {
  class_id: number | null;
  session_id: number | null;
  admission_fee: string;
};

type InstallmentFormState = {
  fee_structure_id: number | null;
  installment_name: string;
  amount: string;
  due_date: string;
};

const EMPTY_FEE_FORM: FeeFormState = {
  class_id: null,
  session_id: null,
  admission_fee: "",
};

const EMPTY_INSTALLMENT_FORM: InstallmentFormState = {
  fee_structure_id: null,
  installment_name: "",
  amount: "",
  due_date: "",
};

const DEFAULT_THEME = {
  isDark: false,
  bg: "#f8fafc",
  card: "#ffffff",
  cardMuted: "#f8fafc",
  text: "#0f172a",
  subText: "#64748b",
  mutedText: "#94a3b8",
  border: "#e2e8f0",
  inputBg: "#ffffff",
  overlay: "rgba(15, 23, 42, 0.28)",
  icon: "#334155",
};
let currentTheme = DEFAULT_THEME;

function getErrorMessage(err: unknown, fallback: string) {
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

function formatScope(scope?: string | null) {
  return scope === "hs" ? "Higher Secondary" : "School";
}

function inferScopeFromClassName(className: string, classes: ClassItem[]) {
  return classes.find((item) => item.name === className)?.class_scope || "school";
}

function sumInstallments(fee: FeeStructure) {
  return (fee.installments || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function findEarliestDueDate(fee: FeeStructure) {
  const dated = (fee.installments || []).filter((item) => item.due_date);
  if (!dated.length) return null;
  return dated
    .map((item) => String(item.due_date))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
}

function SummaryCard({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: string | number;
  accent: string;
  tone: string;
}) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: accent }]}>
      <Text style={[styles.summaryValue, { color: tone }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ScopeBadge({ scope }: { scope?: string | null }) {
  const hs = scope === "hs";
  return (
    <View style={[styles.scopeBadge, hs ? styles.scopeBadgeHs : styles.scopeBadgeSchool]}>
      <Text style={[styles.scopeBadgeText, hs ? styles.scopeBadgeTextHs : styles.scopeBadgeTextSchool]}>
        {formatScope(scope)}
      </Text>
    </View>
  );
}

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

type FeeModalProps = {
  visible: boolean;
  title: string;
  submitLabel: string;
  saving: boolean;
  classes: ClassItem[];
  sessions: SessionItem[];
  activeSessionId: number | null;
  form: FeeFormState;
  editing: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onChange: (next: FeeFormState) => void;
};

function FeeStructureModal({
  visible,
  title,
  submitLabel,
  saving,
  classes,
  sessions,
  activeSessionId,
  form,
  editing,
  onClose,
  onSubmit,
  onChange,
}: FeeModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.inputLabel}>Admission Fee *</Text>
            <TextInput
              style={styles.input}
              value={form.admission_fee}
              onChangeText={(value) => onChange({ ...form, admission_fee: value })}
              placeholder="Amount"
              keyboardType="numeric"
              placeholderTextColor="#94a3b8"
            />

            {!editing ? (
              <>
                <SelectField
                  label="Class *"
                  value={form.class_id === null ? "" : String(form.class_id)}
                  onChange={(value) => onChange({ ...form, class_id: value ? Number(value) : null })}
                  options={classes.map((item) => ({ label: item.name, value: String(item.id) }))}
                  placeholder="Choose class"
                />

                <SelectField
                  label="Session *"
                  value={form.session_id === null ? "" : String(form.session_id)}
                  onChange={(value) => onChange({ ...form, session_id: value ? Number(value) : null })}
                  options={sessions.map((item) => ({
                    label: item.name,
                    value: String(item.id),
                    description: item.id === activeSessionId ? "Active session" : undefined,
                  }))}
                  placeholder="Choose session"
                />
              </>
            ) : null}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable style={styles.secondaryBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.successBtn} onPress={onSubmit} disabled={saving}>
              <Text style={styles.successBtnText}>{saving ? "Saving..." : submitLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type InstallmentModalProps = {
  visible: boolean;
  title: string;
  submitLabel: string;
  saving: boolean;
  form: InstallmentFormState;
  editing: boolean;
  fees: FeeStructure[];
  onClose: () => void;
  onSubmit: () => void;
  onChange: (next: InstallmentFormState) => void;
};

function InstallmentModal({
  visible,
  title,
  submitLabel,
  saving,
  form,
  editing,
  fees,
  onClose,
  onSubmit,
  onChange,
}: InstallmentModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {!editing ? (
              <>
                <Text style={styles.inputLabel}>Fee Structure *</Text>
                <View style={styles.dueItemWrap}>
                  {fees.map((item) => {
                    const active = form.fee_structure_id === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        style={[styles.dueItem, active && styles.dueItemActive]}
                        onPress={() => onChange({ ...form, fee_structure_id: item.id })}
                      >
                        <Text style={[styles.dueText, active && styles.dueTextActive]}>
                          {item.class_name}
                        </Text>
                        <Text style={[styles.dueSubText, active && styles.dueTextActive]}>
                          {item.session_name} - Admission Rs {Number(item.admission_fee || 0)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Text style={[styles.inputLabel, styles.spaceTop]}>Installment Name *</Text>
            <TextInput
              style={styles.input}
              value={form.installment_name}
              onChangeText={(value) => onChange({ ...form, installment_name: value })}
              placeholder="Installment name"
              placeholderTextColor="#94a3b8"
            />

            <Text style={[styles.inputLabel, styles.spaceTop]}>Amount *</Text>
            <TextInput
              style={styles.input}
              value={form.amount}
              onChangeText={(value) => onChange({ ...form, amount: value })}
              placeholder="Amount"
              keyboardType="numeric"
              placeholderTextColor="#94a3b8"
            />

            <DateField
              label="Due Date"
              value={form.due_date}
              onChange={(value) => onChange({ ...form, due_date: value })}
              placeholder="Select due date"
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable style={styles.secondaryBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.successBtn} onPress={onSubmit} disabled={saving}>
              <Text style={styles.successBtnText}>{saving ? "Saving..." : submitLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function FeesTab() {
  const { theme } = useAppTheme();
  currentTheme = theme;
  styles = useMemo(() => createStyles(theme), [theme]);
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions || [];
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const canManage = permissions.includes("fee.create");
  const isAccounts = roles.includes("accounts");

  const [fees, setFees] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"" | "school" | "hs">("");
  const [sessionFilter, setSessionFilter] = useState<number | null>(null);
  const [classFilter, setClassFilter] = useState<number | null>(null);
  const [sectionFilter, setSectionFilter] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [installmentModalOpen, setInstallmentModalOpen] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState<number | null>(null);
  const [editingInstallmentId, setEditingInstallmentId] = useState<number | null>(null);
  const [feeForm, setFeeForm] = useState<FeeFormState>(EMPTY_FEE_FORM);
  const [installmentForm, setInstallmentForm] = useState<InstallmentFormState>(EMPTY_INSTALLMENT_FORM);

  const activeSession = useMemo(
    () => sessions.find((item) => Number(item.is_active) === 1 || item.is_active === true) ?? null,
    [sessions],
  );

  const selectedFilterClass = useMemo(
    () => classes.find((item) => item.id === classFilter) ?? null,
    [classes, classFilter],
  );

  const feesWithScope = useMemo(
    () =>
      fees.map((fee) => ({
        ...fee,
        class_scope: fee.class_scope || inferScopeFromClassName(fee.class_name, classes),
      })),
    [fees, classes],
  );

  const filteredFees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return feesWithScope.filter((fee) => {
      const matchesSearch =
        !query ||
        `${fee.class_name || ""} ${fee.session_name || ""} ${fee.admission_fee || ""}`
          .toLowerCase()
          .includes(query);
      const matchesScope = !scopeFilter || fee.class_scope === scopeFilter;
      const matchesSession =
        !sessionFilter ||
        Number(fee.session_id) === sessionFilter ||
        sessions.find((item) => item.id === sessionFilter)?.name === fee.session_name;
      const feeClass =
        classes.find((item) => item.id === Number(fee.class_id)) ||
        classes.find((item) => item.name === fee.class_name) ||
        null;
      const matchesClass =
        !classFilter ||
        Number(fee.class_id) === classFilter ||
        feeClass?.id === classFilter;
      const matchesSection =
        !sectionFilter ||
        Boolean(feeClass?.sections?.some((section) => Number(section.id) === sectionFilter));
      return matchesSearch && matchesScope && matchesSession && matchesClass && matchesSection;
    });
  }, [classes, classFilter, feesWithScope, scopeFilter, search, sectionFilter, sessionFilter, sessions]);

  const stats = useMemo(() => {
    const structureCount = filteredFees.length;
    const installmentCount = filteredFees.reduce(
      (sum, fee) => sum + (Array.isArray(fee.installments) ? fee.installments.length : 0),
      0,
    );
    const admissionTotal = filteredFees.reduce((sum, fee) => sum + Number(fee.admission_fee || 0), 0);
    const installmentTotal = filteredFees.reduce((sum, fee) => sum + sumInstallments(fee), 0);
    return [
      { label: "Structures", value: structureCount, accent: "#dbeafe", tone: "#1d4ed8" },
      { label: "Installments", value: installmentCount, accent: "#dcfce7", tone: "#15803d" },
      { label: "Admission Base", value: `Rs ${admissionTotal}`, accent: "#fef3c7", tone: "#b45309" },
      { label: "Installment Base", value: `Rs ${installmentTotal}`, accent: "#ede9fe", tone: "#6d28d9" },
    ];
  }, [filteredFees]);

  useEffect(() => {
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (activeSession && feeForm.session_id === null && editingFeeId === null) {
      setFeeForm((prev) => ({ ...prev, session_id: activeSession.id }));
    }
  }, [activeSession, feeForm.session_id, editingFeeId]);

  async function loadBootstrap(mode: "initial" | "refresh" = "initial") {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);

    try {
      const [classRows, sessionRows, feeRows] = await Promise.all([
        getClassStructure(),
        getSessions(),
        getAllFeeStructures(),
      ]);

      setClasses(
        (classRows || []).map((item) => ({
          id: Number(item.id),
          name: item.name,
          class_scope: item.class_scope,
          sections: Array.isArray(item.sections) ? item.sections : [],
        })),
      );
      setSessions(
        (sessionRows || []).map((item) => ({
          id: Number(item.id),
          name: item.name,
          is_active: item.is_active,
        })),
      );
      setFees(feeRows || []);
    } catch (err: unknown) {
      Alert.alert("Load failed", getErrorMessage(err, "Could not load fee data."));
      setClasses([]);
      setSessions([]);
      setFees([]);
    } finally {
      if (mode === "refresh") setRefreshing(false);
      else setLoading(false);
    }
  }

  function showNotice(title: string, message: string, tone: "success" | "error" = "success") {
    setNotice({ title, message, tone });
  }

  function resetFeeForm() {
    setEditingFeeId(null);
    setFeeForm({
      class_id: null,
      session_id: activeSession?.id ?? null,
      admission_fee: "",
    });
  }

  function resetInstallmentForm() {
    setEditingInstallmentId(null);
    setInstallmentForm(EMPTY_INSTALLMENT_FORM);
  }

  function openCreateFeeModal() {
    resetFeeForm();
    setFeeModalOpen(true);
  }

  function openEditFeeModal(fee: FeeStructure) {
    setEditingFeeId(Number(fee.id));
    const matchedClass =
      classes.find((item) => Number(item.id) === Number(fee.class_id)) ||
      classes.find((item) => item.name === fee.class_name);
    const matchedSession =
      sessions.find((item) => Number(item.id) === Number(fee.session_id)) ||
      sessions.find((item) => item.name === fee.session_name);

    setFeeForm({
      class_id: matchedClass?.id ?? null,
      session_id: matchedSession?.id ?? null,
      admission_fee: String(fee.admission_fee ?? ""),
    });
    setFeeModalOpen(true);
  }

  function openCreateInstallmentModal() {
    resetInstallmentForm();
    setInstallmentModalOpen(true);
  }

  function openEditInstallmentModal(feeId: number, installment: FeeStructure["installments"][number]) {
    setEditingInstallmentId(Number(installment.id));
    setInstallmentForm({
      fee_structure_id: Number(feeId),
      installment_name: String(installment.installment_name ?? ""),
      amount: String(installment.amount ?? ""),
      due_date: installment.due_date ? String(installment.due_date).split("T")[0] : "",
    });
    setInstallmentModalOpen(true);
  }

  async function refreshFees() {
    try {
      const feeRows = await getAllFeeStructures();
      setFees(feeRows || []);
    } catch (err: unknown) {
      showNotice("Refresh Failed", getErrorMessage(err, "Could not refresh fee structures."), "error");
    }
  }

  function resetBrowseFilters() {
    setScopeFilter("");
    setSessionFilter(null);
    setClassFilter(null);
    setSectionFilter(null);
  }

  async function handleSaveFeeStructure() {
    const amount = Number(feeForm.admission_fee);
    if (!amount || amount <= 0) {
      return Alert.alert("Validation", "Admission fee must be a valid amount.");
    }
    if (!editingFeeId && (!feeForm.class_id || !feeForm.session_id)) {
      return Alert.alert("Validation", "Class and session are required.");
    }

    setSaving(true);
    try {
      if (editingFeeId) {
        await updateFeeStructure(editingFeeId, { admission_fee: amount });
      } else {
        await createFeeStructure({
          class_id: Number(feeForm.class_id),
          session_id: Number(feeForm.session_id),
          admission_fee: amount,
        });
      }
      await refreshFees();
      setFeeModalOpen(false);
      resetFeeForm();
      showNotice(
        editingFeeId ? "Fee Updated" : "Fee Created",
        editingFeeId ? "Fee structure updated successfully." : "Fee structure created successfully.",
      );
    } catch (err: unknown) {
      showNotice(
        editingFeeId ? "Update Failed" : "Create Failed",
        getErrorMessage(err, "Could not save fee structure."),
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteFeeStructure(fee: FeeStructure) {
    Alert.alert("Delete fee", `Delete fee for ${fee.class_name} (${fee.session_name})?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteFeeStructure(fee.id);
            await refreshFees();
            showNotice("Fee Deleted", "Fee structure deleted successfully.");
          } catch (err: unknown) {
            showNotice("Delete Failed", getErrorMessage(err, "Could not delete fee structure."), "error");
          }
        },
      },
    ]);
  }

  async function handleSaveInstallment() {
    const amount = Number(installmentForm.amount);
    if (!installmentForm.installment_name.trim() || !amount || amount <= 0) {
      return Alert.alert("Validation", "Installment name and valid amount are required.");
    }
    if (!editingInstallmentId && !installmentForm.fee_structure_id) {
      return Alert.alert("Validation", "Select a fee structure first.");
    }

    setSaving(true);
    try {
      if (editingInstallmentId) {
        await updateInstallment(editingInstallmentId, {
          installment_name: installmentForm.installment_name.trim(),
          amount,
          due_date: installmentForm.due_date || null,
        });
      } else {
        await createInstallment({
          fee_structure_id: Number(installmentForm.fee_structure_id),
          installment_name: installmentForm.installment_name.trim(),
          amount,
          due_date: installmentForm.due_date || undefined,
        });
      }
      await refreshFees();
      setInstallmentModalOpen(false);
      resetInstallmentForm();
      showNotice(
        editingInstallmentId ? "Installment Updated" : "Installment Created",
        editingInstallmentId ? "Installment updated successfully." : "Installment created successfully.",
      );
    } catch (err: unknown) {
      showNotice(
        editingInstallmentId ? "Update Failed" : "Create Failed",
        getErrorMessage(err, "Could not save installment."),
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteInstallment(installment: FeeStructure["installments"][number]) {
    Alert.alert("Delete installment", `Delete installment '${installment.installment_name}'?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteInstallment(installment.id);
            await refreshFees();
            showNotice("Installment Deleted", "Installment deleted successfully.");
          } catch (err: unknown) {
            showNotice("Delete Failed", getErrorMessage(err, "Could not delete installment."), "error");
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadBootstrap("refresh")} />}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>Fees</Text>
          <Text style={styles.subtitle}>
            {isAccounts
              ? "Review fee structures and installment plans from the finance workspace."
              : "Review fee structures, admission pricing, and installment plans from the live backend."}
          </Text>
        </View>
        <View style={styles.heroActions}>
            <Pressable style={styles.iconUtilityBtn} onPress={() => loadBootstrap("refresh")}>
              <Ionicons name="refresh-outline" size={18} color={theme.icon} />
            </Pressable>
          <View style={styles.heroPrimaryActions}>
            {canManage ? (
              <>
                <Pressable style={styles.secondaryBtnCompact} onPress={openCreateInstallmentModal}>
                  <Text style={styles.secondaryBtnText}>Add Installment</Text>
                </Pressable>
                <Pressable style={styles.primaryBtn} onPress={openCreateFeeModal}>
                  <Text style={styles.primaryBtnText}>Add Fee</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </View>

      <TopNotice notice={notice} />

      <View style={styles.summaryGrid}>
        {stats.map((item) => (
          <SummaryCard
            key={item.label}
            label={item.label}
            value={item.value}
            accent={item.accent}
            tone={item.tone}
          />
        ))}
      </View>

      <SectionCard title="Browse Structures" hint={`${filteredFees.length} visible`}>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, styles.searchInput]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search class, session, or amount"
            placeholderTextColor="#94a3b8"
          />
          <Pressable style={styles.iconUtilityBtn} onPress={() => setFiltersOpen(true)}>
            <Ionicons name="options-outline" size={18} color={theme.icon} />
          </Pressable>
        </View>

        {(scopeFilter || sessionFilter !== null || classFilter !== null || sectionFilter !== null) ? (
          <Text style={styles.activeFiltersText}>
            {scopeFilter ? `Scope: ${scopeFilter === "hs" ? "Higher Secondary" : "School"}` : "All scope"}
            {sessionFilter !== null ? ` - Session: ${sessions.find((item) => item.id === sessionFilter)?.name || "-"}` : ""}
            {classFilter !== null ? ` - Class: ${selectedFilterClass?.name || "-"}` : ""}
            {sectionFilter !== null ? ` - Section: ${selectedFilterClass?.sections?.find((section) => Number(section.id) === sectionFilter)?.name || "-"}` : ""}
          </Text>
        ) : null}
      </SectionCard>
      <Modal visible={filtersOpen} transparent animationType="fade" onRequestClose={() => setFiltersOpen(false)}>
        <View style={styles.popoverOverlay}>
          <Pressable style={styles.popoverBackdrop} onPress={() => setFiltersOpen(false)} />
          <View style={styles.filterPopover}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Filters</Text>
              <Pressable onPress={resetBrowseFilters}>
                <Text style={styles.resetText}>Reset</Text>
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Scope</Text>
            <View style={styles.chipWrap}>
              {[
                { label: "All Scope", value: "" },
                { label: "School", value: "school" },
                { label: "Higher Secondary", value: "hs" },
              ].map((item) => {
                const active = scopeFilter === item.value;
                return (
                  <Pressable
                    key={item.label}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setScopeFilter(item.value as "" | "school" | "hs")}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <SelectField
              label="Session"
              value={sessionFilter === null ? "" : String(sessionFilter)}
              onChange={(value) => setSessionFilter(value ? Number(value) : null)}
              options={sessions.map((item) => ({
                label: `${item.name}${Number(item.is_active) === 1 || item.is_active === true ? " - Active" : ""}`,
                value: String(item.id),
              }))}
              placeholder="All sessions"
              allowClear
              clearLabel="All sessions"
            />

            <SelectField
              label="Class"
              value={classFilter === null ? "" : String(classFilter)}
              onChange={(value) => {
                if (!value) {
                  setClassFilter(null);
                  setSectionFilter(null);
                  return;
                }
                setClassFilter(Number(value));
                setSectionFilter(null);
              }}
              options={classes.map((item) => ({ label: item.name, value: String(item.id) }))}
              placeholder="All classes"
              allowClear
              clearLabel="All classes"
            />

            <SelectField
              label="Section"
              value={sectionFilter === null ? "" : String(sectionFilter)}
              onChange={(value) => setSectionFilter(value ? Number(value) : null)}
              options={(selectedFilterClass?.sections || []).map((section) => ({
                label: `${section.name}${section.medium ? ` (${section.medium})` : ""}`,
                value: String(section.id),
              }))}
              placeholder="All sections"
              allowClear
              clearLabel="All sections"
              disabled={!selectedFilterClass}
            />


            <View style={styles.actionRow}>
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
      ) : filteredFees.length ? (
        <View style={styles.listContent}>
          {filteredFees.map((fee) => {
            const isExpanded = expandedId === fee.id;
            const earliestDue = findEarliestDueDate(fee);
            const installmentBase = sumInstallments(fee);
            return (
              <View key={fee.id} style={styles.feeCard}>
                <Pressable
                  style={styles.feeHeader}
                  onPress={() => setExpandedId(isExpanded ? null : fee.id)}
                >
                  <View style={styles.feeHeaderCopy}>
                    <View style={styles.rowBetween}>
                      <View style={styles.feeTitleWrap}>
                        <Text style={styles.feeTitle}>{fee.class_name}</Text>
                        <Text style={styles.metaCompact}>{fee.session_name}</Text>
                      </View>
                      <ScopeBadge scope={fee.class_scope} />
                    </View>
                    <View style={styles.metaStack}>
                      <Text style={styles.metaCompact}>Admission Rs {Number(fee.admission_fee || 0)}</Text>
                      <Text style={styles.metaCompact}>
                        {fee.installments?.length || 0} installment{fee.installments?.length === 1 ? "" : "s"} - Base Rs {installmentBase}
                      </Text>
                    </View>
                    {earliestDue ? <Text style={styles.metaCompact}>Next Due {formatDateLabel(earliestDue)}</Text> : null}
                  </View>
                  <Text style={styles.expandText}>{isExpanded ? "Hide" : "Show"}</Text>
                </Pressable>

                {canManage ? (
                  <View style={styles.actionRow}>
                    <Pressable style={styles.secondaryBtn} onPress={() => openEditFeeModal(fee)}>
                      <Text style={styles.secondaryBtnText}>Edit Fee</Text>
                    </Pressable>
                    <Pressable style={styles.deleteBtn} onPress={() => confirmDeleteFeeStructure(fee)}>
                      <Text style={styles.deleteBtnText}>Delete Fee</Text>
                    </Pressable>
                  </View>
                ) : null}

                {isExpanded ? (
                  <View style={styles.installmentsWrap}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.installmentsTitle}>Installments</Text>
                      <Text style={styles.sectionHint}>{fee.installments?.length || 0} rows</Text>
                    </View>
                    {fee.installments?.length ? (
                      fee.installments.map((installment) => (
                        <View key={installment.id} style={styles.installmentRow}>
                          <View style={styles.installmentInfo}>
                            <Text style={styles.installmentName}>{installment.installment_name}</Text>
                            <Text style={styles.installmentDate}>
                              Due: {formatDateLabel(installment.due_date)}
                            </Text>
                          </View>
                          <View style={styles.installmentRight}>
                            <Text style={styles.installmentAmount}>Rs {Number(installment.amount || 0)}</Text>
                            {canManage ? (
                              <View style={styles.installmentActions}>
                                <Pressable
                                  style={styles.installmentActionBtn}
                                  onPress={() => openEditInstallmentModal(fee.id, installment)}
                                >
                                  <Text style={styles.installmentActionText}>Edit</Text>
                                </Pressable>
                                <Pressable
                                  style={styles.installmentDeleteBtn}
                                  onPress={() => confirmDeleteInstallment(installment)}
                                >
                                  <Text style={styles.installmentDeleteText}>Delete</Text>
                                </Pressable>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No installments added yet.</Text>
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No fee structures found</Text>
          <Text style={styles.emptyText}>
            Adjust the filters above or create the first fee structure for your active session.
          </Text>
        </View>
      )}

      <FeeStructureModal
        visible={feeModalOpen}
        title={editingFeeId ? "Edit Fee Structure" : "Create Fee Structure"}
        submitLabel={editingFeeId ? "Update" : "Save"}
        saving={saving}
        classes={classes}
        sessions={sessions}
        activeSessionId={activeSession?.id ?? null}
        form={feeForm}
        editing={Boolean(editingFeeId)}
        onClose={() => {
          setFeeModalOpen(false);
          resetFeeForm();
        }}
        onSubmit={handleSaveFeeStructure}
        onChange={setFeeForm}
      />

      <InstallmentModal
        visible={installmentModalOpen}
        title={editingInstallmentId ? "Edit Installment" : "Add Installment"}
        submitLabel={editingInstallmentId ? "Update" : "Save"}
        saving={saving}
        form={installmentForm}
        editing={Boolean(editingInstallmentId)}
        fees={feesWithScope}
        onClose={() => {
          setInstallmentModalOpen(false);
          resetInstallmentForm();
        }}
        onSubmit={handleSaveInstallment}
        onChange={setInstallmentForm}
      />
    </ScrollView>
  );
}

let styles = createStyles(currentTheme);

function createStyles(theme: typeof DEFAULT_THEME) {
return StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 14, paddingBottom: 8 },
  heroCard: { backgroundColor: theme.card, borderRadius: 24, borderWidth: 1, borderColor: theme.border, padding: 18, gap: 14 },
  heroCopy: { gap: 6 },
  heroActions: { gap: 10 },
  heroPrimaryActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  title: { color: theme.text, fontWeight: "800", fontSize: 22 },
  subtitle: { color: theme.subText, lineHeight: 20 },
  noticeCard: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1 },
  noticeSuccessCard: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  noticeErrorCard: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  noticeTitle: { color: theme.text, fontWeight: "800", marginBottom: 2 },
  noticeMessage: { color: theme.subText },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { width: "48%", minHeight: 92, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, justifyContent: "space-between" },
  summaryValue: { fontSize: 23, fontWeight: "800" },
  summaryLabel: { color: theme.subText, fontSize: 12, fontWeight: "700" },
  sectionCard: { backgroundColor: theme.card, borderRadius: 22, borderWidth: 1, borderColor: theme.border, padding: 16, gap: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  sectionTitle: { color: theme.text, fontWeight: "800", fontSize: 16 },
  sectionHint: { color: theme.subText, fontSize: 12, fontWeight: "600" },
  inputLabel: { color: theme.text, fontWeight: "700" },
  input: { borderWidth: 1, borderColor: theme.border, borderRadius: 14, backgroundColor: theme.inputBg, paddingHorizontal: 12, paddingVertical: 11, color: theme.text },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.cardMuted },
  chipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  chipText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#ffffff" },
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  searchRow: { flexDirection: "row", gap: 10 },
  searchInput: { flex: 1 },
  activeFiltersText: { color: theme.subText, fontSize: 12, fontWeight: "600" },
  listContent: { gap: 12 },
  feeCard: { backgroundColor: theme.card, borderRadius: 20, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  feeHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  feeHeaderCopy: { flex: 1, gap: 4 },
  feeTitle: { color: theme.text, fontWeight: "800", fontSize: 16, flex: 1, marginRight: 8 },
  feeTitleWrap: { flex: 1, gap: 2 },
  meta: { color: theme.subText, lineHeight: 18 },
  metaCompact: { color: theme.subText, lineHeight: 17, fontSize: 12.5 },
  metaStack: { gap: 3 },
  metricRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metricPill: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.cardMuted, color: theme.text, fontSize: 12, fontWeight: "700" },
  expandText: { color: theme.text, fontWeight: "700" },
  scopeBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  scopeBadgeSchool: { borderColor: "#bfdbfe", backgroundColor: "#eff6ff" },
  scopeBadgeHs: { borderColor: "#fde68a", backgroundColor: "#fffbeb" },
  scopeBadgeText: { fontWeight: "700", fontSize: 12 },
  scopeBadgeTextSchool: { color: "#1d4ed8" },
  scopeBadgeTextHs: { color: "#b45309" },
  actionRow: { flexDirection: "row", gap: 10 },
  installmentsWrap: { gap: 10, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12 },
  installmentsTitle: { color: theme.text, fontWeight: "800" },
  installmentRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 14, backgroundColor: theme.cardMuted, padding: 12 },
  installmentInfo: { flex: 1, gap: 4 },
  installmentRight: { alignItems: "flex-end", gap: 8 },
  installmentName: { color: theme.text, fontWeight: "700" },
  popoverOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-start", paddingTop: 250, paddingHorizontal: 24 },
  popoverBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent" },
  filterPopover: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, borderRadius: 18, padding: 14, gap: 12, marginLeft: "auto", width: "82%" },
  resetText: { color: "#15803d", fontWeight: "700" },
  installmentDate: { color: theme.subText },
  installmentAmount: { color: theme.text, fontWeight: "800" },
  installmentActions: { flexDirection: "row", gap: 6 },
  installmentActionBtn: { borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.card },
  installmentActionText: { color: theme.text, fontWeight: "700", fontSize: 12 },
  installmentDeleteBtn: { borderWidth: 1, borderColor: "#fecaca", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fee2e2" },
  installmentDeleteText: { color: "#b91c1c", fontWeight: "700", fontSize: 12 },
  emptyCard: { backgroundColor: theme.card, borderRadius: 22, borderWidth: 1, borderColor: theme.border, padding: 18, gap: 6 },
  emptyTitle: { color: theme.text, fontWeight: "800", fontSize: 16 },
  emptyText: { color: theme.subText, lineHeight: 20 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.overlay },
  modalCard: { maxHeight: "88%", backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18, gap: 10 },
  modalTitle: { color: theme.text, fontWeight: "800", fontSize: 18 },
  modalBody: { maxHeight: 500 },
  modalFooter: { marginTop: 14, flexDirection: "row", gap: 10 },
  primaryBtn: { backgroundColor: "#0f172a", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "#ffffff", fontWeight: "700" },
  successBtn: { flex: 1, backgroundColor: "#15803d", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  successBtnText: { color: "#ffffff", fontWeight: "700" },
  ghostBtn: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  ghostBtnText: { color: theme.text, fontWeight: "700" },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtnCompact: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  iconUtilityBtn: { width: 42, height: 42, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: theme.text, fontWeight: "700" },
  deleteBtn: { flex: 1, backgroundColor: "#fee2e2", borderWidth: 1, borderColor: "#fecaca", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  deleteBtnText: { color: "#b91c1c", fontWeight: "700" },
  dueItemWrap: { gap: 8 },
  dueItem: { borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 12, backgroundColor: theme.card },
  dueItemActive: { borderColor: "#0f172a", backgroundColor: currentTheme.isDark ? "#334155" : "#e2e8f0" },
  dueText: { color: theme.text, fontWeight: "700" },
  dueSubText: { marginTop: 4, color: theme.subText, fontSize: 12 },
  dueTextActive: { color: theme.text },
  spaceTop: { marginTop: 10 },
});
}

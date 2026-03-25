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
import { useAuthStore } from "../../store/authStore";
import { getClassStructure } from "../../services/classesService";
import SelectField from "../../components/form/SelectField";
import DateField from "../../components/form/DateField";
import {
  createPayment,
  deletePayment,
  downloadAndShareReceipt,
  getMyPayments,
  getMyStudentFeeOptions,
  getMyStudentsForFees,
  getPayments,
  getStudentFeeOptions,
  getStudentsForPayment,
  PaymentItem,
  PaymentStudentItem,
  StudentFeeOption,
  updatePayment,
} from "../../services/paymentsService";
import { formatDateLabel } from "../../utils/format";
import TopNotice from "../../components/feedback/TopNotice";
import { useAppTheme } from "../../theme/AppThemeProvider";

type ClassStructureItem = {
  id: number;
  name: string;
  class_scope?: "school" | "hs";
  sections: Array<{ id: number; name: string; medium?: string | null }>;
};

type NoticeState = {
  tone: "success" | "error";
  title: string;
  message: string;
} | null;

type CreateForm = {
  class_id: number | null;
  section_id: number | null;
  student_id: number | null;
  student_fee_id: number | null;
  amount_paid: string;
  remarks: string;
};

type EditForm = {
  id: number | null;
  amount_paid: string;
  remarks: string;
};

const EMPTY_CREATE_FORM: CreateForm = {
  class_id: null,
  section_id: null,
  student_id: null,
  student_fee_id: null,
  amount_paid: "",
  remarks: "",
};

const EMPTY_EDIT_FORM: EditForm = {
  id: null,
  amount_paid: "",
  remarks: "",
};

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

function formatScope(value?: string | null) {
  const scope = String(value || "").trim().toLowerCase();
  if (scope === "hs") return "Higher Secondary";
  if (scope === "school") return "School";
  return "-";
}

function getPaymentStatus(row: PaymentItem) {
  const raw = String(row.fee_status || row.status || "").trim().toLowerCase();
  return raw || "-";
}

function statusStyle(status: string) {
  if (status === "paid") return { borderColor: "#86efac", backgroundColor: "#dcfce7", color: "#166534" };
  if (status === "partial") return { borderColor: "#fde68a", backgroundColor: "#fef3c7", color: "#92400e" };
  if (status === "pending") return { borderColor: "#fecaca", backgroundColor: "#fee2e2", color: "#b91c1c" };
  return { borderColor: "#cbd5e1", backgroundColor: "#f8fafc", color: "#334155" };
}

function toTitle(value: string) {
  if (!value || value === "-") return "-";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatCurrency(value?: number | string | null) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
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

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
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

function IconAction({ icon, onPress, tone = "default" }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; tone?: "default" | "danger" }) {
  const isDanger = tone === "danger";
  return <Pressable style={[styles.iconActionBtn, isDanger && styles.iconActionBtnDanger]} onPress={onPress}><Ionicons name={icon} size={18} color={isDanger ? "#b91c1c" : "#334155"} /></Pressable>;
}

type PaymentModalProps = {
  visible: boolean;
  saving: boolean;
  classes: ClassStructureItem[];
  form: CreateForm;
  students: PaymentStudentItem[];
  feeOptions: StudentFeeOption[];
  studentSearch: string;
  selectedFee: StudentFeeOption | null;
  onClose: () => void;
  onSubmit: () => void;
  onChangeForm: (next: CreateForm) => void;
  onStudentSearch: (value: string) => void;
};

function RecordPaymentModal({
  visible,
  saving,
  classes,
  form,
  students,
  feeOptions,
  studentSearch,
  selectedFee,
  onClose,
  onSubmit,
  onChangeForm,
  onStudentSearch,
}: PaymentModalProps) {
  const selectedClass = useMemo(
    () => classes.find((item) => item.id === form.class_id) ?? null,
    [classes, form.class_id],
  );

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => String(student.name || "").toLowerCase().includes(query));
  }, [studentSearch, students]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Record Payment</Text>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <SelectField
              label="Class *"
              value={form.class_id === null ? "" : String(form.class_id)}
              onChange={(value) =>
                onChangeForm({
                  ...form,
                  class_id: value ? Number(value) : null,
                  section_id: null,
                  student_id: null,
                  student_fee_id: null,
                })
              }
              options={classes.map((item) => ({ label: item.name, value: String(item.id) }))}
              placeholder="Choose class"
            />

            <SelectField
              label="Section *"
              value={form.section_id === null ? "" : String(form.section_id)}
              onChange={(value) =>
                onChangeForm({
                  ...form,
                  section_id: value ? Number(value) : null,
                  student_id: null,
                  student_fee_id: null,
                })
              }
              options={(selectedClass?.sections || []).map((section) => ({
                label: `${section.name}${section.medium ? ` (${section.medium})` : ""}`,
                value: String(section.id),
              }))}
              placeholder="Choose section"
              disabled={!selectedClass}
            />

            <Text style={[styles.inputLabel, styles.spaceTop]}>Student Search</Text>
            <TextInput
              style={styles.input}
              value={studentSearch}
              onChangeText={onStudentSearch}
              placeholder="Search student"
              placeholderTextColor="#94a3b8"
            />

            <Text style={[styles.inputLabel, styles.spaceTop]}>Student *</Text>
            <View style={styles.dueItemWrap}>
              {filteredStudents.map((student) => {
                const active = form.student_id === student.id;
                return (
                  <Pressable
                    key={student.id}
                    style={[styles.dueItem, active && styles.dueItemActive]}
                    onPress={() =>
                      onChangeForm({
                        ...form,
                        student_id: student.id,
                        student_fee_id: null,
                      })
                    }
                  >
                    <Text style={[styles.dueText, active && styles.dueTextActive]}>{student.name}</Text>
                    <Text style={[styles.dueSubText, active && styles.dueTextActive]}>
                      Roll: {student.roll_number || "-"} • {student.section_name || "-"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.inputLabel, styles.spaceTop]}>Due Fee Item *</Text>
            <View style={styles.dueItemWrap}>
              {feeOptions.map((item) => {
                const active = form.student_fee_id === Number(item.id);
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.dueItem, active && styles.dueItemActive]}
                    onPress={() => onChangeForm({ ...form, student_fee_id: Number(item.id) })}
                  >
                    <Text style={[styles.dueText, active && styles.dueTextActive]}>
                      {item.installment_name || item.fee_type}
                    </Text>
                    <Text style={[styles.dueSubText, active && styles.dueTextActive]}>
                      Remaining: {formatCurrency(item.remaining)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.inputLabel, styles.spaceTop]}>Amount Paid *</Text>
            <TextInput
              style={styles.input}
              value={form.amount_paid}
              onChangeText={(value) => onChangeForm({ ...form, amount_paid: value })}
              keyboardType="numeric"
              placeholder="Amount"
              placeholderTextColor="#94a3b8"
            />
            {selectedFee ? (
              <Text style={styles.helperText}>
                Due: {formatCurrency(selectedFee.amount)} • Paid: {formatCurrency(selectedFee.paid)} • Remaining: {formatCurrency(selectedFee.remaining)}
              </Text>
            ) : null}

            <Text style={[styles.inputLabel, styles.spaceTop]}>Remarks</Text>
            <TextInput
              style={styles.input}
              value={form.remarks}
              onChangeText={(value) => onChangeForm({ ...form, remarks: value })}
              placeholder="Optional remarks"
              placeholderTextColor="#94a3b8"
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable style={styles.secondaryBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.successBtn} onPress={onSubmit} disabled={saving}>
              <Text style={styles.successBtnText}>{saving ? "Saving..." : "Save"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EditPaymentModal({
  visible,
  form,
  saving,
  onClose,
  onSubmit,
  onChange,
}: {
  visible: boolean;
  form: EditForm;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onChange: (next: EditForm) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Edit Payment</Text>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.inputLabel}>Amount Paid *</Text>
            <TextInput
              style={styles.input}
              value={form.amount_paid}
              onChangeText={(value) => onChange({ ...form, amount_paid: value })}
              keyboardType="numeric"
              placeholder="Amount"
              placeholderTextColor="#94a3b8"
            />

            <Text style={[styles.inputLabel, styles.spaceTop]}>Remarks</Text>
            <TextInput
              style={styles.input}
              value={form.remarks}
              onChangeText={(value) => onChange({ ...form, remarks: value })}
              placeholder="Optional remarks"
              placeholderTextColor="#94a3b8"
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable style={styles.secondaryBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.successBtn} onPress={onSubmit} disabled={saving}>
              <Text style={styles.successBtnText}>{saving ? "Saving..." : "Update"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function PaymentsTab() {
  const { theme, isDark } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions || [];
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const canCreatePayment = permissions.includes("payment.create");
  const canUpdatePayment = permissions.includes("payment.update");
  const canDeletePayment = permissions.includes("payment.delete");
  const isParentOnly = permissions.includes("fee.view") && !canCreatePayment && !permissions.includes("payment.view");
  const isAccounts = roles.includes("accounts");

  const [classes, setClasses] = useState<ClassStructureItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [students, setStudents] = useState<PaymentStudentItem[]>([]);
  const [myStudents, setMyStudents] = useState<PaymentStudentItem[]>([]);
  const [feeOptions, setFeeOptions] = useState<StudentFeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const [filterClassId, setFilterClassId] = useState<number | null>(null);
  const [filterSectionId, setFilterSectionId] = useState<number | null>(null);
  const [filterScope, setFilterScope] = useState<"" | "school" | "hs">("");
  const [paymentDate, setPaymentDate] = useState("");
  const [parentStudentId, setParentStudentId] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE_FORM);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT_FORM);
  const [studentSearch, setStudentSearch] = useState("");

  const selectedFilterClass = useMemo(
    () => classes.find((item) => item.id === filterClassId) ?? null,
    [classes, filterClassId],
  );

  function resetBrowseFilters() {
    setFilterScope("");
    setFilterClassId(null);
    setFilterSectionId(null);
    setPaymentDate("");
  }

  const selectedFee = useMemo(
    () => feeOptions.find((item) => Number(item.id) === Number(createForm.student_fee_id)) ?? null,
    [feeOptions, createForm.student_fee_id],
  );

  const filteredPayments = useMemo(
    () => payments,
    [payments],
  );

  const summary = useMemo(() => {
    return filteredPayments.reduce(
      (acc, payment) => {
        const status = getPaymentStatus(payment);
        acc.total += 1;
        acc.amount += Number(payment.amount_paid || 0);
        if (status === "paid") acc.paid += 1;
        if (status === "partial") acc.partial += 1;
        return acc;
      },
      { total: 0, paid: 0, partial: 0, amount: 0 },
    );
  }, [filteredPayments]);

  const summaryCards = useMemo(
    () => [
      { label: "Records", value: summary.total, accent: "#dbeafe", tone: "#1d4ed8" },
      { label: "Paid", value: summary.paid, accent: "#dcfce7", tone: "#15803d" },
      { label: "Partial", value: summary.partial, accent: "#fef3c7", tone: "#b45309" },
      { label: "Collected", value: formatCurrency(summary.amount), accent: "#ede9fe", tone: "#6d28d9" },
    ],
    [summary],
  );

  useEffect(() => {
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (isParentOnly) {
      loadParentPayments();
      return;
    }
    loadPaymentsList();
  }, [filterClassId, filterSectionId, filterScope, paymentDate, parentStudentId, isParentOnly]);

  useEffect(() => {
    if (!createForm.class_id || !createForm.section_id || isParentOnly) {
      setStudents([]);
      setStudentSearch("");
      setCreateForm((prev) => ({ ...prev, student_id: null, student_fee_id: null }));
      return;
    }
    loadStudentsForCreate(createForm.class_id, createForm.section_id);
  }, [createForm.class_id, createForm.section_id, isParentOnly]);

  useEffect(() => {
    if (!createForm.student_id || isParentOnly) {
      setFeeOptions([]);
      setCreateForm((prev) => ({ ...prev, student_fee_id: null }));
      return;
    }
    loadStudentFeeItems(createForm.student_id);
  }, [createForm.student_id, isParentOnly]);

  async function loadBootstrap(mode: "initial" | "refresh" = "initial") {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);

    try {
      const structure = await getClassStructure();
      setClasses(structure as ClassStructureItem[]);

      if (isParentOnly) {
        const rows = await getMyStudentsForFees();
        setMyStudents(rows);
        if (rows.length === 1) setParentStudentId(Number(rows[0].id));
      }
    } catch (err: unknown) {
      Alert.alert("Load failed", getErrorMessage(err, "Could not load payment filters."));
      setClasses([]);
      setMyStudents([]);
    } finally {
      if (mode === "refresh") setRefreshing(false);
      else setLoading(false);
    }
  }

  async function loadPaymentsList() {
    setLoading(true);
    try {
      const rows = await getPayments({
        class_id: filterClassId ?? undefined,
        section_id: filterSectionId ?? undefined,
        scope: filterScope || undefined,
        payment_date: paymentDate || undefined,
      });
      setPayments(rows);
    } catch (err: unknown) {
      setPayments([]);
      Alert.alert("Load failed", getErrorMessage(err, "Could not load payments."));
    } finally {
      setLoading(false);
    }
  }

  async function loadParentPayments() {
    if (!parentStudentId) {
      setPayments([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await getMyPayments({ student_id: parentStudentId });
      setPayments(rows);
    } catch (err: unknown) {
      setPayments([]);
      Alert.alert("Load failed", getErrorMessage(err, "Could not load student payments."));
    } finally {
      setLoading(false);
    }
  }

  async function loadStudentsForCreate(classId: number, sectionId: number) {
    try {
      const rows = await getStudentsForPayment({ class_id: classId, section_id: sectionId });
      setStudents(rows);
    } catch (err: unknown) {
      setStudents([]);
      showNotice("Load Failed", getErrorMessage(err, "Could not load students."), "error");
    }
  }

  async function loadStudentFeeItems(studentId: number) {
    try {
      const rows = await getStudentFeeOptions(studentId);
      setFeeOptions(rows);
    } catch (err: unknown) {
      setFeeOptions([]);
      showNotice("Fee Items Missing", getErrorMessage(err, "Fee ledger is not available for this student."), "error");
    }
  }

  function showNotice(title: string, message: string, tone: "success" | "error" = "success") {
    setNotice({ title, message, tone });
  }

  function resetCreateForm() {
    setCreateForm(EMPTY_CREATE_FORM);
    setStudents([]);
    setFeeOptions([]);
    setStudentSearch("");
  }

  async function handleCreatePayment() {
    if (!createForm.student_fee_id) return Alert.alert("Validation", "Select due fee item.");
    const amount = Number(createForm.amount_paid);
    if (!amount || amount <= 0) return Alert.alert("Validation", "Enter a valid payment amount.");
    if (selectedFee && amount > Number(selectedFee.remaining || 0)) {
      return Alert.alert("Validation", "Amount cannot exceed remaining fee.");
    }

    setSaving(true);
    try {
      await createPayment({
        student_fee_id: Number(createForm.student_fee_id),
        amount_paid: amount,
        remarks: createForm.remarks || undefined,
      });
      setCreateOpen(false);
      resetCreateForm();
      await loadPaymentsList();
      showNotice("Payment Saved", "Payment recorded successfully.");
    } catch (err: unknown) {
      showNotice("Create Failed", getErrorMessage(err, "Failed to create payment."), "error");
    } finally {
      setSaving(false);
    }
  }

  function openEditPayment(row: PaymentItem) {
    setEditForm({
      id: row.id,
      amount_paid: String(row.amount_paid ?? ""),
      remarks: row.remarks ?? "",
    });
    setEditOpen(true);
  }

  async function handleUpdatePayment() {
    if (!editForm.id) return;
    const amount = Number(editForm.amount_paid);
    if (!amount || amount <= 0) return Alert.alert("Validation", "Enter a valid payment amount.");

    setSaving(true);
    try {
      await updatePayment(editForm.id, {
        amount_paid: amount,
        remarks: editForm.remarks || undefined,
      });
      setEditOpen(false);
      setEditForm(EMPTY_EDIT_FORM);
      await loadPaymentsList();
      showNotice("Payment Updated", "Payment updated successfully.");
    } catch (err: unknown) {
      showNotice("Update Failed", getErrorMessage(err, "Failed to update payment."), "error");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(row: PaymentItem) {
    Alert.alert("Delete payment", "Delete this payment record?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePayment(row.id);
            await loadPaymentsList();
            showNotice("Payment Deleted", "Payment deleted successfully.");
          } catch (err: unknown) {
            showNotice("Delete Failed", getErrorMessage(err, "Failed to delete payment."), "error");
          }
        },
      },
    ]);
  }

  async function handleReceipt(row: PaymentItem) {
    try {
      await downloadAndShareReceipt(row.id);
    } catch (err: unknown) {
      showNotice("Receipt Failed", getErrorMessage(err, "Failed to download receipt."), "error");
    }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadBootstrap("refresh")} />}
    >
      <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.heroCopy}>
          <Text style={[styles.title, { color: theme.text }]}>Payments</Text>
          <Text style={[styles.subtitle, { color: theme.subText }]}>
            {isParentOnly
              ? "Review your child payment history and due items."
              : isAccounts
                ? "Record, review, and update fee payments from the finance workspace."
                : "Record, review, export, and update fee payments from the live backend."}
          </Text>
        </View>
        <View style={styles.heroActions}>
          {!isParentOnly ? (
            <>
              {canCreatePayment ? (
                <Pressable style={[styles.primaryBtn, styles.fullWidthBtn]} onPress={() => setCreateOpen(true)}>
                  <Text style={styles.primaryBtnText}>Record Payment</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[styles.iconUtilityBtn, { borderColor: theme.border, backgroundColor: isDark ? theme.cardMuted : "#fff" }]}
                onPress={() => setFiltersOpen(true)}
              >
                <Ionicons name="options-outline" size={18} color={theme.icon} />
              </Pressable>
            </>
          ) : null}
        </View>
      </View>

      <TopNotice notice={notice} />

      {!isParentOnly && (filterClassId !== null || filterSectionId !== null || filterScope || paymentDate) ? (
        <Text style={[styles.activeFiltersText, { color: theme.subText }]}>
          {filterScope ? `Scope: ${filterScope === "hs" ? "Higher Secondary" : "School"}` : "All scope"}
          {filterClassId !== null ? ` • Class: ${selectedFilterClass?.name || "-"}` : ""}
          {filterSectionId !== null ? ` • Section: ${selectedFilterClass?.sections?.find((section) => section.id === filterSectionId)?.name || "-"}` : ""}
          {paymentDate ? ` • Date: ${paymentDate}` : ""}
        </Text>
      ) : null}

      {isParentOnly ? (
        <SectionCard title="Student" hint={`${myStudents.length} linked`}>
          <View style={styles.chipWrap}>
            {myStudents.map((student) => {
              const active = parentStudentId === Number(student.id);
              return (
                <Pressable
                  key={student.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setParentStudentId(Number(student.id))}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{student.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </SectionCard>
      ) : null}

      {!isParentOnly ? (
        <Modal visible={filtersOpen} transparent animationType="fade" onRequestClose={() => setFiltersOpen(false)}>
          <View style={styles.popoverOverlay}>
            <Pressable style={styles.popoverBackdrop} onPress={() => setFiltersOpen(false)} />
            <View style={[styles.filterPopover, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Filters</Text>
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
                  const active = filterScope === item.value;
                  return (
                    <Pressable
                      key={item.label}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setFilterScope(item.value as "" | "school" | "hs")}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <DateField label="Payment Date" value={paymentDate} onChange={setPaymentDate} placeholder="All dates" />

              <SelectField
                label="Class"
                value={filterClassId === null ? "" : String(filterClassId)}
                onChange={(value) => {
                  if (!value) {
                    setFilterClassId(null);
                    setFilterSectionId(null);
                    return;
                  }
                  setFilterClassId(Number(value));
                  setFilterSectionId(null);
                }}
                options={classes.map((item) => ({ label: item.name, value: String(item.id) }))}
                placeholder="All classes"
                allowClear
                clearLabel="All classes"
              />

              <SelectField
                label="Section"
                value={filterSectionId === null ? "" : String(filterSectionId)}
                onChange={(value) => setFilterSectionId(value ? Number(value) : null)}
                options={(selectedFilterClass?.sections || []).map((section) => ({
                  label: `${section.name}${section.medium ? ` (${section.medium})` : ""}`,
                  value: String(section.id),
                }))}
                placeholder="All sections"
                allowClear
                clearLabel="All sections"
                disabled={!selectedFilterClass}
              />

              <View style={styles.rowActions}>
                <Pressable
                  style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: isDark ? theme.cardMuted : "#fff" }]}
                  onPress={() => setFiltersOpen(false)}
                >
                  <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Apply</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      <View style={styles.summaryGrid}>
        {summaryCards.map((item) => (
          <SummaryCard
            key={item.label}
            label={item.label}
            value={item.value}
            accent={item.accent}
            tone={item.tone}
          />
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : filteredPayments.length ? (
        <View style={styles.listContent}>
          {filteredPayments.map((row) => {
            const palette = statusStyle(getPaymentStatus(row));
            return (
              <View key={row.id} style={[styles.paymentCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.rowBetween}>
                  <View style={styles.paymentHeaderCopy}>
                    <Text style={[styles.paymentTitle, { color: theme.text }]}>{row.student_name}</Text>
                    <Text style={[styles.metaCompact, { color: theme.subText }]}>
                      {formatScope(row.class_scope)} • {formatDateLabel(row.payment_date || row.created_at)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { borderColor: palette.borderColor, backgroundColor: palette.backgroundColor }]}>
                    <Text style={[styles.statusBadgeText, { color: palette.color }]}>
                      {toTitle(getPaymentStatus(row))}
                    </Text>
                  </View>
                </View>
                <View style={styles.metaStack}>
                  <Text style={[styles.metaCompact, { color: theme.subText }]}>
                    {row.class_name || "-"} • {row.section_name || "-"}
                  </Text>
                  <Text style={[styles.metaCompact, { color: theme.subText }]}>
                    {row.fee_type || "-"} • Paid: {formatCurrency(row.amount_paid)}
                  </Text>
                  {row.remarks ? (
                    <Text style={[styles.metaCompact, { color: theme.subText }]}>Remarks: {row.remarks}</Text>
                  ) : null}
                </View>
                <View style={styles.cardIconActions}>
                  {canUpdatePayment && !isParentOnly ? (
                    <IconAction icon="create-outline" onPress={() => openEditPayment(row)} />
                  ) : null}
                  {canDeletePayment && !isParentOnly ? (
                    <IconAction icon="trash-outline" tone="danger" onPress={() => confirmDelete(row)} />
                  ) : null}
                  <IconAction icon="receipt-outline" onPress={() => handleReceipt(row)} />
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No payment records found</Text>
          <Text style={[styles.emptyText, { color: theme.subText }]}>
            {isParentOnly
              ? "Select a linked student to review payment history."
              : "Adjust the filters or record the first payment for this class."}
          </Text>
        </View>
      )}

      {canCreatePayment && !isParentOnly ? (
        <RecordPaymentModal
          visible={createOpen}
          saving={saving}
          classes={classes}
          form={createForm}
          students={students}
          feeOptions={feeOptions}
          studentSearch={studentSearch}
          selectedFee={selectedFee}
          onClose={() => {
            setCreateOpen(false);
            resetCreateForm();
          }}
          onSubmit={handleCreatePayment}
          onChangeForm={setCreateForm}
          onStudentSearch={setStudentSearch}
        />
      ) : null}

      {canUpdatePayment && !isParentOnly ? (
        <EditPaymentModal
          visible={editOpen}
          form={editForm}
          saving={saving}
          onClose={() => {
            setEditOpen(false);
            setEditForm(EMPTY_EDIT_FORM);
          }}
          onSubmit={handleUpdatePayment}
          onChange={setEditForm}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 14, paddingBottom: 8 },
  heroCard: { backgroundColor: "#ffffff", borderRadius: 24, borderWidth: 1, borderColor: "#e2e8f0", padding: 18, gap: 14 },
  heroCopy: { gap: 6 },
  heroActions: { flexDirection: "row", gap: 10 },
  title: { color: "#0f172a", fontWeight: "800", fontSize: 22 },
  subtitle: { color: "#64748b", lineHeight: 20 },
  noticeCard: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1 },
  noticeSuccessCard: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  noticeErrorCard: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  noticeTitle: { color: "#0f172a", fontWeight: "800", marginBottom: 2 },
  noticeMessage: { color: "#475569" },
  sectionCard: { backgroundColor: "#ffffff", borderRadius: 22, borderWidth: 1, borderColor: "#e2e8f0", padding: 16, gap: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  sectionTitle: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  sectionHint: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  inputLabel: { color: "#334155", fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, backgroundColor: "#ffffff", paddingHorizontal: 12, paddingVertical: 11, color: "#0f172a" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f8fafc" },
  chipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  chipText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#ffffff" },
  activeFiltersText: { fontSize: 12, fontWeight: "600" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { width: "48%", minHeight: 92, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, justifyContent: "space-between" },
  summaryValue: { fontSize: 23, fontWeight: "800" },
  summaryLabel: { color: "#334155", fontSize: 12, fontWeight: "700" },
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  listContent: { gap: 12 },
  paymentCard: { backgroundColor: "#ffffff", borderRadius: 20, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 14, paddingVertical: 12, gap: 7 },
  paymentHeaderCopy: { flex: 1, gap: 2 },
  paymentTitle: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  meta: { color: "#475569", lineHeight: 18 },
  metaCompact: { color: "#475569", lineHeight: 17, fontSize: 12.5 },
  metaStack: { gap: 3 },
  statusBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontWeight: "700", fontSize: 12 },
  rowActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  cardIconActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  iconActionBtn: { width: 38, height: 38, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  iconActionBtnDanger: { borderColor: "#fecaca", backgroundColor: "#fff5f5" },
  iconUtilityBtn: { width: 42, height: 42, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.28)" },
  popoverOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-start", paddingTop: 230, paddingHorizontal: 24 },
  popoverBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent" },
  filterPopover: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12, marginLeft: "auto", width: "82%" },
  resetText: { color: "#15803d", fontWeight: "700" },
  modalCard: { maxHeight: "88%", backgroundColor: "#ffffff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18, gap: 10 },
  modalTitle: { color: "#0f172a", fontWeight: "800", fontSize: 18 },
  modalBody: { maxHeight: 500 },
  modalFooter: { marginTop: 14, flexDirection: "row", gap: 10 },
  primaryBtn: { backgroundColor: "#0f172a", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  fullWidthBtn: { flex: 1 },
  primaryBtnText: { color: "#ffffff", fontWeight: "700" },
  successBtn: { flex: 1, backgroundColor: "#15803d", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  successBtnText: { color: "#ffffff", fontWeight: "700" },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: "#334155", fontWeight: "700" },
  deleteBtn: { flex: 1, backgroundColor: "#fee2e2", borderWidth: 1, borderColor: "#fecaca", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  deleteBtnText: { color: "#b91c1c", fontWeight: "700" },
  dueItemWrap: { gap: 8 },
  dueItem: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, padding: 12, backgroundColor: "#ffffff" },
  dueItemActive: { borderColor: "#0f172a", backgroundColor: "#e2e8f0" },
  dueText: { color: "#0f172a", fontWeight: "700" },
  dueSubText: { marginTop: 4, color: "#64748b", fontSize: 12 },
  dueTextActive: { color: "#0f172a" },
  helperText: { marginTop: 6, color: "#64748b", fontSize: 12 },
  emptyCard: { backgroundColor: "#ffffff", borderRadius: 22, borderWidth: 1, borderColor: "#e2e8f0", padding: 18, gap: 6 },
  emptyTitle: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  emptyText: { color: "#64748b", lineHeight: 20 },
  spaceTop: { marginTop: 10 },
});

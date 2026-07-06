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
import { getClassStructure, getSessions, type ClassStructureItem, type SessionItem } from "../../services/classesService";
import { getStreams, type StreamItem } from "../../services/settingsService";
import {
  createTransportAssignment,
  createTransportPayment,
  deleteTransportPayment,
  downloadAndShareTransportReceipt,
  getTransportAssignments,
  getTransportDues,
  getTransportPayments,
  getTransportSummary,
  searchTransportStudents,
  updateTransportPayment,
  type TransportAssignment,
  type TransportDue,
  type TransportPayment,
  type TransportStudent,
} from "../../services/paymentsService";
import SelectField from "../../components/form/SelectField";
import TopNotice from "../../components/feedback/TopNotice";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { formatDateLabel } from "../../utils/format";

type NoticeState = { tone: "success" | "error"; title: string; message: string } | null;
type AssignmentForm = {
  class_id: number | null;
  section_id: number | null;
  stream_id: number | null;
  student_id: number | null;
  session_id: number | null;
  start_month: string;
  start_year: string;
  monthly_fee: string;
};
type PaymentForm = {
  class_id: number | null;
  section_id: number | null;
  stream_id: number | null;
  student_id: number | null;
  due_id: number | null;
  amount_paid: string;
  remarks: string;
};

const MONTHS = [
  ["1", "January"],
  ["2", "February"],
  ["3", "March"],
  ["4", "April"],
  ["5", "May"],
  ["6", "June"],
  ["7", "July"],
  ["8", "August"],
  ["9", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
];

const EMPTY_ASSIGNMENT_FORM: AssignmentForm = {
  class_id: null,
  section_id: null,
  stream_id: null,
  student_id: null,
  session_id: null,
  start_month: "4",
  start_year: String(new Date().getFullYear()),
  monthly_fee: "",
};

const EMPTY_PAYMENT_FORM: PaymentForm = {
  class_id: null,
  section_id: null,
  stream_id: null,
  student_id: null,
  due_id: null,
  amount_paid: "",
  remarks: "",
};

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err && "response" in err) {
    const data = (err as { response?: { data?: { message?: string; error?: string } } }).response?.data;
    return data?.error || data?.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function money(value?: number | string | null) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function title(value?: string | null) {
  const text = String(value || "").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "-";
}

function monthLabel(month?: number | string | null, year?: number | string | null) {
  const found = MONTHS.find(([value]) => Number(value) === Number(month));
  return `${found?.[1] || month || "-"}${year ? ` ${year}` : ""}`;
}

function resolveClassScope(item?: ClassStructureItem | null) {
  return String(item?.class_scope || "school").trim().toLowerCase() === "hs" ? "hs" : "school";
}

function StatusBadge({ value }: { value?: string | null }) {
  const status = String(value || "").trim().toLowerCase();
  const palette =
    status === "active" || status === "paid"
      ? { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", color: "#15803d" }
      : status === "pending" || status === "partial"
        ? { borderColor: "#fde68a", backgroundColor: "#fffbeb", color: "#b45309" }
        : status === "unpaid"
          ? { borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#b91c1c" }
          : { borderColor: "#cbd5e1", backgroundColor: "#f8fafc", color: "#475569" };

  return (
    <View style={[styles.statusBadge, { borderColor: palette.borderColor, backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.statusText, { color: palette.color }]}>{title(status || "-")}</Text>
    </View>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string | number; icon: keyof typeof Ionicons.glyphMap }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.summaryIcon, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
        <Ionicons name={icon} size={18} color={theme.icon} />
      </View>
      <Text style={[styles.summaryValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: theme.subText }]}>{label}</Text>
    </View>
  );
}

function SectionCard({ title: heading, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.rowBetween}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{heading}</Text>
        {hint ? <Text style={[styles.sectionHint, { color: theme.subText }]}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export default function TransportationFeeTab() {
  const { theme } = useAppTheme();
  const [classes, setClasses] = useState<ClassStructureItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [assignments, setAssignments] = useState<TransportAssignment[]>([]);
  const [dues, setDues] = useState<TransportDue[]>([]);
  const [payments, setPayments] = useState<TransportPayment[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [students, setStudents] = useState<TransportStudent[]>([]);
  const [paymentStudents, setPaymentStudents] = useState<TransportStudent[]>([]);
  const [paymentDues, setPaymentDues] = useState<TransportDue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>(EMPTY_ASSIGNMENT_FORM);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(EMPTY_PAYMENT_FORM);
  const [editPayment, setEditPayment] = useState<{ id: number; amount_paid: string; remarks: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransportPayment | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => Boolean(session.is_active)) || sessions[0] || null,
    [sessions],
  );
  const assignmentClass = classes.find((item) => item.id === assignmentForm.class_id) || null;
  const paymentClass = classes.find((item) => item.id === paymentForm.class_id) || null;
  const assignmentNeedsStream = resolveClassScope(assignmentClass) === "hs";
  const paymentNeedsStream = resolveClassScope(paymentClass) === "hs";
  const selectedPaymentDue = paymentDues.find((due) => Number(due.id) === Number(paymentForm.due_id)) || null;

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
      const [summaryRows, sessionRows, classRows, streamRows, assignmentRows, dueRows, paymentRows] = await Promise.all([
        getTransportSummary(),
        getSessions(),
        getClassStructure(),
        getStreams(),
        getTransportAssignments(),
        getTransportDues({ status: "pending" }),
        getTransportPayments(),
      ]);
      setSummary(summaryRows as Record<string, number>);
      setSessions(sessionRows);
      setClasses(classRows);
      setStreams(streamRows);
      setAssignments(assignmentRows);
      setDues(dueRows);
      setPayments(paymentRows);
    } catch (err: unknown) {
      showNotice("Load Failed", getErrorMessage(err, "Could not load transportation fees."), "error");
    } finally {
      if (mode === "refresh") setRefreshing(false);
      else setLoading(false);
    }
  }

  function showNotice(titleText: string, message: string, tone: "success" | "error" = "success") {
    setNotice({ title: titleText, message, tone });
  }

  async function loadStudentsForAssignment() {
    if (!assignmentForm.class_id || !assignmentForm.section_id || (assignmentNeedsStream && !assignmentForm.stream_id)) {
      showNotice("Filters Missing", "Select class, section, and stream if required.", "error");
      return;
    }

    try {
      const rows = await searchTransportStudents({
        session_id: assignmentForm.session_id || activeSession?.id || undefined,
        class_id: assignmentForm.class_id,
        section_id: assignmentForm.section_id,
        stream_id: assignmentNeedsStream ? assignmentForm.stream_id || undefined : undefined,
      });
      setStudents(rows);
      if (!rows.length) showNotice("No Students", "No students found for selected filters.", "error");
    } catch (err: unknown) {
      setStudents([]);
      showNotice("Load Failed", getErrorMessage(err, "Could not load students."), "error");
    }
  }

  async function loadPaymentStudents() {
    if (!paymentForm.class_id || !paymentForm.section_id || (paymentNeedsStream && !paymentForm.stream_id)) {
      showNotice("Filters Missing", "Select class, section, and stream if required.", "error");
      return;
    }

    try {
      const rows = await searchTransportStudents({
        session_id: activeSession?.id || undefined,
        class_id: paymentForm.class_id,
        section_id: paymentForm.section_id,
        stream_id: paymentNeedsStream ? paymentForm.stream_id || undefined : undefined,
        assigned_only: "1",
      });
      setPaymentStudents(rows);
      if (!rows.length) showNotice("No Students", "No assigned students found for selected filters.", "error");
    } catch (err: unknown) {
      setPaymentStudents([]);
      showNotice("Load Failed", getErrorMessage(err, "Could not load assigned students."), "error");
    }
  }

  async function loadPaymentDues(studentId: number | null) {
    if (!studentId) {
      setPaymentDues([]);
      return;
    }

    try {
      const rows = await getTransportDues({
        student_id: studentId,
        session_id: activeSession?.id || undefined,
        status: "pending",
      });
      setPaymentDues(rows);
    } catch (err: unknown) {
      setPaymentDues([]);
      showNotice("Load Failed", getErrorMessage(err, "Could not load pending dues."), "error");
    }
  }

  async function handleCreateAssignment() {
    if (!assignmentForm.student_id) return Alert.alert("Validation", "Select a student.");
    if (!assignmentForm.session_id && !activeSession?.id) return Alert.alert("Validation", "Select academic session.");
    const fee = Number(assignmentForm.monthly_fee);
    if (!Number.isFinite(fee) || fee <= 0) return Alert.alert("Validation", "Enter monthly fee.");

    setSaving(true);
    try {
      await createTransportAssignment({
        student_id: assignmentForm.student_id,
        session_id: assignmentForm.session_id || Number(activeSession?.id),
        start_month: Number(assignmentForm.start_month),
        start_year: Number(assignmentForm.start_year),
        monthly_fee: fee,
      });
      setAssignmentOpen(false);
      setAssignmentForm({ ...EMPTY_ASSIGNMENT_FORM, session_id: activeSession?.id ? Number(activeSession.id) : null });
      setStudents([]);
      await loadAll("refresh");
      showNotice("Assignment Created", "Monthly transportation dues were generated.");
    } catch (err: unknown) {
      showNotice("Create Failed", getErrorMessage(err, "Could not assign transportation."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatePayment() {
    if (!paymentForm.student_id) return Alert.alert("Validation", "Select student.");
    if (!paymentForm.due_id) return Alert.alert("Validation", "Select due item.");
    const amount = Number(paymentForm.amount_paid);
    if (!Number.isFinite(amount) || amount <= 0) return Alert.alert("Validation", "Enter a valid amount.");
    if (selectedPaymentDue && amount > Number(selectedPaymentDue.remaining || 0)) {
      return Alert.alert("Validation", "Amount cannot exceed remaining due.");
    }

    setSaving(true);
    try {
      await createTransportPayment({
        due_ids: [paymentForm.due_id],
        amount_paid: amount,
        remarks: paymentForm.remarks || undefined,
      });
      setPaymentOpen(false);
      setPaymentForm(EMPTY_PAYMENT_FORM);
      setPaymentStudents([]);
      setPaymentDues([]);
      await loadAll("refresh");
      showNotice("Payment Recorded", "Transportation payment saved.");
    } catch (err: unknown) {
      showNotice("Payment Failed", getErrorMessage(err, "Could not record transportation payment."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePayment() {
    if (!deleteTarget?.id) return;
    setSaving(true);
    try {
      await deleteTransportPayment(deleteTarget.id);
      setDeleteTarget(null);
      await loadAll("refresh");
      showNotice("Payment Deleted", "Transportation payment deleted successfully.");
    } catch (err: unknown) {
      showNotice("Delete Failed", getErrorMessage(err, "Could not delete transportation payment."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdatePayment() {
    if (!editPayment?.id) return;
    const amount = Number(editPayment.amount_paid);
    if (!Number.isFinite(amount) || amount <= 0) return Alert.alert("Validation", "Enter a valid amount.");

    setSaving(true);
    try {
      await updateTransportPayment(editPayment.id, {
        amount_paid: amount,
        remarks: editPayment.remarks || undefined,
      });
      setEditPayment(null);
      await loadAll("refresh");
      showNotice("Payment Updated", "Transportation payment updated successfully.");
    } catch (err: unknown) {
      showNotice("Update Failed", getErrorMessage(err, "Could not update transportation payment."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleReceipt(paymentId: number) {
    try {
      await downloadAndShareTransportReceipt(paymentId);
    } catch (err: unknown) {
      showNotice("Receipt Failed", getErrorMessage(err, "Could not download receipt."), "error");
    }
  }

  function classOptions() {
    return classes.map((item) => ({ label: item.name, value: String(item.id) }));
  }

  function sectionOptions(classItem: ClassStructureItem | null) {
    return (classItem?.sections || []).map((section) => ({
      label: `${section.name}${section.medium ? ` (${section.medium})` : ""}`,
      value: String(section.id),
    }));
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
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadAll("refresh")} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: theme.subText }]}>Fee</Text>
            <Text style={[styles.title, { color: theme.text }]}>Transportation Fee</Text>
            <Text style={[styles.subtitle, { color: theme.subText }]}>Manage monthly transport dues, assignments, payments, and receipts.</Text>
          </View>
          <View style={styles.heroActions}>
            <Pressable style={[styles.primaryBtn, { backgroundColor: theme.primary }]} onPress={() => {
              setAssignmentForm({ ...EMPTY_ASSIGNMENT_FORM, session_id: activeSession?.id ? Number(activeSession.id) : null });
              setAssignmentOpen(true);
            }}>
              <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>Assign Student</Text>
            </Pressable>
            <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setPaymentOpen(true)}>
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Record Payment</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard label="Active Students" value={summary.active_students || 0} icon="people-outline" />
          <SummaryCard label="Monthly Expected" value={money(summary.monthly_expected)} icon="calendar-outline" />
          <SummaryCard label="Pending" value={money(summary.pending_amount)} icon="alert-circle-outline" />
          <SummaryCard label="Collected" value={money(summary.collected_amount)} icon="cash-outline" />
        </View>

        <SectionCard title="Transport Assignments" hint={`${assignments.length} rows`}>
          {assignments.slice(0, 20).map((item) => (
            <View key={item.id} style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
              <View style={styles.rowBetween}>
                <View style={styles.listCopy}>
                  <Text style={[styles.listTitle, { color: theme.text }]}>{item.student_name || `Student #${item.student_id}`}</Text>
                  <Text style={[styles.listMeta, { color: theme.subText }]}>
                    {item.class_name || "-"} / {item.section_name || "-"}{item.stream_name ? ` / ${item.stream_name}` : ""}
                  </Text>
                </View>
                <StatusBadge value={item.status} />
              </View>
              <Text style={[styles.listMeta, { color: theme.subText }]}>
                {money(item.monthly_fee)} monthly - From {monthLabel(item.start_month, item.start_year)} - Pending {item.pending_count || 0}
              </Text>
            </View>
          ))}
          {!assignments.length ? <Text style={[styles.emptyText, { color: theme.subText }]}>No transport assignments yet.</Text> : null}
        </SectionCard>

        <SectionCard title="Pending Dues" hint={`${dues.length} rows`}>
          {dues.slice(0, 20).map((due) => (
            <View key={due.id} style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
              <View style={styles.rowBetween}>
                <View style={styles.listCopy}>
                  <Text style={[styles.listTitle, { color: theme.text }]}>{due.student_name || `Due #${due.id}`}</Text>
                  <Text style={[styles.listMeta, { color: theme.subText }]}>{monthLabel(due.due_month, due.due_year)}</Text>
                </View>
                <StatusBadge value={due.status} />
              </View>
              <Text style={[styles.listMeta, { color: theme.subText }]}>Total {money(due.amount)} - Paid {money(due.paid)} - Remaining {money(due.remaining)}</Text>
            </View>
          ))}
          {!dues.length ? <Text style={[styles.emptyText, { color: theme.subText }]}>No pending transportation dues.</Text> : null}
        </SectionCard>

        <SectionCard title="Transportation Payments" hint={`${payments.length} entries`}>
          {payments.slice(0, 20).map((payment) => (
            <View key={payment.id} style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
              <View style={styles.rowBetween}>
                <View style={styles.listCopy}>
                  <Text style={[styles.listTitle, { color: theme.text }]}>{payment.student_name || `Payment #${payment.id}`}</Text>
                  <Text style={[styles.listMeta, { color: theme.subText }]}>
                    {payment.receipt_no || `TR-${String(payment.id).padStart(6, "0")}`} - {formatDateLabel(payment.created_at)}
                  </Text>
                </View>
                <Text style={[styles.amountText, { color: theme.text }]}>{money(payment.amount_paid)}</Text>
              </View>
              <Text style={[styles.listMeta, { color: theme.subText }]}>{payment.covered_months || "-"} - Remarks: {payment.remarks || "-"}</Text>
              <View style={styles.actionRow}>
                <Pressable style={[styles.smallBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => handleReceipt(payment.id)}>
                  <Text style={[styles.smallBtnText, { color: theme.text }]}>Receipt</Text>
                </Pressable>
                <Pressable
                  style={[styles.smallBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
                  onPress={() => setEditPayment({ id: payment.id, amount_paid: String(payment.amount_paid || ""), remarks: payment.remarks || "" })}
                >
                  <Text style={[styles.smallBtnText, { color: theme.text }]}>Edit</Text>
                </Pressable>
                <Pressable style={[styles.smallBtn, { borderColor: theme.dangerBorder, backgroundColor: theme.dangerSoft }]} onPress={() => setDeleteTarget(payment)}>
                  <Text style={[styles.smallBtnText, { color: theme.danger }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {!payments.length ? <Text style={[styles.emptyText, { color: theme.subText }]}>No transportation payments recorded yet.</Text> : null}
        </SectionCard>
      </ScrollView>

      <Modal visible={assignmentOpen} transparent animationType="slide" onRequestClose={() => setAssignmentOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]} onPress={() => setAssignmentOpen(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Assign Transportation</Text>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <SelectField label="Class" value={assignmentForm.class_id ? String(assignmentForm.class_id) : ""} onChange={(value) => setAssignmentForm((prev) => ({ ...prev, class_id: value ? Number(value) : null, section_id: null, stream_id: null, student_id: null }))} options={classOptions()} placeholder="Choose class" />
              {assignmentNeedsStream ? <SelectField label="Stream" value={assignmentForm.stream_id ? String(assignmentForm.stream_id) : ""} onChange={(value) => setAssignmentForm((prev) => ({ ...prev, stream_id: value ? Number(value) : null, student_id: null }))} options={streams.map((item) => ({ label: item.name, value: String(item.id) }))} placeholder="Choose stream" /> : null}
              <SelectField label="Section" value={assignmentForm.section_id ? String(assignmentForm.section_id) : ""} onChange={(value) => setAssignmentForm((prev) => ({ ...prev, section_id: value ? Number(value) : null, student_id: null }))} options={sectionOptions(assignmentClass)} placeholder="Choose section" disabled={!assignmentClass} />
              <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={loadStudentsForAssignment}>
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Load Students</Text>
              </Pressable>
              <SelectField label="Student" value={assignmentForm.student_id ? String(assignmentForm.student_id) : ""} onChange={(value) => setAssignmentForm((prev) => ({ ...prev, student_id: value ? Number(value) : null }))} options={students.map((item) => ({ label: `${item.name}${item.roll_number ? ` - Roll ${item.roll_number}` : ""}`, value: String(item.id) }))} placeholder="Select student" disabled={!students.length} />
              <SelectField label="Session" value={assignmentForm.session_id ? String(assignmentForm.session_id) : ""} onChange={(value) => setAssignmentForm((prev) => ({ ...prev, session_id: value ? Number(value) : null }))} options={sessions.map((item) => ({ label: item.name, value: String(item.id) }))} placeholder="Select session" />
              <Text style={[styles.inputLabel, { color: theme.text }]}>Start Month</Text>
              <View style={styles.monthWrap}>{MONTHS.map(([value, label]) => <Pressable key={value} style={[styles.monthChip, assignmentForm.start_month === value && { backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={() => setAssignmentForm((prev) => ({ ...prev, start_month: value }))}><Text style={[styles.monthChipText, assignmentForm.start_month === value && { color: theme.primaryText }]}>{label}</Text></Pressable>)}</View>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Start Year</Text>
              <TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={assignmentForm.start_year} onChangeText={(value) => setAssignmentForm((prev) => ({ ...prev, start_year: value.replace(/\D/g, "").slice(0, 4) }))} keyboardType="numeric" />
              <Text style={[styles.inputLabel, { color: theme.text }]}>Monthly Fee</Text>
              <TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={assignmentForm.monthly_fee} onChangeText={(value) => setAssignmentForm((prev) => ({ ...prev, monthly_fee: value.replace(/[^\d.]/g, "") }))} keyboardType="numeric" placeholder="Monthly fee" placeholderTextColor={theme.mutedText} />
            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setAssignmentOpen(false)} disabled={saving}><Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtn, { backgroundColor: theme.primary }, saving && styles.disabled]} onPress={handleCreateAssignment} disabled={saving}><Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>{saving ? "Saving..." : "Save"}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={paymentOpen} transparent animationType="slide" onRequestClose={() => setPaymentOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]} onPress={() => setPaymentOpen(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Transportation Payment</Text>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <SelectField label="Class" value={paymentForm.class_id ? String(paymentForm.class_id) : ""} onChange={(value) => setPaymentForm((prev) => ({ ...prev, class_id: value ? Number(value) : null, section_id: null, stream_id: null, student_id: null, due_id: null, amount_paid: "" }))} options={classOptions()} placeholder="Choose class" />
              {paymentNeedsStream ? <SelectField label="Stream" value={paymentForm.stream_id ? String(paymentForm.stream_id) : ""} onChange={(value) => setPaymentForm((prev) => ({ ...prev, stream_id: value ? Number(value) : null, student_id: null, due_id: null, amount_paid: "" }))} options={streams.map((item) => ({ label: item.name, value: String(item.id) }))} placeholder="Choose stream" /> : null}
              <SelectField label="Section" value={paymentForm.section_id ? String(paymentForm.section_id) : ""} onChange={(value) => setPaymentForm((prev) => ({ ...prev, section_id: value ? Number(value) : null, student_id: null, due_id: null, amount_paid: "" }))} options={sectionOptions(paymentClass)} placeholder="Choose section" disabled={!paymentClass} />
              <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={loadPaymentStudents}>
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Load Students</Text>
              </Pressable>
              <SelectField label="Student" value={paymentForm.student_id ? String(paymentForm.student_id) : ""} onChange={(value) => { const id = value ? Number(value) : null; setPaymentForm((prev) => ({ ...prev, student_id: id, due_id: null, amount_paid: "" })); void loadPaymentDues(id); }} options={paymentStudents.map((item) => ({ label: `${item.name}${item.roll_number ? ` - Roll ${item.roll_number}` : ""}`, value: String(item.id) }))} placeholder="Select student" disabled={!paymentStudents.length} />
              <SelectField label="Due Item" value={paymentForm.due_id ? String(paymentForm.due_id) : ""} onChange={(value) => { const id = value ? Number(value) : null; const due = paymentDues.find((item) => Number(item.id) === Number(id)); setPaymentForm((prev) => ({ ...prev, due_id: id, amount_paid: due ? String(due.remaining || "") : "" })); }} options={paymentDues.map((item) => ({ label: `${monthLabel(item.due_month, item.due_year)} - ${money(item.remaining)}`, value: String(item.id) }))} placeholder="Select due item" disabled={!paymentForm.student_id} />
              {selectedPaymentDue ? <Text style={[styles.helpText, { color: theme.subText }]}>Due {money(selectedPaymentDue.amount)} - Paid {money(selectedPaymentDue.paid)} - Remaining {money(selectedPaymentDue.remaining)}</Text> : null}
              <Text style={[styles.inputLabel, { color: theme.text }]}>Amount</Text>
              <TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={paymentForm.amount_paid} onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, amount_paid: value.replace(/[^\d.]/g, "") }))} keyboardType="numeric" placeholder="Amount" placeholderTextColor={theme.mutedText} />
              <Text style={[styles.inputLabel, { color: theme.text }]}>Remarks</Text>
              <TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={paymentForm.remarks} onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, remarks: value }))} placeholder="Optional remarks" placeholderTextColor={theme.mutedText} />
            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setPaymentOpen(false)} disabled={saving}><Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtn, { backgroundColor: theme.primary }, saving && styles.disabled]} onPress={handleCreatePayment} disabled={saving}><Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>{saving ? "Saving..." : "Save"}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]} onPress={() => setDeleteTarget(null)} />
          <View style={[styles.confirmCard, { backgroundColor: theme.card, borderColor: theme.dangerBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Delete Payment</Text>
            <Text style={[styles.confirmText, { color: theme.subText }]}>This will delete the transportation payment for {deleteTarget?.student_name || "this student"}.</Text>
            <View style={styles.modalFooter}>
              <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setDeleteTarget(null)} disabled={saving}><Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text></Pressable>
              <Pressable style={[styles.secondaryBtn, { borderColor: theme.dangerBorder, backgroundColor: theme.dangerSoft }, saving && styles.disabled]} onPress={handleDeletePayment} disabled={saving}><Text style={[styles.secondaryBtnText, { color: theme.danger }]}>{saving ? "Deleting..." : "Delete"}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(editPayment)} transparent animationType="slide" onRequestClose={() => setEditPayment(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]} onPress={() => setEditPayment(null)} />
          <View style={[styles.confirmCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Transportation Payment</Text>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Amount</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
              value={editPayment?.amount_paid || ""}
              onChangeText={(value) => setEditPayment((prev) => prev ? { ...prev, amount_paid: value.replace(/[^\d.]/g, "") } : prev)}
              keyboardType="numeric"
              placeholder="Amount"
              placeholderTextColor={theme.mutedText}
            />
            <Text style={[styles.inputLabel, { color: theme.text }]}>Remarks</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
              value={editPayment?.remarks || ""}
              onChangeText={(value) => setEditPayment((prev) => prev ? { ...prev, remarks: value } : prev)}
              placeholder="Optional remarks"
              placeholderTextColor={theme.mutedText}
            />
            <View style={styles.modalFooter}>
              <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setEditPayment(null)} disabled={saving}><Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtn, { backgroundColor: theme.primary }, saving && styles.disabled]} onPress={handleUpdatePayment} disabled={saving}><Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>{saving ? "Saving..." : "Update"}</Text></Pressable>
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
  heroActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  primaryBtn: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center", flex: 1 },
  primaryBtnText: { fontWeight: "700" },
  secondaryBtn: { minHeight: 44, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center", flex: 1 },
  secondaryBtnText: { fontWeight: "700" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { width: "48%", minHeight: 104, borderWidth: 1, borderRadius: 16, padding: 12, gap: 6 },
  summaryIcon: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  summaryValue: { fontSize: 18, fontWeight: "800" },
  summaryLabel: { fontSize: 12, fontWeight: "700" },
  sectionCard: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  sectionHint: { fontSize: 12, fontWeight: "700" },
  listCard: { borderWidth: 1, borderRadius: 14, padding: 11, gap: 7 },
  listCopy: { flex: 1, minWidth: 0, gap: 2 },
  listTitle: { fontSize: 15, fontWeight: "800" },
  listMeta: { fontSize: 12.5, lineHeight: 18 },
  amountText: { fontSize: 16, fontWeight: "800" },
  statusBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: "700" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  smallBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  smallBtnText: { fontSize: 12, fontWeight: "700" },
  emptyText: { lineHeight: 20 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalCard: { maxHeight: "88%", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  modalBody: { maxHeight: 540 },
  modalFooter: { flexDirection: "row", gap: 10, marginTop: 10 },
  inputLabel: { marginTop: 8, marginBottom: 6, fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11 },
  monthWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthChip: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#f8fafc" },
  monthChipText: { color: "#475569", fontSize: 12, fontWeight: "700" },
  helpText: { fontSize: 12, fontWeight: "600", marginTop: 6 },
  confirmCard: { marginHorizontal: 18, marginBottom: 100, borderWidth: 1, borderRadius: 22, padding: 18, gap: 10 },
  confirmText: { lineHeight: 20 },
  disabled: { opacity: 0.55 },
});

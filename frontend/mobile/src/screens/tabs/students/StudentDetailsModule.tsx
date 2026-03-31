import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getStudentById, type StudentDetails } from "../../../services/studentsService";
import { getMyPayments, getMyStudentFeeOptions, getPayments, getStudentFeeOptions, type PaymentItem, type StudentFeeOption } from "../../../services/paymentsService";
import { downloadMyMarksheet, downloadStudentMarksheet, getAccessibleExams, getMyResults, getStudentReport, type StudentReport } from "../../../services/reportsService";
import { getStudentAttendanceSessions, type StudentAttendanceSessionItem } from "../../../services/attendanceService";
import { useAuthStore } from "../../../store/authStore";
import { useAppTheme } from "../../../theme/AppThemeProvider";
import { formatDateLabel } from "../../../utils/format";
import DateField from "../../../components/form/DateField";
import TopNotice from "../../../components/feedback/TopNotice";

type TabKey = "overview" | "parents" | "attendance" | "fees" | "reports";
type ExamOption = { id: number; name: string };
type Props = { studentId: number | null; exams: ExamOption[] };
type Notice = { title: string; message: string; tone: "success" | "error" } | null;

const fmtScope = (value?: string | null) => String(value || "").trim().toLowerCase() === "hs" ? "Higher Secondary" : "School";
const fmtCurrency = (value?: number | string | null) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
const norm = (value?: string | null, fallback = "-") => String(value || "").trim().toLowerCase() || fallback;
const title = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
const resolvePhoto = (photoUrl?: string | null) => !photoUrl ? null : /^https?:\/\//i.test(photoUrl) ? photoUrl : `https://kalongkapilividyapith.com${String(photoUrl).startsWith("/") ? photoUrl : `/${photoUrl}`}`;

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err && "response" in err) {
    const data = (err as { response?: { data?: { message?: string; error?: string } } }).response?.data;
    return data?.error || data?.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function statusPalette(value: string) {
  if (["paid", "approved", "present"].includes(value)) return { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", color: "#15803d" };
  if (["partial", "pending", "late"].includes(value)) return { borderColor: "#fde68a", backgroundColor: "#fffbeb", color: "#b45309" };
  if (["absent", "rejected"].includes(value)) return { borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#b91c1c" };
  return { borderColor: "#cbd5e1", backgroundColor: "#f8fafc", color: "#475569" };
}

function summaryPalette(tone: "default" | "blue" | "green" | "violet", isDark: boolean) {
  if (tone === "blue") {
    return {
      borderColor: isDark ? "#1d4ed8" : "#bfdbfe",
      backgroundColor: isDark ? "#172554" : "#eff6ff",
      color: isDark ? "#bfdbfe" : "#1d4ed8",
    };
  }
  if (tone === "green") {
    return {
      borderColor: isDark ? "#15803d" : "#bbf7d0",
      backgroundColor: isDark ? "#14532d" : "#f0fdf4",
      color: isDark ? "#bbf7d0" : "#15803d",
    };
  }
  if (tone === "violet") {
    return {
      borderColor: isDark ? "#7c3aed" : "#ddd6fe",
      backgroundColor: isDark ? "#3b0764" : "#f5f3ff",
      color: isDark ? "#ddd6fe" : "#6d28d9",
    };
  }
  return {
    borderColor: isDark ? "#475569" : "#e2e8f0",
    backgroundColor: isDark ? "#1e293b" : "#ffffff",
    color: isDark ? "#f8fafc" : "#0f172a",
  };
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  return <Pressable style={[styles.filterChip, { borderColor: theme.border, backgroundColor: theme.cardMuted }, active && { borderColor: theme.primary, backgroundColor: theme.primary }]} onPress={onPress}><Text style={[styles.filterChipText, { color: theme.subText }, active && { color: theme.primaryText }]}>{label}</Text></Pressable>;
}

function StatusChip({ value }: { value: string }) {
  const palette = statusPalette(norm(value));
  return <View style={[styles.statusChip, { borderColor: palette.borderColor, backgroundColor: palette.backgroundColor }]}><Text style={[styles.statusChipText, { color: palette.color }]}>{title(norm(value))}</Text></View>;
}

function SectionCard({ title: heading, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const { theme } = useAppTheme();
  return <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}><View style={styles.rowBetween}><Text style={[styles.sectionTitle, { color: theme.text }]}>{heading}</Text>{hint ? <Text style={[styles.sectionHint, { color: theme.subText }]}>{hint}</Text> : null}</View>{children}</View>;
}

function SummaryCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "blue" | "green" | "violet" }) {
  const { theme } = useAppTheme();
  const palette = summaryPalette(tone, theme.isDark);
  return <View style={[styles.summaryCard, { borderColor: palette.borderColor, backgroundColor: palette.backgroundColor }]}><Text style={[styles.summaryValue, { color: palette.color }]}>{value}</Text><Text style={[styles.summaryLabel, { color: theme.subText }]}>{label}</Text></View>;
}

function MetricBar({ label, value, total, color, trackColor, caption }: { label: string; value: number; total: number; color: string; trackColor: string; caption: string }) {
  const { theme } = useAppTheme();
  const width = total > 0 ? Math.max(6, Math.min(100, (value / total) * 100)) : 0;
  return <View style={[styles.metricBarCard, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}><View style={styles.rowBetween}><Text style={[styles.metricBarLabel, { color: theme.text }]}>{label}</Text><Text style={[styles.metricBarCaption, { color: theme.subText }]}>{caption}</Text></View><View style={[styles.metricTrack, { backgroundColor: trackColor }]}><View style={[styles.metricFill, { width: `${width}%`, backgroundColor: color }]} /></View></View>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return <View style={[styles.infoRow, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}><Text style={[styles.infoLabel, { color: theme.subText }]}>{label}</Text><Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text></View>;
}

export default function StudentDetailsModule({ studentId, exams }: Props) {
  const { theme } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const isParent = Boolean(user?.roles?.includes("parent"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [feeItems, setFeeItems] = useState<StudentFeeOption[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [reportExams, setReportExams] = useState<ExamOption[]>(exams || []);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [report, setReport] = useState<StudentReport | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<StudentAttendanceSessionItem[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [attendanceFilters, setAttendanceFilters] = useState({ status: "", approval_status: "", date_from: "", date_to: "" });

  useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(null), 3200); return () => clearTimeout(timer); }, [notice]);

  useEffect(() => {
    if (!studentId) return;
    let ignore = false;
    setActiveTab("overview");
    setSelectedExamId(null);
    setReport(null);
    setReportError(null);
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [detail, examRows] = await Promise.all([getStudentById(studentId), isParent ? getAccessibleExams() : Promise.resolve(exams)]);
        if (ignore) return;
        setStudent(detail);
        setReportExams((examRows || []).map((item) => ({ id: Number(item.id), name: item.name })));
      } catch (err: unknown) {
        if (!ignore) {
          setStudent(null);
          setError(getErrorMessage(err, "Failed to load student details."));
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [studentId, isParent, exams]);

  useEffect(() => {
    if (!studentId) return;
    let ignore = false;
    (async () => {
      setFinanceError(null);
      try {
        const [feeRows, paymentRows] = await Promise.all(isParent ? [getMyStudentFeeOptions(studentId), getMyPayments({ student_id: studentId })] : [getStudentFeeOptions(studentId), getPayments({ student_id: studentId })]);
        if (ignore) return;
        setFeeItems(feeRows);
        setPayments(paymentRows);
      } catch (err: unknown) {
        if (!ignore) {
          setFeeItems([]);
          setPayments([]);
          setFinanceError(getErrorMessage(err, "Failed to load fees and payments."));
        }
      }
    })();
    return () => { ignore = true; };
  }, [studentId, isParent]);

  useEffect(() => {
    if (!studentId) return;
    let ignore = false;
    (async () => {
      setAttendanceLoading(true);
      setAttendanceError(null);
      try {
        const rows = await getStudentAttendanceSessions({
          student_id: studentId,
          status: attendanceFilters.status || undefined,
          approval_status: attendanceFilters.approval_status || undefined,
          date_from: attendanceFilters.date_from || undefined,
          date_to: attendanceFilters.date_to || undefined,
        });
        if (!ignore) setAttendanceRows(rows);
      } catch (err: unknown) {
        if (!ignore) {
          setAttendanceRows([]);
          setAttendanceError(getErrorMessage(err, "Failed to load attendance records."));
        }
      } finally {
        if (!ignore) setAttendanceLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [studentId, attendanceFilters.status, attendanceFilters.approval_status, attendanceFilters.date_from, attendanceFilters.date_to]);

  useEffect(() => {
    if (!studentId || !selectedExamId) {
      setReport(null);
      setReportError(null);
      return;
    }
    let ignore = false;
    (async () => {
      setReportLoading(true);
      setReportError(null);
      try {
        const next = await (isParent ? getMyResults({ exam_id: selectedExamId, student_id: studentId }) : getStudentReport(selectedExamId, studentId));
        if (!ignore) setReport(next);
      } catch (err: unknown) {
        if (!ignore) {
          setReport(null);
          setReportError(getErrorMessage(err, "Report not available for this exam."));
        }
      } finally {
        if (!ignore) setReportLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [studentId, selectedExamId, isParent]);

  const father = useMemo(() => student?.parents?.find((parent) => String(parent.relationship || "").toLowerCase() === "father"), [student]);
  const mother = useMemo(() => student?.parents?.find((parent) => String(parent.relationship || "").toLowerCase() === "mother"), [student]);
  const photoUri = resolvePhoto(student?.photo_url);
  const totalDue = useMemo(() => feeItems.reduce((sum, item) => sum + Number(item.remaining || 0), 0), [feeItems]);
  const totalPaid = useMemo(() => payments.reduce((sum, item) => sum + Number(item.amount_paid || 0), 0), [payments]);
  const approvedAttendance = useMemo(() => attendanceRows.filter((row) => norm(row.approval_status, "") === "approved").length, [attendanceRows]);
  const attendanceTotal = attendanceRows.length;
  const paymentTotal = totalPaid + totalDue;

  async function handleDownloadMarksheet() {
    if (!selectedExamId || !student?.id) return;
    try {
      if (isParent) await downloadMyMarksheet({ exam_id: selectedExamId, student_id: student.id });
      else await downloadStudentMarksheet(selectedExamId, student.id);
      setNotice({ title: "Marksheet ready", message: "The PDF is ready for download or sharing.", tone: "success" });
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to download marksheet.");
      setNotice({ title: "Download failed", message, tone: "error" });
      Alert.alert("Download failed", message);
    }
  }

  if (!studentId) return <Text style={[styles.emptyText, { color: theme.subText }]}>Select a student to view details.</Text>;
  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={theme.text} /></View>;
  if (error) return <View style={[styles.noticeCard, styles.noticeError]}><Text style={[styles.noticeTitle, { color: theme.text }]}>Student unavailable</Text><Text style={[styles.noticeMessage, { color: theme.subText }]}>{error}</Text></View>;
  if (!student) return <Text style={[styles.emptyText, { color: theme.subText }]}>Student not found.</Text>;

  return (
    <View style={styles.root}>
      <TopNotice notice={notice} style={styles.topNoticeOverlay} />
      <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.heroEyebrow, { color: theme.subText }]}>Overview</Text>
        <View style={styles.heroTop}>
          {photoUri ? <Image source={{ uri: photoUri }} style={[styles.photo, { backgroundColor: theme.cardMuted }]} /> : <View style={[styles.avatarFallback, { backgroundColor: theme.cardMuted }]}><Text style={[styles.avatarText, { color: theme.text }]}>{(student.name || "S").slice(0, 1).toUpperCase()}</Text></View>}
          <View style={styles.heroCopy}>
            <Text style={[styles.title, { color: theme.text }]}>{student.name}</Text>
            <Text style={[styles.subtitle, { color: theme.subText }]}>{student.class || "-"} / {student.section || "-"} • {fmtScope(student.class_scope)}</Text>
            <Text style={[styles.heroMeta, { color: theme.subText }]}>Admission {student.admission_no || "-"} • Roll {student.roll_number || "-"}</Text>
            <View style={styles.badgeRow}>
              <StatusChip value={String(student.gender || "-")} />
              <StatusChip value={fmtScope(student.class_scope)} />
              {student.class_scope === "hs" && student.stream_name ? <StatusChip value={student.stream_name} /> : null}
            </View>
          </View>
        </View>
        <View style={styles.summaryGrid}>
          <SummaryCard label="Session" value={student.session || "-"} tone="blue" />
          <SummaryCard label="Approved Days" value={approvedAttendance} tone="green" />
          <SummaryCard label="Outstanding" value={fmtCurrency(totalDue)} tone="violet" />
          <SummaryCard label="Paid Total" value={fmtCurrency(totalPaid)} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {(["overview", "parents", "attendance", "fees", "reports"] as TabKey[]).map((tab) => <FilterChip key={tab} label={title(tab)} active={activeTab === tab} onPress={() => setActiveTab(tab)} />)}
      </ScrollView>

      {activeTab === "overview" ? (
        <SectionCard title="Student Overview" hint={`#${student.id}`}>
          <View style={styles.infoGrid}>
            <InfoRow label="Class" value={student.class || "-"} />
            <InfoRow label="Section" value={student.section || "-"} />
            <InfoRow label="Mobile" value={student.mobile || "-"} />
            <InfoRow label="Gender" value={student.gender || "-"} />
            <InfoRow label="DOB" value={formatDateLabel(student.dob)} />
            <InfoRow label="Admission" value={formatDateLabel(student.date_of_admission)} />
            <InfoRow label="Scope" value={fmtScope(student.class_scope)} />
            <InfoRow label="Stream" value={String(student.class_scope || "").toLowerCase() === "hs" ? student.stream_name || "-" : "-"} />
          </View>
        </SectionCard>
      ) : null}

      {activeTab === "parents" ? (
        <View style={styles.twoColumn}>
          <SectionCard title="Father">
            <InfoRow label="Name" value={father?.name || "-"} />
            <InfoRow label="Phone" value={father?.mobile || "-"} />
            <InfoRow label="Email" value={father?.email || "-"} />
            <InfoRow label="Occupation" value={father?.occupation || "-"} />
            <InfoRow label="Qualification" value={father?.qualification || "-"} />
          </SectionCard>
          <SectionCard title="Mother">
            <InfoRow label="Name" value={mother?.name || "-"} />
            <InfoRow label="Phone" value={mother?.mobile || "-"} />
            <InfoRow label="Email" value={mother?.email || "-"} />
            <InfoRow label="Occupation" value={mother?.occupation || "-"} />
            <InfoRow label="Qualification" value={mother?.qualification || "-"} />
          </SectionCard>
        </View>
      ) : null}

      {activeTab === "attendance" ? (
        <SectionCard title="Attendance History" hint={`${attendanceRows.length} records`}>
          {attendanceTotal ? <MetricBar label="Approved Attendance" value={approvedAttendance} total={attendanceTotal} color="#15803d" trackColor="#dcfce7" caption={`${approvedAttendance}/${attendanceTotal}`} /> : null}
          <View style={styles.filterBlock}>
            <Text style={styles.inputLabel}>Date range</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <DateField value={attendanceFilters.date_from} onChange={(value) => setAttendanceFilters((prev) => ({ ...prev, date_from: value }))} placeholder="From date" />
              </View>
              <View style={styles.inputHalf}>
                <DateField value={attendanceFilters.date_to} onChange={(value) => setAttendanceFilters((prev) => ({ ...prev, date_to: value }))} placeholder="To date" />
              </View>
            </View>
            <Text style={styles.inputLabel}>Attendance status</Text>
            <View style={styles.filterWrap}>
              <FilterChip label="All" active={!attendanceFilters.status} onPress={() => setAttendanceFilters((prev) => ({ ...prev, status: "" }))} />
              {["present", "absent"].map((status) => <FilterChip key={status} label={title(status)} active={attendanceFilters.status === status} onPress={() => setAttendanceFilters((prev) => ({ ...prev, status }))} />)}
            </View>
            <Text style={styles.inputLabel}>Approval</Text>
            <View style={styles.filterWrap}>
              <FilterChip label="All" active={!attendanceFilters.approval_status} onPress={() => setAttendanceFilters((prev) => ({ ...prev, approval_status: "" }))} />
              {["approved", "pending", "rejected"].map((status) => <FilterChip key={status} label={title(status)} active={attendanceFilters.approval_status === status} onPress={() => setAttendanceFilters((prev) => ({ ...prev, approval_status: status }))} />)}
            </View>
            <Pressable style={styles.secondaryBtn} onPress={() => setAttendanceFilters({ status: "", approval_status: "", date_from: "", date_to: "" })}><Text style={styles.secondaryBtnText}>Reset Filters</Text></Pressable>
          </View>
          {attendanceLoading ? <ActivityIndicator color={theme.text} /> : null}
          {attendanceError ? <Text style={styles.errorText}>{attendanceError}</Text> : null}
          {attendanceRows.length ? attendanceRows.map((row) => (
            <View key={row.id} style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
              <View style={styles.rowBetween}>
                <View style={styles.listCopy}>
                  <Text style={[styles.listTitle, { color: theme.text }]}>{formatDateLabel(row.date)}</Text>
                  <Text style={[styles.listMeta, { color: theme.subText }]}>{row.class_name || "-"} / {row.section_name || "-"} • {row.session_name || "-"}</Text>
                </View>
                <StatusChip value={String(row.approval_status || "-")} />
              </View>
              <View style={styles.rowBetween}>
                <Text style={[styles.listMeta, { color: theme.subText }]}>Attendance status</Text>
                <StatusChip value={String(row.student_status || "-")} />
              </View>
              <View style={styles.metaPillRow}>
                <Text style={[styles.listMeta, { color: theme.subText }]}>Marked {row.submitted_by_username || "-"}</Text>
                <Text style={[styles.listMeta, { color: theme.subText }]}>Reviewed {row.reviewed_by_username || "-"}</Text>
              </View>
            </View>
          )) : !attendanceLoading ? <Text style={styles.emptyText}>No attendance records found for this student.</Text> : null}
        </SectionCard>
      ) : null}

      {activeTab === "fees" ? (
        <>
          <SectionCard title="Fee Summary" hint="Live backend ledger">
            <View style={styles.summaryGrid}>
              <SummaryCard label="Active Items" value={feeItems.length} tone="blue" />
              <SummaryCard label="Outstanding" value={fmtCurrency(totalDue)} tone="violet" />
              <SummaryCard label="Payments" value={payments.length} tone="green" />
              <SummaryCard label="Paid Total" value={fmtCurrency(totalPaid)} />
            </View>
            {paymentTotal ? <MetricBar label="Payment Coverage" value={totalPaid} total={paymentTotal} color="#6d28d9" trackColor="#ede9fe" caption={`${Math.round((totalPaid / paymentTotal) * 100)}% paid`} /> : null}
            {financeError ? <Text style={styles.errorText}>{financeError}</Text> : null}
          </SectionCard>
          <SectionCard title="Pending / Active Fee Items" hint={`${feeItems.length} rows`}>
            {feeItems.length ? feeItems.map((item) => (
              <View key={item.id} style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
                <View style={styles.rowBetween}>
                  <View style={styles.listCopy}>
                    <Text style={[styles.listTitle, { color: theme.text }]}>{item.installment_name || item.fee_type}</Text>
                    <Text style={[styles.listMeta, { color: theme.subText }]}>Due {formatDateLabel(item.due_date)}</Text>
                  </View>
                  <StatusChip value={norm(item.status)} />
                </View>
                <Text style={[styles.listMeta, { color: theme.subText }]}>Total {fmtCurrency(item.amount)} • Paid {fmtCurrency(item.paid)} • Remaining {fmtCurrency(item.remaining)}</Text>
              </View>
            )) : <Text style={styles.emptyText}>No pending fee items for this student.</Text>}
          </SectionCard>
          <SectionCard title="Payment History" hint={`${payments.length} entries`}>
            {payments.length ? payments.map((payment) => (
              <View key={`${payment.id}-${payment.created_at}`} style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
                <View style={styles.rowBetween}>
                  <View style={styles.listCopy}>
                    <Text style={[styles.listTitle, { color: theme.text }]}>{payment.fee_type || "-"}</Text>
                    <Text style={[styles.listMeta, { color: theme.subText }]}>{formatDateLabel(payment.payment_date || payment.created_at)}</Text>
                  </View>
                  <StatusChip value={norm(payment.fee_status || payment.status)} />
                </View>
                <Text style={[styles.listAmount, { color: theme.text }]}>{fmtCurrency(payment.amount_paid)}</Text>
                <View style={styles.metaStack}>
                  <Text style={[styles.listMeta, { color: theme.subText }]}>{payment.class_name || "-"} / {payment.section_name || "-"}</Text>
                  <Text style={[styles.listMeta, { color: theme.subText }]}>Remarks: {payment.remarks || "-"}</Text>
                </View>
              </View>
            )) : <Text style={styles.emptyText}>No payment history found for this student.</Text>}
          </SectionCard>
        </>
      ) : null}

      {activeTab === "reports" ? (
        <>
          <SectionCard title="Exam Report" hint={selectedExamId ? "Exam selected" : "Select an exam"}>
            <Text style={styles.inputLabel}>Exam</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterWrap}>
              {reportExams.map((exam) => <FilterChip key={exam.id} label={exam.name} active={selectedExamId === exam.id} onPress={() => setSelectedExamId(exam.id)} />)}
            </ScrollView>
            <View style={styles.actionRow}>
              <Pressable style={[styles.primaryBtn, { backgroundColor: theme.primary }, (!selectedExamId || !report) && styles.btnDisabled]} disabled={!selectedExamId || !report} onPress={handleDownloadMarksheet}><Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>Download Marksheet</Text></Pressable>
            </View>
            {reportLoading ? <ActivityIndicator color={theme.text} /> : null}
            {reportError ? <Text style={styles.errorText}>{reportError}</Text> : null}
            {!selectedExamId ? <Text style={styles.emptyText}>Select an exam to view results.</Text> : null}
          </SectionCard>
          {report ? (
            <>
              <SectionCard title={report.exam?.name || "Exam Report"} hint={`${report.exam?.class_name || "-"} / ${report.exam?.section_name || "-"}`}>
                <View style={styles.summaryGrid}>
                  <SummaryCard label="Total" value={report.summary?.total ?? 0} tone="blue" />
                  <SummaryCard label="Max Total" value={report.summary?.max_total ?? 0} />
                  <SummaryCard label="Percentage" value={`${report.summary?.percentage ?? 0}%`} tone="green" />
                  <SummaryCard label="Subjects" value={report.subjects?.length || 0} tone="violet" />
                </View>
                <MetricBar label="Result Percentage" value={Number(report.summary?.percentage ?? 0)} total={100} color="#15803d" trackColor="#dcfce7" caption={`${Number(report.summary?.percentage ?? 0).toFixed(1)}%`} />
              </SectionCard>
              <SectionCard title="Subject Breakdown" hint={`${report.subjects?.length || 0} subjects`}>
                {(report.subjects || []).map((subject, index) => (
                  <View key={`${subject.subject}-${index}`} style={[styles.subjectCard, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
                    <View style={styles.listCopy}>
                      <Text style={[styles.listTitle, { color: theme.text }]}>{subject.subject}</Text>
                      <Text style={[styles.listMeta, { color: theme.subText }]}>Max marks {subject.max_marks}</Text>
                    </View>
                    <View style={styles.subjectMarks}>
                      <Text style={[styles.subjectMarksValue, { color: theme.text }]}>{subject.marks}</Text>
                      <Text style={[styles.subjectMarksMeta, { color: theme.subText }]}>scored</Text>
                    </View>
                  </View>
                ))}
              </SectionCard>
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "relative", gap: 14, paddingBottom: 8 },
  centered: { minHeight: 260, alignItems: "center", justifyContent: "center" },
  topNoticeOverlay: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, elevation: 20 },
  heroCard: { backgroundColor: "#ffffff", borderRadius: 24, borderWidth: 1, borderColor: "#e2e8f0", padding: 16, gap: 12 },
  heroEyebrow: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: -2 },
  heroTop: { flexDirection: "row", gap: 14 },
  photo: { width: 76, height: 76, borderRadius: 22, backgroundColor: "#e2e8f0" },
  avatarFallback: { width: 76, height: 76, borderRadius: 22, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#0f172a", fontWeight: "800", fontSize: 28 },
  heroCopy: { flex: 1, gap: 4 },
  title: { color: "#0f172a", fontWeight: "800", fontSize: 22 },
  subtitle: { color: "#475569", fontWeight: "700" },
  heroMeta: { color: "#64748b", lineHeight: 18 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  tabsRow: { gap: 8, paddingBottom: 2 },
  filterChip: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f8fafc" },
  filterChipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  filterChipText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  filterChipTextActive: { color: "#ffffff" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { width: "48%", minHeight: 76, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "space-between" },
  summaryValue: { fontSize: 20, fontWeight: "800" },
  summaryLabel: { color: "#64748b", fontSize: 12, fontWeight: "700" },
  metricBarCard: { gap: 6, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, backgroundColor: "#f8fafc", paddingHorizontal: 12, paddingVertical: 10 },
  metricBarLabel: { color: "#334155", fontWeight: "700", fontSize: 12 },
  metricBarCaption: { color: "#64748b", fontSize: 12, fontWeight: "700" },
  metricTrack: { height: 8, borderRadius: 999, overflow: "hidden" },
  metricFill: { height: "100%", borderRadius: 999 },
  noticeCard: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  noticeSuccess: { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4" },
  noticeError: { borderColor: "#fecaca", backgroundColor: "#fef2f2" },
  noticeTitle: { color: "#0f172a", fontWeight: "800", marginBottom: 2 },
  noticeMessage: { color: "#475569" },
  sectionCard: { backgroundColor: "#ffffff", borderRadius: 22, borderWidth: 1, borderColor: "#e2e8f0", padding: 16, gap: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  sectionTitle: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  sectionHint: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  infoGrid: { gap: 8 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, backgroundColor: "#f8fafc", paddingHorizontal: 12, paddingVertical: 9 },
  infoLabel: { color: "#64748b", fontWeight: "700" },
  infoValue: { color: "#0f172a", fontWeight: "700", flexShrink: 1, textAlign: "right" },
  twoColumn: { gap: 14 },
  inputLabel: { color: "#334155", fontWeight: "700" },
  filterBlock: { gap: 10 },
  inputRow: { flexDirection: "row", gap: 10 },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, backgroundColor: "#ffffff", paddingHorizontal: 12, paddingVertical: 11, color: "#0f172a" },
  inputHalf: { flex: 1 },
  filterWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  secondaryBtn: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: "#334155", fontWeight: "700" },
  primaryBtn: { backgroundColor: "#0f172a", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "#ffffff", fontWeight: "700" },
  btnDisabled: { opacity: 0.45 },
  actionRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  listCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, backgroundColor: "#f8fafc", padding: 10, gap: 5 },
  listCopy: { flex: 1, gap: 2 },
  listTitle: { color: "#0f172a", fontWeight: "700", fontSize: 14 },
  listMeta: { color: "#64748b", fontSize: 12, lineHeight: 18 },
  listAmount: { color: "#0f172a", fontWeight: "800", fontSize: 18 },
  metaStack: { gap: 2 },
  metaPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  statusChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusChipText: { fontSize: 12, fontWeight: "700" },
  subjectCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, backgroundColor: "#f8fafc", padding: 10 },
  subjectMarks: { alignItems: "flex-end" },
  subjectMarksValue: { color: "#0f172a", fontWeight: "800", fontSize: 18 },
  subjectMarksMeta: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  emptyText: { color: "#64748b" },
  errorText: { color: "#b91c1c" },
});

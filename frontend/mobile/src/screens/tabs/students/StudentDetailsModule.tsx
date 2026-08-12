import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getStudentById, updateStudent, type StudentDetails } from "../../../services/studentsService";
import {
  createTransportAssignment,
  downloadAndShareReceipt,
  downloadAndShareTransportReceipt,
  endTransportAssignment,
  getMyPayments,
  getMyStudentFeeOptions,
  getPayments,
  getStudentFeeOptions,
  getTransportAssignments,
  getTransportDues,
  getTransportPayments,
  type PaymentItem,
  type StudentFeeOption,
  type TransportAssignment,
  type TransportDue,
  type TransportPayment,
} from "../../../services/paymentsService";
import { downloadMyMarksheet, downloadStudentMarksheet, getAccessibleExams, getMyResults, getStudentReport, type StudentReport } from "../../../services/reportsService";
import { getStudentAttendanceSessions, type StudentAttendanceSessionItem } from "../../../services/attendanceService";
import {
  getStudentSubjectRegistrations,
  replaceStudentSubjectRegistrations,
  type StudentSubjectRegistrationDetails,
} from "../../../services/subjectsService";
import { useAuthStore } from "../../../store/authStore";
import { useAppTheme } from "../../../theme/AppThemeProvider";
import { formatDateLabel } from "../../../utils/format";
import DateField from "../../../components/form/DateField";
import TopNotice from "../../../components/feedback/TopNotice";

type TabKey = "overview" | "parents" | "subjects" | "attendance" | "fees" | "transportation" | "reports";
type ExamOption = { id: number; name: string };
type Props = { studentId: number | null };
type Notice = { title: string; message: string; tone: "success" | "error" } | null;
type ParentRole = "father" | "mother";
type ParentField = "name" | "mobile" | "email" | "occupation" | "qualification";
type ParentDraft = Record<ParentRole, Record<ParentField, string>>;
type TransportForm = { enabled: boolean; monthly_fee: string; start_month: string; start_year: string };
type SummaryTone = "default" | "blue" | "green" | "violet" | "orange";

const EMPTY_PARENT_DRAFT: ParentDraft = {
  father: { name: "", mobile: "", email: "", occupation: "", qualification: "" },
  mother: { name: "", mobile: "", email: "", occupation: "", qualification: "" },
};
const TRANSPORT_MONTHS = [
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

const fmtScope = (value?: string | null) => String(value || "").trim().toLowerCase() === "hs" ? "Higher Secondary" : "School";
const fmtCurrency = (value?: number | string | null) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
const getFeeName = (row?: { fee_name?: string | null; installment_name?: string | null; fee_type?: string | null }) => {
  const directFeeName = String(row?.fee_name || "").trim();
  if (directFeeName) return directFeeName;
  const feeName = String(row?.installment_name || "").trim();
  if (feeName) return feeName;
  return String(row?.fee_type || "").toLowerCase() === "admission" ? "Admission Fee" : "-";
};
const norm = (value?: string | null, fallback = "-") => String(value || "").trim().toLowerCase() || fallback;
const title = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
const displayMarkValue = (value?: string | number | null, status?: string | null) => norm(status, "") === "absent" ? "AB" : value ?? "-";
const tabLabel = (value: TabKey) => value === "subjects" ? "Subject Selection" : value === "fees" ? "Fees & Payments" : value === "reports" ? "Marksheet" : title(value);
const tabIcon = (value: TabKey): keyof typeof Ionicons.glyphMap => {
  if (value === "parents") return "people-outline";
  if (value === "subjects") return "book-outline";
  if (value === "attendance") return "calendar-outline";
  if (value === "fees") return "wallet-outline";
  if (value === "transportation") return "bus-outline";
  if (value === "reports") return "document-text-outline";
  return "grid-outline";
};
const formatTransportMonth = (month?: number | string | null, year?: number | string | null) => `${TRANSPORT_MONTHS.find(([value]) => Number(value) === Number(month))?.[1] || month || "-"}${year ? ` ${year}` : ""}`;
const resolvePhoto = (photoUrl?: string | null) => !photoUrl ? null : /^https?:\/\//i.test(photoUrl) ? photoUrl : `https://kalongkapilividyapith.com${String(photoUrl).startsWith("/") ? photoUrl : `/${photoUrl}`}`;
const toDialablePhone = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw || raw === "-") return null;

  const compact = raw.replace(/[^\d+]/g, "");
  if (!compact) return null;

  const normalized = compact.startsWith("+")
    ? `+${compact.slice(1).replace(/\+/g, "")}`
    : compact.replace(/\+/g, "");
  const digitsOnly = normalized.replace(/^\+/, "");

  if (!/^\d{7,15}$/.test(digitsOnly)) return null;
  return normalized;
};
const toMailAddress = (value?: string | null) => {
  const email = String(value || "").trim();
  return /^\S+@\S+\.\S+$/.test(email) ? email : null;
};

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

function identityPalette(kind: "gender" | "scope" | "stream", value: string, isDark: boolean) {
  const normalized = norm(value, "");
  if (kind === "gender") {
    if (normalized === "male") return summaryPalette("blue", isDark);
    if (normalized === "female") return summaryPalette("violet", isDark);
    return summaryPalette("orange", isDark);
  }
  if (kind === "scope") {
    return normalized.includes("higher") || normalized === "hs"
      ? summaryPalette("green", isDark)
      : summaryPalette("blue", isDark);
  }
  return summaryPalette("orange", isDark);
}

function summaryPalette(tone: SummaryTone, isDark: boolean) {
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
  if (tone === "orange") {
    return {
      borderColor: isDark ? "#9a3412" : "#fed7aa",
      backgroundColor: isDark ? "#431407" : "#fff7ed",
      color: isDark ? "#fed7aa" : "#ea580c",
    };
  }
  return {
    borderColor: isDark ? "#475569" : "#e2e8f0",
    backgroundColor: isDark ? "#1e293b" : "#ffffff",
    color: isDark ? "#f8fafc" : "#0f172a",
  };
}

function FilterChip({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      style={[
        styles.filterChip,
        {
          borderColor: active ? theme.success : theme.border,
          backgroundColor: active ? theme.successSoft : "transparent",
        },
      ]}
      onPress={onPress}
    >
      {icon ? <Ionicons name={icon} size={16} color={active ? theme.success : theme.subText} /> : null}
      <Text style={[styles.filterChipText, { color: active ? theme.success : theme.subText }]}>{label}</Text>
    </Pressable>
  );
}

function StatusChip({ value }: { value: string }) {
  const palette = statusPalette(norm(value));
  return <View style={[styles.statusChip, { borderColor: palette.borderColor, backgroundColor: palette.backgroundColor }]}><Text style={[styles.statusChipText, { color: palette.color }]}>{title(norm(value))}</Text></View>;
}

function IdentityChip({ value, kind }: { value: string; kind: "gender" | "scope" | "stream" }) {
  const { theme } = useAppTheme();
  const palette = identityPalette(kind, value, theme.isDark);
  return <View style={[styles.statusChip, { borderColor: palette.borderColor, backgroundColor: palette.backgroundColor }]}><Text style={[styles.statusChipText, { color: palette.color }]}>{title(norm(value))}</Text></View>;
}

function SectionCard({ title: heading, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const { theme } = useAppTheme();
  return <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}><View style={styles.rowBetween}><Text style={[styles.sectionTitle, { color: theme.text }]}>{heading}</Text>{hint ? <Text style={[styles.sectionHint, { color: theme.subText }]}>{hint}</Text> : null}</View>{children}</View>;
}

function SummaryCard({ label, value, tone = "default", icon }: { label: string; value: string | number; tone?: SummaryTone; icon?: keyof typeof Ionicons.glyphMap }) {
  const { theme } = useAppTheme();
  const palette = summaryPalette(tone, theme.isDark);
  return (
    <View style={[styles.summaryCard, { borderColor: palette.borderColor, backgroundColor: palette.backgroundColor }]}>
      <View style={styles.summaryLabelRow}>
        {icon ? (
          <View style={[styles.summaryIcon, { backgroundColor: theme.card, borderColor: palette.borderColor }]}>
            <Ionicons name={icon} size={17} color={palette.color} />
          </View>
        ) : null}
        <Text style={[styles.summaryLabel, { color: theme.subText }]}>{label}</Text>
      </View>
      <Text style={[styles.summaryValue, { color: palette.color }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function CompactStat({ label, value, tone = "default" }: { label: string; value: string | number; tone?: SummaryTone }) {
  const { theme } = useAppTheme();
  const palette = summaryPalette(tone, theme.isDark);
  return (
    <View style={[styles.compactStatPill, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
      <Text style={[styles.compactStatValue, { color: palette.color }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.compactStatLabel, { color: theme.subText }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function DetailTabButton({ tab, active, onPress }: { tab: TabKey; active: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      style={[
        styles.detailTabButton,
        {
          borderColor: active ? theme.primary : theme.border,
          backgroundColor: active ? theme.primary : theme.card,
        },
      ]}
      onPress={onPress}
    >
      <Ionicons name={tabIcon(tab)} size={15} color={active ? theme.primaryText : theme.icon} />
      <Text style={[styles.detailTabText, { color: active ? theme.primaryText : theme.text }]} numberOfLines={1}>
        {tabLabel(tab)}
      </Text>
    </Pressable>
  );
}

function DetailIcon({ name, tone = "green" }: { name: keyof typeof Ionicons.glyphMap; tone?: SummaryTone }) {
  const { theme } = useAppTheme();
  const palette = summaryPalette(tone, theme.isDark);
  return (
    <View style={[styles.detailIcon, { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }]}>
      <Ionicons name={name} size={18} color={palette.color} />
    </View>
  );
}

function MetricBar({ label, value, total, color, trackColor, caption }: { label: string; value: number; total: number; color: string; trackColor: string; caption: string }) {
  const { theme } = useAppTheme();
  const width = total > 0 ? Math.max(6, Math.min(100, (value / total) * 100)) : 0;
  return <View style={[styles.metricBarCard, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}><View style={styles.rowBetween}><Text style={[styles.metricBarLabel, { color: theme.text }]}>{label}</Text><Text style={[styles.metricBarCaption, { color: theme.subText }]}>{caption}</Text></View><View style={[styles.metricTrack, { backgroundColor: trackColor }]}><View style={[styles.metricFill, { width: `${width}%`, backgroundColor: color }]} /></View></View>;
}

function InfoRow({ label, value, onPress, icon }: { label: string; value: string; onPress?: (() => void) | undefined; icon?: keyof typeof Ionicons.glyphMap }) {
  const { theme } = useAppTheme();
  const iconNode = icon ? (
    <View style={[styles.infoIcon, { backgroundColor: theme.successSoft }]}>
      <Ionicons name={icon} size={18} color={theme.success} />
    </View>
  ) : null;
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.infoRow, { borderColor: theme.border, backgroundColor: "transparent" }]}
      >
        {iconNode}
        <Text style={[styles.infoLabel, { color: theme.subText }]}>{label}</Text>
        <Text style={[styles.infoValue, styles.infoValueLink, { color: theme.primary }]} numberOfLines={2}>{value}</Text>
      </Pressable>
    );
  }
  return <View style={[styles.infoRow, { borderColor: theme.border, backgroundColor: "transparent" }]}>{iconNode}<Text style={[styles.infoLabel, { color: theme.subText }]}>{label}</Text><Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={2}>{value}</Text></View>;
}

function MarksheetPreview({ report, student }: { report: StudentReport; student: StudentDetails }) {
  const { theme } = useAppTheme();
  const subjects = report.subjects || [];
  const grade = String(report.summary?.grade || "-").trim() || "-";

  return (
    <View style={[styles.marksheetPreview, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <View style={[styles.marksheetHeader, { borderBottomColor: theme.border, backgroundColor: theme.cardMuted }]}>
        <Text style={[styles.marksheetEyebrow, { color: theme.subText }]}>Marksheet Preview</Text>
        <Text style={[styles.marksheetTitle, { color: theme.text }]}>{report.exam?.name || "Exam Marksheet"}</Text>
        <Text style={[styles.marksheetSubTitle, { color: theme.subText }]}>
          {report.exam?.class_name || "-"} / {report.exam?.section_name || "-"}
          {report.exam?.medium ? ` (${report.exam.medium})` : ""}
        </Text>
      </View>

      <View style={[styles.marksheetInfoGrid, { borderBottomColor: theme.border }]}>
        <View style={styles.marksheetInfoItem}>
          <DetailIcon name="person-outline" />
          <View style={styles.marksheetInfoCopy}>
            <Text style={[styles.marksheetInfoLabel, { color: theme.subText }]}>Student</Text>
            <Text style={[styles.marksheetInfoValue, { color: theme.text }]}>{report.student?.name || student.name || "-"}</Text>
          </View>
        </View>
        <View style={styles.marksheetInfoItem}>
          <DetailIcon name="reader-outline" tone="blue" />
          <View style={styles.marksheetInfoCopy}>
            <Text style={[styles.marksheetInfoLabel, { color: theme.subText }]}>Roll No</Text>
            <Text style={[styles.marksheetInfoValue, { color: theme.text }]}>{report.student?.roll_number || student.roll_number || "-"}</Text>
          </View>
        </View>
        <View style={styles.marksheetInfoItem}>
          <DetailIcon name="document-text-outline" tone="orange" />
          <View style={styles.marksheetInfoCopy}>
            <Text style={[styles.marksheetInfoLabel, { color: theme.subText }]}>Admission No</Text>
            <Text style={[styles.marksheetInfoValue, { color: theme.text }]}>{student.admission_no || "-"}</Text>
          </View>
        </View>
        <View style={styles.marksheetInfoItem}>
          <DetailIcon name="calendar-outline" tone="violet" />
          <View style={styles.marksheetInfoCopy}>
            <Text style={[styles.marksheetInfoLabel, { color: theme.subText }]}>Session</Text>
            <Text style={[styles.marksheetInfoValue, { color: theme.text }]}>{student.session || "-"}</Text>
          </View>
        </View>
      </View>

      <View style={styles.marksheetTable}>
        <View style={[styles.marksheetTableRow, styles.marksheetTableHead, { borderBottomColor: theme.border }]}>
          <Text style={[styles.marksheetSubjectHead, { color: theme.subText }]}>Subject</Text>
          <Text style={[styles.marksheetMarksHead, { color: theme.subText }]}>Marks{"\n"}Obtained</Text>
          <Text style={[styles.marksheetMarksHead, { color: theme.subText }]}>Total{"\n"}Marks</Text>
        </View>
        {subjects.map((subject, index) => (
          <View key={`${subject.subject}-${index}`} style={[styles.marksheetTableRow, { borderBottomColor: theme.border }]}>
            <Text style={[styles.marksheetSubjectCell, { color: theme.text }]}>{subject.subject}</Text>
            <Text style={[styles.marksheetMarksCell, { color: norm(subject.mark_status, "") === "absent" ? theme.danger : theme.text }]}>
              {displayMarkValue(subject.marks, subject.mark_status)}
            </Text>
            <Text style={[styles.marksheetMarksCell, { color: theme.text }]}>{subject.max_marks ?? "-"}</Text>
          </View>
        ))}
        <View style={[styles.marksheetTableRow, styles.marksheetTotalRow, { borderTopColor: theme.border }]}>
          <Text style={[styles.marksheetSubjectCell, styles.marksheetTotalText, { color: theme.text }]}>Grand Total</Text>
          <Text style={[styles.marksheetMarksCell, styles.marksheetTotalText, { color: theme.text }]}>{report.summary?.total ?? 0}</Text>
          <Text style={[styles.marksheetMarksCell, styles.marksheetTotalText, { color: theme.text }]}>{report.summary?.max_total ?? 0}</Text>
        </View>
      </View>

      <View style={[styles.marksheetSummaryRow, { borderTopColor: theme.border }]}>
        <View style={styles.marksheetSummaryItem}>
          <Text style={[styles.marksheetInfoLabel, { color: theme.subText }]}>Percentage</Text>
          <Text style={[styles.marksheetSummaryValue, { color: theme.text }]}>{report.summary?.percentage ?? 0}%</Text>
        </View>
        <View style={styles.marksheetSummaryItem}>
          <Text style={[styles.marksheetInfoLabel, { color: theme.subText }]}>Grade</Text>
          <Text style={[styles.marksheetSummaryValue, { color: theme.primary }]}>{grade}</Text>
        </View>
      </View>

      <Text style={[styles.marksheetFootnote, { color: theme.subText, borderTopColor: theme.border }]}>
        Preview only. Download the marksheet for the printable PDF.
      </Text>
    </View>
  );
}

export default function StudentDetailsModule({ studentId }: Props) {
  const { theme } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const isParent = Boolean(user?.roles?.includes("parent"));
  const isStudentUser = Boolean(user?.roles?.includes("student"));
  const canViewTransportation = !isStudentUser && Boolean(user?.permissions?.includes("fee.view"));
  const canEditTransportation = !isParent && !isStudentUser && Boolean(user?.permissions?.includes("fee.create"));
  const canEditParents = !isParent && Boolean(user?.permissions?.includes("student.update"));
  const canEditSubjectSelection = !isParent && Boolean(user?.permissions?.includes("student.update"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [feeItems, setFeeItems] = useState<StudentFeeOption[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [reportExams, setReportExams] = useState<ExamOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [report, setReport] = useState<StudentReport | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<StudentAttendanceSessionItem[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [attendanceFilters, setAttendanceFilters] = useState({ status: "", approval_status: "", date_from: "", date_to: "" });
  const [isEditingParents, setIsEditingParents] = useState(false);
  const [parentDraft, setParentDraft] = useState<ParentDraft>(EMPTY_PARENT_DRAFT);
  const [parentSaveError, setParentSaveError] = useState<string>("");
  const [parentSaveMessage, setParentSaveMessage] = useState<string>("");
  const [savingParents, setSavingParents] = useState(false);
  const [subjectSelection, setSubjectSelection] = useState<StudentSubjectRegistrationDetails>({ enrollment: null, offerings: [] });
  const [selectedOfferingIds, setSelectedOfferingIds] = useState<number[]>([]);
  const [subjectSelectionLoading, setSubjectSelectionLoading] = useState(false);
  const [subjectSelectionSaving, setSubjectSelectionSaving] = useState(false);
  const [subjectSelectionError, setSubjectSelectionError] = useState("");
  const [subjectSelectionMessage, setSubjectSelectionMessage] = useState("");
  const [transportAssignments, setTransportAssignments] = useState<TransportAssignment[]>([]);
  const [transportDues, setTransportDues] = useState<TransportDue[]>([]);
  const [transportPayments, setTransportPayments] = useState<TransportPayment[]>([]);
  const [transportError, setTransportError] = useState("");
  const [transportMessage, setTransportMessage] = useState("");
  const [transportSaving, setTransportSaving] = useState(false);
  const [transportDownloadingId, setTransportDownloadingId] = useState<number | null>(null);
  const [paymentReceiptDownloadingId, setPaymentReceiptDownloadingId] = useState<number | null>(null);
  const [transportForm, setTransportForm] = useState<TransportForm>({
    enabled: false,
    monthly_fee: "",
    start_month: "4",
    start_year: String(new Date().getFullYear()),
  });

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
        const detail = await getStudentById(studentId);
        const examRows = await getAccessibleExams(isParent ? {} : { student_id: detail.id });
        if (ignore) return;
        setStudent(detail);
        setReportExams((examRows || []).map((item) => ({ id: Number(item.id), name: item.name })));
        await Promise.all([
          loadSubjectSelection(detail.id),
          canViewTransportation ? loadTransport(detail.id) : Promise.resolve(),
        ]);
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
  }, [studentId, isParent]);

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
  const guardian = useMemo(
    () => student?.parents?.find((parent) => String(parent.relationship || "").toLowerCase() === "guardian"),
    [student]
  );
  const fatherDisplay = father || guardian || null;
  const motherDisplay = mother || guardian || null;

  useEffect(() => {
    setParentDraft({
      father: {
        name: String(fatherDisplay?.name || "").trim(),
        mobile: String(fatherDisplay?.mobile || "").trim(),
        email: String(fatherDisplay?.email || "").trim(),
        occupation: String(fatherDisplay?.occupation || "").trim(),
        qualification: String(fatherDisplay?.qualification || "").trim(),
      },
      mother: {
        name: String(motherDisplay?.name || "").trim(),
        mobile: String(motherDisplay?.mobile || "").trim(),
        email: String(motherDisplay?.email || "").trim(),
        occupation: String(motherDisplay?.occupation || "").trim(),
        qualification: String(motherDisplay?.qualification || "").trim(),
      },
    });
    setIsEditingParents(false);
    setParentSaveError("");
    setParentSaveMessage("");
  }, [
    student?.id,
    fatherDisplay?.name,
    fatherDisplay?.mobile,
    fatherDisplay?.email,
    fatherDisplay?.occupation,
    fatherDisplay?.qualification,
    motherDisplay?.name,
    motherDisplay?.mobile,
    motherDisplay?.email,
    motherDisplay?.occupation,
    motherDisplay?.qualification,
  ]);

  const photoUri = resolvePhoto(student?.photo_url);
  const totalDue = useMemo(() => feeItems.reduce((sum, item) => sum + Number(item.remaining || 0), 0), [feeItems]);
  const totalPaid = useMemo(() => payments.reduce((sum, item) => sum + Number(item.amount_paid || 0), 0), [payments]);
  const approvedAttendance = useMemo(() => attendanceRows.filter((row) => norm(row.approval_status, "") === "approved").length, [attendanceRows]);
  const attendanceTotal = attendanceRows.length;
  const attendanceSummary = attendanceTotal ? `${approvedAttendance}/${attendanceTotal}` : "-";
  const paymentTotal = totalPaid + totalDue;
  const activeTransportAssignment = useMemo(
    () => transportAssignments.find((item) => norm(item.status, "") === "active") || null,
    [transportAssignments]
  );
  const tabs = useMemo<TabKey[]>(
    () => ["overview", "parents", "subjects", "attendance", "fees", ...(canViewTransportation ? (["transportation"] as TabKey[]) : []), "reports"],
    [canViewTransportation]
  );

  async function loadSubjectSelection(nextStudentId: number | string) {
    setSubjectSelectionLoading(true);
    setSubjectSelectionError("");
    setSubjectSelectionMessage("");
    try {
      const data = await getStudentSubjectRegistrations(nextStudentId);
      const offerings = Array.isArray(data.offerings) ? data.offerings : [];
      setSubjectSelection({ enrollment: data.enrollment || null, offerings });
      setSelectedOfferingIds(
        offerings
          .filter((offering) => Boolean(offering.auto_required) || Boolean(offering.registration_id))
          .map((offering) => Number(offering.id))
          .filter((offeringId) => Number.isFinite(offeringId))
      );
    } catch (err: unknown) {
      setSubjectSelection({ enrollment: null, offerings: [] });
      setSelectedOfferingIds([]);
      setSubjectSelectionError(getErrorMessage(err, "Failed to load subject choices."));
    } finally {
      setSubjectSelectionLoading(false);
    }
  }

  async function loadTransport(nextStudentId: number | string) {
    setTransportError("");
    setTransportMessage("");
    try {
      const [assignmentRows, dueRows] = await Promise.all([
        getTransportAssignments({ student_id: nextStudentId }),
        getTransportDues({ student_id: nextStudentId }),
      ]);
      let paymentRows: TransportPayment[] = [];
      try {
        paymentRows = await getTransportPayments({ student_id: nextStudentId });
      } catch {
        paymentRows = [];
      }
      const activeAssignment = assignmentRows.find((item) => norm(item.status, "") === "active");
      setTransportAssignments(assignmentRows);
      setTransportDues(dueRows);
      setTransportPayments(paymentRows);
      setTransportForm((prev) => ({
        ...prev,
        enabled: Boolean(activeAssignment),
        monthly_fee: activeAssignment?.monthly_fee ? String(activeAssignment.monthly_fee) : prev.monthly_fee,
        start_month: activeAssignment?.start_month ? String(activeAssignment.start_month) : prev.start_month,
        start_year: activeAssignment?.start_year ? String(activeAssignment.start_year) : prev.start_year,
      }));
    } catch (err: unknown) {
      setTransportAssignments([]);
      setTransportDues([]);
      setTransportPayments([]);
      setTransportError(getErrorMessage(err, "Failed to load transportation fee details."));
    }
  }

  function updateParentDraft(role: ParentRole, field: ParentField, value: string) {
    const nextValue = field === "mobile" ? value.replace(/\D/g, "").slice(0, 10) : value;
    setParentDraft((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [field]: nextValue,
      },
    }));
  }

  function validateParentDraft() {
    const fatherMobile = String(parentDraft?.father?.mobile || "").trim();
    const motherMobile = String(parentDraft?.mother?.mobile || "").trim();
    const fatherName = String(parentDraft?.father?.name || "").trim();
    const motherName = String(parentDraft?.mother?.name || "").trim();
    const fatherEmail = String(parentDraft?.father?.email || "").trim();
    const motherEmail = String(parentDraft?.mother?.email || "").trim();

    if (!fatherMobile && !motherMobile) {
      return "At least one parent phone is required.";
    }
    if (fatherMobile && !/^\d{10}$/.test(fatherMobile)) {
      return "Father phone must be 10 digits.";
    }
    if (motherMobile && !/^\d{10}$/.test(motherMobile)) {
      return "Mother phone must be 10 digits.";
    }
    if (fatherMobile && !fatherName) {
      return "Father name is required when father phone is provided.";
    }
    if (motherMobile && !motherName) {
      return "Mother name is required when mother phone is provided.";
    }
    if (fatherEmail && !/^\S+@\S+\.\S+$/.test(fatherEmail)) {
      return "Father email is invalid.";
    }
    if (motherEmail && !/^\S+@\S+\.\S+$/.test(motherEmail)) {
      return "Mother email is invalid.";
    }
    return "";
  }

  async function handleSaveParents() {
    if (!student?.id || savingParents) return;
    setParentSaveError("");
    setParentSaveMessage("");

    const validation = validateParentDraft();
    if (validation) {
      setParentSaveError(validation);
      return;
    }

    setSavingParents(true);
    try {
      await updateStudent(student.id, {
        father: {
          name: String(parentDraft?.father?.name || "").trim(),
          mobile: String(parentDraft?.father?.mobile || "").trim(),
          email: String(parentDraft?.father?.email || "").trim(),
          occupation: String(parentDraft?.father?.occupation || "").trim(),
          qualification: String(parentDraft?.father?.qualification || "").trim(),
        },
        mother: {
          name: String(parentDraft?.mother?.name || "").trim(),
          mobile: String(parentDraft?.mother?.mobile || "").trim(),
          email: String(parentDraft?.mother?.email || "").trim(),
          occupation: String(parentDraft?.mother?.occupation || "").trim(),
          qualification: String(parentDraft?.mother?.qualification || "").trim(),
        },
      });

      const refreshed = await getStudentById(student.id);
      setStudent(refreshed);
      setIsEditingParents(false);
      setParentSaveMessage("Parent details updated.");
      setNotice({
        title: "Parent Details Updated",
        message: "Parent information has been updated successfully.",
        tone: "success",
      });
    } catch (err: unknown) {
      setParentSaveError(getErrorMessage(err, "Failed to update parent details."));
    } finally {
      setSavingParents(false);
    }
  }

  function toggleSubjectOffering(offeringId: number, disabled: boolean) {
    if (disabled || !Number.isFinite(offeringId)) return;
    setSubjectSelectionMessage("");
    setSubjectSelectionError("");
    setSelectedOfferingIds((prev) =>
      prev.includes(offeringId) ? prev.filter((id) => id !== offeringId) : [...prev, offeringId]
    );
  }

  async function handleSaveSubjectSelection() {
    if (!student?.id || subjectSelectionSaving || !canEditSubjectSelection) return;
    setSubjectSelectionSaving(true);
    setSubjectSelectionError("");
    setSubjectSelectionMessage("");
    try {
      await replaceStudentSubjectRegistrations(student.id, { offering_ids: selectedOfferingIds });
      await loadSubjectSelection(student.id);
      setSubjectSelectionMessage("Subject selection updated.");
      setNotice({ title: "Subjects Updated", message: "Subject choices have been saved.", tone: "success" });
    } catch (err: unknown) {
      setSubjectSelectionError(getErrorMessage(err, "Failed to save subject selection."));
    } finally {
      setSubjectSelectionSaving(false);
    }
  }

  async function handleSaveTransport() {
    if (!student?.id || transportSaving || !canEditTransportation) return;
    setTransportSaving(true);
    setTransportError("");
    setTransportMessage("");
    try {
      if (transportForm.enabled) {
        if (!student.session_id) {
          throw new Error("Student must have an active academic session before transportation fee can be enabled.");
        }
        if (!transportForm.monthly_fee || Number(transportForm.monthly_fee) <= 0) {
          throw new Error("Monthly transportation fee is required.");
        }
        await createTransportAssignment({
          student_id: student.id,
          session_id: student.session_id,
          start_month: Number(transportForm.start_month),
          start_year: Number(transportForm.start_year),
          monthly_fee: Number(transportForm.monthly_fee),
        });
        setTransportMessage("Transportation fee enabled for this student.");
      } else if (activeTransportAssignment) {
        const today = new Date();
        await endTransportAssignment(activeTransportAssignment.id, {
          end_month: today.getMonth() + 1,
          end_year: today.getFullYear(),
        });
        setTransportMessage("Transportation fee disabled for this student.");
      }
      await loadTransport(student.id);
    } catch (err: unknown) {
      setTransportError(getErrorMessage(err, "Failed to save transportation fee."));
    } finally {
      setTransportSaving(false);
    }
  }

  async function handleTransportReceipt(paymentId: number) {
    if (!paymentId) return;
    setTransportDownloadingId(paymentId);
    setTransportError("");
    try {
      await downloadAndShareTransportReceipt(paymentId);
      setNotice({ title: "Receipt Ready", message: "Transportation receipt is ready for sharing.", tone: "success" });
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to download transportation receipt.");
      setTransportError(message);
      Alert.alert("Download failed", message);
    } finally {
      setTransportDownloadingId(null);
    }
  }

  async function handlePaymentReceipt(payment: PaymentItem) {
    if (!payment?.id) return;
    setPaymentReceiptDownloadingId(payment.id);
    try {
      const receiptSerial = payment.receipt_serial || `PAY-${String(payment.id).padStart(6, "0")}`;
      await downloadAndShareReceipt(payment.id, receiptSerial);
      setNotice({ title: "Receipt Ready", message: "Payment receipt is ready for sharing.", tone: "success" });
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to download payment receipt.");
      setNotice({ title: "Download failed", message, tone: "error" });
      Alert.alert("Download failed", message);
    } finally {
      setPaymentReceiptDownloadingId(null);
    }
  }

  function handleCancelParentEdit() {
    setIsEditingParents(false);
    setParentSaveError("");
    setParentSaveMessage("");
    setParentDraft({
      father: {
        name: String(fatherDisplay?.name || "").trim(),
        mobile: String(fatherDisplay?.mobile || "").trim(),
        email: String(fatherDisplay?.email || "").trim(),
        occupation: String(fatherDisplay?.occupation || "").trim(),
        qualification: String(fatherDisplay?.qualification || "").trim(),
      },
      mother: {
        name: String(motherDisplay?.name || "").trim(),
        mobile: String(motherDisplay?.mobile || "").trim(),
        email: String(motherDisplay?.email || "").trim(),
        occupation: String(motherDisplay?.occupation || "").trim(),
        qualification: String(motherDisplay?.qualification || "").trim(),
      },
    });
  }

  async function handleCallPress(phone?: string | null) {
    const dialable = toDialablePhone(phone);
    if (!dialable) return;
    try {
      await Linking.openURL(`tel:${dialable}`);
    } catch {
      Alert.alert("Call failed", "Could not open the phone dialer.");
    }
  }

  async function handleEmailPress(email?: string | null) {
    const mailAddress = toMailAddress(email);
    if (!mailAddress) return;
    try {
      await Linking.openURL(`mailto:${mailAddress}`);
    } catch {
      Alert.alert("Email failed", "Could not open the email app.");
    }
  }

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
      <View style={[styles.compactOverviewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.compactOverviewTop}>
          {photoUri ? <Image source={{ uri: photoUri }} style={[styles.compactPhoto, { backgroundColor: theme.cardMuted, borderColor: theme.border }]} /> : <View style={[styles.compactAvatarFallback, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}><Text style={[styles.compactAvatarText, { color: theme.text }]}>{(student.name || "S").slice(0, 1).toUpperCase()}</Text></View>}
          <View style={styles.compactStudentCopy}>
            <Text style={[styles.compactStudentName, { color: theme.text }]} numberOfLines={2}>{student.name}</Text>
            <Text style={[styles.subtitle, { color: theme.subText }]}>{student.class || "-"} / {student.section || "-"} • {fmtScope(student.class_scope)}</Text>
            <Text style={[styles.heroMeta, { color: theme.subText }]}>Admission {student.admission_no || "-"} • Roll {student.roll_number || "-"}</Text>
            <View style={styles.compactIdentityRow}>
              <IdentityChip value={String(student.gender || "-")} kind="gender" />
              <IdentityChip value={fmtScope(student.class_scope)} kind="scope" />
              {student.class_scope === "hs" && student.stream_name ? <IdentityChip value={student.stream_name} kind="stream" /> : null}
            </View>
          </View>
        </View>
        <View style={styles.compactStatsRow}>
          <CompactStat label="Session" value={student.session || "-"} tone="blue" />
          <CompactStat label="Attendance" value={attendanceSummary} tone="orange" />
          <CompactStat label="Fees Due" value={fmtCurrency(totalDue)} tone={totalDue > 0 ? "orange" : "green"} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailTabRow}>
        {tabs.map((tab) => (
          <DetailTabButton key={tab} tab={tab} active={activeTab === tab} onPress={() => setActiveTab(tab)} />
        ))}
      </ScrollView>

      {activeTab === "overview" ? (
        <SectionCard title="Student Information">
          <View style={styles.infoGrid}>
            <InfoRow label="Class" value={student.class || "-"} icon="school-outline" />
            <InfoRow label="Section" value={student.section || "-"} icon="people-outline" />
            <InfoRow
              label="Mobile"
              value={student.mobile || "-"}
              icon="phone-portrait-outline"
              onPress={toDialablePhone(student.mobile) ? () => handleCallPress(student.mobile) : undefined}
            />
            <InfoRow label="Gender" value={student.gender || "-"} icon="male-female-outline" />
            <InfoRow label="Date of Birth" value={formatDateLabel(student.dob)} icon="calendar-clear-outline" />
            <InfoRow label="Admission Date" value={formatDateLabel(student.date_of_admission)} icon="calendar-outline" />
            <InfoRow label="Scope" value={fmtScope(student.class_scope)} icon="radio-button-on-outline" />
            <InfoRow label="Stream" value={String(student.class_scope || "").toLowerCase() === "hs" ? student.stream_name || "-" : "-"} icon="flask-outline" />
          </View>
        </SectionCard>
      ) : null}

      {activeTab === "parents" ? (
        <View style={styles.twoColumn}>
          {canEditParents ? (
            <View style={styles.parentActionBar}>
              {!isEditingParents ? (
                <Pressable style={styles.secondaryBtn} onPress={() => { setIsEditingParents(true); setParentSaveError(""); setParentSaveMessage(""); }}>
                  <Text style={styles.secondaryBtnText}>Edit Parent Details</Text>
                </Pressable>
              ) : (
                <View style={styles.actionRow}>
                  <Pressable style={[styles.primaryBtn, { backgroundColor: theme.primary }, savingParents && styles.btnDisabled]} onPress={handleSaveParents} disabled={savingParents}>
                    <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>{savingParents ? "Saving..." : "Save Parent Details"}</Text>
                  </Pressable>
                  <Pressable style={[styles.secondaryBtn, savingParents && styles.btnDisabled]} onPress={handleCancelParentEdit} disabled={savingParents}>
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : null}
          {parentSaveError ? <Text style={styles.errorText}>{parentSaveError}</Text> : null}
          {parentSaveMessage ? <Text style={styles.successText}>{parentSaveMessage}</Text> : null}

          <SectionCard title="Father">
            {isEditingParents ? (
              <View style={styles.parentFormGrid}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
                  value={parentDraft.father.name}
                  onChangeText={(value) => updateParentDraft("father", "name", value)}
                  placeholder="Father name"
                  placeholderTextColor={theme.mutedText}
                />
                <Text style={styles.inputLabel}>Phone</Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
                  value={parentDraft.father.mobile}
                  onChangeText={(value) => updateParentDraft("father", "mobile", value)}
                  placeholder="10-digit phone"
                  placeholderTextColor={theme.mutedText}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
                  value={parentDraft.father.email}
                  onChangeText={(value) => updateParentDraft("father", "email", value)}
                  placeholder="Email"
                  placeholderTextColor={theme.mutedText}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Text style={styles.inputLabel}>Occupation</Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
                  value={parentDraft.father.occupation}
                  onChangeText={(value) => updateParentDraft("father", "occupation", value)}
                  placeholder="Occupation"
                  placeholderTextColor={theme.mutedText}
                />
                <Text style={styles.inputLabel}>Qualification</Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
                  value={parentDraft.father.qualification}
                  onChangeText={(value) => updateParentDraft("father", "qualification", value)}
                  placeholder="Qualification"
                  placeholderTextColor={theme.mutedText}
                />
              </View>
            ) : (
              <>
                <InfoRow label="Name" value={fatherDisplay?.name || "-"} icon="person-outline" />
                <InfoRow
                  label="Phone"
                  value={fatherDisplay?.mobile || "-"}
                  icon="call-outline"
                  onPress={toDialablePhone(fatherDisplay?.mobile) ? () => handleCallPress(fatherDisplay?.mobile) : undefined}
                />
                <InfoRow
                  label="Email"
                  value={fatherDisplay?.email || "-"}
                  icon="mail-outline"
                  onPress={toMailAddress(fatherDisplay?.email) ? () => handleEmailPress(fatherDisplay?.email) : undefined}
                />
                <InfoRow label="Occupation" value={fatherDisplay?.occupation || "-"} icon="briefcase-outline" />
                <InfoRow label="Qualification" value={fatherDisplay?.qualification || "-"} icon="school-outline" />
              </>
            )}
          </SectionCard>
          <SectionCard title="Mother">
            {isEditingParents ? (
              <View style={styles.parentFormGrid}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
                  value={parentDraft.mother.name}
                  onChangeText={(value) => updateParentDraft("mother", "name", value)}
                  placeholder="Mother name"
                  placeholderTextColor={theme.mutedText}
                />
                <Text style={styles.inputLabel}>Phone</Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
                  value={parentDraft.mother.mobile}
                  onChangeText={(value) => updateParentDraft("mother", "mobile", value)}
                  placeholder="10-digit phone"
                  placeholderTextColor={theme.mutedText}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
                  value={parentDraft.mother.email}
                  onChangeText={(value) => updateParentDraft("mother", "email", value)}
                  placeholder="Email"
                  placeholderTextColor={theme.mutedText}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Text style={styles.inputLabel}>Occupation</Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
                  value={parentDraft.mother.occupation}
                  onChangeText={(value) => updateParentDraft("mother", "occupation", value)}
                  placeholder="Occupation"
                  placeholderTextColor={theme.mutedText}
                />
                <Text style={styles.inputLabel}>Qualification</Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
                  value={parentDraft.mother.qualification}
                  onChangeText={(value) => updateParentDraft("mother", "qualification", value)}
                  placeholder="Qualification"
                  placeholderTextColor={theme.mutedText}
                />
              </View>
            ) : (
              <>
                <InfoRow label="Name" value={motherDisplay?.name || "-"} icon="person-outline" />
                <InfoRow
                  label="Phone"
                  value={motherDisplay?.mobile || "-"}
                  icon="call-outline"
                  onPress={toDialablePhone(motherDisplay?.mobile) ? () => handleCallPress(motherDisplay?.mobile) : undefined}
                />
                <InfoRow
                  label="Email"
                  value={motherDisplay?.email || "-"}
                  icon="mail-outline"
                  onPress={toMailAddress(motherDisplay?.email) ? () => handleEmailPress(motherDisplay?.email) : undefined}
                />
                <InfoRow label="Occupation" value={motherDisplay?.occupation || "-"} icon="briefcase-outline" />
                <InfoRow label="Qualification" value={motherDisplay?.qualification || "-"} icon="school-outline" />
              </>
            )}
          </SectionCard>
        </View>
      ) : null}

      {activeTab === "subjects" ? (
        <SectionCard title="Subject Selection" hint={`${subjectSelection.offerings.length} subjects`}>
          {subjectSelection.enrollment ? (
            <View style={styles.metaPillRow}>
              <StatusChip value={subjectSelection.enrollment.class_name || student.class || "-"} />
              <StatusChip value={subjectSelection.enrollment.section_name || student.section || "-"} />
              <StatusChip value={subjectSelection.enrollment.medium || student.medium || "-"} />
              {subjectSelection.enrollment.stream_name ? <StatusChip value={subjectSelection.enrollment.stream_name} /> : null}
            </View>
          ) : null}
          {subjectSelectionError ? <Text style={styles.errorText}>{subjectSelectionError}</Text> : null}
          {subjectSelectionMessage ? <Text style={styles.successText}>{subjectSelectionMessage}</Text> : null}
          {subjectSelectionLoading ? <ActivityIndicator color={theme.text} /> : null}
          {!subjectSelectionLoading && !subjectSelection.offerings.length ? (
            <Text style={styles.emptyText}>No subjects are available for this student.</Text>
          ) : (
            <View style={styles.subjectSelectionList}>
              {subjectSelection.offerings.map((offering) => {
                const offeringId = Number(offering.id);
                const isRequired = Boolean(offering.auto_required);
                const checked = isRequired || selectedOfferingIds.includes(offeringId);
                const disabled = isRequired || !canEditSubjectSelection;
                return (
                  <Pressable
                    key={offering.id}
                    style={[
                      styles.checkRow,
                      { borderColor: checked ? theme.primary : theme.border, backgroundColor: checked ? theme.cardMuted : theme.card },
                      disabled && styles.btnDisabled,
                    ]}
                    onPress={() => toggleSubjectOffering(offeringId, disabled)}
                  >
                    <View style={[styles.detailIcon, { borderColor: checked ? theme.success : theme.border, backgroundColor: checked ? theme.successSoft : theme.cardMuted }]}>
                      <Ionicons name={checked ? "checkmark-circle" : "ellipse-outline"} size={18} color={checked ? theme.success : theme.subText} />
                    </View>
                    <View style={styles.listCopy}>
                      <Text style={[styles.listTitle, { color: theme.text }]}>
                        {offering.subject_name}{offering.subject_code ? ` (${offering.subject_code})` : ""}
                      </Text>
                      <Text style={[styles.listMeta, { color: theme.subText }]}>
                        {title(String(offering.subject_group || "subject"))}{isRequired ? " | Required" : " | Optional"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
          {canEditSubjectSelection ? (
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: theme.primary }, (subjectSelectionSaving || subjectSelectionLoading) && styles.btnDisabled]}
              onPress={handleSaveSubjectSelection}
              disabled={subjectSelectionSaving || subjectSelectionLoading}
            >
              <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>{subjectSelectionSaving ? "Saving..." : "Save Subjects"}</Text>
            </Pressable>
          ) : null}
        </SectionCard>
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
                <DetailIcon name="calendar-outline" tone="orange" />
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
          <SectionCard title="Fee Summary">
            {paymentTotal ? <MetricBar label="Payment Coverage" value={totalPaid} total={paymentTotal} color="#6d28d9" trackColor="#ede9fe" caption={`${Math.round((totalPaid / paymentTotal) * 100)}% paid`} /> : null}
            {financeError ? <Text style={styles.errorText}>{financeError}</Text> : null}
          </SectionCard>
          <SectionCard title="Pending / Active Fee Items" hint={`${feeItems.length} rows`}>
            {feeItems.length ? feeItems.map((item) => (
              <View key={item.id} style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
                <View style={styles.rowBetween}>
                  <DetailIcon name="receipt-outline" tone="orange" />
                  <View style={styles.listCopy}>
                    <Text style={[styles.listTitle, { color: theme.text }]}>{getFeeName(item)}</Text>
                    <Text style={[styles.listMeta, { color: theme.subText }]}>Due {formatDateLabel(item.due_date)}</Text>
                  </View>
                  <StatusChip value={norm(item.status)} />
                </View>
                {item.fee_mode === "status_only" ? (
                  <Text style={[styles.listMeta, { color: theme.subText }]}>Status {title(norm(item.status))}</Text>
                ) : null}
                {item.fee_mode !== "status_only" ? (
                <Text style={[styles.listMeta, { color: theme.subText }]}>Total {fmtCurrency(item.amount)} • Paid {fmtCurrency(item.paid)} • Remaining {fmtCurrency(item.remaining)}</Text>
                ) : null}
              </View>
            )) : <Text style={styles.emptyText}>No pending fee items for this student.</Text>}
          </SectionCard>
          <SectionCard title="Payment History" hint={`${payments.length} entries`}>
            {payments.length ? payments.map((payment) => (
              <View key={`${payment.id}-${payment.created_at}`} style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
                <View style={styles.rowBetween}>
                  <DetailIcon name="card-outline" tone="violet" />
                  <View style={styles.listCopy}>
                    <Text style={[styles.listTitle, { color: theme.text }]}>{getFeeName(payment)}</Text>
                    <Text style={[styles.listMeta, { color: theme.subText }]}>{formatDateLabel(payment.payment_date || payment.created_at)}</Text>
                  </View>
                  <StatusChip value={norm(payment.fee_status || payment.status)} />
                </View>
                <Text style={[styles.listAmount, { color: theme.text }]}>{fmtCurrency(payment.amount_paid)}</Text>
                <View style={styles.metaStack}>
                  <Text style={[styles.listMeta, { color: theme.subText }]}>{payment.class_name || "-"} / {payment.section_name || "-"}</Text>
                  <Text style={[styles.listMeta, { color: theme.subText }]}>Remarks: {payment.remarks || "-"}</Text>
                </View>
                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.secondaryBtn, paymentReceiptDownloadingId === payment.id && styles.btnDisabled]}
                    onPress={() => handlePaymentReceipt(payment)}
                    disabled={paymentReceiptDownloadingId === payment.id}
                  >
                    <Text style={styles.secondaryBtnText}>{paymentReceiptDownloadingId === payment.id ? "Downloading..." : "Receipt"}</Text>
                  </Pressable>
                </View>
              </View>
            )) : <Text style={styles.emptyText}>No payment history found for this student.</Text>}
          </SectionCard>
        </>
      ) : null}

      {activeTab === "transportation" && canViewTransportation ? (
        <>
          {isParent && transportError ? <Text style={styles.errorText}>{transportError}</Text> : null}
          {!isParent ? (
          <SectionCard title="Transportation Fee" hint={activeTransportAssignment ? "Active" : "Not enabled"}>
            {transportError ? <Text style={styles.errorText}>{transportError}</Text> : null}
            {transportMessage ? <Text style={styles.successText}>{transportMessage}</Text> : null}
            <Pressable
              style={[
                styles.checkRow,
                { borderColor: transportForm.enabled ? theme.primary : theme.border, backgroundColor: theme.cardMuted },
                (!canEditTransportation || transportSaving) && styles.btnDisabled,
              ]}
              onPress={() => canEditTransportation && !transportSaving ? setTransportForm((prev) => ({ ...prev, enabled: !prev.enabled })) : undefined}
            >
              <View style={[styles.detailIcon, { borderColor: transportForm.enabled ? theme.success : theme.border, backgroundColor: transportForm.enabled ? theme.successSoft : theme.cardMuted }]}>
                <Ionicons name={transportForm.enabled ? "checkmark-circle" : "bus-outline"} size={18} color={transportForm.enabled ? theme.success : theme.subText} />
              </View>
              <View style={styles.listCopy}>
                <Text style={[styles.listTitle, { color: theme.text }]}>Enable transportation fee</Text>
                <Text style={[styles.listMeta, { color: theme.subText }]}>Creates monthly transportation dues from the selected start month.</Text>
              </View>
            </Pressable>
            <Text style={styles.inputLabel}>Monthly Fee</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }, (!canEditTransportation || !transportForm.enabled || transportSaving) && styles.btnDisabled]}
              value={transportForm.monthly_fee}
              onChangeText={(value) => setTransportForm((prev) => ({ ...prev, monthly_fee: value.replace(/[^\d.]/g, "") }))}
              keyboardType="numeric"
              editable={canEditTransportation && transportForm.enabled && !transportSaving}
              placeholder="Monthly fee"
              placeholderTextColor={theme.mutedText}
            />
            <Text style={styles.inputLabel}>Start Month</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterWrap}>
              {TRANSPORT_MONTHS.map(([value, label]) => (
                <FilterChip
                  key={value}
                  label={label}
                  active={transportForm.start_month === value}
                  onPress={() => canEditTransportation && transportForm.enabled && !transportSaving ? setTransportForm((prev) => ({ ...prev, start_month: value })) : undefined}
                />
              ))}
            </ScrollView>
            <Text style={styles.inputLabel}>Start Year</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }, (!canEditTransportation || !transportForm.enabled || transportSaving) && styles.btnDisabled]}
              value={transportForm.start_year}
              onChangeText={(value) => setTransportForm((prev) => ({ ...prev, start_year: value.replace(/\D/g, "").slice(0, 4) }))}
              keyboardType="numeric"
              editable={canEditTransportation && transportForm.enabled && !transportSaving}
              placeholder="Start year"
              placeholderTextColor={theme.mutedText}
            />
            {activeTransportAssignment ? (
              <View style={styles.summaryGrid}>
                <SummaryCard label="Monthly Fee" value={fmtCurrency(activeTransportAssignment.monthly_fee)} tone="green" icon="wallet-outline" />
                <SummaryCard label="Started From" value={formatTransportMonth(activeTransportAssignment.start_month, activeTransportAssignment.start_year)} tone="blue" icon="calendar-outline" />
                <SummaryCard label="Pending Months" value={activeTransportAssignment.pending_count || 0} tone="violet" icon="time-outline" />
              </View>
            ) : null}
            {canEditTransportation ? (
              <Pressable style={[styles.primaryBtn, { backgroundColor: theme.primary }, transportSaving && styles.btnDisabled]} onPress={handleSaveTransport} disabled={transportSaving}>
                <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>{transportSaving ? "Saving..." : "Save Transportation Fee"}</Text>
              </Pressable>
            ) : null}
          </SectionCard>
          ) : null}
          <SectionCard title="Transportation Dues" hint={`${transportDues.length} rows`}>
            {transportDues.length ? transportDues.map((due) => (
              <View key={due.id} style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
                <View style={styles.rowBetween}>
                  <DetailIcon name="bus-outline" tone="blue" />
                  <View style={styles.listCopy}>
                    <Text style={[styles.listTitle, { color: theme.text }]}>{formatTransportMonth(due.due_month, due.due_year)}</Text>
                    <Text style={[styles.listMeta, { color: theme.subText }]}>Total {fmtCurrency(due.amount)} | Paid {fmtCurrency(due.paid)} | Remaining {fmtCurrency(due.remaining)}</Text>
                  </View>
                  <StatusChip value={norm(due.status)} />
                </View>
              </View>
            )) : <Text style={styles.emptyText}>No transportation dues found for this student.</Text>}
          </SectionCard>
          <SectionCard title="Transportation Payment History" hint={`${transportPayments.length} entries`}>
            {transportPayments.length ? transportPayments.map((payment) => (
              <View key={payment.id} style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
                <View style={styles.rowBetween}>
                  <DetailIcon name="receipt-outline" tone="green" />
                  <View style={styles.listCopy}>
                    <Text style={[styles.listTitle, { color: theme.text }]}>{payment.receipt_no || `TR-${String(payment.id).padStart(6, "0")}`}</Text>
                    <Text style={[styles.listMeta, { color: theme.subText }]}>{formatDateLabel(payment.created_at)} | {payment.covered_months || "-"}</Text>
                  </View>
                  <Text style={[styles.listAmount, { color: theme.text }]}>{fmtCurrency(payment.amount_paid)}</Text>
                </View>
                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.secondaryBtn, transportDownloadingId === payment.id && styles.btnDisabled]}
                    onPress={() => handleTransportReceipt(payment.id)}
                    disabled={transportDownloadingId === payment.id}
                  >
                    <Text style={styles.secondaryBtnText}>{transportDownloadingId === payment.id ? "Downloading..." : "Receipt"}</Text>
                  </Pressable>
                </View>
              </View>
            )) : <Text style={styles.emptyText}>No transportation payment history found for this student.</Text>}
          </SectionCard>
        </>
      ) : null}

      {activeTab === "reports" ? (
        <>
          <SectionCard title="Marksheet" hint={selectedExamId ? "Exam selected" : "Select an exam"}>
            <Text style={styles.inputLabel}>Exam</Text>
            <View style={styles.examPickerGrid}>
              {reportExams.map((exam) => <FilterChip key={exam.id} label={exam.name} icon="document-text-outline" active={selectedExamId === exam.id} onPress={() => setSelectedExamId(exam.id)} />)}
            </View>
            <View style={styles.actionRow}>
              <Pressable style={[styles.primaryBtn, { backgroundColor: theme.primary }, (!selectedExamId || !report) && styles.btnDisabled]} disabled={!selectedExamId || !report} onPress={handleDownloadMarksheet}>
                <Ionicons name="download-outline" size={17} color={theme.primaryText} />
                <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>Download Marksheet</Text>
              </Pressable>
            </View>
            {reportLoading ? <ActivityIndicator color={theme.text} /> : null}
            {reportError ? <Text style={styles.errorText}>{reportError}</Text> : null}
            {!selectedExamId ? <Text style={styles.emptyText}>Select an exam to view results.</Text> : null}
          </SectionCard>
          {report ? (
            <MarksheetPreview report={report} student={student} />
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
  compactOverviewCard: { backgroundColor: "#ffffff", borderRadius: 18, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 14, paddingVertical: 13, gap: 11 },
  compactOverviewTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  compactPhoto: { width: 58, height: 58, borderRadius: 16, borderWidth: 1, backgroundColor: "#e2e8f0" },
  compactAvatarFallback: { width: 58, height: 58, borderRadius: 16, borderWidth: 1, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  compactAvatarText: { color: "#0f172a", fontWeight: "900", fontSize: 22 },
  compactStudentCopy: { flex: 1, gap: 3, minWidth: 0 },
  compactStudentName: { color: "#0f172a", fontWeight: "900", fontSize: 17, lineHeight: 22 },
  compactStudentMeta: { color: "#64748b", fontWeight: "700", fontSize: 12, lineHeight: 16 },
  compactIdentityRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, alignItems: "center" },
  compactStatsRow: { flexDirection: "row", gap: 8 },
  compactStatPill: { flex: 1, minHeight: 54, borderWidth: 1, borderRadius: 13, paddingHorizontal: 9, paddingVertical: 8, justifyContent: "space-between" },
  compactStatValue: { fontSize: 14, lineHeight: 18, fontWeight: "900" },
  compactStatLabel: { fontSize: 10, lineHeight: 13, fontWeight: "800" },
  detailTabRow: { gap: 8, paddingRight: 14, paddingBottom: 2 },
  detailTabButton: { minHeight: 38, minWidth: 104, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  detailTabText: { fontSize: 12, fontWeight: "800", maxWidth: 112 },
  heroCard: { backgroundColor: "#ffffff", borderRadius: 22, borderWidth: 1, borderColor: "#e2e8f0", padding: 16, gap: 12 },
  heroEyebrow: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: -2 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  photo: { width: 76, height: 76, borderRadius: 22, borderWidth: 1, backgroundColor: "#e2e8f0" },
  avatarFallback: { width: 76, height: 76, borderRadius: 22, borderWidth: 1, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#0f172a", fontWeight: "800", fontSize: 28 },
  heroCopy: { flex: 1, gap: 4, minWidth: 0 },
  title: { color: "#0f172a", fontWeight: "800", fontSize: 22, lineHeight: 27, flex: 1 },
  subtitle: { color: "#475569", fontWeight: "700", fontSize: 13 },
  heroMeta: { color: "#64748b", lineHeight: 18 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  identityBadgeWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4, alignItems: "center" },
  tabsRow: { gap: 8, paddingBottom: 2 },
  tabsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: { minWidth: "31%", flexGrow: 1, minHeight: 42, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#f8fafc", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  filterChipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  filterChipText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  filterChipTextActive: { color: "#ffffff" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { flexBasis: "48%", flexGrow: 1, minHeight: 66, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 9, justifyContent: "flex-start", gap: 5 },
  summaryLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryIcon: { width: 26, height: 26, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  summaryValue: { fontSize: 15, lineHeight: 19, fontWeight: "800" },
  summaryLabel: { color: "#64748b", fontSize: 12, fontWeight: "700", flexShrink: 1 },
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
  infoGrid: { gap: 0 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#e2e8f0", paddingVertical: 10 },
  infoIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  detailIcon: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  infoLabel: { color: "#64748b", fontWeight: "700", flex: 1 },
  infoValue: { color: "#0f172a", fontWeight: "800", flexShrink: 1, textAlign: "right", maxWidth: "45%" },
  infoValueLink: { textDecorationLine: "underline" },
  twoColumn: { gap: 14 },
  parentActionBar: { gap: 8 },
  parentFormGrid: { gap: 8 },
  inputLabel: { color: "#334155", fontWeight: "700" },
  filterBlock: { gap: 10 },
  inputRow: { flexDirection: "row", gap: 10 },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, backgroundColor: "#ffffff", paddingHorizontal: 12, paddingVertical: 11, color: "#0f172a" },
  inputHalf: { flex: 1 },
  filterWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  examPickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subjectSelectionList: { gap: 8 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11 },
  secondaryBtn: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: "#334155", fontWeight: "700" },
  primaryBtn: { backgroundColor: "#0f172a", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  primaryBtnText: { color: "#ffffff", fontWeight: "700" },
  btnDisabled: { opacity: 0.45 },
  actionRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  listCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, backgroundColor: "#f8fafc", padding: 10, gap: 7 },
  listCopy: { flex: 1, gap: 2 },
  listTitle: { color: "#0f172a", fontWeight: "800", fontSize: 13 },
  listMeta: { color: "#64748b", fontSize: 12, lineHeight: 17, fontWeight: "600" },
  listAmount: { color: "#0f172a", fontWeight: "800", fontSize: 15 },
  metaStack: { gap: 2 },
  metaPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  statusChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusChipText: { fontSize: 12, fontWeight: "700" },
  subjectCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, backgroundColor: "#f8fafc", padding: 10 },
  subjectMarks: { alignItems: "flex-end" },
  subjectMarksValue: { color: "#0f172a", fontWeight: "800", fontSize: 18 },
  subjectMarksMeta: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  marksheetPreview: { borderWidth: 1, borderRadius: 18, overflow: "hidden" },
  marksheetHeader: { borderBottomWidth: 1, paddingHorizontal: 14, paddingVertical: 12, alignItems: "center" },
  marksheetEyebrow: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2 },
  marksheetTitle: { marginTop: 3, fontSize: 17, lineHeight: 22, fontWeight: "800", textAlign: "center" },
  marksheetSubTitle: { marginTop: 2, fontSize: 12, fontWeight: "700", textAlign: "center" },
  marksheetInfoGrid: { flexDirection: "row", flexWrap: "wrap", borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  marksheetInfoItem: { flexBasis: "48%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 9, minWidth: 0 },
  marksheetInfoCopy: { flex: 1, minWidth: 0, gap: 2 },
  marksheetInfoLabel: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  marksheetInfoValue: { fontSize: 12, lineHeight: 16, fontWeight: "700" },
  marksheetTable: { paddingHorizontal: 12, paddingVertical: 8 },
  marksheetTableRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, paddingVertical: 8, gap: 8 },
  marksheetTableHead: { paddingTop: 2 },
  marksheetSubjectHead: { flex: 1, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  marksheetMarksHead: { width: 74, textAlign: "right", fontSize: 10, lineHeight: 12, fontWeight: "800", textTransform: "uppercase" },
  marksheetSubjectCell: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  marksheetMarksCell: { width: 74, textAlign: "right", fontSize: 13, fontWeight: "800" },
  marksheetTotalRow: { borderTopWidth: 1, borderBottomWidth: 0, marginTop: 2 },
  marksheetTotalText: { fontSize: 13 },
  marksheetSummaryRow: { flexDirection: "row", borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  marksheetSummaryItem: { flex: 1, gap: 2 },
  marksheetSummaryValue: { fontSize: 15, fontWeight: "900" },
  marksheetFootnote: { borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 11, lineHeight: 15 },
  emptyText: { color: "#64748b" },
  successText: { color: "#15803d", fontWeight: "600" },
  errorText: { color: "#b91c1c" },
});

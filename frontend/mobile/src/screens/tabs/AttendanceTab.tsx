import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuthStore } from "../../store/authStore";
import { useAppTheme } from "../../theme/AppThemeProvider";
import TopNotice from "../../components/feedback/TopNotice";
import { ClassStructureItem, getClassStructure } from "../../services/classesService";
import DateField from "../../components/form/DateField";
import SelectField from "../../components/form/SelectField";
import {
  AbsenceMessageTemplate,
  getAbsenceMessageTemplates,
  getAllTeacherAttendance,
  getPendingStudentAttendance,
  getStudentAttendanceEntryScopes,
  getStudentAttendanceRoster,
  getStudentAttendanceSession,
  getStudentAttendanceSessions,
  notifyAbsentParents,
  reviewStudentAttendance,
  StudentAttendanceSessionDetails,
  StudentAttendanceSessionItem,
  StudentAttendanceStatus,
  submitStudentAttendance,
  TeacherAttendanceItem,
} from "../../services/attendanceService";

type AttendanceTabKey = "take" | "approved" | "history" | "review" | "notify" | "logs";

const STATUS_OPTIONS: StudentAttendanceStatus[] = ["present", "absent"];
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

function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err && "response" in err) {
    const data = (err as { response?: { data?: { message?: string; error?: string } } }).response?.data;
    return data?.error || data?.message || fallback;
  }
  return fallback;
}

function scopeLabel(scope?: string | null) {
  return scope === "hs" ? "Higher Secondary" : "School";
}

function defaultRosterMeta() {
  return {
    existing_session_id: null as number | null,
    existing_approval_status: null as string | null,
    existing_submitted_at: null as string | null,
    existing_submitted_by_username: null as string | null,
    existing_reviewed_at: null as string | null,
    existing_reviewed_by_username: null as string | null,
    existing_review_remarks: null as string | null,
  };
}

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "green" | "red" | "amber";
}) {
  return (
    <View style={[styles.summaryCard, summaryCardTone(tone)]}>
      <Text style={[styles.summaryValue, summaryValueTone(tone)]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = String(status || "").toLowerCase();
  return (
    <View style={[styles.statusBadge, statusBadgeTone(normalized)]}>
      <Text style={[styles.statusBadgeText, statusBadgeTextTone(normalized)]}>
        {capitalize(normalized || "unknown")}
      </Text>
    </View>
  );
}

export default function AttendanceTab() {
  const { theme } = useAppTheme();
  currentTheme = theme;
  styles = useMemo(() => createStyles(theme), [theme]);
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions || [];
  const canTakeAttendance = permissions.includes("attendance.take") || permissions.includes("student_attendance.take");
  const canReviewAttendance = permissions.includes("student_attendance.review");
  const canNotifyParents = permissions.includes("student_attendance.notify");
  const canViewTeacherLogs = permissions.includes("teacher.view");
  const isTeacherOnly =
    Array.isArray(user?.roles) &&
    user.roles.includes("teacher") &&
    !canReviewAttendance &&
    !canNotifyParents &&
    !permissions.includes("teacher.update");

  const tabs = useMemo(() => {
    const next: Array<{ key: AttendanceTabKey; label: string }> = [];
    if (canTakeAttendance) next.push({ key: "take", label: "Take" });
    if (isTeacherOnly) {
      next.push({ key: "approved", label: "Approved" });
      next.push({ key: "history", label: "History" });
    }
    if (canReviewAttendance) next.push({ key: "review", label: "Review" });
    if (canNotifyParents) next.push({ key: "notify", label: "Notify" });
    if (canViewTeacherLogs) next.push({ key: "logs", label: isTeacherOnly ? "My Logs" : "Logs" });
    return next;
  }, [canTakeAttendance, isTeacherOnly, canReviewAttendance, canNotifyParents, canViewTeacherLogs]);

  const [activeTab, setActiveTab] = useState<AttendanceTabKey>("take");
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string; tone: "success" | "error" } | null>(null);

  const [entryScopes, setEntryScopes] = useState<{
    restricted: boolean;
    assignments: Array<{
      class_id: number;
      section_id: number;
      session_id: number;
      class_name?: string;
      section_name?: string;
      session_name?: string;
      medium?: string | null;
      class_scope?: string;
    }>;
  }>({ restricted: false, assignments: [] });
  const [classes, setClasses] = useState<ClassStructureItem[]>([]);
  const [form, setForm] = useState({ class_id: "", section_id: "", session_id: "", date: todayDate() });
  const [rosterLoading, setRosterLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rosterMeta, setRosterMeta] = useState(defaultRosterMeta());
  const [roster, setRoster] = useState<
    Array<{
      student_id: number;
      name: string;
      roll_number?: string | number;
      class_scope?: string;
      medium?: string | null;
      status: StudentAttendanceStatus;
    }>
  >([]);

  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingRows, setPendingRows] = useState<StudentAttendanceSessionItem[]>([]);
  const [selectedPending, setSelectedPending] = useState<StudentAttendanceSessionDetails | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState("");

  const [approvedLoading, setApprovedLoading] = useState(false);
  const [approvedRows, setApprovedRows] = useState<StudentAttendanceSessionItem[]>([]);
  const [selectedApproved, setSelectedApproved] = useState<StudentAttendanceSessionDetails | null>(null);
  const [notifyForm, setNotifyForm] = useState({ template_key: "", message: "", student_ids: [] as number[] });
  const [messageTemplates, setMessageTemplates] = useState<AbsenceMessageTemplate[]>([]);
  const [notifyLoading, setNotifyLoading] = useState(false);

  const [teacherLogs, setTeacherLogs] = useState<TeacherAttendanceItem[]>([]);
  const [teacherLogsLoading, setTeacherLogsLoading] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState("");

  const availableClasses = useMemo(() => {
    if (!entryScopes.restricted) return classes;
    const classIds = new Set(entryScopes.assignments.map((row) => String(row.class_id)));
    return classes
      .filter((row) => classIds.has(String(row.id)))
      .map((row) => ({
        ...row,
        sections: (row.sections || []).filter((section) =>
          entryScopes.assignments.some(
            (assignment) =>
              String(assignment.class_id) === String(row.id) &&
              String(assignment.section_id) === String(section.id),
          ),
        ),
      }));
  }, [classes, entryScopes]);

  const selectedClass = useMemo(
    () => availableClasses.find((row) => String(row.id) === String(form.class_id)) ?? null,
    [availableClasses, form.class_id],
  );
  const singleAssignedScope = useMemo(() => {
    if (!entryScopes.restricted) return null;
    const uniquePairs = new Map();
    entryScopes.assignments.forEach((row) => {
      const key = `${row.class_id}:${row.section_id}`;
      if (!uniquePairs.has(key)) {
        uniquePairs.set(key, row);
      }
    });
    return uniquePairs.size === 1 ? [...uniquePairs.values()][0] : null;
  }, [entryScopes]);

  const availableSessions = useMemo(() => {
    if (!entryScopes.restricted) return [...new Set(entryScopes.assignments.map((row) => row.session_id))];
    if (!form.class_id) return [...new Set(entryScopes.assignments.map((row) => row.session_id))];
    return [
      ...new Set(
        entryScopes.assignments
          .filter((row) => String(row.class_id) === String(form.class_id))
          .map((row) => row.session_id),
      ),
    ];
  }, [entryScopes, form.class_id]);

  const sessionOptions = useMemo(
    () =>
      availableSessions.map((sessionId) => {
        const match = entryScopes.assignments.find((row) => Number(row.session_id) === Number(sessionId));
        return {
          label: match?.session_name || `Session ${sessionId}`,
          value: String(sessionId),
        };
      }),
    [availableSessions, entryScopes],
  );

  const selectedSessionLabel = useMemo(
    () => sessionOptions.find((item) => item.value === String(form.session_id))?.label || "",
    [sessionOptions, form.session_id],
  );

  const shouldShowSessionPicker = !isTeacherOnly && sessionOptions.length > 1;

  const filteredTeacherLogs = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    return teacherLogs.filter((row) => !q || String(row.teacher || "").toLowerCase().includes(q));
  }, [teacherLogs, teacherSearch]);
  const teacherScopeKeys = useMemo(
    () =>
      new Set(
        (entryScopes.assignments || []).map(
          (row) => `${Number(row.class_id)}:${Number(row.section_id)}:${Number(row.session_id || 0)}`,
        ),
      ),
    [entryScopes],
  );

  const rosterSummary = useMemo(() => {
    return roster.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.status === "present") acc.present += 1;
        if (row.status === "absent") acc.absent += 1;
        return acc;
      },
      { total: 0, present: 0, absent: 0 },
    );
  }, [roster]);

  useEffect(() => {
    if (tabs.length && !tabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(tabs[0].key);
    }
  }, [tabs, activeTab]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === "review" && canReviewAttendance) loadPending();
    if (activeTab === "notify" && canNotifyParents) loadApproved();
    if ((activeTab === "approved" || activeTab === "history") && isTeacherOnly) loadApproved();
    if (activeTab === "logs" && canViewTeacherLogs) loadTeacherLogs();
  }, [activeTab]);

  useEffect(() => {
    if (!sessionOptions.length) return;
    if (!form.session_id) {
      setForm((prev) => ({ ...prev, session_id: sessionOptions[0].value }));
      return;
    }
    if (!sessionOptions.some((item) => item.value === String(form.session_id))) {
      setForm((prev) => ({ ...prev, session_id: sessionOptions[0].value }));
    }
  }, [sessionOptions, form.session_id]);

  useEffect(() => {
    if (
      activeTab !== "take" ||
      !isTeacherOnly ||
      !singleAssignedScope ||
      !form.class_id ||
      !form.section_id
    ) {
      return;
    }
    loadRoster();
  }, [
    activeTab,
    isTeacherOnly,
    singleAssignedScope,
    form.class_id,
    form.section_id,
    form.session_id,
    form.date,
  ]);

  async function refreshCurrentTab() {
    setRefreshing(true);
    try {
      if (activeTab === "take") {
        await Promise.all([loadEntryScopes(), loadClassStructure()]);
        if (form.class_id && form.section_id) await loadRoster();
      } else if (activeTab === "review") {
        await loadPending();
      } else if (activeTab === "notify" || activeTab === "approved" || activeTab === "history") {
        await loadApproved();
      } else if (activeTab === "logs") {
        await loadTeacherLogs();
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function loadInitialData() {
    await Promise.all([loadEntryScopes(), loadClassStructure()]);
    if (canNotifyParents) {
      try {
        setMessageTemplates(await getAbsenceMessageTemplates());
      } catch {
        setMessageTemplates([]);
      }
    }
  }

  async function loadEntryScopes() {
    if (!canTakeAttendance) return;
    try {
      const data = await getStudentAttendanceEntryScopes();
      setEntryScopes(data || { restricted: false, assignments: [] });
      if (data?.restricted && data.assignments?.length) {
        const first = data.assignments[0];
        setForm((prev) => ({
          ...prev,
          class_id: prev.class_id || String(first.class_id),
          section_id: prev.section_id || String(first.section_id),
          session_id: prev.session_id || String(first.session_id),
        }));
      }
    } catch {
      setEntryScopes({ restricted: false, assignments: [] });
    }
  }

  async function loadClassStructure() {
    try {
      setClasses(await getClassStructure());
    } catch {
      setClasses([]);
    }
  }

  async function loadRoster() {
    if (!form.class_id || !form.section_id) return;
    setRosterLoading(true);
    try {
      const payload = await getStudentAttendanceRoster({
        class_id: form.class_id,
        section_id: form.section_id,
        session_id: form.session_id || undefined,
        date: form.date,
      });
      setRosterMeta({
        existing_session_id: payload.existing_session_id,
        existing_approval_status: payload.existing_approval_status,
        existing_submitted_at: payload.existing_submitted_at || null,
        existing_submitted_by_username: payload.existing_submitted_by_username || null,
        existing_reviewed_at: payload.existing_reviewed_at || null,
        existing_reviewed_by_username: payload.existing_reviewed_by_username || null,
        existing_review_remarks: payload.existing_review_remarks || null,
      });
      setRoster(
        (payload.students || []).map((student) => ({
          student_id: Number(student.student_id),
          name: student.name,
          roll_number: student.roll_number,
          class_scope: student.class_scope,
          medium: student.medium,
          status: student.status || "present",
        })),
      );
      if (payload.academic_session_id && !form.session_id) {
        setForm((prev) => ({ ...prev, session_id: String(payload.academic_session_id) }));
      }
    } catch (err: unknown) {
      Alert.alert("Roster failed", getErrorMessage(err, "Could not load student roster."));
      setRoster([]);
      setRosterMeta(defaultRosterMeta());
    } finally {
      setRosterLoading(false);
    }
  }

  async function loadPending() {
    setPendingLoading(true);
    try {
      setPendingRows(await getPendingStudentAttendance());
    } catch (err: unknown) {
      setPendingRows([]);
      Alert.alert("Load failed", getErrorMessage(err, "Could not load pending attendance."));
    } finally {
      setPendingLoading(false);
    }
  }

  async function loadApproved() {
    setApprovedLoading(true);
    try {
      const needsFullHistory = isTeacherOnly && activeTab === "history";
      const rows = await getStudentAttendanceSessions(
        needsFullHistory ? undefined : { approval_status: "approved" },
      );

      const scopedRows = (rows || []).filter((row) => {
        if (!isTeacherOnly || !entryScopes.restricted) return true;
        const fallbackKey = `${Number(row.class_id)}:${Number(row.section_id)}:0`;
        const exactKey = `${Number(row.class_id)}:${Number(row.section_id)}:${Number(row.academic_session_id || 0)}`;
        return teacherScopeKeys.has(exactKey) || teacherScopeKeys.has(fallbackKey);
      });

      setApprovedRows(
        needsFullHistory
          ? scopedRows
          : scopedRows.filter((row) => String(row.approval_status || "").toLowerCase() === "approved"),
      );
    } catch (err: unknown) {
      setApprovedRows([]);
      Alert.alert("Load failed", getErrorMessage(err, "Could not load attendance sessions."));
    } finally {
      setApprovedLoading(false);
    }
  }

  async function loadTeacherLogs() {
    setTeacherLogsLoading(true);
    try {
      setTeacherLogs(await getAllTeacherAttendance());
    } catch (err: unknown) {
      setTeacherLogs([]);
      Alert.alert("Load failed", getErrorMessage(err, "Could not load teacher attendance."));
    } finally {
      setTeacherLogsLoading(false);
    }
  }

  async function openSessionDetails(sessionId: number, target: "pending" | "approved") {
    try {
      const data = await getStudentAttendanceSession(sessionId);
      if (target === "pending") {
        setSelectedPending(data);
        setReviewRemarks("");
      } else {
        setSelectedApproved(data);
        setNotifyForm({
          template_key: "",
          message: "",
          student_ids: (data.rows || []).filter((row) => row.status === "absent").map((row) => Number(row.student_id)),
        });
      }
    } catch (err: unknown) {
      Alert.alert("Open failed", getErrorMessage(err, "Could not load attendance details."));
    }
  }

  function updateStudentStatus(studentId: number, status: StudentAttendanceStatus) {
    if (rosterMeta.existing_session_id && rosterMeta.existing_approval_status !== "rejected") return;
    setRoster((prev) => prev.map((row) => (row.student_id === studentId ? { ...row, status } : row)));
  }

  function bulkMark(status: StudentAttendanceStatus) {
    if (rosterMeta.existing_session_id && rosterMeta.existing_approval_status !== "rejected") return;
    setRoster((prev) => prev.map((row) => ({ ...row, status })));
  }

  async function handleSubmitAttendance() {
    if (!form.class_id || !form.section_id || !form.date) return Alert.alert("Validation", "Class, section, and date are required.");
    if (!roster.length) return Alert.alert("Validation", "Load the student roster before submitting.");
    if (rosterMeta.existing_session_id && rosterMeta.existing_approval_status !== "rejected") {
      return Alert.alert("Locked", "Attendance is already recorded for this date.");
    }

    setSubmitting(true);
    try {
      const res = await submitStudentAttendance({
        session_id: form.session_id || undefined,
        class_id: Number(form.class_id),
        section_id: Number(form.section_id),
        date: form.date,
        deviceSource: "mobile",
        attendance: roster.map((row) => ({ student_id: row.student_id, status: row.status })),
      });
      setNotice({
        title: "Attendance Submitted",
        message: res?.approval_status === "approved" ? "Attendance recorded and approved." : "Attendance submitted for review.",
        tone: "success",
      });
      await loadRoster();
      if (canReviewAttendance) await loadPending();
    } catch (err: unknown) {
      Alert.alert("Submit failed", getErrorMessage(err, "Could not submit attendance."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(status: "approved" | "rejected") {
    if (!selectedPending?.id) return;
    try {
      await reviewStudentAttendance({
        attendance_session_id: selectedPending.id,
        status,
        remarks: reviewRemarks || undefined,
      });
      setNotice({
        title: status === "approved" ? "Attendance Approved" : "Attendance Rejected",
        message: status === "approved" ? "Attendance session approved successfully." : "Attendance session rejected successfully.",
        tone: "success",
      });
      setSelectedPending(null);
      await loadPending();
      if (canNotifyParents) await loadApproved();
    } catch (err: unknown) {
      Alert.alert("Review failed", getErrorMessage(err, "Could not review attendance."));
    }
  }

  async function handleNotifyParents() {
    if (!selectedApproved?.id) return;
    if (!notifyForm.student_ids.length) return Alert.alert("Validation", "Select at least one absent student.");
    if (!notifyForm.template_key && !String(notifyForm.message || "").trim()) {
      return Alert.alert("Validation", "Choose a template or enter a custom message.");
    }
    setNotifyLoading(true);
    try {
      const result = await notifyAbsentParents(selectedApproved.id, {
        template_key: notifyForm.template_key || undefined,
        message: notifyForm.template_key ? undefined : notifyForm.message,
        student_ids: notifyForm.student_ids,
      });
      setNotice({
        title: "Parent Messages Sent",
        message: `${result?.sent_count || 0} sent${result?.failed_count ? `, ${result.failed_count} failed` : ""}.`,
        tone: "success",
      });
      await openSessionDetails(Number(selectedApproved.id), "approved");
    } catch (err: unknown) {
      Alert.alert("Notify failed", getErrorMessage(err, "Could not notify parents."));
    } finally {
      setNotifyLoading(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshCurrentTab} />}>
      <View style={styles.heroCard}>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>Attendance</Text>
          <Text style={styles.subtitle}>Record student attendance, review sessions, notify parents, and track teacher logs from the live backend flow.</Text>
        </View>
      </View>

      <TopNotice notice={notice} />

      <View style={styles.tabsRow}>
        {tabs.map((tab) => <Pressable key={tab.key} style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]} onPress={() => setActiveTab(tab.key)}><Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextActive]}>{tab.label}</Text></Pressable>)}
      </View>

      {activeTab === "take" ? <>
        <View style={styles.statsGrid}>
          <SummaryCard label="Students" value={rosterSummary.total} />
          <SummaryCard label="Present" value={rosterSummary.present} tone="green" />
          <SummaryCard label="Absent" value={rosterSummary.absent} tone="red" />
        </View>

        <SectionCard title="Take Attendance" hint={rosterMeta.existing_approval_status ? `Status: ${rosterMeta.existing_approval_status}` : "New entry"}>
          <DateField
            label="Attendance Date"
            value={form.date}
            onChange={(value) => setForm((prev) => ({ ...prev, date: value }))}
            placeholder="Select attendance date"
          />
          {shouldShowSessionPicker ? (
            <SelectField
              label="Session"
              value={form.session_id}
              onChange={(value) => setForm((prev) => ({ ...prev, session_id: value }))}
              options={sessionOptions}
              placeholder="Choose session"
            />
          ) : selectedSessionLabel ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Academic Session</Text>
              <Text style={styles.infoText}>{selectedSessionLabel}</Text>
            </View>
          ) : null}
          <SelectField
            label="Class"
            value={form.class_id}
            onChange={(value) => setForm((prev) => ({ ...prev, class_id: value, section_id: "" }))}
            options={availableClasses.map((item) => ({
              label: item.name,
              value: String(item.id),
              description: scopeLabel(item.class_scope),
            }))}
            placeholder="Choose class"
          />
          <SelectField
            label="Section"
            value={form.section_id}
            onChange={(value) => setForm((prev) => ({ ...prev, section_id: value }))}
            options={(selectedClass?.sections || []).map((section) => ({
              label: `${section.name}${section.medium ? ` (${section.medium})` : ""}`,
              value: String(section.id),
            }))}
            placeholder="Choose section"
            disabled={!selectedClass}
          />
          <View style={styles.rowActions}>
            <Pressable style={styles.secondaryBtn} onPress={() => bulkMark("present")}><Text style={styles.secondaryBtnText}>Mark All Present</Text></Pressable>
            <Pressable style={styles.secondaryBtn} onPress={loadRoster}><Text style={styles.secondaryBtnText}>Load Roster</Text></Pressable>
          </View>
          {rosterMeta.existing_session_id ? <View style={styles.infoCard}><Text style={styles.infoTitle}>Existing Session</Text><Text style={styles.infoText}>Submitted by {rosterMeta.existing_submitted_by_username || "-"} on {formatDateTime(rosterMeta.existing_submitted_at)}</Text><Text style={styles.infoText}>Approval: {rosterMeta.existing_approval_status || "-"}</Text>{rosterMeta.existing_approval_status === "rejected" ? <Text style={styles.infoText}>This session was rejected. Update the attendance and submit it again.</Text> : null}{rosterMeta.existing_reviewed_by_username ? <Text style={styles.infoText}>Reviewed by {rosterMeta.existing_reviewed_by_username}</Text> : null}{rosterMeta.existing_review_remarks ? <Text style={styles.infoText}>Remarks: {rosterMeta.existing_review_remarks}</Text> : null}</View> : null}
        </SectionCard>

        <SectionCard title="Student Roster" hint={roster.length ? `${roster.length} loaded` : "No roster"}>
          {rosterLoading ? <ActivityIndicator size="large" color="#0f172a" /> : roster.length ? roster.map((student) => <View key={student.student_id} style={styles.studentCard}><View style={styles.rosterHeader}><View style={styles.rosterCopy}><Text style={styles.studentName}>{student.name}</Text><Text style={styles.detailText}>Roll: {student.roll_number || "-"}{student.medium ? ` | ${student.medium}` : ""}</Text></View><View style={styles.scopePill}><Text style={styles.scopePillText}>{scopeLabel(student.class_scope)}</Text></View></View><View style={styles.statusRow}>{STATUS_OPTIONS.map((status) => { const active = student.status === status; return <Pressable key={`${student.student_id}-${status}`} style={[styles.statusChip, active && statusChipActiveStyle(status)]} onPress={() => updateStudentStatus(student.student_id, status)}><Text style={[styles.statusChipText, active && statusChipTextActiveStyle(status)]}>{capitalize(status)}</Text></Pressable>; })}</View></View>) : <Text style={styles.emptyText}>Choose class and section, then load the roster.</Text>}
          <Pressable style={[styles.successBtn, styles.submitBtn]} onPress={handleSubmitAttendance} disabled={submitting || (Boolean(rosterMeta.existing_session_id) && rosterMeta.existing_approval_status !== "rejected")}><Text style={styles.successBtnText}>{submitting ? "Submitting..." : (rosterMeta.existing_session_id && rosterMeta.existing_approval_status !== "rejected") ? "Attendance Locked" : rosterMeta.existing_approval_status === "rejected" ? "Resubmit Attendance" : "Submit Attendance"}</Text></Pressable>
        </SectionCard>
      </> : null}

      {activeTab === "review" ? <>
        <SectionCard title="Pending Approval" hint={`${pendingRows.length} pending`}>
          {pendingLoading ? <ActivityIndicator size="large" color="#0f172a" /> : pendingRows.length ? pendingRows.map((row) => <Pressable key={row.id} style={styles.sessionCard} onPress={() => openSessionDetails(Number(row.id), "pending")}><View style={styles.rowBetween}><Text style={styles.sessionTitle}>{row.class_name || "-"} / {row.section_name || "-"}</Text><StatusBadge status={row.approval_status || "pending"} /></View><Text style={styles.detailText}>{formatDate(row.date)} • Absent: {row.absent_count || 0}</Text><Text style={styles.detailText}>Submitted by {row.submitted_by_username || "-"}</Text></Pressable>) : <Text style={styles.emptyText}>No pending sessions found.</Text>}
        </SectionCard>
        <SectionCard title="Review Details" hint={selectedPending ? "Selected" : "Choose a session"}>
          {selectedPending ? <>
            <View style={styles.infoCard}><Text style={styles.infoText}>Date: {formatDate(selectedPending.date)}</Text><Text style={styles.infoText}>Session: {selectedPending.session_name || "-"}</Text><Text style={styles.infoText}>Class: {selectedPending.class_name || "-"}</Text><Text style={styles.infoText}>Section: {selectedPending.section_name || "-"}</Text></View>
            {(selectedPending.rows || []).map((row) => <View key={row.id} style={styles.studentRow}><Text style={styles.studentName}>{row.student_name}</Text><StatusBadge status={row.status} /></View>)}
            <Text style={styles.inputLabel}>Remarks</Text>
            <TextInput style={[styles.input, styles.textarea]} multiline value={reviewRemarks} onChangeText={setReviewRemarks} placeholder="Optional remarks" placeholderTextColor="#94a3b8" textAlignVertical="top" />
            <View style={styles.rowActions}><Pressable style={styles.successBtn} onPress={() => handleReview("approved")}><Text style={styles.successBtnText}>Approve</Text></Pressable><Pressable style={styles.deleteBtn} onPress={() => handleReview("rejected")}><Text style={styles.deleteBtnText}>Reject</Text></Pressable></View>
          </> : <Text style={styles.emptyText}>Open a pending session to review it.</Text>}
        </SectionCard>
      </> : null}

      {(activeTab === "approved" || activeTab === "history" || activeTab === "notify") ? <>
        <SectionCard title={activeTab === "notify" ? "Approved Sessions" : activeTab === "approved" ? "Approved Classes" : "Attendance History"} hint={`${approvedRows.length} sessions`}>
          {approvedLoading ? <ActivityIndicator size="large" color="#0f172a" /> : approvedRows.length ? approvedRows.map((row) => <Pressable key={row.id} style={styles.sessionCard} onPress={() => openSessionDetails(Number(row.id), "approved")}><View style={styles.rowBetween}><Text style={styles.sessionTitle}>{row.class_name || "-"} / {row.section_name || "-"}</Text><StatusBadge status={row.approval_status || "approved"} /></View><Text style={styles.detailText}>{formatDate(row.date)} • Absent: {row.absent_count || 0}</Text>{row.reviewed_by_username ? <Text style={styles.detailText}>Reviewed by {row.reviewed_by_username}</Text> : null}</Pressable>) : <Text style={styles.emptyText}>No sessions found.</Text>}
        </SectionCard>
        <SectionCard title={activeTab === "notify" ? "Parent Message" : "Session Details"} hint={selectedApproved ? "Selected" : "Choose a session"}>
          {selectedApproved ? <>
            <View style={styles.infoCard}><Text style={styles.infoText}>Date: {formatDate(selectedApproved.date)}</Text><Text style={styles.infoText}>Class: {selectedApproved.class_name || "-"}</Text><Text style={styles.infoText}>Section: {selectedApproved.section_name || "-"}</Text><Text style={styles.infoText}>Approval: {selectedApproved.approval_status || "-"}</Text></View>
            {(selectedApproved.rows || []).map((row) => <View key={row.id} style={styles.studentRow}><Text style={styles.studentName}>{row.student_name}</Text><StatusBadge status={row.status} /></View>)}
            {activeTab === "notify" ? <>
              <Text style={styles.inputLabel}>Template</Text>
              <View style={styles.filterRow}><Pressable style={[styles.filterChip, !notifyForm.template_key && styles.filterChipActive]} onPress={() => setNotifyForm((prev) => ({ ...prev, template_key: "" }))}><Text style={[styles.filterChipText, !notifyForm.template_key && styles.filterChipTextActive]}>Custom</Text></Pressable>{messageTemplates.map((template) => <Pressable key={template.key} style={[styles.filterChip, notifyForm.template_key === template.key && styles.filterChipActive]} onPress={() => setNotifyForm((prev) => ({ ...prev, template_key: template.key }))}><Text style={[styles.filterChipText, notifyForm.template_key === template.key && styles.filterChipTextActive]}>{template.label}</Text></Pressable>)}</View>
              <Text style={styles.inputLabel}>Message</Text>
              <TextInput style={[styles.input, styles.textarea]} multiline value={notifyForm.message} onChangeText={(value) => setNotifyForm((prev) => ({ ...prev, message: value }))} placeholder="Leave blank if you use a template" placeholderTextColor="#94a3b8" editable={!notifyForm.template_key} textAlignVertical="top" />
              <Text style={styles.inputLabel}>Absent Students</Text>
              {(selectedApproved.rows || []).filter((row) => row.status === "absent").map((row) => { const checked = notifyForm.student_ids.includes(Number(row.student_id)); return <Pressable key={row.id} style={[styles.selectionRow, checked && styles.selectionRowActive]} onPress={() => setNotifyForm((prev) => ({ ...prev, student_ids: checked ? prev.student_ids.filter((id) => id !== Number(row.student_id)) : [...prev.student_ids, Number(row.student_id)] }))}><Text style={styles.studentName}>{row.student_name}</Text><Text style={styles.detailText}>{checked ? "Selected" : "Tap to send"}</Text></Pressable>; })}
              <Pressable style={styles.successBtn} onPress={handleNotifyParents} disabled={notifyLoading}><Text style={styles.successBtnText}>{notifyLoading ? "Sending..." : "Send To Parents"}</Text></Pressable>
            </> : null}
          </> : <Text style={styles.emptyText}>Open a session to inspect the roster.</Text>}
        </SectionCard>
      </> : null}

      {activeTab === "logs" ? <SectionCard title="Teacher Logs" hint={`${filteredTeacherLogs.length} records`}>
        <TextInput style={styles.input} value={teacherSearch} onChangeText={setTeacherSearch} placeholder="Search teacher name" placeholderTextColor="#94a3b8" />
        {teacherLogsLoading ? <ActivityIndicator size="large" color="#0f172a" /> : filteredTeacherLogs.length ? filteredTeacherLogs.map((row) => <View key={row.id} style={styles.sessionCard}><View style={styles.rowBetween}><Text style={styles.sessionTitle}>{row.teacher}</Text><StatusBadge status={row.status} /></View><Text style={styles.detailText}>Date: {formatDate(row.attendance_date)}</Text><Text style={styles.detailText}>Check In: {formatDateTime(row.check_in)}</Text><Text style={styles.detailText}>Check Out: {formatDateTime(row.check_out)}</Text><Text style={styles.detailText}>Worked Hours: {row.worked_hours || "-"}</Text></View>) : <Text style={styles.emptyText}>No teacher attendance records found.</Text>}
      </SectionCard> : null}
    </ScrollView>
  );
}

function capitalize(value: string) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : ""; }
function summaryCardTone(tone: "default" | "green" | "red" | "amber") { if (tone === "green") return { borderColor: "#bbf7d0", backgroundColor: currentTheme.isDark ? "#052e16" : "#f0fdf4" }; if (tone === "red") return { borderColor: "#fecaca", backgroundColor: currentTheme.isDark ? "#450a0a" : "#fef2f2" }; if (tone === "amber") return { borderColor: "#fde68a", backgroundColor: currentTheme.isDark ? "#451a03" : "#fffbeb" }; return { borderColor: currentTheme.border, backgroundColor: currentTheme.card }; }
function summaryValueTone(tone: "default" | "green" | "red" | "amber") { if (tone === "green") return { color: currentTheme.isDark ? "#86efac" : "#15803d" }; if (tone === "red") return { color: currentTheme.isDark ? "#fca5a5" : "#b91c1c" }; if (tone === "amber") return { color: currentTheme.isDark ? "#fcd34d" : "#b45309" }; return { color: currentTheme.text }; }
function statusBadgeTone(status: string) { if (status === "present" || status === "approved") return { borderColor: "#bbf7d0", backgroundColor: currentTheme.isDark ? "#052e16" : "#f0fdf4" }; if (status === "absent" || status === "rejected") return { borderColor: "#fecaca", backgroundColor: currentTheme.isDark ? "#450a0a" : "#fef2f2" }; return { borderColor: "#fde68a", backgroundColor: currentTheme.isDark ? "#451a03" : "#fffbeb" }; }
function statusBadgeTextTone(status: string) { if (status === "present" || status === "approved") return { color: currentTheme.isDark ? "#86efac" : "#15803d" }; if (status === "absent" || status === "rejected") return { color: currentTheme.isDark ? "#fca5a5" : "#b91c1c" }; return { color: currentTheme.isDark ? "#fcd34d" : "#b45309" }; }
function statusChipActiveStyle(status: StudentAttendanceStatus) { if (status === "present") return { borderColor: "#15803d", backgroundColor: currentTheme.isDark ? "#14532d" : "#dcfce7" }; if (status === "absent") return { borderColor: "#b91c1c", backgroundColor: currentTheme.isDark ? "#7f1d1d" : "#fee2e2" }; return { borderColor: "#b45309", backgroundColor: currentTheme.isDark ? "#78350f" : "#fef3c7" }; }
function statusChipTextActiveStyle(status: StudentAttendanceStatus) { if (status === "present") return { color: currentTheme.isDark ? "#dcfce7" : "#166534" }; if (status === "absent") return { color: currentTheme.isDark ? "#fee2e2" : "#991b1b" }; return { color: currentTheme.isDark ? "#fef3c7" : "#92400e" }; }

let styles = createStyles(currentTheme);

function createStyles(theme: typeof DEFAULT_THEME) {
return StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 14, paddingBottom: 8 },
  heroCard: { backgroundColor: theme.card, borderRadius: 24, borderWidth: 1, borderColor: theme.border, padding: 18, gap: 14 },
  heroCopy: { gap: 6 },
  title: { color: theme.text, fontWeight: "800", fontSize: 22 },
  subtitle: { color: theme.subText, lineHeight: 20 },
  noticeCard: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1 },
  noticeSuccess: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  noticeError: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  noticeTitle: { color: theme.text, fontWeight: "800", marginBottom: 2 },
  noticeMessage: { color: theme.subText },
  tabsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tabBtn: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: theme.card },
  tabBtnActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  tabBtnText: { color: theme.subText, fontWeight: "700", fontSize: 12 },
  tabBtnTextActive: { color: "#fff" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { width: "48%", minHeight: 86, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, justifyContent: "space-between" },
  summaryValue: { fontSize: 24, fontWeight: "800" },
  summaryLabel: { color: theme.subText, fontSize: 12, fontWeight: "700" },
  sectionCard: { backgroundColor: theme.card, borderRadius: 22, borderWidth: 1, borderColor: theme.border, padding: 16, gap: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  sectionTitle: { color: theme.text, fontWeight: "800", fontSize: 16 },
  hint: { color: theme.subText, fontSize: 12, fontWeight: "600" },
  inputLabel: { color: theme.text, fontWeight: "700" },
  input: { borderWidth: 1, borderColor: theme.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: theme.inputBg, color: theme.text },
  textarea: { minHeight: 110 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.cardMuted },
  filterChipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  filterChipText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  filterChipTextActive: { color: "#fff" },
  classChip: { minWidth: 120, borderWidth: 1, borderColor: theme.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.card },
  classChipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  classChipTitle: { color: theme.text, fontWeight: "700" },
  classChipMeta: { marginTop: 4, color: theme.subText, fontSize: 12, fontWeight: "600" },
  classChipMetaActive: { color: "rgba(255,255,255,0.72)" },
  rowActions: { flexDirection: "row", gap: 10, marginTop: 2 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: theme.text, fontWeight: "700" },
  successBtn: { backgroundColor: "#15803d", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  successBtnText: { color: "#fff", fontWeight: "700" },
  deleteBtn: { backgroundColor: "#fee2e2", borderWidth: 1, borderColor: "#fecaca", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  deleteBtnText: { color: "#b91c1c", fontWeight: "700" },
  infoCard: { borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 12, backgroundColor: theme.cardMuted, gap: 4 },
  infoTitle: { color: theme.text, fontWeight: "800" },
  infoText: { color: theme.subText, lineHeight: 18 },
  studentCard: { borderWidth: 1, borderColor: theme.border, borderRadius: 16, backgroundColor: theme.cardMuted, padding: 12, gap: 10 },
  rosterHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  rosterCopy: { flex: 1, minWidth: 0, gap: 2 },
  studentName: { color: theme.text, fontWeight: "700" },
  detailText: { color: theme.subText, lineHeight: 18 },
  scopePill: { maxWidth: "42%", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#eef2ff", alignSelf: "flex-start" },
  scopePillText: { color: "#4338ca", fontSize: 12, fontWeight: "700", textAlign: "center" },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  statusChip: { borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: theme.card },
  statusChipText: { color: theme.text, fontWeight: "700", fontSize: 12 },
  submitBtn: { marginTop: 4 },
  sessionCard: { borderWidth: 1, borderColor: theme.border, borderRadius: 16, backgroundColor: theme.cardMuted, padding: 12, gap: 5 },
  sessionTitle: { color: theme.text, fontWeight: "700" },
  statusBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: "700" },
  studentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 10, backgroundColor: theme.card },
  selectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 10, backgroundColor: theme.card },
  selectionRowActive: { borderColor: "#15803d", backgroundColor: "#f0fdf4" },
  emptyText: { color: theme.subText },
});
}

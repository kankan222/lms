import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { adminResetPassword } from "../../../services/usersService";
import {
  getTeacher,
  getTeacherAssignments,
  getTeacherAttendance,
  resolveTeacherPhotoUrl,
  type TeacherAssignment,
  type TeacherAttendanceRow,
  type TeacherItem,
} from "../../../services/teachersService";
import { formatDateLabel } from "../../../utils/format";
import DateField from "../../../components/form/DateField";
import TopNotice from "../../../components/feedback/TopNotice";
import { useAppTheme } from "../../../theme/AppThemeProvider";

type Props = {
  teacherId: number | null;
  canManageTeachers: boolean;
};

type TabKey = "overview" | "assignments" | "attendance" | "security";
type Notice = { title: string; message: string; tone: "success" | "error" } | null;

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err && "response" in err) {
    const data = (err as { response?: { data?: { message?: string; error?: string } } }).response?.data;
    return data?.error || data?.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

const fmtScope = (scope?: string | null) => String(scope || "").trim().toLowerCase() === "hs" ? "Higher Secondary" : "School";
const title = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : "";

function statusPalette(status: string) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "in") return { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", color: "#15803d" };
  if (value === "out") return { borderColor: "#bfdbfe", backgroundColor: "#eff6ff", color: "#1d4ed8" };
  if (value === "unknown") return { borderColor: "#fde68a", backgroundColor: "#fffbeb", color: "#b45309" };
  return { borderColor: "#cbd5e1", backgroundColor: "#f8fafc", color: "#475569" };
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  return <Pressable style={[styles.filterChip, { borderColor: theme.border, backgroundColor: theme.cardMuted }, active && { borderColor: theme.primary, backgroundColor: theme.primary }]} onPress={onPress}><Text style={[styles.filterChipText, { color: theme.subText }, active && { color: theme.primaryText }]}>{label}</Text></Pressable>;
}

function SummaryCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "blue" | "green" | "violet" }) {
  const { theme } = useAppTheme();
  const palette = tone === "blue"
    ? {
        borderColor: theme.isDark ? "#1d4ed8" : "#bfdbfe",
        backgroundColor: theme.isDark ? "#172554" : "#eff6ff",
        color: theme.isDark ? "#bfdbfe" : "#1d4ed8",
      }
    : tone === "green"
      ? {
          borderColor: theme.isDark ? "#15803d" : "#bbf7d0",
          backgroundColor: theme.isDark ? "#14532d" : "#f0fdf4",
          color: theme.isDark ? "#bbf7d0" : "#15803d",
        }
      : tone === "violet"
        ? {
            borderColor: theme.isDark ? "#7c3aed" : "#ddd6fe",
            backgroundColor: theme.isDark ? "#3b0764" : "#f5f3ff",
            color: theme.isDark ? "#ddd6fe" : "#6d28d9",
          }
        : {
            borderColor: theme.isDark ? "#475569" : "#e2e8f0",
            backgroundColor: theme.isDark ? "#1e293b" : "#ffffff",
            color: theme.isDark ? "#f8fafc" : "#0f172a",
          };
  return <View style={[styles.summaryCard, { borderColor: palette.borderColor, backgroundColor: palette.backgroundColor }]}><Text style={[styles.summaryValue, { color: palette.color }]}>{value}</Text><Text style={[styles.summaryLabel, { color: theme.subText }]}>{label}</Text></View>;
}

function SectionCard({ title: heading, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const { theme } = useAppTheme();
  return <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}><View style={styles.rowBetween}><Text style={[styles.sectionTitle, { color: theme.text }]}>{heading}</Text>{hint ? <Text style={[styles.sectionHint, { color: theme.subText }]}>{hint}</Text> : null}</View>{children}</View>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return <View style={[styles.infoRow, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}><Text style={[styles.infoLabel, { color: theme.subText }]}>{label}</Text><Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text></View>;
}

function StatusChip({ value }: { value: string }) {
  const palette = statusPalette(value);
  return <View style={[styles.statusChip, { borderColor: palette.borderColor, backgroundColor: palette.backgroundColor }]}><Text style={[styles.statusChipText, { color: palette.color }]}>{title(String(value || "-"))}</Text></View>;
}

export default function TeacherDetailsModule({ teacherId, canManageTeachers }: Props) {
  const { theme } = useAppTheme();
  const [teacher, setTeacher] = useState<TeacherItem | null>(null);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [attendance, setAttendance] = useState<TeacherAttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [attendanceFilters, setAttendanceFilters] = useState({ startDate: "", endDate: "" });
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!teacherId) return;
    let ignore = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [teacherRow, assignmentRows, attendanceRows] = await Promise.all([
          getTeacher(teacherId),
          getTeacherAssignments(teacherId),
          getTeacherAttendance(teacherId, {
            startDate: attendanceFilters.startDate || undefined,
            endDate: attendanceFilters.endDate || undefined,
          }),
        ]);
        if (ignore) return;
        setTeacher(teacherRow);
        setAssignments(assignmentRows);
        setAttendance(attendanceRows);
      } catch (err: unknown) {
        if (!ignore) setError(getErrorMessage(err, "Failed to load teacher details."));
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [teacherId, attendanceFilters.startDate, attendanceFilters.endDate]);

  const photoUri = resolveTeacherPhotoUrl(teacher?.photo_url);
  const punchInCount = useMemo(() => attendance.filter((row) => String(row.punch_type || "").toLowerCase() === "in").length, [attendance]);
  const punchOutCount = useMemo(() => attendance.filter((row) => String(row.punch_type || "").toLowerCase() === "out").length, [attendance]);
  const assignedClassSections = useMemo(
    () =>
      Array.from(
        new Map(
          assignments.map((assignment) => [
            `${assignment.class}-${assignment.section}`,
            {
              key: `${assignment.class}-${assignment.section}`,
              className: assignment.class,
              sectionName: assignment.section,
            },
          ]),
        ).values(),
      ),
    [assignments],
  );
  const assignedSubjects = useMemo(
    () =>
      Array.from(
        new Map(
          assignments.map((assignment) => [
            assignment.subject,
            {
              key: assignment.subject,
              subjectName: assignment.subject,
            },
          ]),
        ).values(),
      ),
    [assignments],
  );

  async function handleResetPassword() {
    if (!teacher?.user_id) return;
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      return Alert.alert("Validation", "New password must be at least 6 characters.");
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return Alert.alert("Validation", "Passwords do not match.");
    }
    setResetting(true);
    try {
      await adminResetPassword({ user_id: teacher.user_id, new_password: passwordForm.newPassword });
      setPasswordForm({ newPassword: "", confirmPassword: "" });
      setNotice({ title: "Password updated", message: "Teacher password has been reset successfully.", tone: "success" });
    } catch (err: unknown) {
      setNotice({ title: "Reset failed", message: getErrorMessage(err, "Failed to reset password."), tone: "error" });
    } finally {
      setResetting(false);
    }
  }

  if (!teacherId) return <Text style={[styles.emptyText, { color: theme.subText }]}>Select a teacher to view details.</Text>;
  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={theme.text} /></View>;
  if (error) return <View style={styles.errorCard}><Text style={styles.errorTitle}>Teacher unavailable</Text><Text style={styles.errorText}>{error}</Text></View>;
  if (!teacher) return <Text style={[styles.emptyText, { color: theme.subText }]}>Teacher not found.</Text>;

  return (
    <View style={styles.root}>
      <TopNotice notice={notice} style={styles.topNoticeOverlay} />
      <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.heroEyebrow, { color: theme.subText }]}>Overview</Text>
        <View style={styles.heroTop}>
          {photoUri ? <Image source={{ uri: photoUri }} style={[styles.photo, { backgroundColor: theme.cardMuted }]} /> : <View style={[styles.avatarFallback, { backgroundColor: theme.cardMuted }]}><Text style={[styles.avatarText, { color: theme.text }]}>{(teacher.name || "T").slice(0, 1).toUpperCase()}</Text></View>}
          <View style={styles.heroCopy}>
            <Text style={[styles.title, { color: theme.text }]}>{teacher.name}</Text>
            <Text style={[styles.subtitle, { color: theme.subText }]}>{fmtScope(teacher.class_scope)}</Text>
            <Text style={styles.heroMeta}>Employee ID {teacher.employee_id || "-"} • Phone {teacher.phone || "-"}</Text>
            <Text style={[styles.heroMeta, { color: theme.subText }]}>Email {teacher.email || "-"}</Text>
          </View>
        </View>
        <View style={styles.summaryGrid}>
          <SummaryCard label="Assignments" value={assignments.length} tone="blue" />
          <SummaryCard label="Punch In" value={punchInCount} tone="green" />
          <SummaryCard label="Punch Out" value={punchOutCount} tone="violet" />
          <SummaryCard label="Scope" value={fmtScope(teacher.class_scope)} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {(["overview", "assignments", "attendance"] as TabKey[]).concat(canManageTeachers && teacher.user_id ? ["security"] : []).map((tab) => (
          <FilterChip key={tab} label={title(tab)} active={activeTab === tab} onPress={() => setActiveTab(tab)} />
        ))}
      </ScrollView>

      {activeTab === "overview" ? (
        <SectionCard title="Teacher Overview" hint={`#${teacher.id}`}>
          <View style={styles.infoGrid}>
            <InfoRow label="Employee ID" value={teacher.employee_id || "-"} />
            <InfoRow label="Phone" value={teacher.phone || "-"} />
            <InfoRow label="Email" value={teacher.email || "-"} />
            <InfoRow label="Scope" value={fmtScope(teacher.class_scope)} />
            <InfoRow label="User ID" value={teacher.user_id ? String(teacher.user_id) : "-"} />
          </View>
        </SectionCard>
      ) : null}

      {activeTab === "assignments" ? (
        <SectionCard title="Assignments" hint={`${assignments.length} linked`}>
          {assignments.length ? (
            <>
              <View style={styles.assignmentGroup}>
                <Text style={[styles.groupTitle, { color: theme.text }]}>Assigned Classes & Sections</Text>
                <View style={styles.assignmentChipWrap}>
                  {assignedClassSections.map((item) => (
                    <View key={item.key} style={[styles.assignmentChip, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
                      <Text style={[styles.assignmentChipText, { color: theme.subText }]}>
                        {item.className} / {item.sectionName}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.assignmentGroup}>
                <Text style={[styles.groupTitle, { color: theme.text }]}>Assigned Subjects</Text>
                <View style={styles.assignmentChipWrap}>
                  {assignedSubjects.map((item) => (
                    <View key={item.key} style={[styles.assignmentChip, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
                      <Text style={[styles.assignmentChipText, { color: theme.subText }]}>{item.subjectName}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.assignmentGroup}>
                <Text style={[styles.groupTitle, { color: theme.text }]}>Assignment Details</Text>
                {assignments.map((assignment) => (
                  <View key={assignment.id} style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
                    <Text style={[styles.listTitle, { color: theme.text }]}>{assignment.class} / {assignment.section}</Text>
                    <Text style={[styles.listMeta, { color: theme.subText }]}>Subject: {assignment.subject}</Text>
                    <Text style={[styles.listMeta, { color: theme.subText }]}>Session: {assignment.session}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : <Text style={styles.emptyText}>No assignments found for this teacher.</Text>}
        </SectionCard>
      ) : null}

      {activeTab === "attendance" ? (
        <SectionCard title="Attendance Logs" hint={`${attendance.length} records`}>
          <View style={styles.filterBlock}>
            <Text style={styles.inputLabel}>Date range</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <DateField value={attendanceFilters.startDate} onChange={(value) => setAttendanceFilters((prev) => ({ ...prev, startDate: value }))} placeholder="From date" />
              </View>
              <View style={styles.inputHalf}>
                <DateField value={attendanceFilters.endDate} onChange={(value) => setAttendanceFilters((prev) => ({ ...prev, endDate: value }))} placeholder="To date" />
              </View>
            </View>
            <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setAttendanceFilters({ startDate: "", endDate: "" })}><Text style={[styles.secondaryBtnText, { color: theme.text }]}>Reset Filters</Text></Pressable>
          </View>
          {attendance.length ? attendance.map((row) => (
            <View key={row.id} style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.listTitle, { color: theme.text }]}>{formatDateLabel(row.punch_time)}</Text>
                <StatusChip value={row.punch_type} />
              </View>
              <Text style={[styles.listMeta, { color: theme.subText }]}>Punch time: {formatDateLabel(row.punch_time)}</Text>
              <Text style={[styles.listMeta, { color: theme.subText }]}>Device: {row.device_name || row.device_code || "-"}</Text>
              <Text style={[styles.listMeta, { color: theme.subText }]}>Location: {row.location || "-"}</Text>
            </View>
          )) : <Text style={[styles.emptyText, { color: theme.subText }]}>No attendance records found for this teacher.</Text>}
        </SectionCard>
      ) : null}

      {activeTab === "security" && canManageTeachers && teacher.user_id ? (
        <SectionCard title="Security" hint="Admin reset">
          <Text style={[styles.inputLabel, { color: theme.text }]}>New password</Text>
          <TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={passwordForm.newPassword} onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, newPassword: value }))} secureTextEntry placeholder="Minimum 6 characters" placeholderTextColor={theme.mutedText} />
          <Text style={[styles.inputLabel, { color: theme.text }]}>Confirm password</Text>
          <TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} value={passwordForm.confirmPassword} onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, confirmPassword: value }))} secureTextEntry placeholder="Repeat password" placeholderTextColor={theme.mutedText} />
          <Pressable style={[styles.successBtn, { backgroundColor: theme.success }, resetting && styles.btnDisabled]} disabled={resetting} onPress={handleResetPassword}><Text style={[styles.successBtnText, { color: theme.successText }]}>{resetting ? "Updating..." : "Reset Password"}</Text></Pressable>
        </SectionCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "relative", gap: 14, paddingBottom: 8 },
  centered: { minHeight: 240, alignItems: "center", justifyContent: "center" },
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
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { width: "48%", minHeight: 88, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, justifyContent: "space-between" },
  summaryValue: { fontSize: 22, fontWeight: "800" },
  summaryLabel: { fontSize: 12, fontWeight: "700" },
  tabsRow: { gap: 8, paddingBottom: 2 },
  filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterChipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  filterChipText: { fontWeight: "700", fontSize: 12 },
  filterChipTextActive: { color: "#ffffff" },
  sectionCard: { backgroundColor: "#ffffff", borderRadius: 22, borderWidth: 1, borderColor: "#e2e8f0", padding: 16, gap: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  sectionTitle: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  sectionHint: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  infoGrid: { gap: 8 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, backgroundColor: "#f8fafc", paddingHorizontal: 12, paddingVertical: 10 },
  infoLabel: { color: "#64748b", fontWeight: "700" },
  infoValue: { color: "#0f172a", fontWeight: "700", flexShrink: 1, textAlign: "right" },
  assignmentGroup: { gap: 10 },
  groupTitle: { color: "#0f172a", fontWeight: "700", fontSize: 14 },
  assignmentChipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  assignmentChip: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 999, backgroundColor: "#f8fafc", paddingHorizontal: 10, paddingVertical: 6 },
  assignmentChipText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  listCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16, backgroundColor: "#f8fafc", padding: 12, gap: 6 },
  listTitle: { color: "#0f172a", fontWeight: "700", fontSize: 14 },
  listMeta: { color: "#64748b", fontSize: 12, lineHeight: 18 },
  statusChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusChipText: { fontSize: 12, fontWeight: "700" },
  filterBlock: { gap: 10 },
  inputLabel: { color: "#334155", fontWeight: "700" },
  inputRow: { flexDirection: "row", gap: 10 },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, backgroundColor: "#ffffff", paddingHorizontal: 12, paddingVertical: 11, color: "#0f172a" },
  inputHalf: { flex: 1 },
  secondaryBtn: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: "#334155", fontWeight: "700" },
  successBtn: { backgroundColor: "#15803d", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  successBtnText: { color: "#ffffff", fontWeight: "700" },
  btnDisabled: { opacity: 0.45 },
  emptyText: { color: "#64748b" },
  errorCard: { borderRadius: 18, borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fef2f2", paddingHorizontal: 14, paddingVertical: 12 },
  errorTitle: { color: "#991b1b", fontWeight: "800", marginBottom: 2 },
  errorText: { color: "#b91c1c" },
});

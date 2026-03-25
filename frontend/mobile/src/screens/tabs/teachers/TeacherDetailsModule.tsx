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

type Props = {
  teacherId: number | null;
  canManageTeachers: boolean;
};

type TabKey = "overview" | "assignments" | "attendance" | "security";

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
  if (value === "present") return { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", color: "#15803d" };
  if (value === "absent") return { borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#b91c1c" };
  if (value === "late") return { borderColor: "#fde68a", backgroundColor: "#fffbeb", color: "#b45309" };
  return { borderColor: "#cbd5e1", backgroundColor: "#f8fafc", color: "#475569" };
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}><Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text></Pressable>;
}

function SummaryCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "blue" | "green" | "violet" }) {
  const palette = tone === "blue"
    ? { borderColor: "#bfdbfe", backgroundColor: "#eff6ff", color: "#1d4ed8" }
    : tone === "green"
      ? { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", color: "#15803d" }
      : tone === "violet"
        ? { borderColor: "#ddd6fe", backgroundColor: "#f5f3ff", color: "#6d28d9" }
        : { borderColor: "#e2e8f0", backgroundColor: "#ffffff", color: "#0f172a" };
  return <View style={[styles.summaryCard, { borderColor: palette.borderColor, backgroundColor: palette.backgroundColor }]}><Text style={[styles.summaryValue, { color: palette.color }]}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function SectionCard({ title: heading, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return <View style={styles.sectionCard}><View style={styles.rowBetween}><Text style={styles.sectionTitle}>{heading}</Text>{hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}</View>{children}</View>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function StatusChip({ value }: { value: string }) {
  const palette = statusPalette(value);
  return <View style={[styles.statusChip, { borderColor: palette.borderColor, backgroundColor: palette.backgroundColor }]}><Text style={[styles.statusChipText, { color: palette.color }]}>{title(String(value || "-"))}</Text></View>;
}

export default function TeacherDetailsModule({ teacherId, canManageTeachers }: Props) {
  const [teacher, setTeacher] = useState<TeacherItem | null>(null);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [attendance, setAttendance] = useState<TeacherAttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [attendanceFilters, setAttendanceFilters] = useState({ startDate: "", endDate: "" });
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [resetting, setResetting] = useState(false);

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
  const attendancePresent = useMemo(() => attendance.filter((row) => String(row.status || "").toLowerCase() === "present").length, [attendance]);
  const attendanceAbsent = useMemo(() => attendance.filter((row) => String(row.status || "").toLowerCase() === "absent").length, [attendance]);
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
      Alert.alert("Password updated", "Teacher password has been reset successfully.");
    } catch (err: unknown) {
      Alert.alert("Reset failed", getErrorMessage(err, "Failed to reset password."));
    } finally {
      setResetting(false);
    }
  }

  if (!teacherId) return <Text style={styles.emptyText}>Select a teacher to view details.</Text>;
  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#0f172a" /></View>;
  if (error) return <View style={styles.errorCard}><Text style={styles.errorTitle}>Teacher unavailable</Text><Text style={styles.errorText}>{error}</Text></View>;
  if (!teacher) return <Text style={styles.emptyText}>Teacher not found.</Text>;

  return (
    <View style={styles.root}>
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} /> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{(teacher.name || "T").slice(0, 1).toUpperCase()}</Text></View>}
          <View style={styles.heroCopy}>
            <Text style={styles.title}>{teacher.name}</Text>
            <Text style={styles.subtitle}>{fmtScope(teacher.class_scope)}</Text>
            <Text style={styles.heroMeta}>Employee ID {teacher.employee_id || "-"} • Phone {teacher.phone || "-"}</Text>
            <Text style={styles.heroMeta}>Email {teacher.email || "-"}</Text>
          </View>
        </View>
        <View style={styles.summaryGrid}>
          <SummaryCard label="Assignments" value={assignments.length} tone="blue" />
          <SummaryCard label="Present Days" value={attendancePresent} tone="green" />
          <SummaryCard label="Absent Days" value={attendanceAbsent} tone="violet" />
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
                <Text style={styles.groupTitle}>Assigned Classes & Sections</Text>
                <View style={styles.assignmentChipWrap}>
                  {assignedClassSections.map((item) => (
                    <View key={item.key} style={styles.assignmentChip}>
                      <Text style={styles.assignmentChipText}>
                        {item.className} / {item.sectionName}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.assignmentGroup}>
                <Text style={styles.groupTitle}>Assigned Subjects</Text>
                <View style={styles.assignmentChipWrap}>
                  {assignedSubjects.map((item) => (
                    <View key={item.key} style={styles.assignmentChip}>
                      <Text style={styles.assignmentChipText}>{item.subjectName}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.assignmentGroup}>
                <Text style={styles.groupTitle}>Assignment Details</Text>
                {assignments.map((assignment) => (
                  <View key={assignment.id} style={styles.listCard}>
                    <Text style={styles.listTitle}>{assignment.class} / {assignment.section}</Text>
                    <Text style={styles.listMeta}>Subject: {assignment.subject}</Text>
                    <Text style={styles.listMeta}>Session: {assignment.session}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : <Text style={styles.emptyText}>No assignments found for this teacher.</Text>}
        </SectionCard>
      ) : null}

      {activeTab === "attendance" ? (
        <SectionCard title="Attendance History" hint={`${attendance.length} records`}>
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
            <Pressable style={styles.secondaryBtn} onPress={() => setAttendanceFilters({ startDate: "", endDate: "" })}><Text style={styles.secondaryBtnText}>Reset Filters</Text></Pressable>
          </View>
          {attendance.length ? attendance.map((row) => (
            <View key={row.id} style={styles.listCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.listTitle}>{formatDateLabel(row.attendance_date)}</Text>
                <StatusChip value={row.status} />
              </View>
              <Text style={styles.listMeta}>Check in: {row.check_in ? formatDateLabel(row.check_in) : "-"}</Text>
              <Text style={styles.listMeta}>Check out: {row.check_out ? formatDateLabel(row.check_out) : "-"}</Text>
              <Text style={styles.listMeta}>Worked hours: {String(row.worked_hours || "-")}</Text>
            </View>
          )) : <Text style={styles.emptyText}>No attendance records found for this teacher.</Text>}
        </SectionCard>
      ) : null}

      {activeTab === "security" && canManageTeachers && teacher.user_id ? (
        <SectionCard title="Security" hint="Admin reset">
          <Text style={styles.inputLabel}>New password</Text>
          <TextInput style={styles.input} value={passwordForm.newPassword} onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, newPassword: value }))} secureTextEntry placeholder="Minimum 6 characters" placeholderTextColor="#94a3b8" />
          <Text style={styles.inputLabel}>Confirm password</Text>
          <TextInput style={styles.input} value={passwordForm.confirmPassword} onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, confirmPassword: value }))} secureTextEntry placeholder="Repeat password" placeholderTextColor="#94a3b8" />
          <Pressable style={[styles.successBtn, resetting && styles.btnDisabled]} disabled={resetting} onPress={handleResetPassword}><Text style={styles.successBtnText}>{resetting ? "Updating..." : "Reset Password"}</Text></Pressable>
        </SectionCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14, paddingBottom: 8 },
  centered: { minHeight: 240, alignItems: "center", justifyContent: "center" },
  heroCard: { backgroundColor: "#ffffff", borderRadius: 24, borderWidth: 1, borderColor: "#e2e8f0", padding: 16, gap: 14 },
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
  summaryLabel: { color: "#64748b", fontSize: 12, fontWeight: "700" },
  tabsRow: { gap: 8, paddingBottom: 2 },
  filterChip: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f8fafc" },
  filterChipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  filterChipText: { color: "#475569", fontWeight: "700", fontSize: 12 },
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

import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
import { formatDateLabel, formatTimeLabel } from "../../../utils/format";
import DateField from "../../../components/form/DateField";
import TopNotice from "../../../components/feedback/TopNotice";
import { useAppTheme } from "../../../theme/AppThemeProvider";

type Props = {
  teacherId: number | null;
  canManageTeachers: boolean;
};

type TabKey = "overview" | "assignments" | "attendance" | "security";
type Notice = { title: string; message: string; tone: "success" | "error" } | null;
type AttendancePreset = "today" | "week" | "month" | "custom";
type DateRange = { from: string; to: string };

const ATTENDANCE_PAGE_SIZE = 10;

function formatDateInputValue(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfInputDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveAttendancePresetRange(preset: Exclude<AttendancePreset, "custom">): DateRange {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);

  if (preset === "week") {
    start.setDate(start.getDate() - 6);
  } else if (preset === "month") {
    start.setDate(start.getDate() - 29);
  }

  return {
    from: formatDateInputValue(start),
    to: formatDateInputValue(end),
  };
}

function toDateKey(value?: string | null) {
  if (!value) return "";
  return formatDateInputValue(value);
}

function buildDateRangeKeys(from?: string, to?: string) {
  if (!from || !to || from > to) return [] as string[];
  const fromDate = startOfInputDate(from);
  const toDate = startOfInputDate(to);
  if (!fromDate || !toDate) return [] as string[];

  const keys: string[] = [];
  const cursor = new Date(fromDate);
  while (cursor.getTime() <= toDate.getTime()) {
    keys.push(formatDateInputValue(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err && "response" in err) {
    const data = (err as { response?: { data?: { message?: string; error?: string } } }).response?.data;
    return data?.error || data?.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function formatSectionLabel(sectionName?: string | null, sectionMedium?: string | null) {
  const name = String(sectionName || "Section").trim();
  const medium = String(sectionMedium || "").trim();
  return medium ? `${name} (${medium})` : name;
}

function resolveScopeCode(scopeCode?: string | null, scopeName?: string | null): "school" | "hs" {
  const code = String(scopeCode || "").trim().toLowerCase();
  if (code === "hs" || code === "school") return code;
  if (code.includes("higher secondary")) return "hs";
  if (code.includes("school")) return "school";

  const name = String(scopeName || "").trim().toLowerCase();
  if (name.includes("higher secondary")) return "hs";
  if (name.includes("school")) return "school";
  return "school";
}

const formatScopeLabel = (scope?: string | null, scopeName?: string | null) => resolveScopeCode(scope, scopeName) === "hs" ? "Higher Secondary" : "School";
const title = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
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

type SummaryTone = "default" | "blue" | "green" | "violet" | "red" | "amber";

function summaryPalette(theme: ReturnType<typeof useAppTheme>["theme"], tone: SummaryTone = "default") {
  if (tone === "blue") {
    return {
      borderColor: theme.isDark ? "#1d4ed8" : "#bfdbfe",
      backgroundColor: theme.isDark ? "#172554" : "#eff6ff",
      color: theme.isDark ? "#bfdbfe" : "#1d4ed8",
    };
  }
  if (tone === "green") {
    return {
      borderColor: theme.isDark ? "#15803d" : "#bbf7d0",
      backgroundColor: theme.isDark ? "#14532d" : "#f0fdf4",
      color: theme.isDark ? "#bbf7d0" : "#15803d",
    };
  }
  if (tone === "red") {
    return {
      borderColor: theme.isDark ? "#b91c1c" : "#fecaca",
      backgroundColor: theme.isDark ? "#7f1d1d" : "#fef2f2",
      color: theme.isDark ? "#fecaca" : "#991b1b",
    };
  }
  if (tone === "amber") {
    return {
      borderColor: theme.isDark ? "#b45309" : "#fde68a",
      backgroundColor: theme.isDark ? "#451a03" : "#fffbeb",
      color: theme.isDark ? "#fde68a" : "#b45309",
    };
  }
  if (tone === "violet") {
    return {
      borderColor: theme.isDark ? "#7c3aed" : "#ddd6fe",
      backgroundColor: theme.isDark ? "#3b0764" : "#f5f3ff",
      color: theme.isDark ? "#ddd6fe" : "#6d28d9",
    };
  }
  return {
    borderColor: theme.border,
    backgroundColor: theme.cardMuted,
    color: theme.text,
  };
}

function CompactStat({ label, value, tone = "default" }: { label: string; value: string | number; tone?: SummaryTone }) {
  const { theme } = useAppTheme();
  const palette = summaryPalette(theme, tone);
  return <View style={[styles.compactStatPill, { borderColor: palette.borderColor, backgroundColor: palette.backgroundColor }]}><Text style={[styles.compactStatValue, { color: palette.color }]} numberOfLines={1}>{value}</Text><Text style={[styles.compactStatLabel, { color: tone === "default" ? theme.subText : palette.color }]} numberOfLines={1}>{label}</Text></View>;
}

function TabButton({ label, icon, active, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; active: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  return (
    <Pressable style={[styles.tabButton, { borderColor: theme.border, backgroundColor: theme.card }, active && { borderColor: theme.primary, backgroundColor: theme.primary }]} onPress={onPress}>
      <Ionicons name={icon} size={15} color={active ? theme.primaryText : theme.icon} />
      <Text style={[styles.tabButtonText, { color: active ? theme.primaryText : theme.text }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function SectionCard({ title: heading, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const { theme } = useAppTheme();
  return <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}><View style={styles.rowBetween}><Text style={[styles.sectionTitle, { color: theme.text }]}>{heading}</Text>{hint ? <Text style={[styles.sectionHint, { color: theme.subText }]}>{hint}</Text> : null}</View>{children}</View>;
}

function InfoRow({ label, value, onPress }: { label: string; value: string; onPress?: (() => void) | undefined }) {
  const { theme } = useAppTheme();
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.infoRow, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}
      >
        <Text style={[styles.infoLabel, { color: theme.subText }]}>{label}</Text>
        <Text style={[styles.infoValue, styles.infoValueLink, { color: theme.primary }]}>{value}</Text>
      </Pressable>
    );
  }
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
  const [attendanceFiltersOpen, setAttendanceFiltersOpen] = useState(false);
  const [attendancePreset, setAttendancePreset] = useState<AttendancePreset>("month");
  const [attendanceDraftRange, setAttendanceDraftRange] = useState<DateRange>(() =>
    resolveAttendancePresetRange("month"),
  );
  const [attendanceAppliedRange, setAttendanceAppliedRange] = useState<DateRange>(() =>
    resolveAttendancePresetRange("month"),
  );
  const [currentPage, setCurrentPage] = useState(1);
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
            startDate: attendanceAppliedRange.from || undefined,
            endDate: attendanceAppliedRange.to || undefined,
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
  }, [teacherId, attendanceAppliedRange.from, attendanceAppliedRange.to]);

  useEffect(() => {
    setCurrentPage(1);
  }, [attendance]);

  const photoUri = resolveTeacherPhotoUrl(teacher?.photo_url);
  const punchInCount = useMemo(() => attendance.filter((row) => String(row.punch_type || "").toLowerCase() === "in").length, [attendance]);
  const punchOutCount = useMemo(() => attendance.filter((row) => String(row.punch_type || "").toLowerCase() === "out").length, [attendance]);
  const assignedClassSections = useMemo(
    () =>
      Array.from(
        new Map(
          assignments.map((assignment) => [
            `${assignment.class}-${assignment.section}-${assignment.section_medium || ""}`,
            {
              key: `${assignment.class}-${assignment.section}-${assignment.section_medium || ""}`,
              className: assignment.class,
              sectionName: formatSectionLabel(assignment.section, assignment.section_medium),
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
  const attendanceDateKeys = useMemo(
    () => buildDateRangeKeys(attendanceAppliedRange.from, attendanceAppliedRange.to),
    [attendanceAppliedRange.from, attendanceAppliedRange.to],
  );
  const presentDays = useMemo(() => {
    const daySet = new Set<string>();
    attendance.forEach((row) => {
      const dateKey = toDateKey(row.punch_time);
      if (dateKey) daySet.add(dateKey);
    });
    return daySet.size;
  }, [attendance]);
  const totalDaysInRange = attendanceDateKeys.length;
  const absentDays = Math.max(totalDaysInRange - presentDays, 0);
  const logSummary = useMemo(
    () =>
      attendance.reduce(
        (acc, row) => {
          const punchType = String(row?.punch_type || "").trim().toLowerCase();
          if (punchType === "in") acc.in += 1;
          else if (punchType === "out") acc.out += 1;
          else acc.unknown += 1;
          return acc;
        },
        { in: 0, out: 0, unknown: 0 },
      ),
    [attendance],
  );
  const totalPages = Math.max(1, Math.ceil(attendance.length / ATTENDANCE_PAGE_SIZE));
  const paginatedAttendance = useMemo(
    () => attendance.slice((currentPage - 1) * ATTENDANCE_PAGE_SIZE, currentPage * ATTENDANCE_PAGE_SIZE),
    [attendance, currentPage],
  );
  const currentStart = attendance.length ? (currentPage - 1) * ATTENDANCE_PAGE_SIZE + 1 : 0;
  const currentEnd = Math.min(currentPage * ATTENDANCE_PAGE_SIZE, attendance.length);
  const tabs = useMemo(
    () =>
      ([
        { key: "overview", label: "Overview", icon: "person-outline" },
        { key: "assignments", label: "Classes", icon: "albums-outline" },
        { key: "attendance", label: "Attendance", icon: "time-outline" },
      ] as Array<{ key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }>).concat(
        canManageTeachers && teacher?.user_id ? [{ key: "security", label: "Security", icon: "shield-checkmark-outline" }] : [],
      ),
    [canManageTeachers, teacher?.user_id],
  );

  function handleAttendancePresetChange(preset: Exclude<AttendancePreset, "custom">) {
    const nextRange = resolveAttendancePresetRange(preset);
    setAttendancePreset(preset);
    setAttendanceDraftRange(nextRange);
    setAttendanceAppliedRange(nextRange);
  }

  function handleViewAttendanceRange() {
    const from = String(attendanceDraftRange.from || "");
    const to = String(attendanceDraftRange.to || "");
    if (!from || !to) {
      Alert.alert("Validation", "Select both start and end date.");
      return false;
    }
    if (from > to) {
      Alert.alert("Validation", "Start date cannot be later than end date.");
      return false;
    }
    setAttendancePreset("custom");
    setAttendanceAppliedRange({ from, to });
    return true;
  }

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

  async function handleCallPress(phone?: string | null) {
    const dialable = toDialablePhone(phone);
    if (!dialable) return;
    try {
      await Linking.openURL(`tel:${dialable}`);
    } catch {
      Alert.alert("Call failed", "Could not open the phone dialer.");
    }
  }

  if (!teacherId) return <Text style={[styles.emptyText, { color: theme.subText }]}>Select a teacher to view details.</Text>;
  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={theme.text} /></View>;
  if (error) return <View style={styles.errorCard}><Text style={styles.errorTitle}>Teacher unavailable</Text><Text style={styles.errorText}>{error}</Text></View>;
  if (!teacher) return <Text style={[styles.emptyText, { color: theme.subText }]}>Teacher not found.</Text>;

  return (
    <View style={styles.root}>
      <TopNotice notice={notice} style={styles.topNoticeOverlay} />
      <View style={[styles.compactOverviewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.profileHeader}>
          {photoUri ? <Image source={{ uri: photoUri }} style={[styles.photo, { backgroundColor: theme.cardMuted }]} /> : <View style={[styles.avatarFallback, { backgroundColor: theme.cardMuted }]}><Text style={[styles.avatarText, { color: theme.text }]}>{(teacher.name || "T").slice(0, 1).toUpperCase()}</Text></View>}
          <View style={styles.profileCopy}>
            <View style={styles.profileTitleRow}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{teacher.name}</Text>
              <View style={[styles.scopeBadge, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}><Text style={[styles.scopeBadgeText, { color: theme.subText }]}>{formatScopeLabel(teacher.class_scope, teacher.scope_name)}</Text></View>
            </View>
            <Text style={[styles.profileMeta, { color: theme.subText }]} numberOfLines={1}>Employee ID {teacher.employee_id || "-"} | Phone {teacher.phone || "-"}</Text>
            <Text style={[styles.profileMeta, { color: theme.subText }]} numberOfLines={1}>Email {teacher.email || "-"}</Text>
          </View>
        </View>
        <View style={styles.compactStatsRow}>
          <CompactStat label="Assignments" value={assignments.length} tone="blue" />
          <CompactStat label="Classes" value={assignedClassSections.length} />
          <CompactStat label="In" value={punchInCount} tone="green" />
          <CompactStat label="Out" value={punchOutCount} tone="violet" />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {tabs.map((tab) => (
          <TabButton key={tab.key} label={tab.label} icon={tab.icon} active={activeTab === tab.key} onPress={() => setActiveTab(tab.key)} />
        ))}
      </ScrollView>

      {activeTab === "overview" ? (
        <SectionCard title="Teacher Overview" hint={`#${teacher.id}`}>
          <View style={styles.infoGrid}>
            <InfoRow label="Employee ID" value={teacher.employee_id || "-"} />
            <InfoRow
              label="Phone"
              value={teacher.phone || "-"}
              onPress={toDialablePhone(teacher.phone) ? () => handleCallPress(teacher.phone) : undefined}
            />
            <InfoRow label="Email" value={teacher.email || "-"} />
            <InfoRow label="Scope" value={formatScopeLabel(teacher.class_scope, teacher.scope_name)} />
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
                    <Text style={[styles.listTitle, { color: theme.text }]}>
                      {assignment.class} / {formatSectionLabel(assignment.section, assignment.section_medium)}
                    </Text>
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
          <View style={[styles.attendanceOverview, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.attendanceOverviewTitle, { color: theme.text }]}>Attendance Summary</Text>
              <Text style={[styles.attendanceRangeText, { color: theme.subText }]}>{attendanceAppliedRange.from || "-"} to {attendanceAppliedRange.to || "-"}</Text>
            </View>
            <View style={styles.compactStatsRow}>
              <CompactStat label="Present" value={presentDays} tone="green" />
              <CompactStat label="Absent" value={absentDays} tone="red" />
              <CompactStat label="Days" value={totalDaysInRange} />
              <CompactStat label="Unknown" value={logSummary.unknown} tone="amber" />
            </View>
          </View>

          <View style={styles.compactToolbar}>
            <Pressable style={[styles.toolbarBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setAttendanceFiltersOpen((prev) => !prev)}>
              <Ionicons name="filter-outline" size={16} color={theme.icon} />
              <Text style={[styles.toolbarBtnText, { color: theme.text }]}>Filters</Text>
            </Pressable>
            <View style={[styles.toolbarInfo, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
              <Text style={[styles.toolbarInfoText, { color: theme.subText }]}>IN/OUT {logSummary.in}/{logSummary.out}</Text>
            </View>
          </View>

          {attendanceFiltersOpen ? <View style={styles.filterBlock}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Date range</Text>
            <View style={styles.filterRow}>
              <FilterChip label="Today" active={attendancePreset === "today"} onPress={() => handleAttendancePresetChange("today")} />
              <FilterChip label="Week" active={attendancePreset === "week"} onPress={() => handleAttendancePresetChange("week")} />
              <FilterChip label="Month" active={attendancePreset === "month"} onPress={() => handleAttendancePresetChange("month")} />
              <FilterChip label="Custom" active={attendancePreset === "custom"} onPress={() => setAttendancePreset("custom")} />
            </View>
            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <DateField
                  value={attendanceDraftRange.from}
                  onChange={(value) => {
                    setAttendancePreset("custom");
                    setAttendanceDraftRange((prev) => ({ ...prev, from: value }));
                  }}
                  placeholder="From date"
                />
              </View>
              <View style={styles.inputHalf}>
                <DateField
                  value={attendanceDraftRange.to}
                  onChange={(value) => {
                    setAttendancePreset("custom");
                    setAttendanceDraftRange((prev) => ({ ...prev, to: value }));
                  }}
                  placeholder="To date"
                />
              </View>
            </View>
            <Pressable
              style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
              onPress={() => {
                if (handleViewAttendanceRange()) setAttendanceFiltersOpen(false);
              }}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>View Range</Text>
            </Pressable>
          </View> : null}

          {paginatedAttendance.length ? paginatedAttendance.map((row) => (
            <View key={row.id} style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.listTitle, { color: theme.text }]}>{formatTimeLabel(row.punch_time)}</Text>
                <StatusChip value={row.punch_type} />
              </View>
              <Text style={[styles.listMeta, { color: theme.subText }]}>Date: {formatDateLabel(row.punch_time)}</Text>
              <Text style={[styles.listMeta, { color: theme.subText }]}>Device: {row.device_name || row.device_code || "-"}</Text>
              <Text style={[styles.listMeta, { color: theme.subText }]}>Location: {row.location || "-"}</Text>
            </View>
          )) : <Text style={[styles.emptyText, { color: theme.subText }]}>No attendance logs found for the selected range.</Text>}

          <View style={styles.paginationRow}>
            <Text style={[styles.paginationMeta, { color: theme.subText }]}>
              Showing {currentStart}-{currentEnd} of {attendance.length}
            </Text>
            <View style={styles.paginationActions}>
              <Pressable
                style={[
                  styles.pageBtn,
                  { borderColor: theme.border, backgroundColor: theme.card },
                  currentPage <= 1 && styles.btnDisabled,
                ]}
                onPress={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage <= 1}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Previous</Text>
              </Pressable>
              <Text style={[styles.paginationMeta, { color: theme.subText }]}>Page {currentPage} of {totalPages}</Text>
              <Pressable
                style={[
                  styles.pageBtn,
                  { borderColor: theme.border, backgroundColor: theme.card },
                  currentPage >= totalPages && styles.btnDisabled,
                ]}
                onPress={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage >= totalPages}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Next</Text>
              </Pressable>
            </View>
          </View>
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
  compactOverviewCard: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 12 },
  profileHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  photo: { width: 58, height: 58, borderRadius: 16, backgroundColor: "#e2e8f0" },
  avatarFallback: { width: 58, height: 58, borderRadius: 16, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#0f172a", fontWeight: "900", fontSize: 22 },
  profileCopy: { flex: 1, minWidth: 0, gap: 3 },
  profileTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, color: "#0f172a", fontWeight: "900", fontSize: 18, lineHeight: 23, minWidth: 0 },
  scopeBadge: { maxWidth: "44%", borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  scopeBadgeText: { fontSize: 11, fontWeight: "800" },
  profileMeta: { fontSize: 12, fontWeight: "700", lineHeight: 17 },
  compactStatsRow: { flexDirection: "row", gap: 8 },
  compactStatPill: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 8, gap: 2 },
  compactStatValue: { fontSize: 13, fontWeight: "900" },
  compactStatLabel: { fontSize: 10, fontWeight: "800" },
  tabsRow: { gap: 8, paddingBottom: 2 },
  tabButton: { minHeight: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  tabButtonText: { fontSize: 12, fontWeight: "800" },
  filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterChipText: { fontWeight: "700", fontSize: 12 },
  sectionCard: { backgroundColor: "#ffffff", borderRadius: 22, borderWidth: 1, borderColor: "#e2e8f0", padding: 16, gap: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  sectionTitle: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  sectionHint: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  infoGrid: { gap: 8 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, backgroundColor: "#f8fafc", paddingHorizontal: 12, paddingVertical: 10 },
  infoLabel: { color: "#64748b", fontWeight: "700" },
  infoValue: { color: "#0f172a", fontWeight: "700", flexShrink: 1, textAlign: "right" },
  infoValueLink: { textDecorationLine: "underline" },
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
  attendanceOverview: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  attendanceOverviewTitle: { fontSize: 14, fontWeight: "900" },
  attendanceRangeText: { flexShrink: 1, fontSize: 11, fontWeight: "800", textAlign: "right" },
  compactToolbar: { flexDirection: "row", gap: 8 },
  toolbarBtn: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  toolbarBtnText: { fontSize: 13, fontWeight: "800" },
  toolbarInfo: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  toolbarInfoText: { fontSize: 12, fontWeight: "800" },
  filterBlock: { gap: 10 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  inputLabel: { color: "#334155", fontWeight: "700" },
  inputRow: { flexDirection: "row", gap: 10 },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, backgroundColor: "#ffffff", paddingHorizontal: 12, paddingVertical: 11, color: "#0f172a" },
  inputHalf: { flex: 1 },
  secondaryBtn: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: "#334155", fontWeight: "700" },
  paginationRow: { gap: 10, paddingTop: 2 },
  paginationMeta: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  paginationActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  pageBtn: { borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  successBtn: { backgroundColor: "#15803d", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  successBtnText: { color: "#ffffff", fontWeight: "700" },
  btnDisabled: { opacity: 0.45 },
  emptyText: { color: "#64748b" },
  errorCard: { borderRadius: 18, borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fef2f2", paddingHorizontal: 14, paddingVertical: 12 },
  errorTitle: { color: "#991b1b", fontWeight: "800", marginBottom: 2 },
  errorText: { color: "#b91c1c" },
});

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
import TopNotice from "../../components/feedback/TopNotice";
import DateField from "../../components/form/DateField";
import { useAppTheme } from "../../theme/AppThemeProvider";
import {
  downloadTeacherAttendanceMatrixPdf,
  getAllTeacherAttendance,
  type TeacherAttendanceItem,
} from "../../services/attendanceService";

type RangePreset = "today" | "week" | "month" | "custom";
type DateRange = { from: string; to: string };
type Notice = { title: string; message: string; tone: "success" | "error" } | null;

const DEFAULT_THEME = {
  isDark: false,
  bg: "#f8fafc",
  card: "#ffffff",
  cardMuted: "#f8fafc",
  text: "#0f172a",
  subText: "#64748b",
  border: "#e2e8f0",
  inputBg: "#ffffff",
  primary: "#0f172a",
  primaryText: "#ffffff",
  success: "#15803d",
  successBorder: "#bbf7d0",
  successText: "#ffffff",
};
let currentTheme = DEFAULT_THEME;

function normalizeDateInput(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function resolvePresetRange(preset: Exclude<RangePreset, "custom">): DateRange {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  if (preset === "week") {
    start.setDate(start.getDate() - 6);
  } else if (preset === "month") {
    start.setDate(start.getDate() - 29);
  }
  return { from: normalizeDateInput(start), to: normalizeDateInput(end) };
}

function startOfDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDate(value: string) {
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
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

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function statusBadgeTone(status: string) {
  if (status === "in") return { borderColor: "#bbf7d0", backgroundColor: currentTheme.isDark ? "#052e16" : "#f0fdf4" };
  if (status === "out") return { borderColor: "#bfdbfe", backgroundColor: currentTheme.isDark ? "#172554" : "#eff6ff" };
  return { borderColor: "#fde68a", backgroundColor: currentTheme.isDark ? "#451a03" : "#fffbeb" };
}

function statusBadgeTextTone(status: string) {
  if (status === "in") return { color: currentTheme.isDark ? "#86efac" : "#15803d" };
  if (status === "out") return { color: currentTheme.isDark ? "#bfdbfe" : "#1d4ed8" };
  return { color: currentTheme.isDark ? "#fcd34d" : "#b45309" };
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

function StatusBadge({ status }: { status: string }) {
  const normalized = String(status || "unknown").toLowerCase();
  return (
    <View style={[styles.statusBadge, statusBadgeTone(normalized)]}>
      <Text style={[styles.statusBadgeText, statusBadgeTextTone(normalized)]}>
        {capitalize(normalized)}
      </Text>
    </View>
  );
}

export default function TeacherAttendanceTab() {
  const { theme } = useAppTheme();
  currentTheme = theme;
  styles = useMemo(() => createStyles(theme), [theme]);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [logs, setLogs] = useState<TeacherAttendanceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState<RangePreset>("today");
  const [draftRange, setDraftRange] = useState<DateRange>(() => resolvePresetRange("today"));
  const [appliedRange, setAppliedRange] = useState<DateRange>(() => resolvePresetRange("today"));
  const [pdfDownloading, setPdfDownloading] = useState(false);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    const fromBoundary = startOfDate(appliedRange.from);
    const toBoundary = endOfDate(appliedRange.to);
    const fromTime = fromBoundary?.getTime() ?? null;
    const toTime = toBoundary?.getTime() ?? null;

    return [...logs]
      .filter((row) => {
        const punchDate = new Date(row.punch_time);
        if (Number.isNaN(punchDate.getTime())) return false;
        const punchTime = punchDate.getTime();
        if (fromTime !== null && punchTime < fromTime) return false;
        if (toTime !== null && punchTime > toTime) return false;
        if (query && !String(row.teacher || "").toLowerCase().includes(query)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.punch_time).getTime() - new Date(a.punch_time).getTime());
  }, [logs, search, appliedRange.from, appliedRange.to]);

  useEffect(() => {
    void loadLogs();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  async function loadLogs() {
    setLoading(true);
    try {
      setLogs(await getAllTeacherAttendance());
    } catch (err: unknown) {
      setLogs([]);
      Alert.alert("Load failed", getErrorMessage(err, "Could not load teacher attendance."));
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await loadLogs();
    } finally {
      setRefreshing(false);
    }
  }

  function applyPreset(nextPreset: Exclude<RangePreset, "custom">) {
    const range = resolvePresetRange(nextPreset);
    setPreset(nextPreset);
    setDraftRange(range);
    setAppliedRange(range);
  }

  function viewRange() {
    const from = String(draftRange.from || "");
    const to = String(draftRange.to || "");
    if (!from || !to) {
      Alert.alert("Validation", "Select both start and end dates.");
      return;
    }
    if (from > to) {
      Alert.alert("Validation", "Start date cannot be later than end date.");
      return;
    }
    setPreset("custom");
    setAppliedRange({ from, to });
  }

  async function downloadPdf() {
    const from = String(appliedRange.from || "");
    const to = String(appliedRange.to || "");
    if (!from || !to) {
      Alert.alert("Validation", "Select both start and end dates.");
      return;
    }

    setPdfDownloading(true);
    try {
      await downloadTeacherAttendanceMatrixPdf({ startDate: from, endDate: to });
      setNotice({
        title: "Teacher Attendance Downloaded",
        message: "Teacher attendance matrix PDF has been downloaded.",
        tone: "success",
      });
    } catch (err: unknown) {
      Alert.alert("Download failed", getErrorMessage(err, "Could not download teacher attendance PDF."));
    } finally {
      setPdfDownloading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <TopNotice notice={notice} style={styles.topNoticeOverlay} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={styles.innerContent}>
          <View style={styles.heroCard}>
            <Text style={styles.title}>Teacher Attendance</Text>
            <Text style={styles.subtitle}>Review machine punch logs, filter by date range, and download the attendance matrix.</Text>
          </View>

          <SectionCard title="Teacher Logs" hint={`${filteredLogs.length} records`}>
            <View style={styles.filterRow}>
              {(["today", "week", "month"] as const).map((item) => (
                <Pressable
                  key={item}
                  style={[styles.filterChip, preset === item && styles.filterChipActive]}
                  onPress={() => applyPreset(item)}
                >
                  <Text style={[styles.filterChipText, preset === item && styles.filterChipTextActive]}>{capitalize(item)}</Text>
                </Pressable>
              ))}
              <Pressable
                style={[styles.filterChip, preset === "custom" && styles.filterChipActive]}
                onPress={() => setPreset("custom")}
              >
                <Text style={[styles.filterChipText, preset === "custom" && styles.filterChipTextActive]}>Custom</Text>
              </Pressable>
            </View>

            <View style={styles.filterGrid}>
              <DateField
                label="From"
                value={draftRange.from}
                onChange={(value) => {
                  setPreset("custom");
                  setDraftRange((prev) => ({ ...prev, from: value }));
                }}
                placeholder="From date"
              />
              <DateField
                label="To"
                value={draftRange.to}
                onChange={(value) => {
                  setPreset("custom");
                  setDraftRange((prev) => ({ ...prev, to: value }));
                }}
                placeholder="To date"
              />
            </View>

            <View style={styles.rowActions}>
              <Pressable style={styles.secondaryBtn} onPress={viewRange}>
                <Text style={styles.secondaryBtnText}>View Range</Text>
              </Pressable>
              <Pressable
                style={[styles.successBtn, pdfDownloading && styles.btnDisabled]}
                onPress={downloadPdf}
                disabled={pdfDownloading}
              >
                <Text style={styles.successBtnText}>{pdfDownloading ? "Downloading..." : "Download PDF"}</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.input}
              value={search}
              onChangeText={setSearch}
              placeholder="Search teacher name"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.detailText}>
              Showing {filteredLogs.length} record{filteredLogs.length === 1 ? "" : "s"} for {appliedRange.from} to {appliedRange.to}.
            </Text>

            {loading ? (
              <ActivityIndicator size="large" color={theme.text} />
            ) : filteredLogs.length ? (
              filteredLogs.map((row) => (
                <View key={row.id} style={styles.sessionCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.sessionTitle}>{row.teacher}</Text>
                    <StatusBadge status={row.punch_type} />
                  </View>
                  <Text style={styles.detailText}>Punch Time: {formatDateTime(row.punch_time)}</Text>
                  <Text style={styles.detailText}>Device: {row.device_name || row.device_code || "-"}</Text>
                  <Text style={styles.detailText}>Location: {row.location || "-"}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No teacher attendance records found.</Text>
            )}
          </SectionCard>
        </View>
      </ScrollView>
    </View>
  );
}

let styles = createStyles(currentTheme);

function createStyles(theme: typeof DEFAULT_THEME) {
  return StyleSheet.create({
    screen: { flex: 1 },
    root: { flex: 1 },
    content: { gap: 14, paddingBottom: 120 },
    innerContent: { gap: 14, paddingHorizontal: 14, paddingTop: 10 },
    topNoticeOverlay: { position: "absolute", top: 0, left: 14, right: 14, zIndex: 20 },
    heroCard: { borderRadius: 24, paddingVertical: 0, gap: 8 },
    heroEyebrow: { color: theme.subText, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
    title: { color: theme.text, fontWeight: "800", fontSize: 22 },
    subtitle: { color: theme.subText, lineHeight: 20 },
    sectionCard: { backgroundColor: theme.card, borderRadius: 22, borderWidth: 1, borderColor: theme.border, padding: 16, gap: 12 },
    rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
    sectionTitle: { color: theme.text, fontWeight: "800", fontSize: 16 },
    hint: { color: theme.subText, fontSize: 12, fontWeight: "600" },
    filterGrid: { gap: 10 },
    filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    filterChip: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.cardMuted },
    filterChipActive: { borderColor: theme.primary, backgroundColor: theme.primary },
    filterChipText: { color: theme.subText, fontWeight: "700", fontSize: 12 },
    filterChipTextActive: { color: theme.primaryText },
    rowActions: { flexDirection: "row", gap: 10, marginTop: 2 },
    secondaryBtn: { flex: 1, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    secondaryBtnText: { color: theme.text, fontWeight: "700" },
    successBtn: { flex: 1, backgroundColor: theme.success, borderWidth: 1, borderColor: theme.successBorder, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    successBtnText: { color: theme.successText, fontWeight: "700" },
    btnDisabled: { opacity: 0.55 },
    input: { borderWidth: 1, borderColor: theme.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: theme.inputBg, color: theme.text },
    detailText: { color: theme.subText, lineHeight: 18 },
    sessionCard: { borderWidth: 1, borderColor: theme.border, borderRadius: 16, backgroundColor: theme.cardMuted, padding: 12, gap: 5 },
    sessionTitle: { color: theme.text, fontWeight: "700" },
    statusBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    statusBadgeText: { fontSize: 12, fontWeight: "700" },
    emptyText: { color: theme.subText },
  });
}

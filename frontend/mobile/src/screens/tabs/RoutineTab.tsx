import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getStudents, type Student } from "../../services/studentsService";
import {
  getClassRoutineBoard,
  getExamRoutineById,
  getExamRoutines,
  getMyTeacherClassRoutineBoard,
  getMyTeacherExamRoutines,
  getMyTeacherRoutine,
  getStudentRoutine,
  type ExamRoutineEntry,
  type RoutineEntry,
} from "../../services/routinesService";
import { useAuthStore } from "../../store/authStore";
import { useAppTheme } from "../../theme/AppThemeProvider";

type RoutineMode = "day" | "exam";
type TeacherRoutineView = "mine" | "classes";
type DayItem = { key: number; short: string; label: string };
type RoutineGroup = { key: string; title: string; subtitle: string; entries: RoutineEntry[] };
type RoutineSlotGroup = { key: string; entry: RoutineEntry; entries: RoutineEntry[]; displayLabel?: string };
type ExamRoutineGroup = { key: string; title: string; subtitle: string; entries: ExamRoutineEntry[] };
type ExamRoutineExamGroup = { key: string; title: string; subtitle: string; groups: ExamRoutineGroup[] };

const DAYS: DayItem[] = [
  { key: 1, short: "Mon", label: "Monday" },
  { key: 2, short: "Tue", label: "Tuesday" },
  { key: 3, short: "Wed", label: "Wednesday" },
  { key: 4, short: "Thu", label: "Thursday" },
  { key: 5, short: "Fri", label: "Friday" },
  { key: 6, short: "Sat", label: "Saturday" },
  { key: 7, short: "Sun", label: "Sunday" },
];

function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function todayWeekday() {
  const day = new Date().getDay();
  return day === 0 ? 1 : day;
}

function formatDate(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString();
}

function formatTime(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "--:--";
  const [hour = "00", minute = "00"] = raw.split(":");
  const hourNumber = Number(hour);
  if (!Number.isFinite(hourNumber)) return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  const suffix = hourNumber >= 12 ? "PM" : "AM";
  const displayHour = hourNumber % 12 || 12;
  return `${displayHour}:${minute.padStart(2, "0")} ${suffix}`;
}

function isBreakEntry(entry: RoutineEntry) {
  return String(entry.entry_type || entry.slot_default_entry_type || "").toLowerCase() === "break";
}

function entryTitle(entry: RoutineEntry) {
  return isBreakEntry(entry)
    ? entry.title || entry.activity_name || entry.slot_label || "Break"
    : entry.title || entry.subject_name || entry.activity_name || entry.slot_label || "Free Period";
}

function entryTeachers(entry: RoutineEntry) {
  return entry.teacher_names || entry.teacher_name || "";
}

function getEntryWeekday(entry: RoutineEntry) {
  const value = Number(entry.weekday);
  return Number.isFinite(value) && value >= 1 && value <= 7 ? value : 1;
}

function sortRoutine(a: RoutineEntry, b: RoutineEntry) {
  const dayDiff = getEntryWeekday(a) - getEntryWeekday(b);
  if (dayDiff) return dayDiff;
  return Number(a.period_number || 0) - Number(b.period_number || 0) ||
    String(a.start_time || "").localeCompare(String(b.start_time || "")) ||
    Number(a.entry_id || a.id || 0) - Number(b.entry_id || b.id || 0);
}

function entryPeriodLabel(entry: RoutineEntry) {
  const explicitLabel = normalizeFilterValue(entry.slot_label);
  if (isBreakEntry(entry)) return explicitLabel || "Break";
  if (explicitLabel) return explicitLabel;
  const period = normalizeFilterValue(entry.period_number);
  return period ? `P${period}` : "Slot";
}

function entryPeriodMeta(entry: RoutineEntry) {
  const period = normalizeFilterValue(entry.period_number);
  return period ? `Period ${period}` : "";
}

function groupRoutineSlots(entries: RoutineEntry[]): RoutineSlotGroup[] {
  const groups = new Map<string, RoutineSlotGroup>();
  for (const entry of entries) {
    const keyParts = [
      getEntryWeekday(entry),
      normalizeFilterValue(entry.period_number),
      normalizeFilterValue(entry.start_time),
      normalizeFilterValue(entry.end_time),
      normalizeFilterValue(entry.slot_label),
    ];
    const key = keyParts.join("|") || `entry-${entry.entry_id || entry.id || groups.size}`;
    if (!groups.has(key)) groups.set(key, { key, entry, entries: [] });
    groups.get(key)?.entries.push(entry);
  }
  return Array.from(groups.values()).map((group) => ({
    ...group,
    entries: [...group.entries].sort(sortRoutine),
  }));
}

function withDisplayPeriodLabels(groups: RoutineSlotGroup[]) {
  let classPeriod = 0;
  return groups.map((group) => {
    if (isBreakEntry(group.entry)) {
      return { ...group, displayLabel: entryPeriodLabel(group.entry) };
    }
    classPeriod += 1;
    return { ...group, displayLabel: `Period ${classPeriod}` };
  });
}

function normalizeIdList(value?: Array<number | string> | string | null) {
  if (Array.isArray(value)) return value.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0);
  if (typeof value === "string") return value.split(",").map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item > 0);
  return [];
}

function scopeText(entry?: RoutineEntry | null) {
  const parts = [entry?.class_scope_label, entry?.class_name, entry?.section_name, entry?.medium, entry?.stream_name]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(" / ") : "Published routine";
}

function normalizeFilterValue(value?: string | number | null) {
  return String(value || "").trim();
}

function uniqueValues(values: Array<string | number | null | undefined>) {
  return Array.from(new Set(values.map(normalizeFilterValue).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function groupRoutineEntries(entries: RoutineEntry[]): RoutineGroup[] {
  const groups = new Map<string, RoutineGroup>();
  for (const entry of entries) {
    const keyParts = [
      entry.routine_version_id,
      entry.class_scope || "",
      entry.class_name || "",
      entry.section_name || "",
      entry.medium || "",
      entry.stream_name || "",
    ];
    const key = keyParts.map((part) => String(part ?? "")).join("|");
    const title = [entry.class_name, entry.section_name].map(normalizeFilterValue).filter(Boolean).join(" / ") || "Class Routine";
    const subtitle = [entry.class_scope_label, entry.medium, entry.stream_name].map(normalizeFilterValue).filter(Boolean).join(" / ") || "Published routine";
    if (!groups.has(key)) groups.set(key, { key, title, subtitle, entries: [] });
    groups.get(key)?.entries.push(entry);
  }
  return Array.from(groups.values()).map((group) => ({
    ...group,
    entries: [...group.entries].sort(sortRoutine),
  }));
}

function groupExamRoutineEntries(entries: ExamRoutineEntry[]): ExamRoutineGroup[] {
  const groups = new Map<string, ExamRoutineGroup>();
  for (const entry of entries) {
    const keyParts = [
      entry.routine_id,
      entry.exam_name || entry.routine_title || "",
      entry.class_scope || "",
      entry.class_name || "",
      entry.section_name || "",
      entry.medium || "",
      entry.stream_name || "",
    ];
    const key = keyParts.map((part) => String(part ?? "")).join("|");
    const title = [entry.class_name, entry.section_name, entry.medium, entry.stream_name]
      .map(normalizeFilterValue)
      .filter(Boolean)
      .join(" / ") || "Class Routine";
    const subtitle = [entry.class_scope === "hs" ? "Higher Secondary" : entry.class_scope === "school" ? "School" : "", entry.exam_name || entry.routine_title]
      .map(normalizeFilterValue)
      .filter(Boolean)
      .join(" / ") || "Published exam routine";
    if (!groups.has(key)) groups.set(key, { key, title, subtitle, entries: [] });
    groups.get(key)?.entries.push(entry);
  }
  return Array.from(groups.values()).map((group) => ({
    ...group,
    entries: [...group.entries].sort(sortExamEntries),
  }));
}

function groupExamRoutinesByExam(groups: ExamRoutineGroup[]): ExamRoutineExamGroup[] {
  const examGroups = new Map<string, ExamRoutineExamGroup>();
  for (const group of groups) {
    const firstEntry = group.entries[0];
    const keyParts = [
      firstEntry?.session_name || "",
      firstEntry?.exam_name || group.title || "",
    ];
    const key = keyParts.map((part) => String(part ?? "")).join("|");
    const current = examGroups.get(key) || {
      key,
      title: firstEntry?.exam_name || group.title || "Exam Routine",
      subtitle: firstEntry?.session_name || "Published exam",
      groups: [],
    };
    current.groups.push(group);
    examGroups.set(key, current);
  }
  return Array.from(examGroups.values());
}

function classLabel(student?: Student | null) {
  const parts = [student?.class, student?.section, student?.medium, student?.stream_name]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(" / ") : "Student routine";
}

function examScopeText(entry?: ExamRoutineEntry | null) {
  const parts = [entry?.class_name, entry?.section_name, entry?.medium, entry?.stream_name]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(" / ") : "Exam routine";
}

function sortExamEntries(a: ExamRoutineEntry, b: ExamRoutineEntry) {
  return String(a.exam_date || "").localeCompare(String(b.exam_date || "")) ||
    String(a.start_time || "").localeCompare(String(b.start_time || ""));
}

function routineEntriesFromResponse(response: { routine?: RoutineEntry[] | { entries?: RoutineEntry[] } } | null | undefined) {
  if (Array.isArray(response?.routine)) return response.routine;
  if (Array.isArray(response?.routine?.entries)) return response.routine.entries;
  return [];
}

export default function RoutineTab() {
  const { theme } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const isParent = roles.includes("parent");
  const isTeacher = roles.includes("teacher");
  const isAdmin = roles.includes("super_admin") || permissions.includes("routines.manage");
  const canViewRoutines = roles.includes("super_admin") || permissions.includes("routines.view") || permissions.includes("routines.manage");
  const [mode, setMode] = useState<RoutineMode>("day");
  const [selectedDay, setSelectedDay] = useState(todayWeekday());
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<RoutineEntry[]>([]);
  const [teacherEntries, setTeacherEntries] = useState<RoutineEntry[]>([]);
  const [examEntries, setExamEntries] = useState<ExamRoutineEntry[]>([]);
  const [teacherRoutineView, setTeacherRoutineView] = useState<TeacherRoutineView>("mine");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [mediumFilter, setMediumFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedRoutineGroupKey, setSelectedRoutineGroupKey] = useState("");
  const [selectedExamRoutineExamKey, setSelectedExamRoutineExamKey] = useState("");
  const [selectedExamGroupKey, setSelectedExamGroupKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStudent = useMemo(
    () => students.find((student) => Number(student.id) === Number(selectedStudentId)) ?? null,
    [selectedStudentId, students],
  );
  const sortedEntries = useMemo(() => [...entries].sort(sortRoutine), [entries]);
  const dayEntries = useMemo(
    () => sortedEntries.filter((entry) => getEntryWeekday(entry) === selectedDay),
    [selectedDay, sortedEntries],
  );
  const teacherDayEntries = useMemo(
    () => [...teacherEntries].sort(sortRoutine).filter((entry) => getEntryWeekday(entry) === selectedDay),
    [selectedDay, teacherEntries],
  );
  const classSwitchingRoutineView = (isAdmin || isTeacher) && !isParent;
  const classSwitchingClassRoutineView = classSwitchingRoutineView && mode !== "exam" && (!isTeacher || teacherRoutineView === "classes");
  const classSwitchingExamRoutineView = classSwitchingRoutineView && mode === "exam";
  const showRoutineFilters = isAdmin || classSwitchingClassRoutineView || classSwitchingExamRoutineView;
  const filterSourceEntries = useMemo(
    () => mode === "exam" ? examEntries : sortedEntries,
    [examEntries, mode, sortedEntries],
  );
  const scopeOptions = useMemo(() => uniqueValues(filterSourceEntries.map((entry) => entry.class_scope)), [filterSourceEntries]);
  const classOptions = useMemo(
    () => uniqueValues(filterSourceEntries
      .filter((entry) => scopeFilter === "all" || normalizeFilterValue(entry.class_scope) === scopeFilter)
      .map((entry) => entry.class_name)),
    [filterSourceEntries, scopeFilter],
  );
  const sectionOptions = useMemo(
    () => uniqueValues(filterSourceEntries
      .filter((entry) => scopeFilter === "all" || normalizeFilterValue(entry.class_scope) === scopeFilter)
      .filter((entry) => classFilter === "all" || normalizeFilterValue(entry.class_name) === classFilter)
      .map((entry) => entry.section_name)),
    [classFilter, filterSourceEntries, scopeFilter],
  );
  const mediumOptions = useMemo(
    () => uniqueValues(filterSourceEntries
      .filter((entry) => scopeFilter === "all" || normalizeFilterValue(entry.class_scope) === scopeFilter)
      .filter((entry) => classFilter === "all" || normalizeFilterValue(entry.class_name) === classFilter)
      .filter((entry) => sectionFilter === "all" || normalizeFilterValue(entry.section_name) === sectionFilter)
      .map((entry) => entry.medium)),
    [classFilter, filterSourceEntries, scopeFilter, sectionFilter],
  );
  const visibleEntries = useMemo(() => {
    if (!classSwitchingClassRoutineView) return dayEntries;
    return dayEntries
      .filter((entry) => scopeFilter === "all" || normalizeFilterValue(entry.class_scope || entry.class_scope_label) === scopeFilter)
      .filter((entry) => classFilter === "all" || normalizeFilterValue(entry.class_name) === classFilter)
      .filter((entry) => sectionFilter === "all" || normalizeFilterValue(entry.section_name) === sectionFilter)
      .filter((entry) => mediumFilter === "all" || normalizeFilterValue(entry.medium) === mediumFilter);
  }, [classFilter, classSwitchingClassRoutineView, dayEntries, mediumFilter, scopeFilter, sectionFilter]);
  const groupedVisibleEntries = useMemo(
    () => classSwitchingClassRoutineView ? groupRoutineEntries(visibleEntries) : [],
    [classSwitchingClassRoutineView, visibleEntries],
  );
  const selectedRoutineGroup = useMemo(
    () => groupedVisibleEntries.find((group) => group.key === selectedRoutineGroupKey) || groupedVisibleEntries[0] || null,
    [groupedVisibleEntries, selectedRoutineGroupKey],
  );
  const visibleExamEntries = useMemo(() => {
    const filtered = classSwitchingExamRoutineView
      ? examEntries
        .filter((entry) => scopeFilter === "all" || normalizeFilterValue(entry.class_scope) === scopeFilter)
        .filter((entry) => classFilter === "all" || normalizeFilterValue(entry.class_name) === classFilter)
        .filter((entry) => sectionFilter === "all" || normalizeFilterValue(entry.section_name) === sectionFilter)
        .filter((entry) => mediumFilter === "all" || normalizeFilterValue(entry.medium) === mediumFilter)
      : examEntries;
    return [...filtered].sort(sortExamEntries);
  }, [classFilter, classSwitchingExamRoutineView, examEntries, mediumFilter, scopeFilter, sectionFilter]);
  const groupedVisibleExamEntries = useMemo(
    () => classSwitchingExamRoutineView ? groupExamRoutineEntries(visibleExamEntries) : [],
    [classSwitchingExamRoutineView, visibleExamEntries],
  );
  const groupedVisibleExamRoutineExams = useMemo(
    () => classSwitchingExamRoutineView ? groupExamRoutinesByExam(groupedVisibleExamEntries) : [],
    [classSwitchingExamRoutineView, groupedVisibleExamEntries],
  );
  const selectedExamRoutineExam = useMemo(
    () => groupedVisibleExamRoutineExams.find((group) => group.key === selectedExamRoutineExamKey) || groupedVisibleExamRoutineExams[0] || null,
    [groupedVisibleExamRoutineExams, selectedExamRoutineExamKey],
  );
  const selectedExamRoutineClassGroups = useMemo(
    () => selectedExamRoutineExam?.groups || [],
    [selectedExamRoutineExam],
  );
  const selectedExamGroup = useMemo(
    () => selectedExamRoutineClassGroups.find((group) => group.key === selectedExamGroupKey) || selectedExamRoutineClassGroups[0] || null,
    [selectedExamGroupKey, selectedExamRoutineClassGroups],
  );
  const activeRoutineFilterCount = [scopeFilter, classFilter, sectionFilter, mediumFilter].filter((value) => value !== "all").length;
  const firstEntry = sortedEntries[0] ?? null;
  const hasRoutineAccess = isParent || isTeacher || isAdmin;
  const modeOptions = useMemo(
    () => [
      ["day", "Day View"],
      ["exam", "Exam Routine"],
    ] as Array<[RoutineMode, string]>,
    [],
  );

  const loadClassRoutineBoardEntries = useCallback(async () => {
    const board = isTeacher
      ? await getMyTeacherClassRoutineBoard({ status: "published" })
      : await getClassRoutineBoard({ status: "published" });
    return board.scopes.flatMap((scope) =>
      scope.weekdays.flatMap((day) =>
        day.routines.flatMap((routine) =>
          (routine.entries || []).map((entry) => ({
            ...entry,
            routine_version_id: routine.routine_version_id,
            session_id: routine.session_id,
            session_name: routine.session_name,
            class_name: routine.class_name,
            section_name: routine.section_name,
            medium: routine.medium,
            stream_name: routine.stream_name,
            class_scope: routine.class_scope || scope.class_scope,
            class_scope_label: routine.class_scope_label || scope.scope_label,
          })),
        ),
      ),
    );
  }, [isTeacher]);

  useEffect(() => {
    if (!groupedVisibleExamRoutineExams.length) {
      setSelectedExamRoutineExamKey("");
      setSelectedExamGroupKey("");
      return;
    }
    setSelectedExamRoutineExamKey((current) => {
      if (current && groupedVisibleExamRoutineExams.some((group) => group.key === current)) return current;
      return groupedVisibleExamRoutineExams[0]?.key || "";
    });
  }, [groupedVisibleExamRoutineExams]);

  useEffect(() => {
    if (!selectedExamRoutineClassGroups.length) {
      setSelectedExamGroupKey("");
      return;
    }
    setSelectedExamGroupKey((current) => {
      if (current && selectedExamRoutineClassGroups.some((group) => group.key === current)) return current;
      return selectedExamRoutineClassGroups[0]?.key || "";
    });
  }, [selectedExamRoutineClassGroups]);

  const loadExamRoutineEntries = useCallback(async (student?: Student | null) => {
    try {
      const summaries = isTeacher
        ? await getMyTeacherExamRoutines({ status: "published" })
        : await getExamRoutines({ status: "published" });
      const details = await Promise.all(
        summaries.map(async (summary) => {
          try {
            return await getExamRoutineById(summary.id);
          } catch {
            return null;
          }
        }),
      );
      const flattened = details.flatMap((detail) =>
        (detail?.entries || []).map((entry) => ({
          ...entry,
          routine_id: detail?.id,
          routine_title: detail?.title,
          exam_name: detail?.exam_name,
          session_name: detail?.session_name,
          class_scope: entry.class_scope || detail?.class_scope,
          class_name: entry.class_name || detail?.class_name,
          section_name: entry.section_name || detail?.section_name,
          medium: entry.medium || detail?.medium,
          stream_name: entry.stream_name || detail?.stream_name,
        })),
      );
      if (isParent && student) {
        setExamEntries(flattened.filter((entry) => {
          const classMatches = !student.class_id || Number(entry.class_id) === Number(student.class_id);
          const sectionMatches = !student.section_id || Number(entry.section_id) === Number(student.section_id);
          return classMatches && sectionMatches;
        }));
        return;
      }
      setExamEntries(flattened);
    } catch {
      setExamEntries([]);
    }
  }, [isParent, isTeacher]);

  const loadRoutine = useCallback(async (loadMode: "initial" | "refresh" = "initial") => {
    if (loadMode === "refresh") setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      if (isParent) {
        setTeacherEntries([]);
        const studentResult = await getStudents({ page: 1, limit: 20 });
        const parentStudents = Array.isArray(studentResult.data) ? studentResult.data : [];
        setStudents(parentStudents);
        const studentId = selectedStudentId ?? parentStudents[0]?.id ?? null;
        setSelectedStudentId(studentId);
        const student = parentStudents.find((item) => Number(item.id) === Number(studentId)) ?? null;
        await loadExamRoutineEntries(student);
        if (!studentId) {
          setEntries([]);
          return;
        }
        const response = await getStudentRoutine(studentId, { date: todayDate() });
        setEntries(routineEntriesFromResponse(response));
        return;
      }

      const [boardEntries, myTeacherEntries] = await Promise.all([
        canViewRoutines ? loadClassRoutineBoardEntries() : Promise.resolve([]),
        isTeacher ? getMyTeacherRoutine() : Promise.resolve([]),
        loadExamRoutineEntries(null),
      ]);
      setEntries(boardEntries);
      setTeacherEntries(myTeacherEntries.map((entry) => ({
        ...entry,
        class_scope_label: entry.class_scope_label || (entry.class_scope === "hs" ? "Higher Secondary" : entry.class_scope === "school" ? "School" : entry.class_scope),
      })));
    } catch {
      setEntries([]);
      setTeacherEntries([]);
      setError("Could not load routine right now.");
    } finally {
      if (loadMode === "refresh") setRefreshing(false);
      else setLoading(false);
    }
  }, [canViewRoutines, isParent, isTeacher, loadClassRoutineBoardEntries, loadExamRoutineEntries, selectedStudentId]);

  useEffect(() => {
    void loadRoutine();
  }, [loadRoutine]);

  function chooseStudent(studentId: number) {
    setSelectedStudentId(studentId);
  }

  useEffect(() => {
    if (!isParent || !selectedStudentId) return;
    const student = students.find((item) => Number(item.id) === Number(selectedStudentId)) ?? null;
    void getStudentRoutine(selectedStudentId, { date: todayDate() })
      .then(async (response) => {
        setEntries(routineEntriesFromResponse(response));
        await loadExamRoutineEntries(student);
      })
      .catch(() => setError("Could not load routine right now."));
  }, [isParent, loadExamRoutineEntries, selectedStudentId, students]);

  function entryBelongsToCurrentTeacher(entry: RoutineEntry) {
    if (!isTeacher || !user?.id) return false;
    const userIds = normalizeIdList(entry.teacher_user_ids);
    return userIds.includes(Number(user.id));
  }

  function renderRoutineSlotGroup(slot: RoutineSlotGroup, index: number) {
    const entry = slot.entry;
    const isBreak = isBreakEntry(entry);
    const entryType = String(entry.entry_type || "").toLowerCase();
    const isFree = entryType === "free";
    const isActivity = entryType === "activity";
    const muted = isBreak || isFree;
    const assignedToTeacher = slot.entries.some(entryBelongsToCurrentTeacher);
    const label = slot.displayLabel || entryPeriodLabel(entry);
    const periodMeta = entryPeriodMeta(entry);
    const multipleEntries = slot.entries.length > 1;
    const showTeacherScope = isTeacher && teacherRoutineView === "mine" && !isParent;

    return (
      <View key={`${slot.key}-${index}`} style={styles.timelineRow}>
        <View style={styles.timeRail}>
          <View style={[
            styles.periodBadge,
            {
              backgroundColor: assignedToTeacher ? theme.infoSoft : muted ? theme.cardMuted : theme.successSoft,
              borderColor: assignedToTeacher ? theme.infoBorder : muted ? theme.border : theme.successBorder,
            },
          ]}>
            <Text
              style={[styles.periodText, { color: assignedToTeacher ? theme.infoText : muted ? theme.subText : theme.primary }]}
              numberOfLines={2}
            >
              {label}
            </Text>
          </View>
        </View>

        <View style={[
          styles.entryCard,
          {
            backgroundColor: assignedToTeacher ? theme.infoSoft : muted ? theme.cardMuted : theme.card,
            borderColor: assignedToTeacher ? theme.infoBorder : theme.border,
          },
        ]}>
          <View style={styles.entryContentRow}>
            <View style={styles.entryTextBlock}>
              <Text style={[styles.entryTitle, { color: theme.text }]} numberOfLines={multipleEntries ? 2 : 1}>
                {multipleEntries ? label : entryTitle(entry)}
              </Text>
              <Text style={[styles.entryTimeRange, { color: theme.subText }]} numberOfLines={1}>
                {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
              </Text>
              {isBreak && periodMeta ? (
                <Text style={[styles.entrySubText, { color: theme.subText }]} numberOfLines={1}>{periodMeta}</Text>
              ) : null}
              {multipleEntries ? (
                <View style={styles.slotSubjectList}>
                  {slot.entries.map((item, itemIndex) => {
                    const itemTeacherText = entryTeachers(item);
                    const itemAssigned = entryBelongsToCurrentTeacher(item);
                    return (
                      <View
                        key={`${item.entry_id || item.id || itemIndex}-${item.subject_name || item.title || itemIndex}`}
                        style={[
                          styles.slotSubjectRow,
                          {
                            backgroundColor: itemAssigned ? theme.card : "transparent",
                            borderColor: itemAssigned ? theme.infoBorder : theme.border,
                          },
                        ]}
                      >
                        <View style={styles.entryTextBlock}>
                          <Text style={[styles.slotSubjectTitle, { color: theme.text }]} numberOfLines={1}>{entryTitle(item)}</Text>
                          {showTeacherScope ? (
                            <Text style={[styles.entryClassText, { color: theme.infoText }]} numberOfLines={1}>{scopeText(item)}</Text>
                          ) : null}
                          {itemTeacherText ? (
                            <Text style={[styles.entryMetaText, { color: theme.subText }]} numberOfLines={1}>{itemTeacherText}</Text>
                          ) : null}
                        </View>
                        {itemAssigned ? (
                          <View style={[styles.teacherHighlightPill, { backgroundColor: theme.infoSoft, borderColor: theme.infoBorder }]}>
                            <Text style={[styles.teacherHighlightText, { color: theme.infoText }]}>Yours</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.entryMetaRow}>
                  {showTeacherScope ? (
                    <View style={styles.entryMetaItem}>
                      <Ionicons name="school-outline" size={14} color={theme.infoText} />
                      <Text style={[styles.entryClassText, { color: theme.infoText }]} numberOfLines={1}>{scopeText(entry)}</Text>
                    </View>
                  ) : null}
                  {entryTeachers(entry) ? (
                    <View style={styles.entryMetaItem}>
                      <Ionicons name="person-outline" size={14} color={theme.subText} />
                      <Text style={[styles.entryMetaText, { color: theme.subText }]} numberOfLines={1}>{entryTeachers(entry)}</Text>
                    </View>
                  ) : null}
                  {!isParent && entry.room ? (
                    <View style={styles.entryMetaItem}>
                      <Ionicons name="location-outline" size={14} color={theme.subText} />
                      <Text style={[styles.entryMetaText, { color: theme.subText }]} numberOfLines={1}>{entry.room}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
            <View style={[
              styles.entryTypeBadge,
              {
                backgroundColor: assignedToTeacher ? theme.infoSoft : theme.successSoft,
                borderColor: assignedToTeacher ? theme.infoBorder : theme.successBorder,
              },
            ]}>
              <Text style={[
                styles.entryTypeText,
                { color: assignedToTeacher ? theme.infoText : theme.primary },
              ]}>
                {assignedToTeacher ? "Yours" : isBreak ? "Break" : isFree ? "Free" : isActivity ? "Activity" : "Class"}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  function renderFilterChips(label: string, value: string, options: string[], onChange: (next: string) => void) {
    if (!options.length) return null;
    return (
      <View style={styles.filterBlock}>
        <Text style={[styles.filterLabel, { color: theme.subText }]}>{label}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
          {["all", ...options].map((option) => {
            const selected = value === option;
            const display = option === "all" ? "All" : option === "hs" ? "HS" : option === "school" ? "School" : option;
            return (
              <Pressable
                key={option}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: selected ? theme.primary : theme.card,
                    borderColor: selected ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => onChange(option)}
              >
                <Text style={[styles.filterChipText, { color: selected ? theme.primaryText : theme.text }]} numberOfLines={1}>
                  {display}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  function filterDisplayValue(label: string, value: string) {
    if (value === "all") return `${label}: All`;
    if (value === "hs") return `${label}: HS`;
    if (value === "school") return `${label}: School`;
    return `${label}: ${value}`;
  }

  function resetRoutineFilters() {
    setScopeFilter("all");
    setClassFilter("all");
    setSectionFilter("all");
    setMediumFilter("all");
  }

  function renderAdminRoutineGroup(group: RoutineGroup) {
    const slotGroups = withDisplayPeriodLabels(groupRoutineSlots(group.entries));
    return (
      <View key={group.key} style={styles.groupBlock}>
        <View style={[styles.groupHeaderCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.entryTitleWrap}>
            <Text style={[styles.groupTitle, { color: theme.text }]} numberOfLines={1}>{group.title}</Text>
            <Text style={[styles.groupSubtitle, { color: theme.subText }]} numberOfLines={1}>{group.subtitle}</Text>
          </View>
          <View style={[styles.entryTypeBadge, { backgroundColor: theme.successSoft, borderColor: theme.successBorder }]}>
            <Text style={[styles.entryTypeText, { color: theme.primary }]}>
              {slotGroups.length}
            </Text>
          </View>
        </View>
        <View style={styles.groupEntries}>
          {slotGroups.map(renderRoutineSlotGroup)}
        </View>
      </View>
    );
  }

  function renderAdminExamRoutineGroup(group: ExamRoutineGroup) {
    return (
      <View key={group.key} style={styles.groupBlock}>
        <View style={[styles.groupHeaderCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.entryTitleWrap}>
            <Text style={[styles.groupTitle, { color: theme.text }]} numberOfLines={1}>{group.title}</Text>
            <Text style={[styles.groupSubtitle, { color: theme.subText }]} numberOfLines={1}>{group.subtitle}</Text>
          </View>
          <View style={[styles.entryTypeBadge, { backgroundColor: theme.infoSoft, borderColor: theme.infoBorder }]}>
            <Text style={[styles.entryTypeText, { color: theme.infoText }]}>
              {group.entries.length}
            </Text>
          </View>
        </View>
        <View style={styles.groupEntries}>
          {group.entries.map(renderExamEntry)}
        </View>
      </View>
    );
  }

  function renderRoutineGroupSelector<T extends { key: string; title: string; subtitle: string }>(
    groups: T[],
    selectedKey: string,
    onSelect: (key: string) => void,
  ) {
    if (!groups.length) return null;
    return (
      <View style={styles.routineSelectorBlock}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routineSelectorChips}>
          {groups.map((group, index) => {
            const fallbackSelected = !selectedKey && index === 0;
            const selected = selectedKey === group.key || fallbackSelected;
            return (
              <Pressable
                key={group.key}
                style={[
                  styles.routineSelectorChip,
                  {
                    backgroundColor: selected ? theme.primary : theme.card,
                    borderColor: selected ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => onSelect(group.key)}
              >
                <View style={styles.routineSelectorTextBlock}>
                  <Text style={[styles.routineSelectorTitle, { color: selected ? theme.primaryText : theme.text }]} numberOfLines={1}>
                    {group.title}
                  </Text>
                  <Text style={[styles.routineSelectorSubtitle, { color: selected ? theme.primaryText : theme.subText }]} numberOfLines={1}>
                    {group.subtitle}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  function renderExamEntry(entry: ExamRoutineEntry, index: number) {
    const title = entry.title || entry.subject_name || "Exam";
    return (
      <View key={`${entry.routine_id || "exam"}-${entry.id || index}`} style={styles.timelineRow}>
        <View style={styles.timeRail}>
          <View style={[styles.periodBadge, { backgroundColor: theme.infoSoft, borderColor: theme.infoBorder }]}>
            <Text style={[styles.periodText, { color: theme.infoText }]}>{index + 1}</Text>
          </View>
        </View>

        <View style={[styles.entryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.entryTitle, { color: theme.text }]} numberOfLines={2}>{title}</Text>
          <Text style={[styles.entryTimeRange, { color: theme.subText }]} numberOfLines={2}>
            {formatDate(entry.exam_date)} / {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
          </Text>
          {!isParent ? (
            <View style={styles.entryMetaRow}>
              <Text style={[styles.examScopeInline, { color: theme.subText }]} numberOfLines={1}>{examScopeText(entry)}</Text>
              {entry.invigilator_names ? (
                <View style={styles.entryMetaItem}>
                  <Ionicons name="person-outline" size={14} color={theme.subText} />
                  <Text style={[styles.entryMetaText, { color: theme.subText }]} numberOfLines={1}>{entry.invigilator_names}</Text>
                </View>
              ) : null}
              {entry.room ? (
                <View style={styles.entryMetaItem}>
                  <Ionicons name="location-outline" size={14} color={theme.subText} />
                  <Text style={[styles.entryMetaText, { color: theme.subText }]} numberOfLines={1}>{entry.room}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRoutine("refresh")} />}
    >
      <View style={styles.heroRow}>
        <View>
          <Text style={[styles.kicker, { color: theme.primary }]}>Routine</Text>
          <Text style={[styles.title, { color: theme.text }]}>
            {mode === "exam" ? "Exam Routine" : isParent ? selectedStudent?.name || "Student Routine" : isTeacher && teacherRoutineView === "mine" ? "My Periods" : isTeacher ? "Class Routine" : "Routine"}
          </Text>
          <Text style={[styles.subtitle, { color: theme.subText }]} numberOfLines={2}>
            {mode === "exam" ? `${visibleExamEntries.length} published paper${visibleExamEntries.length === 1 ? "" : "s"}` : isParent ? classLabel(selectedStudent) : isTeacher && teacherRoutineView === "mine" ? "Periods assigned to you" : isTeacher ? "Assigned class routines" : "Create and publish routines from the software portal."}
          </Text>
        </View>
      </View>

      {isParent && students.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.studentChips}>
          {students.map((student) => {
            const selected = Number(student.id) === Number(selectedStudentId);
            return (
              <Pressable
                key={student.id}
                style={[
                  styles.studentChip,
                  {
                    backgroundColor: selected ? theme.primary : theme.card,
                    borderColor: selected ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => chooseStudent(Number(student.id))}
              >
                <Text style={[styles.studentChipText, { color: selected ? theme.primaryText : theme.text }]} numberOfLines={1}>
                  {student.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={[styles.segmented, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {modeOptions.map(([key, label]) => {
          const selected = mode === key;
          return (
            <Pressable
              key={key}
              style={[styles.segmentButton, { backgroundColor: selected ? theme.primary : "transparent" }]}
              onPress={() => setMode(key as RoutineMode)}
            >
              <Text style={[styles.segmentText, { color: selected ? theme.primaryText : theme.subText }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mode !== "exam" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayChips}>
          {DAYS.map((day) => {
            const selected = day.key === selectedDay;
            return (
              <Pressable
                key={day.key}
                style={[
                  styles.dayChip,
                  {
                    backgroundColor: selected ? theme.primary : theme.card,
                    borderColor: selected ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => {
                  setSelectedDay(day.key);
                }}
              >
                <Text style={[styles.dayChipText, { color: selected ? theme.primaryText : theme.text }]}>{day.short}</Text>
                <Text style={[styles.dayChipSubText, { color: selected ? theme.primaryText : theme.subText }]}>{day.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {isTeacher && mode !== "exam" ? (
        <View style={[styles.segmented, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {([
            ["mine", "My Periods"],
            ["classes", "Class Routines"],
          ] as Array<[TeacherRoutineView, string]>).map(([key, label]) => {
            const selected = teacherRoutineView === key;
            return (
              <Pressable
                key={key}
                style={[styles.segmentButton, { backgroundColor: selected ? theme.primary : "transparent" }]}
                onPress={() => setTeacherRoutineView(key)}
              >
                <Text style={[styles.segmentText, { color: selected ? theme.primaryText : theme.subText }]} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {showRoutineFilters ? (
        <View style={styles.compactFilterArea}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compactFilterRow}>
            <Pressable
              style={[styles.filterToggle, { backgroundColor: filtersOpen ? theme.primary : theme.card, borderColor: filtersOpen ? theme.primary : theme.border }]}
              onPress={() => setFiltersOpen((current) => !current)}
            >
              <Ionicons name="options-outline" size={15} color={filtersOpen ? theme.primaryText : theme.text} />
              <Text style={[styles.filterToggleText, { color: filtersOpen ? theme.primaryText : theme.text }]}>
                Filters{activeRoutineFilterCount ? ` (${activeRoutineFilterCount})` : ""}
              </Text>
            </Pressable>
            <View style={[styles.summaryChip, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.summaryChipText, { color: theme.subText }]} numberOfLines={1}>
                {filterDisplayValue("Scope", scopeFilter)}
              </Text>
            </View>
            <View style={[styles.summaryChip, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.summaryChipText, { color: theme.subText }]} numberOfLines={1}>
                {filterDisplayValue("Class", classFilter)}
              </Text>
            </View>
            {activeRoutineFilterCount ? (
              <Pressable style={[styles.clearFilterChip, { borderColor: theme.border }]} onPress={resetRoutineFilters}>
                <Text style={[styles.clearFilterText, { color: theme.danger }]}>Clear</Text>
              </Pressable>
            ) : null}
          </ScrollView>
          {classSwitchingClassRoutineView ? renderRoutineGroupSelector(groupedVisibleEntries, selectedRoutineGroup?.key || "", setSelectedRoutineGroupKey) : null}
          {classSwitchingExamRoutineView ? (
            <>
              {renderRoutineGroupSelector(groupedVisibleExamRoutineExams, selectedExamRoutineExam?.key || "", setSelectedExamRoutineExamKey)}
              {renderRoutineGroupSelector(selectedExamRoutineClassGroups, selectedExamGroup?.key || "", setSelectedExamGroupKey)}
            </>
          ) : null}
          {filtersOpen ? (
            <View style={[styles.filtersPanel, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
              {renderFilterChips("Scope", scopeFilter, scopeOptions, (next) => {
                setScopeFilter(next);
                setClassFilter("all");
                setSectionFilter("all");
                setMediumFilter("all");
              })}
              {renderFilterChips("Class", classFilter, classOptions, (next) => {
                setClassFilter(next);
                setSectionFilter("all");
                setMediumFilter("all");
              })}
              {renderFilterChips("Section", sectionFilter, sectionOptions, (next) => {
                setSectionFilter(next);
                setMediumFilter("all");
              })}
              {renderFilterChips("Medium", mediumFilter, mediumOptions, setMediumFilter)}
            </View>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.stateBlock}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : !hasRoutineAccess && !canViewRoutines ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="lock-closed-outline" size={24} color={theme.subText} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Routine access unavailable</Text>
          <Text style={[styles.emptyText, { color: theme.subText }]}>Your account does not have a routine view assigned.</Text>
        </View>
      ) : error ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="alert-circle-outline" size={24} color={theme.danger} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>{error}</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={() => loadRoutine()}>
            <Text style={[styles.retryText, { color: theme.primaryText }]}>Retry</Text>
          </Pressable>
        </View>
      ) : classSwitchingExamRoutineView && selectedExamGroup ? (
        <View style={styles.groupList}>{renderAdminExamRoutineGroup(selectedExamGroup)}</View>
      ) : mode === "exam" && visibleExamEntries.length ? (
        <View style={styles.timelineList}>{visibleExamEntries.map(renderExamEntry)}</View>
      ) : isTeacher && mode !== "exam" && teacherRoutineView === "mine" && teacherDayEntries.length ? (
        <View style={styles.timelineList}>{groupRoutineSlots(teacherDayEntries).map(renderRoutineSlotGroup)}</View>
      ) : classSwitchingClassRoutineView && selectedRoutineGroup ? (
        <View style={styles.groupList}>{renderAdminRoutineGroup(selectedRoutineGroup)}</View>
      ) : mode !== "exam" && visibleEntries.length ? (
        <View style={styles.timelineList}>{withDisplayPeriodLabels(groupRoutineSlots(visibleEntries)).map(renderRoutineSlotGroup)}</View>
      ) : (
        <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name={isAdmin ? "desktop-outline" : "calendar-outline"} size={24} color={theme.subText} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {isAdmin ? "Manage routines in software" : mode === "exam" ? "No exam routine found" : "No routine found"}
          </Text>
          <Text style={[styles.emptyText, { color: theme.subText }]}>
            {isAdmin
              ? "Mobile is ready for viewing once a routine is published."
              : mode === "exam"
                ? "Published exam papers will appear here."
                : isTeacher && teacherRoutineView === "mine"
                  ? "Assigned periods will appear here."
                : "Published classes and breaks will appear here."}
          </Text>
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    marginTop: 2,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    maxWidth: 220,
  },
  studentChips: {
    gap: 8,
    paddingBottom: 10,
  },
  studentChip: {
    maxWidth: 160,
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  studentChipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  segmented: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 4,
    flexDirection: "row",
    gap: 4,
    marginBottom: 12,
  },
  segmentButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  segmentText: {
    fontSize: 11,
    fontWeight: "800",
  },
  dayChips: {
    gap: 8,
    paddingBottom: 14,
  },
  dayChip: {
    width: 76,
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  dayChipText: {
    fontSize: 15,
    fontWeight: "800",
  },
  dayChipSubText: {
    fontSize: 10,
    marginTop: 2,
  },
  compactFilterArea: {
    marginBottom: 12,
    gap: 8,
  },
  compactFilterRow: {
    gap: 8,
    alignItems: "center",
    paddingBottom: 2,
  },
  filterToggle: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterToggleText: {
    fontSize: 12,
    fontWeight: "800",
  },
  summaryChip: {
    maxWidth: 170,
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  summaryChipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  clearFilterChip: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: "800",
  },
  filtersPanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 10,
    marginBottom: 14,
  },
  filterBlock: {
    gap: 6,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  filterChips: {
    gap: 8,
  },
  filterChip: {
    maxWidth: 150,
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  routineSelectorBlock: {
    marginTop: 2,
  },
  routineSelectorChips: {
    gap: 8,
    paddingBottom: 2,
  },
  routineSelectorChip: {
    maxWidth: 210,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  routineSelectorTextBlock: {
    maxWidth: 180,
  },
  routineSelectorTitle: {
    fontSize: 12,
    fontWeight: "800",
  },
  routineSelectorSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 1,
  },
  groupList: {
    gap: 16,
  },
  groupBlock: {
    gap: 10,
  },
  groupHeaderCard: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  groupEntries: {
    gap: 10,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  groupSubtitle: {
    fontSize: 12,
    marginTop: 3,
    fontWeight: "700",
  },
  timelineList: {
    gap: 10,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  timeRail: {
    width: 64,
    alignItems: "center",
    paddingTop: 26,
  },
  periodBadge: {
    width: 54,
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  periodText: {
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  timeText: {
    fontSize: 10,
    marginTop: 3,
    fontWeight: "700",
  },
  entryCard: {
    flex: 1,
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  entryContentRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  entryTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  entryTitleWrap: {
    flex: 1,
  },
  entryTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  entryTimeRange: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  entrySubText: {
    fontSize: 12,
    marginTop: 3,
  },
  examScope: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 10,
  },
  examScopeInline: {
    maxWidth: "100%",
    fontSize: 12,
    fontWeight: "700",
  },
  entryTypeBadge: {
    minWidth: 52,
    minHeight: 26,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  entryTypeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  entryMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 2,
  },
  entryMetaItem: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  entryMetaText: {
    fontSize: 12,
    fontWeight: "700",
  },
  entryClassText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  slotSubjectList: {
    gap: 8,
    marginTop: 10,
  },
  slotSubjectRow: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  slotSubjectTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  teacherHighlightPill: {
    minHeight: 24,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  teacherHighlightText: {
    fontSize: 10,
    fontWeight: "900",
  },
  stateBlock: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    minHeight: 190,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 10,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 6,
  },
  retryBtn: {
    minHeight: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 12,
  },
  retryText: {
    fontSize: 13,
    fontWeight: "800",
  },
  bottomSpacer: {
    height: 12,
  },
});

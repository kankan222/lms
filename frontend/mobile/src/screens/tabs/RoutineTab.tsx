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
  getMyTeacherRoutine,
  getStudentRoutine,
  type ExamRoutineEntry,
  type RoutineEntry,
} from "../../services/routinesService";
import { useAuthStore } from "../../store/authStore";
import { useAppTheme } from "../../theme/AppThemeProvider";

type RoutineMode = "week" | "day" | "teacher" | "exam";
type DayItem = { key: number; short: string; label: string };

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
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function entryTitle(entry: RoutineEntry) {
  return entry.subject_name || entry.activity_name || entry.title || entry.slot_label || (entry.entry_type === "break" ? "Break" : "Free Period");
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
  return Number(a.period_number || 0) - Number(b.period_number || 0);
}

function scopeText(entry?: RoutineEntry | null) {
  const parts = [entry?.class_scope_label, entry?.class_name, entry?.section_name, entry?.medium, entry?.stream_name]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(" / ") : "Published routine";
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
  const [mode, setMode] = useState<RoutineMode>(isTeacher ? "teacher" : "week");
  const [selectedDay, setSelectedDay] = useState(todayWeekday());
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<RoutineEntry[]>([]);
  const [examEntries, setExamEntries] = useState<ExamRoutineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStudent = useMemo(
    () => students.find((student) => Number(student.id) === Number(selectedStudentId)) ?? null,
    [selectedStudentId, students],
  );
  const selectedDayMeta = DAYS.find((day) => day.key === selectedDay) ?? DAYS[0];
  const sortedEntries = useMemo(() => [...entries].sort(sortRoutine), [entries]);
  const visibleEntries = useMemo(() => {
    if (mode === "week") return sortedEntries;
    return sortedEntries.filter((entry) => getEntryWeekday(entry) === selectedDay);
  }, [mode, selectedDay, sortedEntries]);
  const visibleExamEntries = useMemo(() => [...examEntries].sort(sortExamEntries), [examEntries]);
  const firstEntry = sortedEntries[0] ?? null;
  const hasRoutineAccess = isParent || isTeacher || isAdmin;
  const modeOptions = useMemo(
    () => [
      ["week", "Week View"],
      ["day", "Day View"],
      ...(isTeacher ? [["teacher", "Teacher View"]] : []),
      ["exam", "Exam Routine"],
    ] as Array<[RoutineMode, string]>,
    [isTeacher],
  );

  const loadClassRoutineBoardEntries = useCallback(async () => {
    const board = await getClassRoutineBoard({ status: "published" });
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
  }, []);

  const loadExamRoutineEntries = useCallback(async (student?: Student | null) => {
    try {
      const summaries = await getExamRoutines({ status: "published" });
      const details = await Promise.all(
        summaries.slice(0, 8).map(async (summary) => {
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
  }, [isParent]);

  const loadRoutine = useCallback(async (loadMode: "initial" | "refresh" = "initial") => {
    if (loadMode === "refresh") setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      if (isParent) {
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

      if (isTeacher) {
        const [response] = await Promise.all([
          getMyTeacherRoutine({ date: todayDate() }),
          loadExamRoutineEntries(null),
        ]);
        setEntries(response || []);
        return;
      }

      const [boardEntries] = await Promise.all([
        canViewRoutines ? loadClassRoutineBoardEntries() : Promise.resolve([]),
        loadExamRoutineEntries(null),
      ]);
      setEntries(boardEntries);
    } catch {
      setEntries([]);
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

  function renderMetric(label: string, value: string, icon: keyof typeof Ionicons.glyphMap) {
    return (
      <View style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={[styles.metricIcon, { backgroundColor: theme.successSoft, borderColor: theme.successBorder }]}>
          <Ionicons name={icon} size={16} color={theme.primary} />
        </View>
        <Text style={[styles.metricLabel, { color: theme.subText }]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.metricValue, { color: theme.text }]} numberOfLines={1}>{value}</Text>
      </View>
    );
  }

  function renderEntry(entry: RoutineEntry, index: number) {
    const isBreak = String(entry.entry_type || "").toLowerCase() === "break";
    const isFree = ["free", "custom"].includes(String(entry.entry_type || "").toLowerCase());
    const muted = isBreak || isFree;
    const teacherText = entryTeachers(entry);
    const day = DAYS.find((item) => item.key === getEntryWeekday(entry));

    return (
      <View key={`${entry.routine_version_id || "routine"}-${entry.entry_id || entry.id || index}-${getEntryWeekday(entry)}`} style={styles.timelineRow}>
        <View style={styles.timeRail}>
          <View style={[
            styles.periodBadge,
            {
              backgroundColor: muted ? theme.cardMuted : theme.successSoft,
              borderColor: muted ? theme.border : theme.successBorder,
            },
          ]}>
            <Text style={[styles.periodText, { color: muted ? theme.subText : theme.primary }]}>
              {entry.period_number || index + 1}
            </Text>
          </View>
          <Text style={[styles.timeText, { color: theme.subText }]}>{formatTime(entry.start_time)}</Text>
          <Text style={[styles.timeText, { color: theme.mutedText }]}>{formatTime(entry.end_time)}</Text>
        </View>

        <View style={[
          styles.entryCard,
          {
            backgroundColor: muted ? theme.cardMuted : theme.card,
            borderColor: theme.border,
          },
        ]}>
          <View style={styles.rowBetween}>
            <View style={styles.entryTitleWrap}>
              <Text style={[styles.entryTitle, { color: theme.text }]} numberOfLines={1}>{entryTitle(entry)}</Text>
              <Text style={[styles.entrySubText, { color: theme.subText }]} numberOfLines={1}>
                {isParent ? (mode === "week" ? day?.short || "" : `Period ${entry.period_number || index + 1}`) : `${mode === "week" ? `${day?.short || ""} / ` : ""}${scopeText(entry)}`}
              </Text>
            </View>
            <View style={[
              styles.entryTypeBadge,
              {
                backgroundColor: theme.successSoft,
                borderColor: theme.successBorder,
              },
            ]}>
              <Text style={[
                styles.entryTypeText,
                { color: theme.primary },
              ]}>
                {isBreak ? "Break" : isFree ? "Free" : "Class"}
              </Text>
            </View>
          </View>

          <View style={styles.entryMetaRow}>
            {!isParent && teacherText ? (
              <View style={styles.entryMetaItem}>
                <Ionicons name="person-outline" size={14} color={theme.subText} />
                <Text style={[styles.entryMetaText, { color: theme.subText }]} numberOfLines={1}>{teacherText}</Text>
              </View>
            ) : null}
            {!isParent && entry.room ? (
              <View style={styles.entryMetaItem}>
                <Ionicons name="location-outline" size={14} color={theme.subText} />
                <Text style={[styles.entryMetaText, { color: theme.subText }]} numberOfLines={1}>{entry.room}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  function renderExamEntry(entry: ExamRoutineEntry, index: number) {
    const title = entry.subject_name || entry.title || "Exam";
    return (
      <View key={`${entry.routine_id || "exam"}-${entry.id || index}`} style={styles.timelineRow}>
        <View style={styles.timeRail}>
          <View style={[styles.periodBadge, { backgroundColor: theme.infoSoft, borderColor: theme.infoBorder }]}>
            <Ionicons name="document-text-outline" size={16} color={theme.infoText} />
          </View>
          <Text style={[styles.timeText, { color: theme.subText }]}>{formatTime(entry.start_time)}</Text>
          <Text style={[styles.timeText, { color: theme.mutedText }]}>{formatTime(entry.end_time)}</Text>
        </View>

        <View style={[styles.entryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.rowBetween}>
            <View style={styles.entryTitleWrap}>
              <Text style={[styles.entryTitle, { color: theme.text }]} numberOfLines={1}>{title}</Text>
              <Text style={[styles.entrySubText, { color: theme.subText }]} numberOfLines={1}>
                {entry.exam_name || entry.routine_title || "Published exam"} / {formatDate(entry.exam_date)}
              </Text>
            </View>
            <View style={[styles.entryTypeBadge, { backgroundColor: theme.infoSoft, borderColor: theme.infoBorder }]}>
              <Text style={[styles.entryTypeText, { color: theme.infoText }]}>Exam</Text>
            </View>
          </View>

          <Text style={[styles.examScope, { color: theme.subText }]} numberOfLines={1}>
            {isParent ? "Subject and time" : examScopeText(entry)}
          </Text>
          {!isParent ? (
            <View style={styles.entryMetaRow}>
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
            {mode === "exam" ? "Exam Routine" : isParent ? selectedStudent?.name || "Student Routine" : isTeacher ? "My Teaching Routine" : "Routine"}
          </Text>
          <Text style={[styles.subtitle, { color: theme.subText }]} numberOfLines={2}>
            {mode === "exam" ? `${visibleExamEntries.length} published paper${visibleExamEntries.length === 1 ? "" : "s"}` : isParent ? classLabel(selectedStudent) : isTeacher ? scopeText(firstEntry) : "Create and publish routines from the software portal."}
          </Text>
        </View>
        <View style={[styles.datePill, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.dateDay, { color: theme.text }]}>{selectedDayMeta.short}</Text>
          <Text style={[styles.dateText, { color: theme.subText }]}>{todayDate()}</Text>
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

      <View style={styles.metricGrid}>
        {renderMetric("Session", mode === "exam" ? visibleExamEntries[0]?.session_name || "Active" : firstEntry?.session_name || (firstEntry?.session_id ? String(firstEntry.session_id) : selectedStudent?.session_name || "Active"), "calendar-clear-outline")}
        {renderMetric("Scope", mode === "exam" ? isParent ? classLabel(selectedStudent) : examScopeText(visibleExamEntries[0]) : isParent ? classLabel(selectedStudent) : scopeText(firstEntry), "school-outline")}
        {renderMetric("Status", mode === "exam" ? `${visibleExamEntries.length} papers` : firstEntry ? "Published" : "No routine", "checkmark-done-outline")}
      </View>

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
                  if (mode === "week") setMode("day");
                }}
              >
                <Text style={[styles.dayChipText, { color: selected ? theme.primaryText : theme.text }]}>{day.short}</Text>
                <Text style={[styles.dayChipSubText, { color: selected ? theme.primaryText : theme.subText }]}>{day.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
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
      ) : mode === "exam" && visibleExamEntries.length ? (
        <View style={styles.timelineList}>{visibleExamEntries.map(renderExamEntry)}</View>
      ) : mode !== "exam" && visibleEntries.length ? (
        <View style={styles.timelineList}>{visibleEntries.map(renderEntry)}</View>
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
  datePill: {
    width: 86,
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  dateDay: {
    fontSize: 17,
    fontWeight: "800",
  },
  dateText: {
    fontSize: 10,
    marginTop: 2,
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
  metricGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
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
  timelineList: {
    gap: 10,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 10,
  },
  timeRail: {
    width: 54,
    alignItems: "center",
  },
  periodBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  periodText: {
    fontSize: 13,
    fontWeight: "800",
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
  entrySubText: {
    fontSize: 12,
    marginTop: 3,
  },
  examScope: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 10,
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
    marginTop: 12,
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

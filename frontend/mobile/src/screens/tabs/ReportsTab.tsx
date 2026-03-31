import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { getClassStructure } from "../../services/classesService";
import { useAppTheme } from "../../theme/AppThemeProvider";
import SelectField from "../../components/form/SelectField";
import { getExams, getExamById, type ExamSubject } from "../../services/examsService";
import { getSubjects } from "../../services/subjectsService";
import {
  approveMarks,
  downloadMyMarksheet,
  downloadStudentMarksheet,
  getAccessibleExamById,
  getAccessibleExams,
  getMarksApprovalSummary,
  getMarksGrid,
  getPendingApprovalQueue,
  getMyResults,
  getMyStudents,
  rejectMarks,
  saveMarks,
  submitMarksForApproval,
  type AccessibleExamScope,
  type LinkedStudent,
  type MarksGridData,
  type MarksApprovalSummary,
  type PendingApprovalQueue,
  type StudentReport,
} from "../../services/reportsService";
import TopNotice from "../../components/feedback/TopNotice";
import { useAuthStore } from "../../store/authStore";

type ReportsTabKey = "review" | "entry" | "published" | "results";

type ClassItem = {
  id: number;
  name: string;
  class_scope?: string | null;
  sections: Array<{ id: number; name: string; medium?: string | null }>;
};

type SubjectItem = {
  id: number;
  name: string;
};

type NoticeTone = "success" | "error";

const EMPTY_FILTERS = {
  exam_id: "",
  class_id: "",
  section_id: "",
  medium: "",
  subject_id: "",
  name: "",
  approval_status: "",
};

const EMPTY_SELF_FILTERS = {
  exam_id: "",
  student_id: "",
};

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
  primary: "#0f172a",
  primaryText: "#ffffff",
  success: "#15803d",
  successText: "#ffffff",
  danger: "#b91c1c",
  dangerSoft: "#fee2e2",
  dangerBorder: "#fecaca",
};
let currentTheme = DEFAULT_THEME;

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err && "response" in err) {
    const data = (err as { response?: { data?: { message?: string; error?: string } } }).response?.data;
    return data?.error || data?.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function uniqueMediums(
  sections: Array<{ id: number; name: string; medium?: string | null }> = [],
) {
  return [...new Set(sections.map((item) => item.medium).filter(Boolean))];
}

function uniqueById<T extends { id: number | string }>(items: T[] = []) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = String(item.id);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${Number(value).toFixed(2)}%`;
}

function formatScope(scope?: string | null) {
  return String(scope || "school").trim().toLowerCase() === "hs" ? "Higher Secondary" : "School";
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function noticeToneStyle(tone: NoticeTone) {
  return tone === "success"
    ? { borderColor: "#bbf7d0", backgroundColor: currentTheme.isDark ? "#052e16" : "#f0fdf4" }
    : { borderColor: "#fecaca", backgroundColor: currentTheme.isDark ? "#450a0a" : "#fef2f2" };
}

function statusBadgeTone(status: string) {
  if (status === "approved") {
    return {
      borderColor: currentTheme.isDark ? "#15803d" : "#bbf7d0",
      backgroundColor: currentTheme.isDark ? "#052e16" : "#f0fdf4",
      color: currentTheme.isDark ? "#86efac" : "#15803d",
    };
  }
  if (status === "pending") {
    return {
      borderColor: currentTheme.isDark ? "#d97706" : "#fde68a",
      backgroundColor: currentTheme.isDark ? "#451a03" : "#fffbeb",
      color: currentTheme.isDark ? "#fcd34d" : "#b45309",
    };
  }
  return {
    borderColor: currentTheme.border,
    backgroundColor: currentTheme.cardMuted,
    color: currentTheme.subText,
  };
}

function summaryCardTone(tone: "default" | "green" | "amber" | "violet") {
  if (tone === "green") return { borderColor: "#bbf7d0", backgroundColor: currentTheme.isDark ? "#052e16" : "#f0fdf4" };
  if (tone === "amber") return { borderColor: "#fde68a", backgroundColor: currentTheme.isDark ? "#451a03" : "#fffbeb" };
  if (tone === "violet") return { borderColor: "#ddd6fe", backgroundColor: currentTheme.isDark ? "#2e1065" : "#f5f3ff" };
  return { borderColor: currentTheme.border, backgroundColor: currentTheme.card };
}

function summaryValueTone(tone: "default" | "green" | "amber" | "violet") {
  if (tone === "green") return { color: currentTheme.isDark ? "#86efac" : "#15803d" };
  if (tone === "amber") return { color: currentTheme.isDark ? "#fcd34d" : "#b45309" };
  if (tone === "violet") return { color: currentTheme.isDark ? "#c4b5fd" : "#6d28d9" };
  return { color: currentTheme.text };
}

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
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
  value: string | number;
  tone?: "default" | "green" | "amber" | "violet";
}) {
  return (
    <View style={[styles.summaryCard, summaryCardTone(tone)]}>
      <Text style={[styles.summaryValue, summaryValueTone(tone)]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function TabChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.tabChip, active && styles.tabChipActive]} onPress={onPress}>
      <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: string }) {
  const palette = statusBadgeTone(String(status || "").toLowerCase());
  return (
    <View style={[styles.statusBadge, { borderColor: palette.borderColor, backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.statusBadgeText, { color: palette.color }]}>
        {capitalize(String(status || "draft").toLowerCase())}
      </Text>
    </View>
  );
}

function ReportCard({ report }: { report: StudentReport }) {
  return (
    <SectionCard
      title={report.student?.name || "Approved Result"}
      hint={`${report.exam?.class_name || "-"} / ${report.exam?.section_name || "-"}`}
    >
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>Exam: {report.exam?.name || "-"}</Text>
        <Text style={styles.infoText}>Total: {report.summary?.total ?? 0}</Text>
        <Text style={styles.infoText}>Max Total: {report.summary?.max_total ?? 0}</Text>
        <Text style={styles.infoText}>Percentage: {formatPercent(report.summary?.percentage)}</Text>
      </View>

      {(report.subjects || []).map((row) => (
        <View key={row.subject} style={styles.subjectRow}>
          <View>
            <Text style={styles.studentName}>{row.subject}</Text>
          </View>
          <View style={styles.subjectMarks}>
            <Text style={styles.subjectMarksValue}>{row.marks}</Text>
            <Text style={styles.mutedText}>/ {row.max_marks}</Text>
          </View>
        </View>
      ))}
    </SectionCard>
  );
}

export default function ReportsTab() {
  const { theme } = useAppTheme();
  currentTheme = theme;
  styles = useMemo(() => createStyles(theme), [theme]);
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions || [];
  const isAdmin = permissions.includes("marks.approve");
  const canEnterMarks = permissions.includes("marks.enter");
  const canUseEntryFlow = canEnterMarks || isAdmin;
  const canViewExamCatalog = permissions.includes("exams.view");
  const selfViewOnly = !isAdmin && !canEnterMarks;

  const tabs = useMemo(() => {
    if (selfViewOnly) {
      return [{ key: "results" as ReportsTabKey, label: "Results" }];
    }
    if (isAdmin) {
      return [
        { key: "review" as ReportsTabKey, label: "Review" },
        { key: "entry" as ReportsTabKey, label: "Entry" },
        { key: "published" as ReportsTabKey, label: "Published" },
      ];
    }
    return [
      { key: "entry" as ReportsTabKey, label: "Entry" },
      { key: "published" as ReportsTabKey, label: "Published" },
    ];
  }, [isAdmin, selfViewOnly]);

  const [activeTab, setActiveTab] = useState<ReportsTabKey>(tabs[0]?.key || "entry");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gridLoading, setGridLoading] = useState(false);
  const [selfLoading, setSelfLoading] = useState(false);
  const [examMetaLoading, setExamMetaLoading] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string; tone: NoticeTone } | null>(null);

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [exams, setExams] = useState<Array<{ id: number; name: string }>>([]);
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>([]);
  const [examScopes, setExamScopes] = useState<AccessibleExamScope[]>([]);
  const [myStudents, setMyStudents] = useState<LinkedStudent[]>([]);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selfFilters, setSelfFilters] = useState(EMPTY_SELF_FILTERS);
  const [grid, setGrid] = useState<MarksGridData | null>(null);
  const [selfReport, setSelfReport] = useState<StudentReport | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [editedMarks, setEditedMarks] = useState<Record<number, string>>({});
  const [editMode, setEditMode] = useState(false);
  const [pendingQueue, setPendingQueue] = useState<PendingApprovalQueue>({ total_pending: 0, groups: [] });
  const [approvalSummary, setApprovalSummary] = useState<MarksApprovalSummary>({ pending: 0, draft: 0, approved: 0 });
  const [reviewQueueSnapshot, setReviewQueueSnapshot] = useState<PendingApprovalQueue | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const rowOffsetsRef = useRef<Record<number, number>>({});

  const scopedClassIds = useMemo(
    () => [...new Set((examScopes || []).map((item) => String(item.class_id)))],
    [examScopes],
  );

  const availableClasses = useMemo(() => {
    if (!filters.exam_id) return classes;
    return classes.filter((item) => scopedClassIds.includes(String(item.id)));
  }, [classes, filters.exam_id, scopedClassIds]);

  const selectedClass = useMemo(
    () => availableClasses.find((item) => String(item.id) === String(filters.class_id)) || null,
    [availableClasses, filters.class_id],
  );

  const availableSections = useMemo(() => {
    if (!selectedClass) return [];
    const sections = selectedClass.sections || [];
    if (!filters.exam_id) return sections;

    const allowedSectionIds = new Set(
      (examScopes || [])
        .filter((item) => String(item.class_id) === String(selectedClass.id))
        .map((item) => String(item.section_id)),
    );
    return sections.filter((item) => allowedSectionIds.has(String(item.id)));
  }, [selectedClass, filters.exam_id, examScopes]);
  const selectedSection = useMemo(
    () => availableSections.find((item) => String(item.id) === String(filters.section_id)) || null,
    [availableSections, filters.section_id],
  );
  const displayedPendingQueue = editMode && reviewQueueSnapshot ? reviewQueueSnapshot : pendingQueue;
  const pendingReviewMeta = displayedPendingQueue.groups?.[0] || null;

  const mediums = useMemo(() => uniqueMediums(availableSections), [availableSections]);
  const examOptions = useMemo(
    () => exams.map((exam) => ({ label: exam.name, value: String(exam.id) })),
    [exams],
  );
  const classOptions = useMemo(
    () => {
      const rows =
        isAdmin &&
        activeTab === "review" &&
        pendingReviewMeta &&
        !availableClasses.some((item) => String(item.id) === String(filters.class_id))
          ? [
              ...availableClasses,
              {
                id: pendingReviewMeta.class_id,
                name: pendingReviewMeta.class_name,
                class_scope: undefined,
                sections: [],
              },
            ]
          : availableClasses;

      return uniqueById(rows).map((item) => ({
        label: item.name,
        value: String(item.id),
        description: formatScope(item.class_scope),
      }));
    },
    [activeTab, availableClasses, filters.class_id, isAdmin, pendingReviewMeta],
  );
  const sectionOptions = useMemo(
    () => {
      const rows =
        isAdmin &&
        activeTab === "review" &&
        pendingReviewMeta &&
        !availableSections.some((item) => String(item.id) === String(filters.section_id))
          ? [
              ...availableSections,
              {
                id: pendingReviewMeta.section_id,
                name: pendingReviewMeta.section_name,
                medium: pendingReviewMeta.medium || undefined,
              },
            ]
          : availableSections;

      return uniqueById(rows).map((item) => ({
        label: item.name,
        value: String(item.id),
        description: item.medium ? String(item.medium) : undefined,
      }));
    },
    [activeTab, availableSections, filters.section_id, isAdmin, pendingReviewMeta],
  );
  const myStudentOptions = useMemo(
    () =>
      myStudents.map((student) => ({
        label: student.name,
        value: String(student.id),
        description: student.class_name ? `${student.class_name} / ${student.section_name}` : "Linked student",
      })),
    [myStudents],
  );

  const filteredSubjects = useMemo(() => {
    if (!examSubjects.length) return subjects;
    return subjects.filter((subject) =>
      examSubjects.some((item) => String(item.subject_id) === String(subject.id)),
    );
  }, [examSubjects, subjects]);
  const subjectOptions = useMemo(
    () => filteredSubjects.map((subject) => ({ label: subject.name, value: String(subject.id) })),
    [filteredSubjects],
  );
  const selectedSubject = useMemo(
    () => filteredSubjects.find((item) => String(item.id) === String(filters.subject_id)) || null,
    [filteredSubjects, filters.subject_id],
  );

  const gridStatusCounts = useMemo(() => {
    return (grid?.rows || []).reduce(
      (acc, row) => {
        const status = String(row.approval_status || "draft");
        acc.total += 1;
        if (status === "draft") acc.draft += 1;
        if (status === "pending") acc.pending += 1;
        if (status === "approved") acc.approved += 1;
        return acc;
      },
      { total: 0, draft: 0, pending: 0, approved: 0 },
    );
  }, [grid]);

  const allSelected = Boolean(grid?.rows?.length) && selectedStudentIds.length === (grid?.rows?.length || 0);

  useEffect(() => {
    setActiveTab(tabs[0]?.key || "entry");
  }, [selfViewOnly, isAdmin]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (editMode) {
      setReviewQueueSnapshot({
        total_pending: pendingQueue.total_pending || 0,
        groups: Array.isArray(pendingQueue.groups) ? [...pendingQueue.groups] : [],
      });
      return;
    }
    setReviewQueueSnapshot(null);
  }, [editMode, pendingQueue]);

  useEffect(() => {
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!filters.exam_id) {
      setExamSubjects([]);
      setExamScopes([]);
      setExamMetaLoading(false);
      setFilters((prev) => ({ ...prev, subject_id: "" }));
      return;
    }

    let ignore = false;
    (async () => {
      if (!ignore) setExamMetaLoading(true);
      try {
        const examLoader = canViewExamCatalog ? getExamById : getAccessibleExamById;
        const exam = await examLoader(filters.exam_id);
        if (ignore) return;
        setExamSubjects(
          Array.isArray(exam?.subjects)
            ? exam.subjects.map((subject) => ({
                ...subject,
                pass_marks: subject.pass_marks ?? undefined,
                subject_name: subject.subject_name ?? undefined,
              }))
            : [],
        );
        setExamScopes(Array.isArray(exam?.scopes) ? (exam.scopes as AccessibleExamScope[]) : []);
      } catch (err: unknown) {
        if (ignore) return;
        setExamSubjects([]);
        setExamScopes([]);
        setError("Exam load failed", getErrorMessage(err, "Failed to load exam subjects."));
      } finally {
        if (!ignore) {
          setExamMetaLoading(false);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [filters.exam_id, canViewExamCatalog]);

  useEffect(() => {
    if (!filters.exam_id) return;
    if (examMetaLoading) return;

    if (filters.class_id && !availableClasses.some((item) => String(item.id) === String(filters.class_id))) {
      setFilters((prev) => ({ ...prev, class_id: "", section_id: "", medium: "" }));
      return;
    }

    if (filters.section_id && !availableSections.some((item) => String(item.id) === String(filters.section_id))) {
      setFilters((prev) => ({ ...prev, section_id: "", medium: "" }));
    }
  }, [filters.exam_id, filters.class_id, filters.section_id, availableClasses, availableSections, examMetaLoading]);

  useEffect(() => {
    if (loading || selfViewOnly || !grid) return;
    if (editMode || gridLoading) return;

    const nextStatus =
      activeTab === "review" ? "pending" : activeTab === "published" ? "approved" : "";
    const currentStatus = String(filters.approval_status || "");
    const activeStatus = currentStatus || nextStatus;
    const gridHasRows = Array.isArray(grid?.rows) && grid.rows.length > 0;

    const scopeMismatch =
      String(grid.exam_id || "") !== String(filters.exam_id || "") ||
      String(grid.class_id || "") !== String(filters.class_id || "") ||
      String(grid.section_id || "") !== String(filters.section_id || "") ||
      String(grid.subject?.id || "") !== String(filters.subject_id || "");

    const statusMismatch =
      gridHasRows &&
      Boolean(activeStatus) &&
      grid.rows.some((row) => String(row.approval_status || "") !== activeStatus);

    const hasStaleGridState =
      gridHasRows ||
      Boolean(grid?.exam_id || grid?.class_id || grid?.section_id || grid?.subject?.id);

    if (
      hasStaleGridState &&
      (scopeMismatch ||
        statusMismatch ||
        !filters.exam_id ||
        !filters.class_id ||
        !filters.section_id ||
        !filters.subject_id)
    ) {
      resetGridState({
        exam_id: Number(filters.exam_id || 0),
        class_id: Number(filters.class_id || 0),
        section_id: Number(filters.section_id || 0),
        subject: {
          id: Number(filters.subject_id || 0),
          name: selectedSubject?.name || "Subject",
          max_marks: 0,
          pass_marks: 0,
        },
        rows: [],
      });
    }
  }, [
    activeTab,
    loading,
    selfViewOnly,
    editMode,
    gridLoading,
    grid,
    filters.exam_id,
    filters.class_id,
    filters.section_id,
    filters.subject_id,
    filters.approval_status,
    selectedSubject,
  ]);

  useEffect(() => {
    if (loading || selfViewOnly) return;
    if (!filters.exam_id || !filters.class_id || !filters.section_id || !filters.subject_id) return;
    if (isAdmin && activeTab === "review" && editMode) return;
    handleLoadGrid();
  }, [
    activeTab,
    loading,
    selfViewOnly,
    isAdmin,
    editMode,
    filters.exam_id,
    filters.class_id,
    filters.section_id,
    filters.subject_id,
    filters.medium,
    filters.name,
    filters.approval_status,
  ]);

  useEffect(() => {
    if (!isAdmin || loading || activeTab !== "review") return;
    if (editMode) return;
    const nextScope = pendingQueue.groups?.[0];
    if (!nextScope) return;

    const needsScopeUpdate =
      String(filters.exam_id || "") !== String(nextScope.exam_id) ||
      String(filters.class_id || "") !== String(nextScope.class_id) ||
      String(filters.section_id || "") !== String(nextScope.section_id) ||
      String(filters.subject_id || "") !== String(nextScope.subject_id) ||
      String(filters.approval_status || "") !== "pending";

    if (needsScopeUpdate) {
      setFilters((prev) => ({
        ...prev,
        exam_id: String(nextScope.exam_id),
        class_id: String(nextScope.class_id),
        section_id: String(nextScope.section_id),
        medium: nextScope.medium || "",
        subject_id: String(nextScope.subject_id),
        approval_status: "pending",
      }));
    }
  }, [activeTab, pendingQueue, loading, isAdmin, filters.exam_id, filters.class_id, filters.section_id, filters.subject_id, filters.approval_status, editMode]);

  async function loadBootstrap() {
    setLoading(true);
    try {
      const examLoader = canViewExamCatalog ? getExams : getAccessibleExams;
      const [classRows, subjectRows, examRows] = await Promise.all([
        getClassStructure(),
        getSubjects(),
        examLoader(),
      ]);
      const pendingRes = isAdmin ? await getPendingApprovalQueue() : null;
      const summaryRes = isAdmin ? await getMarksApprovalSummary() : null;

      setClasses(classRows as ClassItem[]);
      setSubjects(subjectRows.map((subject) => ({ id: Number(subject.id), name: subject.name })));
      setExams((examRows || []).map((exam) => ({ id: Number(exam.id), name: exam.name })));
      if (isAdmin) {
        setPendingQueue(pendingRes || { total_pending: 0, groups: [] });
        setApprovalSummary(summaryRes || { pending: 0, draft: 0, approved: 0 });
      }

      if (selfViewOnly) {
        const rows = await getMyStudents();
        setMyStudents(rows);
        if (rows.length === 1) {
          setSelfFilters((prev) => ({ ...prev, student_id: String(rows[0].id) }));
        }
      }
    } catch (err: unknown) {
      setError("Reports unavailable", getErrorMessage(err, "Failed to load report filters."));
    } finally {
      setLoading(false);
    }
  }

  async function refreshCurrentTab() {
    setRefreshing(true);
    try {
      await loadBootstrap();
      if (selfViewOnly) {
        if (selfFilters.exam_id) await handleLoadSelfResults();
      } else if (filters.exam_id && filters.class_id && filters.section_id && filters.subject_id) {
        await handleLoadGrid();
      }
    } finally {
      setRefreshing(false);
    }
  }

  function setSuccess(title: string, message: string) {
    setNotice({ title, message, tone: "success" });
  }

  function setError(title: string, message: string) {
    setNotice({ title, message, tone: "error" });
  }

  function resetGridState(nextGrid: MarksGridData) {
    setGrid(nextGrid);
    setSelectedStudentIds([]);
    const draft: Record<number, string> = {};
    (nextGrid.rows || []).forEach((row) => {
      draft[Number(row.student_id)] =
        row.marks !== null && row.marks !== undefined ? String(row.marks) : "";
    });
    setEditedMarks(draft);
    setEditMode(false);
  }

  function syncTabFilter(tab: ReportsTabKey) {
    setFilters((prev) => ({
      ...prev,
      approval_status: tab === "review" ? "pending" : tab === "published" ? "approved" : "",
    }));
  }

  async function handleLoadGrid() {
    if (!filters.exam_id || !filters.class_id || !filters.section_id || !filters.subject_id) {
      setError("Validation", "Exam, class, section, and subject are required.");
      return;
    }

    setGridLoading(true);
    try {
      const data = await getMarksGrid(filters);
      resetGridState(data);
      setNotice(null);
    } catch (err: unknown) {
      resetGridState({
        exam_id: Number(filters.exam_id || 0),
        class_id: Number(filters.class_id || 0),
        section_id: Number(filters.section_id || 0),
        subject: {
          id: Number(filters.subject_id || 0),
          name: selectedSubject?.name || "Subject",
          max_marks: 0,
          pass_marks: 0,
        },
        rows: [],
      });
      setError("Load failed", getErrorMessage(err, "Failed to load marks grid."));
    } finally {
      setGridLoading(false);
    }
  }

  function toggleRow(studentId: number) {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId],
    );
  }

  function toggleAllRows() {
    if (!grid?.rows?.length) {
      setSelectedStudentIds([]);
      return;
    }

    setSelectedStudentIds((prev) =>
      prev.length === grid.rows.length ? [] : grid.rows.map((row) => Number(row.student_id)),
    );
  }

  function updateMarksValue(studentId: number, value: string) {
    setEditedMarks((prev) => ({ ...prev, [studentId]: value }));
  }

  function registerRowOffset(studentId: number, y: number) {
    rowOffsetsRef.current[studentId] = y;
  }

  function focusMarksInput(studentId: number) {
    const y = rowOffsetsRef.current[studentId];
    if (typeof y !== "number") return;

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(y - 24, 0),
        animated: true,
      });
    });
  }

  function buildMutationPayload(extra: Record<string, unknown> = {}) {
    return {
      exam_id: filters.exam_id || grid?.exam_id || "",
      class_id: filters.class_id || grid?.class_id || "",
      section_id: filters.section_id || grid?.section_id || "",
      medium: filters.medium || undefined,
      subject_id: filters.subject_id || grid?.subject?.id || "",
      ...extra,
    };
  }

  async function handleSaveMarks() {
    if (!grid?.rows?.length) {
      setError("Validation", "Load a marks grid first.");
      return;
    }

    const marks = grid.rows
      .map((row) => ({
        student_id: row.student_id,
        marks: editedMarks[Number(row.student_id)],
      }))
      .filter((row) => row.marks !== "" && row.marks !== undefined);

    if (!marks.length) {
      setError("Validation", "Enter at least one mark to save.");
      return;
    }

    setGridLoading(true);
    try {
      await saveMarks({
        ...buildMutationPayload(),
        marks,
      });
      await handleLoadGrid();
      setEditMode(false);
      setSuccess("Saved", "Marks saved.");
    } catch (err: unknown) {
      setError("Save failed", getErrorMessage(err, "Failed to save marks."));
      setGridLoading(false);
    }
  }

  async function handleSubmitMarks(applyAll: boolean) {
    setGridLoading(true);
    try {
      await submitMarksForApproval(
        buildMutationPayload(applyAll ? { apply_all: true } : { student_ids: selectedStudentIds }),
      );
      await handleLoadGrid();
      setSuccess(
        "Submitted",
        applyAll ? "All draft marks submitted." : "Selected draft marks submitted.",
      );
    } catch (err: unknown) {
      setError("Submit failed", getErrorMessage(err, "Failed to submit marks."));
      setGridLoading(false);
    }
  }

  async function handleApprove(applyAll: boolean) {
    setGridLoading(true);
    try {
      await approveMarks(
        buildMutationPayload(applyAll ? { apply_all: true } : { student_ids: selectedStudentIds }),
      );
      if (isAdmin) {
        const queue = await getPendingApprovalQueue();
        setPendingQueue(queue);
        const summary = await getMarksApprovalSummary();
        setApprovalSummary(summary);
      }
      await handleLoadGrid();
      setSuccess(
        "Approved",
        applyAll ? "All pending marks approved." : "Selected marks approved.",
      );
    } catch (err: unknown) {
      setError("Approve failed", getErrorMessage(err, "Failed to approve marks."));
      setGridLoading(false);
    }
  }

  async function handleReject() {
    setGridLoading(true);
    try {
      await rejectMarks(buildMutationPayload({ student_ids: selectedStudentIds }));
      if (isAdmin) {
        const queue = await getPendingApprovalQueue();
        setPendingQueue(queue);
        const summary = await getMarksApprovalSummary();
        setApprovalSummary(summary);
      }
      await handleLoadGrid();
      setSuccess("Rejected", "Selected marks moved back to draft.");
    } catch (err: unknown) {
      setError("Reject failed", getErrorMessage(err, "Failed to reject marks."));
      setGridLoading(false);
    }
  }

  async function handleDownloadStudent(studentId: number) {
    try {
      await downloadStudentMarksheet(filters.exam_id, studentId);
    } catch (err: unknown) {
      Alert.alert("Download failed", getErrorMessage(err, "Failed to download marksheet."));
    }
  }

  async function handleLoadSelfResults() {
    if (!selfFilters.exam_id) {
      setError("Validation", "Select an exam first.");
      return;
    }

    setSelfLoading(true);
    try {
      const data = await getMyResults(selfFilters);
      setSelfReport(data);
      setNotice(null);
    } catch (err: unknown) {
      setSelfReport(null);
      setError("Load failed", getErrorMessage(err, "Failed to load approved results."));
    } finally {
      setSelfLoading(false);
    }
  }

  async function handleDownloadMyResult() {
    try {
      await downloadMyMarksheet(selfFilters);
    } catch (err: unknown) {
      Alert.alert("Download failed", getErrorMessage(err, "Failed to download marksheet."));
    }
  }

  function renderTabRow() {
    if (tabs.length <= 1) return null;
    return (
      <View style={styles.tabsRow}>
        {tabs.map((tab) => (
          <TabChip
            key={tab.key}
            label={tab.label}
            active={activeTab === tab.key}
            onPress={() => {
              setActiveTab(tab.key);
              syncTabFilter(tab.key);
            }}
          />
        ))}
      </View>
    );
  }

  function renderAdminSummary() {
    if (!isAdmin) return null;
    return (
      <View style={styles.summaryGrid}>
        <SummaryCard label="Pending Approval" value={approvalSummary.pending} tone="amber" />
        <SummaryCard label="Draft Entries" value={approvalSummary.draft} tone="violet" />
        <SummaryCard label="Approved Records" value={approvalSummary.approved} tone="green" />
      </View>
    );
  }

  function renderFilterPanel() {
    return (
      <SectionCard title="Filters" hint="Choose scope and load a grid">
        <SelectField
          label="Exam"
          placeholder="Select exam"
          value={filters.exam_id}
          options={examOptions}
          onChange={(value) =>
            setFilters((prev) => ({
              ...prev,
              exam_id: value,
              class_id: "",
              section_id: "",
              medium: "",
              subject_id: "",
            }))
          }
          allowClear
          clearLabel="Clear exam"
        />

        <SelectField
          label="Class"
          placeholder="Select class"
          value={filters.class_id}
          options={classOptions}
          onChange={(value) =>
            setFilters((prev) => ({
              ...prev,
              class_id: value,
              section_id: "",
              medium: "",
            }))
          }
          allowClear
          clearLabel="Clear class"
        />

        <SelectField
          label="Section"
          placeholder="Select section"
          value={filters.section_id}
          options={sectionOptions}
          onChange={(value) => setFilters((prev) => ({ ...prev, section_id: value }))}
          allowClear
          clearLabel="Clear section"
          disabled={!filters.class_id}
        />

        <SelectField
          label="Subject"
          placeholder="Select subject"
          value={filters.subject_id}
          options={subjectOptions}
          onChange={(value) => setFilters((prev) => ({ ...prev, subject_id: value }))}
          allowClear
          clearLabel="Clear subject"
          disabled={!filters.exam_id}
        />

        {mediums.length ? (
          <>
            <Text style={styles.inputLabel}>Medium</Text>
            <View style={styles.filterWrap}>
              <FilterChip
                label="All Mediums"
                active={!filters.medium}
                onPress={() => setFilters((prev) => ({ ...prev, medium: "" }))}
              />
              {mediums.map((medium) => (
                <FilterChip
                  key={String(medium)}
                  label={String(medium)}
                  active={filters.medium === medium}
                  onPress={() => setFilters((prev) => ({ ...prev, medium: String(medium) }))}
                />
              ))}
            </View>
          </>
        ) : null}

        {isAdmin ? (
          <>
            <Text style={styles.inputLabel}>Status</Text>
            <View style={styles.filterWrap}>
              <FilterChip
                label="All"
                active={!filters.approval_status}
                onPress={() => setFilters((prev) => ({ ...prev, approval_status: "" }))}
              />
              {["draft", "pending", "approved"].map((status) => (
                <FilterChip
                  key={status}
                  label={capitalize(status)}
                  active={filters.approval_status === status}
                  onPress={() => setFilters((prev) => ({ ...prev, approval_status: status }))}
                />
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.inputLabel}>Student Search</Text>
        <TextInput
          style={styles.input}
          placeholder="Search student name"
          placeholderTextColor={theme.mutedText}
          value={filters.name}
          onChangeText={(value) => setFilters((prev) => ({ ...prev, name: value }))}
        />

        <View style={styles.actionRow}>
          <Pressable style={styles.primaryBtn} onPress={handleLoadGrid} disabled={gridLoading}>
            <Text style={styles.primaryBtnText}>{gridLoading ? "Loading..." : "Load Students"}</Text>
          </Pressable>
        </View>
      </SectionCard>
    );
  }

  function renderGridPanel() {
    const isPendingMode = activeTab === "review";
    const isPublishedMode = activeTab === "published";
    const canEditMarks = isPendingMode ? editMode : !isPublishedMode && canUseEntryFlow;
    const canSelectRows = !isPublishedMode;
    const showEntryActions = canUseEntryFlow && !isPendingMode && !isPublishedMode;
    const showAdminEditActions = isAdmin && isPendingMode;
    const showAdminApprovalActions = isAdmin && isPendingMode;
    const emptyMessage = isPendingMode
      ? "Load a pending approval grid to review submitted marks."
      : isPublishedMode
        ? "Load approved records to download marksheets."
        : "Select the filters above and load a marks grid.";

    return (
      <SectionCard
        title={grid?.subject?.name || "Marks Grid"}
        hint={`${grid?.rows?.length || 0} students`}
      >
        <View style={styles.summaryGrid}>
          <SummaryCard label="Students" value={gridStatusCounts.total} />
          <SummaryCard label="Selected" value={selectedStudentIds.length} />
          <SummaryCard label="Pending" value={gridStatusCounts.pending} tone="amber" />
          <SummaryCard label="Approved" value={gridStatusCounts.approved} tone="green" />
        </View>

        <View style={styles.actionWrap}>
          {grid?.rows?.length ? (
            <Pressable
              style={[styles.secondaryBtn, { backgroundColor: theme.card, borderColor: theme.border }, !canSelectRows && styles.disabledBtn]}
              onPress={toggleAllRows}
              disabled={!canSelectRows}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>{allSelected ? "Clear Selection" : "Select All"}</Text>
            </Pressable>
          ) : null}

          {showEntryActions ? (
            <>
              <Pressable style={[styles.successBtn, { backgroundColor: theme.success }]} onPress={handleSaveMarks} disabled={gridLoading || !grid?.rows?.length}>
                <Text style={styles.successBtnText}>Save</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => handleSubmitMarks(false)}
                disabled={gridLoading || !selectedStudentIds.length}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Submit Selected</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => handleSubmitMarks(true)}
                disabled={gridLoading || !grid?.rows?.length}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Submit All</Text>
              </Pressable>
            </>
          ) : null}

          {showAdminEditActions ? (
            <>
              <Pressable
                style={[styles.secondaryBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => setEditMode((prev) => !prev)}
                disabled={!grid?.rows?.length}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>{editMode ? "Cancel Edit" : "Edit"}</Text>
              </Pressable>
              {editMode ? (
                <Pressable style={[styles.successBtn, { backgroundColor: theme.success }]} onPress={handleSaveMarks} disabled={gridLoading || !grid?.rows?.length}>
                  <Text style={styles.successBtnText}>Save Changes</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {showAdminApprovalActions ? (
            <>
              <Pressable
                style={[styles.successBtn, { backgroundColor: theme.success }]}
                onPress={() => handleApprove(false)}
                disabled={gridLoading || !selectedStudentIds.length}
              >
                <Text style={styles.successBtnText}>Approve Selected</Text>
              </Pressable>
              {isPendingMode ? (
                <>
                  <Pressable
                    style={[styles.successBtn, { backgroundColor: theme.success }]}
                    onPress={() => handleApprove(true)}
                    disabled={gridLoading || !grid?.rows?.length}
                  >
                    <Text style={styles.successBtnText}>Approve All</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.deleteBtn, { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder }]}
                    onPress={handleReject}
                    disabled={gridLoading || !selectedStudentIds.length}
                  >
                    <Text style={[styles.deleteBtnText, { color: theme.danger }]}>Reject</Text>
                  </Pressable>
                </>
              ) : null}
            </>
          ) : null}
        </View>

        {gridLoading ? <ActivityIndicator size="large" color={theme.primary} /> : null}

        {grid?.rows?.length ? (
          grid.rows.map((row) => (
            <Pressable
              key={row.student_id}
              style={[
                styles.studentCard,
                { backgroundColor: theme.cardMuted, borderColor: theme.border },
                canSelectRows &&
                  selectedStudentIds.includes(Number(row.student_id)) &&
                  [styles.studentCardSelected, { borderColor: theme.primary, backgroundColor: theme.isDark ? "#1e293b" : "#eef2ff" }],
              ]}
              onLayout={(event) => registerRowOffset(Number(row.student_id), event.nativeEvent.layout.y)}
              onPress={() => toggleRow(Number(row.student_id))}
              disabled={!canSelectRows}
            >
              <View style={styles.rowBetween}>
                <View style={styles.studentMeta}>
                  <View style={styles.studentHeaderRow}>
                    <Text style={[styles.studentName, { color: theme.text }]}>{row.student_name}</Text>
                    {canSelectRows ? (
                      <View
                        style={[
                          styles.selectionDot,
                          { backgroundColor: theme.border },
                          selectedStudentIds.includes(Number(row.student_id)) && [styles.selectionDotActive, { backgroundColor: theme.primary }],
                        ]}
                      />
                    ) : null}
                  </View>
                  <View style={styles.metaWrap}>
                    <View style={[styles.metaPill, { borderColor: theme.border, backgroundColor: theme.card }]}>
                      <Text style={[styles.metaPillText, { color: theme.subText }]}>Roll {row.roll_number || "-"}</Text>
                    </View>
                    <View style={[styles.metaPill, { borderColor: theme.border, backgroundColor: theme.card }]}>
                      <Text style={[styles.metaPillText, { color: theme.subText }]}>
                        {selectedClass?.name || "-"} / {selectedSection?.name || "-"}
                        {selectedSection?.medium ? ` (${selectedSection.medium})` : row.medium ? ` (${row.medium})` : ""}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.subjectMeta, { color: theme.subText }]}>Subject: {selectedSubject?.name || grid?.subject?.name || "-"}</Text>
                </View>
                <StatusBadge status={row.approval_status} />
              </View>

              <View style={styles.cardFooterRow}>
                <View style={styles.marksBox}>
                  <Text style={[styles.compactLabel, { color: theme.subText }]}>Marks</Text>
                  {canEditMarks && row.approval_status !== "approved" ? (
                    <TextInput
                      style={[styles.input, styles.marksInput, styles.compactInput]}
                      keyboardType="numeric"
                      value={editedMarks[Number(row.student_id)] ?? ""}
                      onChangeText={(value) => updateMarksValue(Number(row.student_id), value)}
                      onFocus={() => focusMarksInput(Number(row.student_id))}
                      placeholder={`0-${grid.subject.max_marks}`}
                      placeholderTextColor={theme.mutedText}
                    />
                  ) : (
                    <Text style={[styles.marksValue, { color: theme.text }]}>{row.marks ?? "-"}</Text>
                  )}
                </View>

                {isAdmin ? (
                  <Pressable
                    style={[styles.smallSecondaryBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                    disabled={row.approval_status !== "approved"}
                    onPress={() => handleDownloadStudent(Number(row.student_id))}
                  >
                    <Text style={[styles.smallSecondaryBtnText, { color: theme.text }]}>Download</Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: theme.subText }]}>{emptyMessage}</Text>
        )}
      </SectionCard>
    );
  }

  function renderSelfView() {
    return (
      <>
        <SectionCard title="Approved Results" hint="Parents and students">
          <SelectField
            label="Exam"
            placeholder="Select exam"
            value={selfFilters.exam_id}
            options={examOptions}
            onChange={(value) => setSelfFilters((prev) => ({ ...prev, exam_id: value }))}
          />

          {myStudents.length > 1 ? (
            <>
              <SelectField
                label="Student"
                placeholder="Select student"
                value={selfFilters.student_id}
                options={myStudentOptions}
                onChange={(value) => setSelfFilters((prev) => ({ ...prev, student_id: value }))}
              />
            </>
          ) : (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Student</Text>
              <Text style={styles.infoText}>{myStudents[0]?.name || "Linked student will appear here"}</Text>
            </View>
          )}

          <View style={styles.actionRow}>
            <Pressable style={styles.primaryBtn} onPress={handleLoadSelfResults} disabled={selfLoading}>
              <Text style={styles.primaryBtnText}>{selfLoading ? "Loading..." : "View Results"}</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={handleDownloadMyResult} disabled={!selfReport}>
              <Text style={styles.secondaryBtnText}>Download Marksheet</Text>
            </Pressable>
          </View>
        </SectionCard>

        {selfReport ? <ReportCard report={selfReport} /> : null}
      </>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TopNotice notice={notice} style={styles.topNoticeOverlay} />
      <ScrollView
        ref={scrollRef}
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshCurrentTab} />}
      >
        <View style={styles.innerContent}>
          <View style={styles.heroCard}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>Overview</Text>
              <Text style={styles.title}>Reports</Text>
              <Text style={styles.subtitle}>
                {selfViewOnly
                  ? "View approved marks and download marksheets."
                  : isAdmin
                    ? "Review, update, approve, and publish marks."
                    : "Load marks grids, save draft marks, and submit them for approval."}
              </Text>
            </View>
          </View>

          {renderTabRow()}

          {selfViewOnly ? (
            renderSelfView()
          ) : (
            <>
              {renderAdminSummary()}
              {renderFilterPanel()}
              {renderGridPanel()}
            </>
          )}
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
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 120 },
  innerContent: { gap: 14 },
  topNoticeOverlay: {
    position: "absolute",
    top: 10,
    left: 14,
    right: 14,
    zIndex: 20,
    elevation: 20,
  },
  centered: {
    flex: 1,
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    borderRadius: 24,
    paddingVertical: 2,
  },
  heroCopy: { gap: 6 },
  heroEyebrow: {
    color: theme.subText,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    color: theme.text,
    fontWeight: "800",
    fontSize: 22,
  },
  subtitle: {
    color: theme.subText,
    lineHeight: 20,
  },
  noticeCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeTitle: {
    color: theme.text,
    fontWeight: "800",
    marginBottom: 2,
  },
  noticeMessage: {
    color: theme.subText,
  },
  tabsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tabChip: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.card,
  },
  tabChipActive: {
    borderColor: theme.isDark ? "#cbd5e1" : theme.primary,
    backgroundColor: theme.isDark ? "#e2e8f0" : theme.primary,
  },
  tabChipText: {
    color: theme.subText,
    fontWeight: "700",
    fontSize: 12,
  },
  tabChipTextActive: {
    color: theme.isDark ? "#0f172a" : "#ffffff",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryCard: {
    width: "48%",
    minHeight: 84,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "space-between",
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  summaryLabel: {
    color: theme.subText,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionCard: {
    backgroundColor: theme.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    gap: 12,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    color: theme.text,
    fontWeight: "800",
    fontSize: 16,
  },
  sectionHint: {
    color: theme.subText,
    fontSize: 12,
    fontWeight: "600",
  },
  inputLabel: {
    color: theme.text,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: theme.inputBg,
    color: theme.text,
  },
  filterWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.cardMuted,
  },
  filterChipActive: {
    borderColor: theme.isDark ? "#cbd5e1" : theme.primary,
    backgroundColor: theme.isDark ? "#e2e8f0" : theme.primary,
  },
  filterChipText: {
    color: theme.subText,
    fontWeight: "700",
    fontSize: 12,
  },
  filterChipTextActive: {
    color: theme.isDark ? "#0f172a" : "#ffffff",
  },
  scopeCard: {
    minWidth: 132,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.card,
    gap: 4,
  },
  scopeCardActive: {
    borderColor: theme.isDark ? "#cbd5e1" : theme.primary,
    backgroundColor: theme.isDark ? "#e2e8f0" : theme.primary,
  },
  scopeCardTitle: {
    color: theme.text,
    fontWeight: "700",
  },
  scopeCardTitleActive: {
    color: theme.isDark ? "#0f172a" : "#ffffff",
  },
  scopeCardMeta: {
    color: theme.subText,
    fontSize: 12,
    fontWeight: "600",
  },
  scopeCardMetaActive: {
    color: theme.isDark ? "#334155" : "rgba(255,255,255,0.72)",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: theme.primary,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: theme.primaryText,
    fontWeight: "700",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledBtn: {
    opacity: 0.5,
  },
  secondaryBtnText: {
    color: theme.text,
    fontWeight: "700",
  },
  successBtn: {
    backgroundColor: theme.success,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  successBtnText: {
    color: theme.successText,
    fontWeight: "700",
  },
  deleteBtn: {
    backgroundColor: theme.dangerSoft,
    borderWidth: 1,
    borderColor: theme.dangerBorder,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    color: theme.danger,
    fontWeight: "700",
  },
  studentCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    padding: 10,
    gap: 8,
  },
  studentCardSelected: {
    borderColor: "#0f172a",
    backgroundColor: "#eef2ff",
  },
  studentMeta: {
    flex: 1,
    gap: 4,
  },
  studentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectionDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
  },
  selectionDotActive: {
    backgroundColor: "#0f172a",
  },
  studentName: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 14,
    flex: 1,
  },
  mutedText: {
    color: "#64748b",
    fontSize: 12,
  },
  metaWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  metaPill: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaPillText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
  },
  subjectMeta: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 10,
  },
  marksBox: {
    flex: 1,
    gap: 4,
  },
  compactLabel: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 11,
  },
  marksInput: {
    maxWidth: 96,
  },
  compactInput: {
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  marksValue: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
  },
  smallSecondaryBtn: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 84,
  },
  smallSecondaryBtnText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
  },
  emptyText: {
    color: "#64748b",
  },
  infoCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#f8fafc",
    gap: 4,
  },
  infoTitle: {
    color: "#0f172a",
    fontWeight: "800",
  },
  infoText: {
    color: "#475569",
    lineHeight: 18,
  },
  subjectRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  subjectMarks: {
    alignItems: "flex-end",
    gap: 2,
  },
  subjectMarksValue: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 18,
  },
});
}

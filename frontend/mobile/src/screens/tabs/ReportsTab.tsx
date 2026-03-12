import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getClassStructure } from "../../services/classesService";
import { getExams, getExamById } from "../../services/examsService";
import { getSubjects } from "../../services/subjectsService";
import {
  approveMarks,
  downloadMyMarksheet,
  downloadStudentMarksheet,
  getMarksGrid,
  getMyResults,
  getMyStudents,
  rejectMarks,
  saveMarks,
  submitMarksForApproval,
  type LinkedStudent,
  type MarksGridData,
  type StudentReport,
} from "../../services/reportsService";
import { useAuthStore } from "../../store/authStore";

type ClassItem = {
  id: number;
  name: string;
  sections: Array<{ id: number; name: string; medium?: string | null }>;
};

type SubjectItem = {
  id: number;
  name: string;
};

type ExamSubject = {
  subject_id: number;
  subject_name?: string;
};

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

export default function ReportsTab() {
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions || [];
  const isAdmin = permissions.includes("marks.approve");
  const canEnterMarks = permissions.includes("marks.enter");
  const selfViewOnly = !isAdmin && !canEnterMarks;

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [exams, setExams] = useState<Array<{ id: number; name: string }>>([]);
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>([]);
  const [myStudents, setMyStudents] = useState<LinkedStudent[]>([]);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selfFilters, setSelfFilters] = useState(EMPTY_SELF_FILTERS);

  const [grid, setGrid] = useState<MarksGridData | null>(null);
  const [selfReport, setSelfReport] = useState<StudentReport | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [editedMarks, setEditedMarks] = useState<Record<number, string>>({});
  const [editMode, setEditMode] = useState(false);

  const [loading, setLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(false);
  const [selfLoading, setSelfLoading] = useState(false);

  const selectedClass = useMemo(
    () => classes.find((item) => String(item.id) === String(filters.class_id)) || null,
    [classes, filters.class_id]
  );
  const sections = selectedClass?.sections || [];
  const mediums = [...new Set(sections.map((item) => item.medium).filter(Boolean))];
  const filteredSubjects = examSubjects.length
    ? subjects.filter((subject) =>
        examSubjects.some((item) => String(item.subject_id) === String(subject.id))
      )
    : subjects;

  useEffect(() => {
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!filters.exam_id) {
      setExamSubjects([]);
      setFilters((prev) => ({ ...prev, subject_id: "" }));
      return;
    }

    let ignore = false;
    (async () => {
      try {
        const res = await getExamById(filters.exam_id);
        if (!ignore) {
          setExamSubjects(Array.isArray(res?.subjects) ? (res.subjects as ExamSubject[]) : []);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setExamSubjects([]);
          Alert.alert("Exam load failed", getErrorMessage(err, "Failed to load exam subjects."));
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [filters.exam_id]);

  async function loadBootstrap() {
    setLoading(true);
    try {
      const [classRows, subjectRows, examRows] = await Promise.all([
        getClassStructure(),
        getSubjects(),
        getExams(),
      ]);

      setClasses(classRows as ClassItem[]);
      setSubjects(subjectRows.map((subject) => ({ id: Number(subject.id), name: subject.name })));
      setExams(examRows.map((exam) => ({ id: Number(exam.id), name: exam.name })));

      if (selfViewOnly) {
        const rows = await getMyStudents();
        setMyStudents(rows);
        if (rows.length === 1) {
          setSelfFilters((prev) => ({ ...prev, student_id: String(rows[0].id) }));
        }
      }
    } catch (err: unknown) {
      Alert.alert("Reports unavailable", getErrorMessage(err, "Failed to load report filters."));
    } finally {
      setLoading(false);
    }
  }

  function resetGridState(nextGrid: MarksGridData) {
    setGrid(nextGrid);
    setSelectedStudentIds([]);
    const draft: Record<number, string> = {};
    (nextGrid.rows || []).forEach((row) => {
      draft[Number(row.student_id)] = row.marks !== null && row.marks !== undefined ? String(row.marks) : "";
    });
    setEditedMarks(draft);
    setEditMode(false);
  }

  async function handleLoadGrid() {
    if (!filters.exam_id || !filters.class_id || !filters.section_id || !filters.subject_id) {
      Alert.alert("Validation", "Exam, class, section, and subject are required.");
      return;
    }

    setGridLoading(true);
    try {
      const data = await getMarksGrid(filters);
      resetGridState(data);
    } catch (err: unknown) {
      Alert.alert("Load failed", getErrorMessage(err, "Failed to load marks grid."));
    } finally {
      setGridLoading(false);
    }
  }

  function toggleRow(studentId: number) {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  }

  function toggleAllRows() {
    if (!grid?.rows?.length) {
      setSelectedStudentIds([]);
      return;
    }

    setSelectedStudentIds((prev) =>
      prev.length === grid.rows.length ? [] : grid.rows.map((row) => Number(row.student_id))
    );
  }

  function updateMarksValue(studentId: number, value: string) {
    setEditedMarks((prev) => ({ ...prev, [studentId]: value }));
  }

  function buildMutationPayload(extra: Record<string, unknown> = {}) {
    return {
      exam_id: filters.exam_id,
      class_id: filters.class_id,
      section_id: filters.section_id,
      medium: filters.medium || undefined,
      subject_id: filters.subject_id,
      ...extra,
    };
  }

  async function handleSaveMarks() {
    if (!grid?.rows?.length) {
      Alert.alert("Validation", "Load a marks grid first.");
      return;
    }

    const marks = grid.rows
      .map((row) => ({
        student_id: row.student_id,
        marks: editedMarks[Number(row.student_id)],
      }))
      .filter((row) => row.marks !== "" && row.marks !== undefined);

    if (!marks.length) {
      Alert.alert("Validation", "Enter at least one mark to save.");
      return;
    }

    setGridLoading(true);
    try {
      await saveMarks(buildMutationPayload({ marks }) as never);
      await handleLoadGrid();
      Alert.alert("Saved", "Marks saved as draft.");
    } catch (err: unknown) {
      Alert.alert("Save failed", getErrorMessage(err, "Failed to save marks."));
      setGridLoading(false);
    }
  }

  async function handleSubmitMarks(applyAll: boolean) {
    setGridLoading(true);
    try {
      await submitMarksForApproval(
        buildMutationPayload(applyAll ? { apply_all: true } : { student_ids: selectedStudentIds })
      );
      await handleLoadGrid();
      Alert.alert("Submitted", applyAll ? "All draft marks submitted." : "Selected draft marks submitted.");
    } catch (err: unknown) {
      Alert.alert("Submit failed", getErrorMessage(err, "Failed to submit marks."));
      setGridLoading(false);
    }
  }

  async function handleApprove(applyAll: boolean) {
    setGridLoading(true);
    try {
      await approveMarks(
        buildMutationPayload(applyAll ? { apply_all: true } : { student_ids: selectedStudentIds })
      );
      await handleLoadGrid();
      Alert.alert("Approved", applyAll ? "All pending marks approved." : "Selected marks approved.");
    } catch (err: unknown) {
      Alert.alert("Approve failed", getErrorMessage(err, "Failed to approve marks."));
      setGridLoading(false);
    }
  }

  async function handleReject() {
    setGridLoading(true);
    try {
      await rejectMarks(buildMutationPayload({ student_ids: selectedStudentIds }));
      await handleLoadGrid();
      Alert.alert("Rejected", "Selected marks moved back to draft.");
    } catch (err: unknown) {
      Alert.alert("Reject failed", getErrorMessage(err, "Failed to reject marks."));
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
      Alert.alert("Validation", "Select an exam first.");
      return;
    }

    setSelfLoading(true);
    try {
      const data = await getMyResults(selfFilters);
      setSelfReport(data);
    } catch (err: unknown) {
      setSelfReport(null);
      Alert.alert("Load failed", getErrorMessage(err, "Failed to load approved results."));
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

  const allSelected = Boolean(grid?.rows?.length) && selectedStudentIds.length === grid?.rows?.length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f172a" />
      </View>
    );
  }

  return selfViewOnly ? (
    <ScrollView contentContainerStyle={styles.root}>
      <View style={styles.heroCard}>
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.subtitle}>View approved marks and download marksheets</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Result Filters</Text>
        <ChipGroup
          label="Exam"
          options={exams.map((exam) => ({ label: exam.name, value: String(exam.id) }))}
          value={selfFilters.exam_id}
          onChange={(value) => setSelfFilters((prev) => ({ ...prev, exam_id: value }))}
        />

        {myStudents.length > 1 ? (
          <ChipGroup
            label="Student"
            options={myStudents.map((student) => ({
              label: `${student.name}${student.class_name ? ` (${student.class_name} - ${student.section_name})` : ""}`,
              value: String(student.id),
            }))}
            value={selfFilters.student_id}
            onChange={(value) => setSelfFilters((prev) => ({ ...prev, student_id: value }))}
          />
        ) : (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Student</Text>
            <Text style={styles.infoValue}>{myStudents[0]?.name || "Linked student will appear here"}</Text>
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
      </View>

      {selfReport ? <ReportCard report={selfReport} /> : null}
    </ScrollView>
  ) : (
    <ScrollView contentContainerStyle={styles.root}>
      <View style={styles.heroCard}>
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.subtitle}>
          {isAdmin ? "Review, edit, approve, and export marks" : "Save draft marks and submit them for approval"}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Filters</Text>
        <ChipGroup
          label="Exam"
          options={exams.map((exam) => ({ label: exam.name, value: String(exam.id) }))}
          value={filters.exam_id}
          onChange={(value) => setFilters((prev) => ({ ...prev, exam_id: value, subject_id: "" }))}
        />
        <ChipGroup
          label="Class"
          options={classes.map((item) => ({ label: item.name, value: String(item.id) }))}
          value={filters.class_id}
          onChange={(value) =>
            setFilters((prev) => ({ ...prev, class_id: value, section_id: "", medium: "" }))
          }
        />
        <ChipGroup
          label="Section"
          options={sections.map((item) => ({ label: item.name, value: String(item.id) }))}
          value={filters.section_id}
          onChange={(value) => setFilters((prev) => ({ ...prev, section_id: value }))}
        />
        <ChipGroup
          label="Medium"
          options={mediums.map((medium) => ({ label: String(medium), value: String(medium) }))}
          value={filters.medium}
          onChange={(value) => setFilters((prev) => ({ ...prev, medium: value }))}
          includeAll
          allLabel="All Mediums"
        />
        <ChipGroup
          label="Subject"
          options={filteredSubjects.map((subject) => ({ label: subject.name, value: String(subject.id) }))}
          value={filters.subject_id}
          onChange={(value) => setFilters((prev) => ({ ...prev, subject_id: value }))}
        />

        {isAdmin ? (
          <ChipGroup
            label="Status"
            options={[
              { label: "Draft", value: "draft" },
              { label: "Pending", value: "pending" },
              { label: "Approved", value: "approved" },
            ]}
            value={filters.approval_status}
            onChange={(value) => setFilters((prev) => ({ ...prev, approval_status: value }))}
            includeAll
            allLabel="All Statuses"
          />
        ) : null}

        <Text style={styles.inputLabel}>Student Search</Text>
        <TextInput
          style={styles.input}
          placeholder="Search name"
          value={filters.name}
          onChangeText={(value) => setFilters((prev) => ({ ...prev, name: value }))}
        />

        <Pressable style={styles.primaryBtn} onPress={handleLoadGrid} disabled={gridLoading}>
          <Text style={styles.primaryBtnText}>{gridLoading ? "Loading..." : "Load Students"}</Text>
        </Pressable>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard label="Students" value={grid?.rows?.length || 0} />
        <SummaryCard label="Selected" value={selectedStudentIds.length} />
        <SummaryCard label="Subject" value={grid?.subject?.name || "-"} />
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>{grid?.subject?.name || "Marks Grid"}</Text>
            <Text style={styles.muted}>
              {grid?.rows?.length || 0} student{grid?.rows?.length === 1 ? "" : "s"} loaded
            </Text>
          </View>
          {grid?.rows?.length ? (
            <Pressable style={styles.secondaryBtn} onPress={toggleAllRows}>
              <Text style={styles.secondaryBtnText}>{allSelected ? "Clear Selection" : "Select All"}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.actionWrap}>
          {canEnterMarks ? (
            <>
              <Pressable style={styles.primaryBtn} onPress={handleSaveMarks} disabled={gridLoading || !grid?.rows?.length}>
                <Text style={styles.primaryBtnText}>Save</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => handleSubmitMarks(false)}
                disabled={gridLoading || !selectedStudentIds.length}
              >
                <Text style={styles.secondaryBtnText}>Submit Selected</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => handleSubmitMarks(true)}
                disabled={gridLoading || !grid?.rows?.length}
              >
                <Text style={styles.secondaryBtnText}>Submit All</Text>
              </Pressable>
            </>
          ) : null}

          {isAdmin ? (
            <>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setEditMode((prev) => !prev)}
                disabled={!grid?.rows?.length}
              >
                <Text style={styles.secondaryBtnText}>{editMode ? "Cancel Edit" : "Edit"}</Text>
              </Pressable>
              {editMode ? (
                <Pressable style={styles.primaryBtn} onPress={handleSaveMarks} disabled={gridLoading || !grid?.rows?.length}>
                  <Text style={styles.primaryBtnText}>Save Changes</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.primaryBtn}
                onPress={() => handleApprove(false)}
                disabled={gridLoading || !selectedStudentIds.length}
              >
                <Text style={styles.primaryBtnText}>Approve Selected</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => handleApprove(true)}
                disabled={gridLoading || !grid?.rows?.length}
              >
                <Text style={styles.primaryBtnText}>Approve All</Text>
              </Pressable>
              <Pressable
                style={styles.deleteBtn}
                onPress={handleReject}
                disabled={gridLoading || !selectedStudentIds.length}
              >
                <Text style={styles.deleteBtnText}>Reject</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {grid?.rows?.length ? (
          grid.rows.map((row) => {
            const selected = selectedStudentIds.includes(Number(row.student_id));
            return (
              <Pressable
                key={row.student_id}
                style={[styles.studentCard, selected && styles.studentCardSelected]}
                onPress={() => toggleRow(Number(row.student_id))}
              >
                <View style={styles.studentHeader}>
                  <View>
                    <Text style={styles.studentName}>{row.student_name}</Text>
                    <Text style={styles.muted}>Roll: {row.roll_number || "-"}</Text>
                    {row.medium ? <Text style={styles.muted}>{row.medium}</Text> : null}
                  </View>
                  <StatusBadge status={row.approval_status} />
                </View>

                <View style={styles.marksRow}>
                  <View style={styles.marksBox}>
                    <Text style={styles.inputLabel}>Marks</Text>
                    {canEnterMarks || editMode ? (
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={editedMarks[Number(row.student_id)] ?? ""}
                        onChangeText={(value) => updateMarksValue(Number(row.student_id), value)}
                        placeholder={`0-${grid.subject.max_marks}`}
                      />
                    ) : (
                      <Text style={styles.marksValue}>{row.marks ?? "-"}</Text>
                    )}
                  </View>

                  {isAdmin ? (
                    <Pressable
                      style={styles.secondaryBtn}
                      disabled={row.approval_status !== "approved"}
                      onPress={() => handleDownloadStudent(Number(row.student_id))}
                    >
                      <Text style={styles.secondaryBtnText}>Download</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        ) : (
          <Text style={styles.muted}>Select the filters above and load a marks grid.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
  includeAll = false,
  allLabel = "All",
}: {
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
  allLabel?: string;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.inputLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipWrap}>
        {includeAll ? (
          <Pressable style={[styles.chip, !value && styles.chipActive]} onPress={() => onChange("")}>
            <Text style={[styles.chipText, !value && styles.chipTextActive]}>{allLabel}</Text>
          </Pressable>
        ) : null}
        {options.map((option) => {
          const active = value === option.value;
          return (
            <Pressable
              key={`${label}-${option.value}`}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(option.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = String(status || "").trim().toLowerCase();
  const palette =
    normalized === "approved"
      ? { bg: "#dcfce7", border: "#86efac", text: "#166534" }
      : normalized === "pending"
        ? { bg: "#fef3c7", border: "#fde68a", text: "#92400e" }
        : { bg: "#f8fafc", border: "#cbd5e1", text: "#475569" };

  return (
    <View style={[styles.statusBadge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.statusBadgeText, { color: palette.text }]}>{normalized || "-"}</Text>
    </View>
  );
}

function ReportCard({ report }: { report: StudentReport }) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>{report.student?.name || "-"}</Text>
          <Text style={styles.muted}>
            {report.exam?.name || "-"} | {report.exam?.class_name || "-"} / {report.exam?.section_name || "-"}
          </Text>
        </View>
        <View>
          <Text style={styles.metric}>Total: {report.summary?.total ?? 0}</Text>
          <Text style={styles.metric}>Percentage: {report.summary?.percentage ?? 0}%</Text>
        </View>
      </View>

      {(report.subjects || []).map((row) => (
        <View key={row.subject} style={styles.reportRow}>
          <Text style={styles.studentName}>{row.subject}</Text>
          <Text style={styles.muted}>
            Marks: {row.marks} | Max: {row.max_marks} | Pass: {row.pass_marks ?? "-"}
          </Text>
        </View>
      ))}
    </View>
  );
}

function getErrorMessage(err: unknown, fallback: string) {
  if (
    typeof err === "object" &&
    err &&
    "response" in err &&
    typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message ===
      "string"
  ) {
    return (err as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
    paddingBottom: 24,
  },
  centered: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  title: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 18,
  },
  subtitle: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
  muted: {
    color: "#64748b",
    fontSize: 12,
  },
  metric: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
    textAlign: "right",
  },
  group: {
    gap: 8,
  },
  inputLabel: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#ffffff",
  },
  chipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#e2e8f0",
  },
  chipText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
  },
  chipTextActive: {
    color: "#0f172a",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "#334155",
    fontWeight: "600",
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    color: "#b91c1c",
    fontWeight: "700",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryCard: {
    minWidth: 100,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryValue: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16,
  },
  summaryLabel: {
    marginTop: 4,
    color: "#64748b",
    fontWeight: "600",
    fontSize: 12,
  },
  studentCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 10,
  },
  studentCardSelected: {
    borderColor: "#0f172a",
    backgroundColor: "#eef2ff",
  },
  studentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  studentName: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 14,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  marksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 10,
  },
  marksBox: {
    flex: 1,
    gap: 6,
  },
  marksValue: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "800",
  },
  reportRow: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 10,
  },
  infoCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 4,
  },
  infoLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  infoValue: {
    color: "#0f172a",
    fontWeight: "700",
  },
});

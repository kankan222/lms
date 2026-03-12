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
import {
  ClassStructureItem,
  ClassStructureSection,
  getClassStructure,
} from "../../services/classesService";
import { getStudents, Student } from "../../services/studentsService";
import {
  getAllTeacherAttendance,
  StudentAttendanceStatus,
  takeStudentAttendance,
  TeacherAttendanceItem,
} from "../../services/attendanceService";

type AttendanceMode = "teachers" | "students";

type StudentItem = {
  id: number;
  name: string;
  class?: string;
  section?: string;
  roll_number?: string | number;
  medium?: string | null;
  class_scope?: "school" | "hs";
};

const STATUS_OPTIONS: StudentAttendanceStatus[] = ["present", "absent", "late"];

export default function AttendanceTab() {
  const [mode, setMode] = useState<AttendanceMode>("teachers");

  const [teacherRows, setTeacherRows] = useState<TeacherAttendanceItem[]>([]);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");

  const [classes, setClasses] = useState<ClassStructureItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(getTodayDate());
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [studentStatuses, setStudentStatuses] = useState<Record<number, StudentAttendanceStatus>>({});
  const [studentLoading, setStudentLoading] = useState(false);
  const [savingStudentAttendance, setSavingStudentAttendance] = useState(false);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  const filteredTeacherRows = useMemo(() => {
    const query = teacherSearch.trim().toLowerCase();
    if (!query) return teacherRows;
    return teacherRows.filter((item) => item.teacher.toLowerCase().includes(query));
  }, [teacherRows, teacherSearch]);

  const teacherSummary = useMemo(() => {
    return filteredTeacherRows.reduce(
      (acc, row) => {
        acc.total += 1;
        if (String(row.status).toLowerCase() === "present") acc.present += 1;
        if (String(row.status).toLowerCase() === "absent") acc.absent += 1;
        return acc;
      },
      { total: 0, present: 0, absent: 0 },
    );
  }, [filteredTeacherRows]);

  const studentSummary = useMemo(() => {
    return students.reduce(
      (acc, student) => {
        const status = studentStatuses[student.id] ?? "present";
        acc.total += 1;
        if (status === "present") acc.present += 1;
        if (status === "absent") acc.absent += 1;
        if (status === "late") acc.late += 1;
        return acc;
      },
      { total: 0, present: 0, absent: 0, late: 0 },
    );
  }, [studentStatuses, students]);

  useEffect(() => {
    loadTeacherAttendance();
    loadClassStructure();
  }, []);

  async function loadTeacherAttendance() {
    setTeacherLoading(true);
    try {
      const rows = await getAllTeacherAttendance({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setTeacherRows(rows);
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err, "Could not load teacher attendance."));
      setTeacherRows([]);
    } finally {
      setTeacherLoading(false);
    }
  }

  async function loadClassStructure() {
    try {
      const rows = await getClassStructure();
      setClasses(rows);
    } catch {
      setClasses([]);
    }
  }

  async function loadStudentsForSection(classId: number, sectionId: number) {
    setStudentLoading(true);
    try {
      const rows = await getStudents({ class_id: String(classId), section_id: String(sectionId) });
      const normalized = rows
        .map((row: Student) => ({
          id: Number(row.id),
          name: row.name,
          class: row.class,
          section: row.section,
          roll_number: row.roll_number,
          medium: row.medium ?? null,
          class_scope: row.class_scope,
        }))
        .sort((a, b) => String(a.roll_number ?? "").localeCompare(String(b.roll_number ?? ""), undefined, { numeric: true }));
      setStudents(normalized);
      const defaults: Record<number, StudentAttendanceStatus> = {};
      normalized.forEach((student) => {
        defaults[student.id] = "present";
      });
      setStudentStatuses(defaults);
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err, "Could not load students for attendance."));
      setStudents([]);
      setStudentStatuses({});
    } finally {
      setStudentLoading(false);
    }
  }

  function handleClassSelect(classId: number) {
    setSelectedClassId(classId);
    setSelectedSectionId(null);
    setStudents([]);
    setStudentStatuses({});
  }

  async function handleSectionSelect(sectionId: number) {
    if (!selectedClassId) return;
    setSelectedSectionId(sectionId);
    await loadStudentsForSection(selectedClassId, sectionId);
  }

  async function submitStudentAttendance() {
    if (!selectedClassId || !selectedSectionId) {
      Alert.alert("Validation", "Select class and section.");
      return;
    }
    if (!attendanceDate) {
      Alert.alert("Validation", "Attendance date is required.");
      return;
    }
    if (students.length === 0) {
      Alert.alert("Validation", "No students found for selected class and section.");
      return;
    }

    setSavingStudentAttendance(true);
    try {
      await takeStudentAttendance({
        classId: selectedClassId,
        sectionId: selectedSectionId,
        date: attendanceDate,
        deviceSource: "mobile",
        attendance: students.map((student) => ({
          studentId: student.id,
          status: studentStatuses[student.id] ?? "absent",
        })),
      });
      Alert.alert("Attendance saved", "Student attendance saved successfully.");
    } catch (err: unknown) {
      Alert.alert("Attendance failed", getErrorMessage(err, "Could not save attendance."));
    } finally {
      setSavingStudentAttendance(false);
    }
  }

  function resetTeacherFilters() {
    setStartDate("");
    setEndDate("");
    setTeacherSearch("");
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>Attendance</Text>
        <Text style={styles.subtitle}>Teacher records and student attendance entry</Text>
        <View style={styles.modeSwitch}>
          <Pressable
            style={[styles.modeBtn, mode === "teachers" && styles.modeBtnActive]}
            onPress={() => setMode("teachers")}
          >
            <Text style={[styles.modeBtnText, mode === "teachers" && styles.modeBtnTextActive]}>
              Teachers
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === "students" && styles.modeBtnActive]}
            onPress={() => setMode("students")}
          >
            <Text style={[styles.modeBtnText, mode === "students" && styles.modeBtnTextActive]}>
              Students
            </Text>
          </Pressable>
        </View>
      </View>

      {mode === "teachers" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Teacher Attendance</Text>
          <View style={styles.filterCard}>
            <TextInput
              style={styles.input}
              value={teacherSearch}
              onChangeText={setTeacherSearch}
              placeholder="Search teacher name"
            />
            <View style={styles.filterRow}>
              <TextInput
                style={[styles.input, styles.filterInput]}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="Start YYYY-MM-DD"
              />
              <TextInput
                style={[styles.input, styles.filterInput]}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="End YYYY-MM-DD"
              />
            </View>
            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryBtn} onPress={resetTeacherFilters}>
                <Text style={styles.secondaryBtnText}>Reset</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={loadTeacherAttendance}>
                <Text style={styles.primaryBtnText}>Apply Filters</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <SummaryCard label="Records" value={teacherSummary.total} />
            <SummaryCard label="Present" value={teacherSummary.present} tone="green" />
            <SummaryCard label="Absent" value={teacherSummary.absent} tone="red" />
          </View>

          {teacherLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#0f172a" />
            </View>
          ) : (
            <ScrollView style={styles.listWrap} contentContainerStyle={styles.listContent}>
              {filteredTeacherRows.length ? (
                filteredTeacherRows.map((row) => (
                  <View key={row.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>{row.teacher}</Text>
                      <StatusBadge status={String(row.status)} />
                    </View>
                    <Text style={styles.meta}>Date: {row.attendance_date}</Text>
                    <Text style={styles.meta}>Check In: {row.check_in || "-"}</Text>
                    <Text style={styles.meta}>Check Out: {row.check_out || "-"}</Text>
                    <Text style={styles.meta}>Worked Hours: {row.worked_hours || "-"}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No attendance records found.</Text>
              )}
            </ScrollView>
          )}
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Take Student Attendance</Text>
          <View style={styles.filterCard}>
            <Text style={styles.inputLabel}>Attendance Date</Text>
            <TextInput
              style={styles.input}
              value={attendanceDate}
              onChangeText={setAttendanceDate}
              placeholder="YYYY-MM-DD"
            />
          </View>

          <Text style={styles.inputLabel}>Class *</Text>
          <View style={styles.chipWrap}>
            {classes.map((item) => {
              const active = selectedClassId === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={[styles.classChip, active && styles.classChipActive]}
                  onPress={() => handleClassSelect(item.id)}
                >
                  <Text style={[styles.classChipTitle, active && styles.chipTextActive]}>{item.name}</Text>
                  <Text style={[styles.classChipMeta, active && styles.classChipMetaActive]}>
                    {formatScope(item.class_scope)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.inputLabel, styles.spaceTop]}>Section *</Text>
          <View style={styles.chipWrap}>
            {(selectedClass?.sections ?? []).map((section) => {
              const active = selectedSectionId === section.id;
              return (
                <Pressable
                  key={section.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => handleSectionSelect(section.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {sectionLabel(section)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.summaryGrid}>
            <SummaryCard label="Students" value={studentSummary.total} />
            <SummaryCard label="Present" value={studentSummary.present} tone="green" />
            <SummaryCard label="Absent" value={studentSummary.absent} tone="red" />
            <SummaryCard label="Late" value={studentSummary.late} tone="amber" />
          </View>

          {studentLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#0f172a" />
            </View>
          ) : (
            <ScrollView style={styles.listWrap} contentContainerStyle={styles.listContent}>
              {students.length ? (
                students.map((student) => (
                  <View key={student.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardCopy}>
                        <Text style={styles.cardTitle}>{student.name}</Text>
                        <Text style={styles.meta}>
                          Roll: {student.roll_number || "-"}
                          {student.medium ? ` | ${student.medium}` : ""}
                        </Text>
                      </View>
                      <View style={styles.scopePill}>
                        <Text style={styles.scopePillText}>{formatScope(student.class_scope ?? selectedClass?.class_scope)}</Text>
                      </View>
                    </View>
                    <View style={styles.statusRow}>
                      {STATUS_OPTIONS.map((status) => {
                        const active = (studentStatuses[student.id] ?? "present") === status;
                        return (
                          <Pressable
                            key={`${student.id}-${status}`}
                            style={[
                              styles.statusChip,
                              active && statusChipActiveStyle(status),
                            ]}
                            onPress={() =>
                              setStudentStatuses((prev) => ({ ...prev, [student.id]: status }))
                            }
                          >
                            <Text style={[styles.statusChipText, active && statusChipTextActiveStyle(status)]}>
                              {capitalize(status)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Select class and section to load students.</Text>
              )}
            </ScrollView>
          )}

          <Pressable
            style={[styles.primaryBtn, styles.submitBtn]}
            onPress={submitStudentAttendance}
            disabled={savingStudentAttendance}
          >
            <Text style={styles.primaryBtnText}>
              {savingStudentAttendance ? "Saving..." : "Submit Attendance"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

type SummaryCardProps = {
  label: string;
  value: number;
  tone?: "default" | "green" | "red" | "amber";
};

function SummaryCard({ label, value, tone = "default" }: SummaryCardProps) {
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

function getTodayDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getErrorMessage(err: unknown, fallback: string) {
  if (
    typeof err === "object" &&
    err &&
    "response" in err &&
    typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
  ) {
    return (err as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
  }
  return fallback;
}

function formatScope(scope?: string | null) {
  return scope === "hs" ? "Higher Secondary" : "School";
}

function capitalize(value: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sectionLabel(section: ClassStructureSection) {
  return section.medium ? `${section.name} (${section.medium})` : section.name;
}

function summaryCardTone(tone: SummaryCardProps["tone"]) {
  if (tone === "green") return { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4" };
  if (tone === "red") return { borderColor: "#fecaca", backgroundColor: "#fef2f2" };
  if (tone === "amber") return { borderColor: "#fde68a", backgroundColor: "#fffbeb" };
  return { borderColor: "#e2e8f0", backgroundColor: "#ffffff" };
}

function summaryValueTone(tone: SummaryCardProps["tone"]) {
  if (tone === "green") return { color: "#15803d" };
  if (tone === "red") return { color: "#b91c1c" };
  if (tone === "amber") return { color: "#b45309" };
  return { color: "#0f172a" };
}

function statusBadgeTone(status: string) {
  if (status === "present") return { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4" };
  if (status === "absent") return { borderColor: "#fecaca", backgroundColor: "#fef2f2" };
  return { borderColor: "#fde68a", backgroundColor: "#fffbeb" };
}

function statusBadgeTextTone(status: string) {
  if (status === "present") return { color: "#15803d" };
  if (status === "absent") return { color: "#b91c1c" };
  return { color: "#b45309" };
}

function statusChipActiveStyle(status: StudentAttendanceStatus) {
  if (status === "present") return { borderColor: "#15803d", backgroundColor: "#dcfce7" };
  if (status === "absent") return { borderColor: "#b91c1c", backgroundColor: "#fee2e2" };
  return { borderColor: "#b45309", backgroundColor: "#fef3c7" };
}

function statusChipTextActiveStyle(status: StudentAttendanceStatus) {
  if (status === "present") return { color: "#166534" };
  if (status === "absent") return { color: "#991b1b" };
  return { color: "#92400e" };
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  toolbar: {
    gap: 8,
  },
  title: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 18,
  },
  subtitle: {
    color: "#64748b",
    fontSize: 13,
  },
  modeSwitch: {
    flexDirection: "row",
    gap: 8,
  },
  modeBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
  },
  modeBtnActive: {
    borderColor: "#0f172a",
    backgroundColor: "#e2e8f0",
  },
  modeBtnText: {
    color: "#334155",
    fontWeight: "600",
  },
  modeBtnTextActive: {
    color: "#0f172a",
  },
  section: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 10,
  },
  sectionTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
  filterCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    padding: 10,
    gap: 8,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterInput: {
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  inputLabel: {
    color: "#334155",
    fontWeight: "600",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  chipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#e2e8f0",
  },
  chipText: {
    color: "#334155",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#0f172a",
  },
  classChip: {
    minWidth: 120,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
  },
  classChipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#e2e8f0",
  },
  classChipTitle: {
    color: "#0f172a",
    fontWeight: "700",
  },
  classChipMeta: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  classChipMetaActive: {
    color: "#334155",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryCard: {
    minWidth: 88,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  summaryLabel: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  listWrap: {
    maxHeight: 420,
  },
  listContent: {
    gap: 8,
    paddingBottom: 6,
  },
  centered: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    padding: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  cardCopy: {
    flex: 1,
  },
  cardTitle: {
    color: "#0f172a",
    fontWeight: "700",
  },
  meta: {
    marginTop: 4,
    color: "#475569",
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  statusChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  statusChipText: {
    color: "#334155",
    fontWeight: "600",
  },
  scopePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#eef2ff",
  },
  scopePillText: {
    color: "#4338ca",
    fontSize: 12,
    fontWeight: "700",
  },
  primaryBtn: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  secondaryBtnText: {
    color: "#334155",
    fontWeight: "700",
  },
  submitBtn: {
    marginTop: 4,
  },
  emptyText: {
    color: "#64748b",
  },
  spaceTop: {
    marginTop: 4,
  },
});

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
import { getStudents } from "../../services/studentsService";
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
};

type ClassStructureItem = {
  id: number;
  name: string;
  sections: Array<{ id: number; name: string }>;
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
      setClasses(rows as ClassStructureItem[]);
    } catch {
      setClasses([]);
    }
  }

  async function loadStudentsForSection(classId: number, sectionId: number) {
    setStudentLoading(true);
    try {
      const rows = await getStudents({ class_id: String(classId), section_id: String(sectionId) });
      const normalized = rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        class: row.class,
        section: row.section,
        roll_number: (row as StudentItem).roll_number,
      }));
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
      Alert.alert("Success", "Student attendance saved.");
    } catch (err: unknown) {
      Alert.alert("Attendance failed", getErrorMessage(err, "Could not save attendance."));
    } finally {
      setSavingStudentAttendance(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>Attendance</Text>
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
          <View style={styles.filterRow}>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="Start date YYYY-MM-DD"
            />
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="End date YYYY-MM-DD"
            />
            <Pressable style={styles.primaryBtn} onPress={loadTeacherAttendance}>
              <Text style={styles.primaryBtnText}>Apply</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.input}
            value={teacherSearch}
            onChangeText={setTeacherSearch}
            placeholder="Search teacher name"
          />

          {teacherLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#0f172a" />
            </View>
          ) : (
            <ScrollView style={styles.listWrap} contentContainerStyle={styles.listContent}>
              {filteredTeacherRows.length ? (
                filteredTeacherRows.map((row) => (
                  <View key={row.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{row.teacher}</Text>
                    <Text style={styles.meta}>Date: {row.attendance_date}</Text>
                    <Text style={styles.meta}>Status: {row.status}</Text>
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
          <TextInput
            style={styles.input}
            value={attendanceDate}
            onChangeText={setAttendanceDate}
            placeholder="Attendance date YYYY-MM-DD"
          />

          <Text style={styles.inputLabel}>Class *</Text>
          <View style={styles.chipWrap}>
            {classes.map((item) => {
              const active = selectedClassId === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => handleClassSelect(item.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.name}</Text>
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
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{section.name}</Text>
                </Pressable>
              );
            })}
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
                    <Text style={styles.cardTitle}>{student.name}</Text>
                    <Text style={styles.meta}>
                      {student.class || "-"} {student.section ? `- ${student.section}` : ""}
                    </Text>
                    <View style={styles.statusRow}>
                      {STATUS_OPTIONS.map((status) => {
                        const active = (studentStatuses[student.id] ?? "present") === status;
                        return (
                          <Pressable
                            key={`${student.id}-${status}`}
                            style={[styles.statusChip, active && styles.statusChipActive]}
                            onPress={() =>
                              setStudentStatuses((prev) => ({ ...prev, [student.id]: status }))
                            }
                          >
                            <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                              {status}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>
                  Select class and section to load students.
                </Text>
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
    typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message ===
      "string"
  ) {
    return (err as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
  }
  return fallback;
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  toolbar: {
    gap: 10,
  },
  title: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 18,
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
  filterRow: {
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
  listWrap: {
    maxHeight: 360,
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
  cardTitle: {
    color: "#0f172a",
    fontWeight: "700",
  },
  meta: {
    marginTop: 4,
    color: "#475569",
  },
  statusRow: {
    marginTop: 8,
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
  statusChipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#e2e8f0",
  },
  statusChipText: {
    color: "#334155",
    fontWeight: "600",
    textTransform: "capitalize",
  },
  statusChipTextActive: {
    color: "#0f172a",
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


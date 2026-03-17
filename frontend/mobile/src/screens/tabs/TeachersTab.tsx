import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuthStore } from "../../store/authStore";
import {
  assignTeacher,
  createTeacher,
  deleteTeacher,
  getTeacherAssignments,
  getTeachers,
  removeAssignment,
  TeacherAssignment,
  TeacherItem,
  updateTeacher,
} from "../../services/teachersService";
import { ClassStructureItem, getClassStructure, getSessions, SessionItem } from "../../services/classesService";

type TeacherScope = "school" | "hs";
type ScopeFilter = "all" | TeacherScope;

type CreateTeacherForm = {
  employee_id: string;
  name: string;
  phone: string;
  email: string;
  class_scope: TeacherScope;
  password: string;
};

type EditTeacherForm = {
  id: number | null;
  employee_id: string;
  name: string;
  phone: string;
  email: string;
  class_scope: TeacherScope;
};

type AssignmentForm = {
  class_id: number | null;
  section_id: number | null;
  subject_id: number | null;
  session_id: number | null;
};

const EMPTY_CREATE: CreateTeacherForm = {
  employee_id: "",
  name: "",
  phone: "",
  email: "",
  class_scope: "school",
  password: "",
};

const EMPTY_EDIT: EditTeacherForm = {
  id: null,
  employee_id: "",
  name: "",
  phone: "",
  email: "",
  class_scope: "school",
};

const EMPTY_ASSIGNMENT: AssignmentForm = {
  class_id: null,
  section_id: null,
  subject_id: null,
  session_id: null,
};

export default function TeachersTab() {
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions || [];
  const canManageTeachers = permissions.includes("teacher.update");
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [classStructure, setClassStructure] = useState<ClassStructureItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");

  const [createForm, setCreateForm] = useState<CreateTeacherForm>(EMPTY_CREATE);
  const [editForm, setEditForm] = useState<EditTeacherForm>(EMPTY_EDIT);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>(EMPTY_ASSIGNMENT);

  const [selectedTeacher, setSelectedTeacher] = useState<TeacherItem | null>(null);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const filteredAssignmentClasses = useMemo(() => {
    const scope = (selectedTeacher?.class_scope ?? "school") as TeacherScope;
    return classStructure.filter((item) => matchesScope(item, scope));
  }, [classStructure, selectedTeacher?.class_scope]);


  const filteredTeachers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return teachers.filter((teacher) => {
      const matchesQuery =
        !query ||
        String(teacher.name || "").toLowerCase().includes(query) ||
        String(teacher.employee_id || "").toLowerCase().includes(query) ||
        String(teacher.phone || "").toLowerCase().includes(query) ||
        String(teacher.email || "").toLowerCase().includes(query);

      const matchesScope =
        scopeFilter === "all" || (teacher.class_scope ?? "school") === scopeFilter;

      return matchesQuery && matchesScope;
    });
  }, [scopeFilter, search, teachers]);
  const selfTeacher = !canManageTeachers ? filteredTeachers[0] ?? null : null;
  const selectedClass = useMemo(
    () => filteredAssignmentClasses.find((item) => item.id === assignmentForm.class_id) ?? null,
    [assignmentForm.class_id, filteredAssignmentClasses]
  );

  const activeSession = useMemo(
    () => sessions.find((s) => Number(s.is_active) === 1 || s.is_active === true) ?? null,
    [sessions]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [teacherRows, structureRows, sessionRows] = await Promise.all([
        getTeachers(),
        getClassStructure(),
        getSessions(),
      ]);
      setTeachers(teacherRows.map((teacher) => ({ ...teacher, class_scope: (teacher.class_scope ?? "school") as TeacherScope })));
      setClassStructure(structureRows);
      setSessions(sessionRows);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not load teachers."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeSession && assignmentForm.session_id === null) {
      setAssignmentForm((prev) => ({ ...prev, session_id: activeSession.id }));
    }
  }, [activeSession, assignmentForm.session_id]);

  function validateCreate(data: CreateTeacherForm) {
    if (!data.employee_id.trim()) return "Employee ID required.";
    if (!data.name.trim() || /^\d+$/.test(data.name.trim())) return "Valid teacher name required.";
    if (!/^\d{10}$/.test(data.phone.trim())) return "Phone must be 10 digits.";
    if (!/^\S+@\S+\.\S+$/.test(data.email.trim())) return "Valid email required.";
    if (!["school", "hs"].includes(data.class_scope)) return "Class scope is required.";
    if (!data.password || data.password.length < 6) return "Password must be at least 6 characters.";
    return null;
  }

  function validateEdit(data: EditTeacherForm) {
    if (!data.employee_id.trim()) return "Employee ID required.";
    if (!data.name.trim() || /^\d+$/.test(data.name.trim())) return "Valid teacher name required.";
    if (!/^\d{10}$/.test(data.phone.trim())) return "Phone must be 10 digits.";
    if (!/^\S+@\S+\.\S+$/.test(data.email.trim())) return "Valid email required.";
    if (!["school", "hs"].includes(data.class_scope)) return "Class scope is required.";
    return null;
  }

  async function handleCreate() {
    const validation = validateCreate(createForm);
    if (validation) {
      Alert.alert("Validation", validation);
      return;
    }

    setSaving(true);
    try {
      await createTeacher({
        employee_id: createForm.employee_id.trim(),
        name: createForm.name.trim(),
        phone: createForm.phone.trim(),
        email: createForm.email.trim(),
        class_scope: createForm.class_scope,
        password: createForm.password,
      });
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
      await loadData();
    } catch (err: unknown) {
      Alert.alert("Create failed", getErrorMessage(err, "Could not create teacher."));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(teacher: TeacherItem) {
    setEditForm({
      id: teacher.id,
      employee_id: teacher.employee_id ?? "",
      name: teacher.name ?? "",
      phone: teacher.phone ?? "",
      email: teacher.email ?? "",
      class_scope: (teacher.class_scope ?? "school") as TeacherScope,
    });
    setEditOpen(true);
  }

  async function handleEdit() {
    const validation = validateEdit(editForm);
    if (validation) {
      Alert.alert("Validation", validation);
      return;
    }
    if (!editForm.id) return;

    setSaving(true);
    try {
      await updateTeacher(editForm.id, {
        employee_id: editForm.employee_id.trim(),
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        class_scope: editForm.class_scope,
      });
      setEditOpen(false);
      setEditForm(EMPTY_EDIT);
      await loadData();
    } catch (err: unknown) {
      Alert.alert("Update failed", getErrorMessage(err, "Could not update teacher."));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(id: number) {
    Alert.alert("Delete teacher", "Do you want to delete this teacher?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTeacher(id);
            setTeachers((prev) => prev.filter((item) => item.id !== id));
          } catch (err: unknown) {
            Alert.alert("Delete failed", getErrorMessage(err, "Could not delete teacher."));
          }
        },
      },
    ]);
  }

  async function openAssignments(teacher: TeacherItem) {
    setSelectedTeacher(teacher);
    setAssignmentForm({
      ...EMPTY_ASSIGNMENT,
      session_id: activeSession?.id ?? null,
    });
    setAssignmentOpen(true);
    setLoadingAssignments(true);
    try {
      const rows = await getTeacherAssignments(teacher.id);
      setAssignments(rows);
    } catch (err: unknown) {
      setAssignments([]);
      Alert.alert("Load failed", getErrorMessage(err, "Could not load assignments."));
    } finally {
      setLoadingAssignments(false);
    }
  }

  async function submitAssignment() {
    if (!selectedTeacher) return;
    const { class_id, section_id, subject_id, session_id } = assignmentForm;
    if (!class_id || !section_id || !subject_id || !session_id) {
      Alert.alert("Validation", "Class, section, subject and session are required.");
      return;
    }

    setSaving(true);
    try {
      await assignTeacher(selectedTeacher.id, {
        class_id,
        section_id,
        subject_id,
        session_id,
      });
      const rows = await getTeacherAssignments(selectedTeacher.id);
      setAssignments(rows);
      setAssignmentForm((prev) => ({
        ...prev,
        section_id: null,
        subject_id: null,
      }));
    } catch (err: unknown) {
      Alert.alert("Assign failed", getErrorMessage(err, "Could not assign teacher."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAssignment(assignmentId: number) {
    try {
      await removeAssignment(assignmentId);
      setAssignments((prev) => prev.filter((item) => item.id !== assignmentId));
    } catch (err: unknown) {
      Alert.alert("Delete failed", getErrorMessage(err, "Could not remove assignment."));
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <View style={styles.toolbarCopy}>
          <Text style={styles.title}>{canManageTeachers ? "Teachers" : "My Profile"}</Text>
          <Text style={styles.subtitle}>{filteredTeachers.length} of {teachers.length} teachers</Text>
        </View>
        {canManageTeachers ? (
          <Pressable style={styles.primaryBtn} onPress={() => setCreateOpen(true)}>
            <Text style={styles.primaryBtnText}>Add Teacher</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : (
        <>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <View style={styles.filterCard}>
            <FormInput
              label="Search"
              value={search}
              onChangeText={setSearch}
              placeholder="Name, employee ID, phone or email"
              autoCapitalize="none"
            />
            <Text style={styles.inputLabel}>Scope</Text>
            <View style={styles.chipWrap}>
              {(["all", "school", "hs"] as ScopeFilter[]).map((scope) => {
                const active = scopeFilter === scope;
                return (
                  <Pressable
                    key={scope}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setScopeFilter(scope)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {scope === "all" ? "All" : formatScope(scope)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {selfTeacher ? (
            <View style={styles.card}>
              <Text style={styles.teacherName}>{selfTeacher.name}</Text>
              <Text style={styles.meta}>Employee ID: {selfTeacher.employee_id || "-"}</Text>
              <Text style={styles.meta}>Phone: {selfTeacher.phone || "-"}</Text>
              <Text style={styles.meta}>Email: {selfTeacher.email || "-"}</Text>
              <Text style={styles.meta}>Scope: {formatScope(selfTeacher.class_scope)}</Text>
              <View style={styles.rowActions}>
                <Pressable style={styles.secondaryBtn} onPress={() => openAssignments(selfTeacher)}>
                  <Text style={styles.secondaryBtnText}>Assignments</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.grid}>
              {filteredTeachers.map((teacher) => (
                <View key={teacher.id} style={styles.card}>
                  <Text style={styles.teacherName}>{teacher.name}</Text>
                  <Text style={styles.meta}>Employee ID: {teacher.employee_id || "-"}</Text>
                  <Text style={styles.meta}>Phone: {teacher.phone || "-"}</Text>
                  <Text style={styles.meta}>Email: {teacher.email || "-"}</Text>
                  <Text style={styles.meta}>Scope: {formatScope(teacher.class_scope)}</Text>

                  <View style={styles.rowActions}>
                    <Pressable style={styles.secondaryBtn} onPress={() => openAssignments(teacher)}>
                      <Text style={styles.secondaryBtnText}>Assignments</Text>
                    </Pressable>
                    {canManageTeachers ? (
                      <>
                        <Pressable style={styles.secondaryBtn} onPress={() => openEdit(teacher)}>
                          <Text style={styles.secondaryBtnText}>Edit</Text>
                        </Pressable>
                        <Pressable style={styles.deleteBtn} onPress={() => confirmDelete(teacher.id)}>
                          <Text style={styles.deleteBtnText}>Delete</Text>
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                </View>
              ))}
              {!filteredTeachers.length ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No teachers found</Text>
                  <Text style={styles.emptyText}>Adjust the search or scope filter.</Text>
                </View>
              ) : null}
            </View>
          )}
        </>
      )}

      <TeacherFormModal
        visible={createOpen}
        title="Add Teacher"
        submitText="Save"
        saving={saving}
        onClose={() => {
          setCreateOpen(false);
          setCreateForm(EMPTY_CREATE);
        }}
        onSubmit={handleCreate}
      >
        <FormInput
          label="Employee ID *"
          value={createForm.employee_id}
          onChangeText={(value) => setCreateForm((prev) => ({ ...prev, employee_id: value }))}
          placeholder="EMP001"
        />
        <FormInput
          label="Name *"
          value={createForm.name}
          onChangeText={(value) => setCreateForm((prev) => ({ ...prev, name: value }))}
          placeholder="Teacher name"
        />
        <FormInput
          label="Phone *"
          value={createForm.phone}
          onChangeText={(value) => setCreateForm((prev) => ({ ...prev, phone: value }))}
          placeholder="10 digit phone"
          keyboardType="phone-pad"
        />
        <FormInput
          label="Email *"
          value={createForm.email}
          onChangeText={(value) => setCreateForm((prev) => ({ ...prev, email: value }))}
          placeholder="teacher@school.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={styles.inputLabel}>Class Scope *</Text>
        <View style={styles.chipWrap}>
          {(["school", "hs"] as TeacherScope[]).map((scope) => {
            const active = createForm.class_scope === scope;
            return (
              <Pressable
                key={scope}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCreateForm((prev) => ({ ...prev, class_scope: scope }))}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{formatScope(scope)}</Text>
              </Pressable>
            );
          })}
        </View>
        <FormInput
          label="Password *"
          value={createForm.password}
          onChangeText={(value) => setCreateForm((prev) => ({ ...prev, password: value }))}
          placeholder="Minimum 6 chars"
          secureTextEntry
        />
      </TeacherFormModal>

      <TeacherFormModal
        visible={canManageTeachers && editOpen}
        title="Edit Teacher"
        submitText="Update"
        saving={saving}
        onClose={() => {
          setEditOpen(false);
          setEditForm(EMPTY_EDIT);
        }}
        onSubmit={handleEdit}
      >
        <FormInput
          label="Employee ID *"
          value={editForm.employee_id}
          onChangeText={(value) => setEditForm((prev) => ({ ...prev, employee_id: value }))}
          placeholder="EMP001"
        />
        <FormInput
          label="Name *"
          value={editForm.name}
          onChangeText={(value) => setEditForm((prev) => ({ ...prev, name: value }))}
          placeholder="Teacher name"
        />
        <FormInput
          label="Phone *"
          value={editForm.phone}
          onChangeText={(value) => setEditForm((prev) => ({ ...prev, phone: value }))}
          placeholder="10 digit phone"
          keyboardType="phone-pad"
        />
        <FormInput
          label="Email *"
          value={editForm.email}
          onChangeText={(value) => setEditForm((prev) => ({ ...prev, email: value }))}
          placeholder="teacher@school.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={styles.inputLabel}>Class Scope *</Text>
        <View style={styles.chipWrap}>
          {(["school", "hs"] as TeacherScope[]).map((scope) => {
            const active = editForm.class_scope === scope;
            return (
              <Pressable
                key={scope}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setEditForm((prev) => ({ ...prev, class_scope: scope }))}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{formatScope(scope)}</Text>
              </Pressable>
            );
          })}
        </View>
      </TeacherFormModal>

      <Modal visible={assignmentOpen} transparent animationType="slide" onRequestClose={() => setAssignmentOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setAssignmentOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Assignments: {selectedTeacher?.name ?? "Teacher"}
            </Text>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Class *</Text>
              <View style={styles.chipWrap}>
                {filteredAssignmentClasses.map((item) => {
                  const isActive = item.id === assignmentForm.class_id;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.chip, isActive && styles.chipActive]}
                      onPress={() =>
                        setAssignmentForm((prev) => ({
                          ...prev,
                          class_id: item.id,
                          section_id: null,
                          subject_id: null,
                        }))
                      }
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{item.name}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, styles.spaceTop]}>Section *</Text>
              <View style={styles.chipWrap}>
                {(selectedClass?.sections ?? []).map((section) => {
                  const isActive = section.id === assignmentForm.section_id;
                  return (
                    <Pressable
                      key={section.id}
                      style={[styles.chip, isActive && styles.chipActive]}
                      onPress={() =>
                        setAssignmentForm((prev) => ({
                          ...prev,
                          section_id: section.id,
                        }))
                      }
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{section.name}{section.medium ? ` (${section.medium})` : ""}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, styles.spaceTop]}>Subject *</Text>
              <View style={styles.chipWrap}>
                {(selectedClass?.subjects ?? []).map((subject) => {
                  const isActive = subject.id === assignmentForm.subject_id;
                  return (
                    <Pressable
                      key={subject.id}
                      style={[styles.chip, isActive && styles.chipActive]}
                      onPress={() =>
                        setAssignmentForm((prev) => ({
                          ...prev,
                          subject_id: subject.id,
                        }))
                      }
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{subject.name}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, styles.spaceTop]}>Session *</Text>
              <View style={styles.chipWrap}>
                {sessions.map((session) => {
                  const isActive = session.id === assignmentForm.session_id;
                  return (
                    <Pressable
                      key={session.id}
                      style={[styles.chip, isActive && styles.chipActive]}
                      onPress={() =>
                        setAssignmentForm((prev) => ({
                          ...prev,
                          session_id: session.id,
                        }))
                      }
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                        {session.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {canManageTeachers ? (
                <Pressable style={[styles.primaryBtn, styles.spaceTop]} onPress={submitAssignment} disabled={saving}>
                  <Text style={styles.primaryBtnText}>{saving ? "Saving..." : "Assign to Teacher"}</Text>
                </Pressable>
              ) : null}

              <Text style={[styles.inputLabel, styles.spaceTop]}>Current Assignments</Text>
              {loadingAssignments ? (
                <ActivityIndicator size="small" color="#0f172a" />
              ) : assignments.length ? (
                assignments.map((assignment) => (
                  <View key={assignment.id} style={styles.assignmentCard}>
                    <Text style={styles.assignmentText}>
                      {assignment.class} - {assignment.section} - {assignment.subject}
                    </Text>
                    <Text style={styles.assignmentSubText}>Session: {assignment.session}</Text>
                    {canManageTeachers ? (
                      <Pressable onPress={() => deleteAssignment(assignment.id)} style={styles.assignmentDelete}>
                        <Text style={styles.assignmentDeleteText}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No assignments found.</Text>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.secondaryBtn} onPress={() => setAssignmentOpen(false)}>
                <Text style={styles.secondaryBtnText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

type TeacherFormModalProps = {
  visible: boolean;
  title: string;
  submitText: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
};

function TeacherFormModal({
  visible,
  title,
  submitText,
  saving,
  onClose,
  onSubmit,
  children,
}: TeacherFormModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={styles.modalBody}>{children}</ScrollView>
          <View style={styles.modalFooter}>
            <Pressable style={styles.secondaryBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={onSubmit} disabled={saving}>
              <Text style={styles.primaryBtnText}>{saving ? "Saving..." : submitText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type FormInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  secureTextEntry?: boolean;
};

function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  autoCapitalize = "sentences",
  secureTextEntry = false,
}: FormInputProps) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err && "response" in err) {
    const data = (err as { response?: { data?: { message?: string; error?: string } } }).response?.data;
    return data?.error || data?.message || fallback;
  }
  return fallback;
}

function isHsClassName(name: string) {
  const value = String(name || "").trim().toLowerCase();
  if (!value) return false;
  if (value.includes("higher secondary")) return true;
  if (/\bhs\b/.test(value)) return true;
  if (/\b(11|12|xi|xii)\b/.test(value)) return true;
  if (value.includes("1st year") || value.includes("2nd year")) return true;
  return false;
}

function matchesScope(item: ClassStructureItem, scope: TeacherScope) {
  const resolvedScope = item.class_scope ?? (isHsClassName(item.name) ? "hs" : "school");
  const hs = resolvedScope === "hs";
  return scope === "hs" ? hs : !hs;
}

function formatScope(scope: string | null | undefined) {
  return scope === "hs" ? "Higher Secondary" : "School";
}
const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toolbarCopy: {
    flex: 1,
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
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 30,
  },
  errorText: {
    color: "#dc2626",
    fontWeight: "600",
  },
  filterCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  grid: {
    gap: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  teacherName: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
    flex: 1,
  },
  scopeBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scopeBadgeSchool: {
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  scopeBadgeHs: {
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
  },
  scopeBadgeText: {
    fontWeight: "700",
    fontSize: 12,
  },
  scopeBadgeTextSchool: {
    color: "#1d4ed8",
  },
  scopeBadgeTextHs: {
    color: "#b45309",
  },
  meta: {
    marginTop: 4,
    color: "#475569",
  },
  rowActions: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "600",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    color: "#b91c1c",
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
  },
  modalCard: {
    maxHeight: "86%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  modalTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 10,
  },
  modalHint: {
    color: "#64748b",
    marginBottom: 10,
  },
  modalBody: {
    maxHeight: 470,
  },
  fieldBlock: {
    marginBottom: 10,
  },
  inputLabel: {
    color: "#334155",
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
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
    backgroundColor: "#e2e8f0",
    borderColor: "#0f172a",
  },
  chipText: {
    color: "#334155",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#0f172a",
  },
  assignmentCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#f8fafc",
    marginTop: 8,
  },
  assignmentText: {
    color: "#1e293b",
    fontWeight: "600",
  },
  assignmentSubText: {
    marginTop: 2,
    color: "#64748b",
  },
  assignmentDelete: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#fee2e2",
  },
  assignmentDeleteText: {
    color: "#b91c1c",
    fontWeight: "700",
    fontSize: 12,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    padding: 20,
  },
  emptyTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 15,
  },
  emptyText: {
    color: "#64748b",
    marginTop: 8,
  },
  spaceTop: {
    marginTop: 10,
  },
  modalFooter: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
});




























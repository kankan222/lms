import { ReactNode, useEffect, useMemo, useState } from "react";
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
import { getClassStructure, getSessions, type ClassStructureItem } from "../../services/classesService";
import { getExams } from "../../services/examsService";
import {
  bulkUploadStudentsCsv,
  createStudent,
  deleteStudent,
  getStudents,
  updateStudent,
  type Student,
} from "../../services/studentsService";
import StudentDetailsModule from "./students/StudentDetailsModule";

type SessionItem = { id: number; name: string; is_active?: number | boolean };
type StudentScope = "school" | "hs";

type CreateForm = {
  admission_no: string;
  name: string;
  mobile: string;
  gender: string;
  dob: string;
  date_of_admission: string;
  session_id: number | null;
  class_id: number | null;
  section_id: number | null;
  roll_number: string;
  stream: string;
  father_name: string;
  father_mobile: string;
  mother_name: string;
  mother_mobile: string;
};

type EditForm = {
  id: number | null;
  admission_no: string;
  name: string;
  mobile: string;
  gender: string;
  dob: string;
  date_of_admission: string;
  session_id: number | null;
  class_id: number | null;
  section_id: number | null;
  roll_number: string;
  stream: string;
  class_scope: StudentScope;
};

const EMPTY_CREATE: CreateForm = {
  admission_no: "",
  name: "",
  mobile: "",
  gender: "",
  dob: "",
  date_of_admission: "",
  session_id: null,
  class_id: null,
  section_id: null,
  roll_number: "",
  stream: "",
  father_name: "",
  father_mobile: "",
  mother_name: "",
  mother_mobile: "",
};

const EMPTY_EDIT: EditForm = {
  id: null,
  admission_no: "",
  name: "",
  mobile: "",
  gender: "",
  dob: "",
  date_of_admission: "",
  session_id: null,
  class_id: null,
  section_id: null,
  roll_number: "",
  stream: "",
  class_scope: "school",
};

const STREAM_OPTIONS = ["Arts", "Commerce", "Science"] as const;

const BULK_TEMPLATE = [
  "admission_no,name,dob,gender,mobile,date_of_admission,session,class,section,medium,stream,roll_number,father_name,father_mobile,father_email,father_occupation,father_qualification,mother_name,mother_mobile,mother_email,mother_occupation,mother_qualification,photo_url",
  "ADM-2026-001,Rahul Das,2012-05-10,male,9876543210,2026-04-01,2026-2027,Class 8,A,English,,5,Ramesh Das,9876500001,ramesh@example.com,Farmer,Graduate,Sima Das,9876500002,sima@example.com,Homemaker,HS,/uploads/students/sample-school.jpg",
  "ADM-2026-101,Ankita Sharma,2008-07-12,female,9876543222,2026-04-01,2026-2027,HS 1st Year,A1,English,Science,12,Madan Sharma,9876500011,madan@example.com,Business,Graduate,Mina Sharma,9876500012,mina@example.com,Teacher,Graduate,/uploads/students/sample-hs.jpg",
].join("\n");

function formatScope(value?: string | null) {
  const scope = String(value || "").trim().toLowerCase();
  if (scope === "hs") return "Higher Secondary";
  if (scope === "school") return "School";
  return "-";
}

export default function StudentsTab() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassStructureItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const selectedClass = useMemo(() => classes.find((c) => c.id === classId) ?? null, [classes, classId]);
  const classById = useMemo(() => new Map(classes.map((c) => [String(c.id), c])), [classes]);
  const classByName = useMemo(() => new Map(classes.map((c) => [String(c.name || "").toLowerCase(), c])), [classes]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT);
  const [createErrors, setCreateErrors] = useState<Partial<Record<keyof CreateForm, string>>>({});
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof EditForm, string>>>({});
  const [bulkCsv, setBulkCsv] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const [exams, setExams] = useState<Array<{ id: number; name: string }>>([]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const hay = `${s.name || ""} ${s.phone || s.mobile || ""} ${s.class || ""} ${s.section || ""} ${s.roll_number || ""} ${s.stream_name || ""} ${s.class_scope || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [students, search]);

  useEffect(() => {
    (async () => {
      try {
        const [c, s, e] = await Promise.all([getClassStructure(), getSessions(), getExams()]);
        setClasses(c as ClassStructureItem[]);
        setSessions((s || []).map((x) => ({ id: Number(x.id), name: x.name, is_active: x.is_active })));
        setExams((e || []).map((x) => ({ id: Number(x.id), name: x.name })));
      } catch {
        setClasses([]);
        setSessions([]);
        setExams([]);
      }
      await loadStudents();
    })();
  }, []);

  useEffect(() => {
    loadStudents();
  }, [classId, sectionId]);

  async function loadStudents() {
    setLoading(true);
    try {
      const rows = await getStudents({
        class_id: classId ? String(classId) : undefined,
        section_id: sectionId ? String(sectionId) : undefined,
      });
      setStudents(rows);
    } catch (err: unknown) {
      Alert.alert("Error", getErr(err, "Failed to load students."));
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }

  function isDate(value: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
  }

  function validateCreate(form: CreateForm) {
    const errs: Partial<Record<keyof CreateForm, string>> = {};
    if (!form.name.trim()) errs.name = "Student name is required.";
    if (!/^\d{10}$/.test(form.mobile.trim())) errs.mobile = "Student phone must be 10 digits.";
    if (!form.gender.trim()) errs.gender = "Gender is required.";
    if (!isDate(form.dob)) errs.dob = "DOB must be YYYY-MM-DD.";
    if (form.date_of_admission.trim() && !isDate(form.date_of_admission)) errs.date_of_admission = "Admission date must be YYYY-MM-DD.";
    if (!form.session_id) errs.session_id = "Session is required.";
    if (!form.class_id) errs.class_id = "Class is required.";
    if (!form.section_id) errs.section_id = "Section is required.";
    if (!form.roll_number.trim()) errs.roll_number = "Roll number is required.";
    const chosenClass = classes.find((c) => c.id === form.class_id);
    if (chosenClass?.class_scope === "hs" && !form.stream.trim()) errs.stream = "Stream is required for higher secondary classes.";
    if (!form.father_name.trim()) errs.father_name = "Father name is required.";
    if (!/^\d{10}$/.test(form.father_mobile.trim())) errs.father_mobile = "Father phone must be 10 digits.";
    if (!form.mother_name.trim()) errs.mother_name = "Mother name is required.";
    if (!/^\d{10}$/.test(form.mother_mobile.trim())) errs.mother_mobile = "Mother phone must be 10 digits.";
    return errs;
  }

  function validateEdit(form: EditForm) {
    const errs: Partial<Record<keyof EditForm, string>> = {};
    if (!form.name.trim()) errs.name = "Name is required.";
    if (!/^\d{10}$/.test(form.mobile.trim())) errs.mobile = "Phone must be 10 digits.";
    if (!form.gender.trim()) errs.gender = "Gender is required.";
    if (!isDate(form.dob)) errs.dob = "DOB must be YYYY-MM-DD.";
    if (form.date_of_admission.trim() && !isDate(form.date_of_admission)) errs.date_of_admission = "Admission date must be YYYY-MM-DD.";
    if (!form.session_id) errs.session_id = "Session is required.";
    if (!form.class_id) errs.class_id = "Class is required.";
    if (!form.section_id) errs.section_id = "Section is required.";
    if (!form.roll_number.trim()) errs.roll_number = "Roll number is required.";
    if (form.class_scope === "hs" && !form.stream.trim()) errs.stream = "Stream is required for higher secondary classes.";
    return errs;
  }

  async function handleCreate() {
    const errors = validateCreate(createForm);
    setCreateErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    try {
      await createStudent({
        student: {
          admission_no: createForm.admission_no.trim() || undefined,
          name: createForm.name.trim(),
          mobile: createForm.mobile.trim(),
          gender: createForm.gender.trim().toLowerCase(),
          dob: createForm.dob.trim(),
          date_of_admission: createForm.date_of_admission.trim() || new Date().toISOString().slice(0, 10),
        },
        enrollment: {
          session_id: Number(createForm.session_id),
          class_id: Number(createForm.class_id),
          section_id: Number(createForm.section_id),
          medium: String((classes.find((c) => c.id === createForm.class_id)?.sections || []).find((s) => s.id === createForm.section_id)?.medium || "").trim() || undefined,
          roll_number: createForm.roll_number.trim(),
          stream: createForm.stream.trim() || undefined,
        },
        father: { name: createForm.father_name.trim(), mobile: createForm.father_mobile.trim() },
        mother: { name: createForm.mother_name.trim(), mobile: createForm.mother_mobile.trim() },
      });
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
      setCreateErrors({});
      await loadStudents();
    } catch (err: unknown) {
      Alert.alert("Create failed", getErr(err, "Failed to create student."));
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkUpload() {
    if (!bulkCsv.trim()) {
      Alert.alert("Validation", "Paste CSV data before upload.");
      return;
    }

    setBulkSaving(true);
    try {
      const result = await bulkUploadStudentsCsv(bulkCsv);
      Alert.alert("Upload completed", `${result.createdCount ?? 0} students created.`);
      setBulkOpen(false);
      setBulkCsv("");
      await loadStudents();
    } catch (err: unknown) {
      Alert.alert("Upload failed", getErr(err, "Failed to upload students."));
    } finally {
      setBulkSaving(false);
    }
  }

  function openEdit(s: Student) {
    const matched = classById.get(String(s.class_id ?? "")) || classByName.get(String(s.class || "").toLowerCase());
    setEditForm({
      id: s.id,
      admission_no: s.admission_no || "",
      name: s.name || "",
      mobile: s.phone || s.mobile || "",
      gender: s.gender || "",
      dob: s.dob || "",
      date_of_admission: s.date_of_admission || "",
      session_id: s.session_id || null,
      class_id: s.class_id || matched?.id || null,
      section_id: s.section_id || null,
      roll_number: String(s.roll_number || ""),
      stream: s.stream_name || "",
      class_scope: (s.class_scope || matched?.class_scope || "school") as StudentScope,
    });
    setEditErrors({});
    setEditOpen(true);
  }

  async function handleUpdate() {
    if (!editForm.id) return;
    const errors = validateEdit(editForm);
    setEditErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    try {
      await updateStudent(editForm.id, {
        admission_no: editForm.admission_no.trim() || null,
        name: editForm.name.trim(),
        mobile: editForm.mobile.trim(),
        gender: editForm.gender.trim().toLowerCase(),
        dob: editForm.dob.trim(),
        date_of_admission: editForm.date_of_admission.trim() || undefined,
        session_id: Number(editForm.session_id),
        class_id: Number(editForm.class_id),
        section_id: Number(editForm.section_id),
        roll_number: editForm.roll_number.trim(),
        stream: editForm.class_scope === "hs" ? editForm.stream.trim() || undefined : "",
      });
      setEditOpen(false);
      setEditForm(EMPTY_EDIT);
      setEditErrors({});
      await loadStudents();
    } catch (err: unknown) {
      Alert.alert("Update failed", getErr(err, "Failed to update student."));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(s: Student) {
    Alert.alert("Delete student", `Delete ${s.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteStudent(s.id);
            await loadStudents();
          } catch (err: unknown) {
            Alert.alert("Delete failed", getErr(err, "Failed to delete student."));
          }
        },
      },
    ]);
  }

  function openDetails(s: Student) {
    setSelectedStudentId(s.id);
    setDetailOpen(true);
  }

  const activeSession = sessions.find((s) => Number(s.is_active) === 1 || s.is_active === true);
  const createSelectedClass = classes.find((c) => c.id === createForm.class_id) ?? null;
  const editSelectedClass = classes.find((c) => c.id === editForm.class_id) ?? null;

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <View>
          <Text style={styles.title}>Students</Text>
          <Text style={styles.subtitle}>Find all student details here</Text>
        </View>
        <View style={styles.row}>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              setBulkOpen(true);
              if (!bulkCsv) setBulkCsv(BULK_TEMPLATE);
            }}
          >
            <Text>Bulk Upload</Text>
          </Pressable>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              setCreateOpen(true);
              setCreateErrors({});
              setCreateForm((p) => ({ ...p, session_id: p.session_id ?? activeSession?.id ?? null }));
            }}
          >
            <Text style={styles.primaryBtnText}>Add Student</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.block}>
        <TextInput
          style={styles.input}
          placeholder="Search by name, phone, class, section, roll, stream"
          value={search}
          onChangeText={setSearch}
        />

        <Text style={styles.label}>Class</Text>
        <ScrollView horizontal contentContainerStyle={styles.row}>
          <Pressable style={[styles.chip, classId === null && styles.chipA]} onPress={() => { setClassId(null); setSectionId(null); }}><Text>All</Text></Pressable>
          {classes.map((c) => <Pressable key={c.id} style={[styles.chip, classId === c.id && styles.chipA]} onPress={() => { setClassId(c.id); setSectionId(null); }}><Text>{c.name}</Text></Pressable>)}
        </ScrollView>

        {classId !== null ? (
          <>
            <Text style={[styles.label, styles.mt]}>Section</Text>
            <ScrollView horizontal contentContainerStyle={styles.row}>
              <Pressable style={[styles.chip, sectionId === null && styles.chipA]} onPress={() => setSectionId(null)}><Text>All</Text></Pressable>
              {(selectedClass?.sections || []).map((s) => <Pressable key={s.id} style={[styles.chip, sectionId === s.id && styles.chipA]} onPress={() => setSectionId(s.id)}><Text>{s.name}{s.medium ? ` (${s.medium})` : ""}</Text></Pressable>)}
            </ScrollView>
          </>
        ) : null}
      </View>

      {loading ? <ActivityIndicator /> : (
        <ScrollView contentContainerStyle={styles.list}>
          {filteredStudents.map((s) => {
            const matched = classById.get(String(s.class_id ?? "")) || classByName.get(String(s.class || "").toLowerCase());
            const matchedSection = (matched?.sections || []).find((sec) => String(sec.id) === String(s.section_id ?? ""));
            const medium = s.medium || matchedSection?.medium || "Not set";
            const scopeLabel = formatScope(s.class_scope || matched?.class_scope || "school");
            return (
              <Pressable key={s.id} style={styles.card} onPress={() => openDetails(s)}>
                <Text style={styles.t1}>{s.name}</Text>
                <Text style={styles.t2}>{s.class || "-"} - {s.section || "-"} | Roll {s.roll_number || "-"}</Text>
                <Text style={styles.t2}>Scope: {scopeLabel}</Text>
                <Text style={styles.t2}>Medium: {medium}</Text>
                {String(s.class_scope || matched?.class_scope || "school").toLowerCase() === "hs" ? (
                  <Text style={styles.t2}>Stream: {s.stream_name || "-"}</Text>
                ) : null}
                <Text style={styles.t2}>Phone: {s.phone || s.mobile || "-"}</Text>
                <View style={styles.row}>
                  <Pressable style={styles.btn2} onPress={() => openDetails(s)}><Text>Details</Text></Pressable>
                  <Pressable style={styles.btn2} onPress={() => openEdit(s)}><Text>Edit</Text></Pressable>
                  <Pressable style={styles.btn3} onPress={() => confirmDelete(s)}><Text style={{ color: "#b91c1c" }}>Delete</Text></Pressable>
                </View>
              </Pressable>
            );
          })}
          {!filteredStudents.length ? <Text>No students found.</Text> : null}
        </ScrollView>
      )}

      <Modal visible={bulkOpen} transparent animationType="slide" onRequestClose={() => setBulkOpen(false)}>
        <Sheet title="Bulk Upload Students" onClose={() => setBulkOpen(false)}>
          <Text style={styles.t2}>Scope is derived from the selected class in each CSV row. Keep stream blank for School classes and fill it only for Higher Secondary rows.</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            multiline
            value={bulkCsv}
            onChangeText={setBulkCsv}
            placeholder="Paste CSV here"
            textAlignVertical="top"
          />
          <View style={styles.row}>
            <Pressable style={styles.btn2} onPress={() => setBulkCsv(BULK_TEMPLATE)}><Text>Use Template</Text></Pressable>
            <Pressable style={styles.btn2} onPress={() => setBulkOpen(false)}><Text>Cancel</Text></Pressable>
            <Pressable style={styles.primaryBtn} onPress={handleBulkUpload} disabled={bulkSaving}>
              <Text style={styles.primaryBtnText}>{bulkSaving ? "Uploading..." : "Upload CSV"}</Text>
            </Pressable>
          </View>
        </Sheet>
      </Modal>

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <Sheet title="Add Student" onClose={() => setCreateOpen(false)}>
          <FormLabel label="Student name *" />
          <TextInput style={styles.input} value={createForm.name} onChangeText={(v) => setCreateForm((p) => ({ ...p, name: v }))} />
          <FieldError message={createErrors.name} />

          <FormLabel label="Admission No" />
          <TextInput style={styles.input} value={createForm.admission_no} onChangeText={(v) => setCreateForm((p) => ({ ...p, admission_no: v }))} />

          <FormLabel label="Student phone *" />
          <TextInput style={styles.input} value={createForm.mobile} onChangeText={(v) => setCreateForm((p) => ({ ...p, mobile: v }))} keyboardType="phone-pad" />
          <FieldError message={createErrors.mobile} />

          <FormLabel label="Gender * (male/female/other)" />
          <TextInput style={styles.input} value={createForm.gender} onChangeText={(v) => setCreateForm((p) => ({ ...p, gender: v }))} />
          <FieldError message={createErrors.gender} />

          <FormLabel label="DOB * (YYYY-MM-DD)" />
          <TextInput style={styles.input} value={createForm.dob} onChangeText={(v) => setCreateForm((p) => ({ ...p, dob: v }))} />
          <FieldError message={createErrors.dob} />

          <FormLabel label="Admission date (YYYY-MM-DD)" />
          <TextInput style={styles.input} value={createForm.date_of_admission} onChangeText={(v) => setCreateForm((p) => ({ ...p, date_of_admission: v }))} />
          <FieldError message={createErrors.date_of_admission} />

          <FormLabel label="Roll number *" />
          <TextInput style={styles.input} value={createForm.roll_number} onChangeText={(v) => setCreateForm((p) => ({ ...p, roll_number: v }))} />
          <FieldError message={createErrors.roll_number} />

          <FormLabel label="Father name *" />
          <TextInput style={styles.input} value={createForm.father_name} onChangeText={(v) => setCreateForm((p) => ({ ...p, father_name: v }))} />
          <FieldError message={createErrors.father_name} />

          <FormLabel label="Father phone *" />
          <TextInput style={styles.input} value={createForm.father_mobile} onChangeText={(v) => setCreateForm((p) => ({ ...p, father_mobile: v }))} keyboardType="phone-pad" />
          <FieldError message={createErrors.father_mobile} />

          <FormLabel label="Mother name *" />
          <TextInput style={styles.input} value={createForm.mother_name} onChangeText={(v) => setCreateForm((p) => ({ ...p, mother_name: v }))} />
          <FieldError message={createErrors.mother_name} />

          <FormLabel label="Mother phone *" />
          <TextInput style={styles.input} value={createForm.mother_mobile} onChangeText={(v) => setCreateForm((p) => ({ ...p, mother_mobile: v }))} keyboardType="phone-pad" />
          <FieldError message={createErrors.mother_mobile} />

          <FormLabel label="Session *" />
          <ScrollView horizontal contentContainerStyle={styles.row}>
            {sessions.map((s) => <Pressable key={s.id} style={[styles.chip, createForm.session_id === s.id && styles.chipA]} onPress={() => setCreateForm((p) => ({ ...p, session_id: s.id }))}><Text>{s.name}</Text></Pressable>)}
          </ScrollView>
          <FieldError message={createErrors.session_id} />

          <FormLabel label="Class *" />
          <ScrollView horizontal contentContainerStyle={styles.row}>
            {classes.map((c) => <Pressable key={c.id} style={[styles.chip, createForm.class_id === c.id && styles.chipA]} onPress={() => setCreateForm((p) => ({ ...p, class_id: c.id, section_id: null, stream: "" }))}><Text>{c.name}</Text></Pressable>)}
          </ScrollView>
          <FieldError message={createErrors.class_id} />

          <FormLabel label="Section *" />
          <ScrollView horizontal contentContainerStyle={styles.row}>
            {(createSelectedClass?.sections || []).map((s) => <Pressable key={s.id} style={[styles.chip, createForm.section_id === s.id && styles.chipA]} onPress={() => setCreateForm((p) => ({ ...p, section_id: s.id }))}><Text>{s.name}{s.medium ? ` (${s.medium})` : ""}</Text></Pressable>)}
          </ScrollView>
          <FieldError message={createErrors.section_id} />

          {createSelectedClass?.class_scope === "hs" ? (
            <>
              <FormLabel label="Stream *" />
              <ScrollView horizontal contentContainerStyle={styles.row}>
                {STREAM_OPTIONS.map((item) => <Pressable key={item} style={[styles.chip, createForm.stream === item && styles.chipA]} onPress={() => setCreateForm((p) => ({ ...p, stream: item }))}><Text>{item}</Text></Pressable>)}
              </ScrollView>
              <FieldError message={createErrors.stream} />
            </>
          ) : null}

          <View style={styles.row}>
            <Pressable style={styles.btn2} onPress={() => setCreateOpen(false)}><Text>Cancel</Text></Pressable>
            <Pressable style={styles.primaryBtn} onPress={handleCreate} disabled={saving}><Text style={styles.primaryBtnText}>{saving ? "Saving..." : "Save"}</Text></Pressable>
          </View>
        </Sheet>
      </Modal>

      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <Sheet title="Edit Student" onClose={() => setEditOpen(false)}>
          <FormLabel label="Name *" />
          <TextInput style={styles.input} value={editForm.name} onChangeText={(v) => setEditForm((p) => ({ ...p, name: v }))} />
          <FieldError message={editErrors.name} />

          <FormLabel label="Admission No" />
          <TextInput style={styles.input} value={editForm.admission_no} onChangeText={(v) => setEditForm((p) => ({ ...p, admission_no: v }))} />

          <FormLabel label="Phone *" />
          <TextInput style={styles.input} value={editForm.mobile} onChangeText={(v) => setEditForm((p) => ({ ...p, mobile: v }))} keyboardType="phone-pad" />
          <FieldError message={editErrors.mobile} />

          <FormLabel label="Gender *" />
          <TextInput style={styles.input} value={editForm.gender} onChangeText={(v) => setEditForm((p) => ({ ...p, gender: v }))} />
          <FieldError message={editErrors.gender} />

          <FormLabel label="DOB * (YYYY-MM-DD)" />
          <TextInput style={styles.input} value={editForm.dob} onChangeText={(v) => setEditForm((p) => ({ ...p, dob: v }))} />
          <FieldError message={editErrors.dob} />

          <FormLabel label="Admission date (YYYY-MM-DD)" />
          <TextInput style={styles.input} value={editForm.date_of_admission} onChangeText={(v) => setEditForm((p) => ({ ...p, date_of_admission: v }))} />
          <FieldError message={editErrors.date_of_admission} />

          <FormLabel label="Session *" />
          <ScrollView horizontal contentContainerStyle={styles.row}>
            {sessions.map((s) => <Pressable key={s.id} style={[styles.chip, editForm.session_id === s.id && styles.chipA]} onPress={() => setEditForm((p) => ({ ...p, session_id: s.id }))}><Text>{s.name}</Text></Pressable>)}
          </ScrollView>
          <FieldError message={editErrors.session_id} />

          <FormLabel label="Class *" />
          <ScrollView horizontal contentContainerStyle={styles.row}>
            {classes.map((c) => <Pressable key={c.id} style={[styles.chip, editForm.class_id === c.id && styles.chipA]} onPress={() => setEditForm((p) => ({ ...p, class_id: c.id, section_id: null, class_scope: (c.class_scope || "school") as StudentScope, stream: (c.class_scope || "school") === "hs" ? p.stream : "" }))}><Text>{c.name}</Text></Pressable>)}
          </ScrollView>
          <FieldError message={editErrors.class_id} />

          <FormLabel label="Section *" />
          <ScrollView horizontal contentContainerStyle={styles.row}>
            {(editSelectedClass?.sections || []).map((s) => <Pressable key={s.id} style={[styles.chip, editForm.section_id === s.id && styles.chipA]} onPress={() => setEditForm((p) => ({ ...p, section_id: s.id }))}><Text>{s.name}{s.medium ? ` (${s.medium})` : ""}</Text></Pressable>)}
          </ScrollView>
          <FieldError message={editErrors.section_id} />

          <FormLabel label="Roll number *" />
          <TextInput style={styles.input} value={editForm.roll_number} onChangeText={(v) => setEditForm((p) => ({ ...p, roll_number: v }))} />
          <FieldError message={editErrors.roll_number} />

          {editForm.class_scope === "hs" ? (
            <>
              <FormLabel label="Stream *" />
              <ScrollView horizontal contentContainerStyle={styles.row}>
                {STREAM_OPTIONS.map((item) => <Pressable key={item} style={[styles.chip, editForm.stream === item && styles.chipA]} onPress={() => setEditForm((p) => ({ ...p, stream: item }))}><Text>{item}</Text></Pressable>)}
              </ScrollView>
              <FieldError message={editErrors.stream} />
            </>
          ) : null}

          <View style={styles.row}>
            <Pressable style={styles.btn2} onPress={() => setEditOpen(false)}><Text>Cancel</Text></Pressable>
            <Pressable style={styles.primaryBtn} onPress={handleUpdate} disabled={saving}><Text style={styles.primaryBtnText}>{saving ? "Saving..." : "Update"}</Text></Pressable>
          </View>
        </Sheet>
      </Modal>

      <Modal visible={detailOpen} transparent animationType="slide" onRequestClose={() => setDetailOpen(false)}>
        <Sheet title="Student Details" onClose={() => setDetailOpen(false)}>
          <StudentDetailsModule studentId={selectedStudentId} exams={exams} />
        </Sheet>
      </Modal>
    </View>
  );
}

function FormLabel(props: { label: string }) {
  return <Text style={styles.formLabel}>{props.label}</Text>;
}

function FieldError(props: { message?: string }) {
  if (!props.message) return null;
  return <Text style={styles.fieldError}>{props.message}</Text>;
}

function Sheet(props: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Text style={styles.title}>{props.title}</Text>
          <Pressable onPress={props.onClose}><Text style={styles.t2}>Close</Text></Pressable>
        </View>
        <ScrollView style={{ maxHeight: 620 }}>{props.children}</ScrollView>
      </View>
    </View>
  );
}

function getErr(err: unknown, fallback: string) {
  if (typeof err === "object" && err && "response" in err) {
    const data = (err as { response?: { data?: { message?: string; error?: string } } }).response?.data;
    return data?.error || data?.message || fallback;
  }
  return fallback;
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  toolbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  subtitle: { color: "#64748b", marginTop: 4 },
  primaryBtn: { backgroundColor: "#0f172a", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  secondaryBtn: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff" },
  primaryBtnText: { color: "#fff", fontWeight: "600" },
  block: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, backgroundColor: "#fff", padding: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  list: { gap: 10, paddingBottom: 10 },
  card: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, backgroundColor: "#fff", padding: 12 },
  t1: { color: "#0f172a", fontWeight: "700", fontSize: 16 },
  t2: { color: "#475569", marginTop: 4 },
  btn2: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff" },
  btn3: { borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fee2e2", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  label: { color: "#334155", fontWeight: "700", marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
  chipA: { borderColor: "#0f172a", backgroundColor: "#e2e8f0" },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.35)" },
  sheet: { maxHeight: "92%", backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 10, color: "#0f172a", marginBottom: 2 },
  textarea: { minHeight: 220 },
  formLabel: { color: "#334155", fontWeight: "600", marginTop: 8, marginBottom: 6 },
  fieldError: { color: "#b91c1c", marginBottom: 6, fontSize: 12 },
  mt: { marginTop: 10 },
});

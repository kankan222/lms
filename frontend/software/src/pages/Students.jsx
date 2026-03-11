import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import TopBar from "../components/TopBar";

import {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  bulkUploadStudents
} from "../api/students.api";
import { getClassStructure, getSessions } from "../api/academic.api";
import StudentForm from "./student/StudentForm";

import { Button } from "../components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";

const columns = [
  { header: "Id", accessor: "display_id" },
  { header: "Name", accessor: "name" },
  { header: "Class", accessor: "class" },
  { header: "Medium", accessor: "medium" },
  { header: "Section", accessor: "section" },
  { header: "Phone", accessor: "phone" },
  { header: "Roll", accessor: "roll_number" },
  { header: "Gender", accessor: "gender" },
  { header: "DOB", accessor: "dob" }
];

export default function Student() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [open, setOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [errors, setErrors] = useState({});
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkMessage, setBulkMessage] = useState("");

  useEffect(() => {
    loadAcademicOptions();
  }, []);

  useEffect(() => {
    loadStudents();
  }, [classId, sectionId, classes]);

  async function loadAcademicOptions() {
    const [classRes, sessionRes] = await Promise.all([getClassStructure(), getSessions()]);
    setClasses(classRes?.data || []);
    setSessions(sessionRes?.data || []);
  }

  async function loadStudents() {
    const res = await getStudents({
      class_id: classId || undefined,
      section_id: sectionId || undefined
    });
    const rows = Array.isArray(res) ? res : (res?.data ?? []);
    const classById = new Map(classes.map((c) => [String(c.id), c]));
    const classByName = new Map(classes.map((c) => [String(c.name || "").toLowerCase(), c]));
    const enriched = rows.map((row) => {
      const matched =
        classById.get(String(row.class_id ?? "")) ||
        classByName.get(String(row.class || "").toLowerCase());
      const matchedSection = (matched?.sections || []).find(
        (s) => String(s.id) === String(row.section_id || "")
      );
      const medium = String(row.medium || "").trim() || String(matchedSection?.medium || "").trim() || "-";
      return {
        ...row,
        display_id: `KKV-${row.id}`,
        medium,
        mediums: matched?.mediums || []
      };
    });
    setStudents(enriched);
  }

  function validateCreatePayload(payload) {
    const next = {};

    if (!payload?.student?.name?.trim()) next.student_name = "Student name is required";
    if (!/^\d{10}$/.test(String(payload?.student?.mobile || ""))) next.student_mobile = "Student phone must be 10 digits";
    if (!payload?.student?.gender) next.student_gender = "Gender is required";
    if (!payload?.student?.dob) next.student_dob = "DOB is required";
    if (!payload?.student?.date_of_admission) next.student_date_of_admission = "Date of admission is required";

    if (!payload?.enrollment?.session_id) next.session_id = "Session is required";
    if (!payload?.enrollment?.class_id) next.class_id = "Class is required";
    if (!payload?.enrollment?.section_id) next.section_id = "Section is required";
    if (!payload?.enrollment?.medium) next.medium = "Medium is required";
    if (!payload?.enrollment?.roll_number) next.roll_number = "Roll number is required";

    if (!payload?.father?.name?.trim()) next.father_name = "Father name is required";
    if (!/^\d{10}$/.test(String(payload?.father?.mobile || ""))) next.father_mobile = "Father phone must be 10 digits";
    if (payload?.father?.email && !/^\S+@\S+\.\S+$/.test(payload.father.email)) {
      next.father_email = "Invalid father email";
    }

    if (!payload?.mother?.name?.trim()) next.mother_name = "Mother name is required";
    if (!/^\d{10}$/.test(String(payload?.mother?.mobile || ""))) next.mother_mobile = "Mother phone must be 10 digits";
    if (payload?.mother?.email && !/^\S+@\S+\.\S+$/.test(payload.mother.email)) {
      next.mother_email = "Invalid mother email";
    }

    return next;
  }

  async function handleCreate(data) {
    const validation = validateCreatePayload(data);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    const formData = new FormData();
    formData.append("payload", JSON.stringify({
      ...data,
      student: {
        ...data.student,
        photo_file: undefined
      }
    }));
    if (data?.student?.photo_file) {
      formData.append("photo", data.student.photo_file);
    }

    await createStudent(formData);
    await loadStudents();
    setOpen(false);
    setErrors({});
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (!editingStudent) return;

    const localErrors = {};
    if (!editingStudent.name?.trim()) localErrors.name = "Name is required";
    if (!/^\d{10}$/.test(String(editingStudent.phone || ""))) localErrors.phone = "Phone must be 10 digits";
    if (!editingStudent.gender) localErrors.gender = "Gender is required";
    if (!editingStudent.dob) localErrors.dob = "DOB is required";

    setErrors(localErrors);
    if (Object.keys(localErrors).length > 0) return;

    await updateStudent(editingStudent.id, {
      name: editingStudent.name,
      mobile: editingStudent.phone,
      gender: editingStudent.gender,
      dob: editingStudent.dob,
      date_of_admission: editingStudent.date_of_admission
    });
    await loadStudents();
    setEditingStudent(null);
    setErrors({});
  }

  async function handleDelete(row) {
    if (!confirm("Delete this student?")) return;

    await deleteStudent(row.id);
    await loadStudents();
  }

  function handleEdit(row) {
    setEditingStudent(row);
    setErrors({});
  }

  function downloadCsvTemplate() {
    const headers = [
      "admission_no",
      "name",
      "dob",
      "gender",
      "mobile",
      "date_of_admission",
      "session",
      "class",
      "section",
      "medium",
      "roll_number",
      "father_name",
      "father_mobile",
      "father_email",
      "father_occupation",
      "father_qualification",
      "mother_name",
      "mother_mobile",
      "mother_email",
      "mother_occupation",
      "mother_qualification",
      "photo_url"
    ];
    const sample = [
      "ADM-2026-001",
      "Rahul Das",
      "2012-05-10",
      "male",
      "9876543210",
      "2026-04-01",
      "2026-2027",
      "HS 1st Year",
      "A1",
      "English",
      "5",
      "Ramesh Das",
      "9876500001",
      "ramesh@example.com",
      "Farmer",
      "Graduate",
      "Sima Das",
      "9876500002",
      "sima@example.com",
      "Homemaker",
      "HS",
      "/uploads/students/sample.jpg"
    ];

    const csv = `${headers.join(",")}\n${sample.join(",")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students_bulk_upload_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function parseCsvLine(line) {
    return String(line || "")
      .split(/,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/)
      .map((value) => value.replace(/^\"|\"$/g, "").trim());
  }

  function csvEscape(value) {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
      return `"${str.replace(/"/g, "\"\"")}"`;
    }
    return str;
  }

  function isNumericId(value) {
    return /^\d+$/.test(String(value || "").trim());
  }

  function normalizeName(value) {
    return String(value || "").trim().toLowerCase();
  }

  function transformBulkCsvToBackendFormat(csvText) {
    const lines = String(csvText || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      throw new Error("CSV is empty.");
    }

    const inputHeaders = parseCsvLine(lines[0]);
    const inputIndex = new Map(inputHeaders.map((h, i) => [normalizeName(h), i]));
    const getCell = (values, ...keys) => {
      for (const key of keys) {
        const idx = inputIndex.get(normalizeName(key));
        if (idx !== undefined) return values[idx] ?? "";
      }
      return "";
    };

    const classByName = new Map(classes.map((c) => [normalizeName(c.name), c]));
    const sessionByName = new Map(sessions.map((s) => [normalizeName(s.name), s]));

    const outputHeaders = [
      "admission_no",
      "name",
      "dob",
      "gender",
      "mobile",
      "date_of_admission",
      "session_id",
      "class_id",
      "section_id",
      "medium",
      "roll_number",
      "father_name",
      "father_mobile",
      "father_email",
      "father_occupation",
      "father_qualification",
      "mother_name",
      "mother_mobile",
      "mother_email",
      "mother_occupation",
      "mother_qualification",
      "photo_url"
    ];

    const outRows = [];
    const errors = [];

    lines.slice(1).forEach((line, idx) => {
      const rowNo = idx + 2;
      const values = parseCsvLine(line);

      const classToken = getCell(values, "class", "class_name", "class_id");
      let classId = "";
      let classObj = null;
      if (isNumericId(classToken)) {
        classId = String(classToken).trim();
        classObj = classes.find((c) => String(c.id) === classId) || null;
      } else {
        classObj = classByName.get(normalizeName(classToken)) || null;
        classId = classObj ? String(classObj.id) : "";
      }
      if (!classId) {
        errors.push(`Row ${rowNo}: Invalid class '${classToken}'.`);
        return;
      }

      const sectionToken = getCell(values, "section", "section_name", "section_id");
      let sectionId = "";
      let sectionObj = null;
      if (isNumericId(sectionToken)) {
        sectionId = String(sectionToken).trim();
        sectionObj = (classObj?.sections || []).find((s) => String(s.id) === sectionId) || null;
      } else {
        sectionObj = (classObj?.sections || []).find(
          (s) => normalizeName(s.name) === normalizeName(sectionToken)
        ) || null;
        sectionId = sectionObj ? String(sectionObj.id) : "";
      }
      if (!sectionId) {
        errors.push(`Row ${rowNo}: Invalid section '${sectionToken}' for class '${classObj?.name || classToken}'.`);
        return;
      }

      const sessionToken = getCell(values, "session", "session_name", "session_id");
      let sessionId = "";
      if (isNumericId(sessionToken)) {
        sessionId = String(sessionToken).trim();
      } else {
        sessionId = String(sessionByName.get(normalizeName(sessionToken))?.id || "");
      }
      if (!sessionId) {
        errors.push(`Row ${rowNo}: Invalid session '${sessionToken}'.`);
        return;
      }

      const inputMedium = getCell(values, "medium");
      const sectionMedium = String(sectionObj?.medium || "").trim();
      const medium = String(inputMedium || "").trim() || sectionMedium;

      outRows.push({
        admission_no: getCell(values, "admission_no"),
        name: getCell(values, "name"),
        dob: getCell(values, "dob"),
        gender: getCell(values, "gender"),
        mobile: getCell(values, "mobile"),
        date_of_admission: getCell(values, "date_of_admission"),
        session_id: sessionId,
        class_id: classId,
        section_id: sectionId,
        medium,
        roll_number: getCell(values, "roll_number"),
        father_name: getCell(values, "father_name"),
        father_mobile: getCell(values, "father_mobile"),
        father_email: getCell(values, "father_email"),
        father_occupation: getCell(values, "father_occupation"),
        father_qualification: getCell(values, "father_qualification"),
        mother_name: getCell(values, "mother_name"),
        mother_mobile: getCell(values, "mother_mobile"),
        mother_email: getCell(values, "mother_email"),
        mother_occupation: getCell(values, "mother_occupation"),
        mother_qualification: getCell(values, "mother_qualification"),
        photo_url: getCell(values, "photo_url")
      });
    });

    if (errors.length) {
      throw new Error(errors.slice(0, 5).join(" "));
    }

    const outputLines = [
      outputHeaders.join(","),
      ...outRows.map((row) => outputHeaders.map((h) => csvEscape(row[h])).join(","))
    ];
    return outputLines.join("\n");
  }

  async function handleBulkUpload() {
    setBulkMessage("");

    if (!bulkFile) {
      setBulkMessage("Select a CSV file first.");
      return;
    }

    try {
      const rawCsv = await bulkFile.text();
      const normalizedCsv = transformBulkCsvToBackendFormat(rawCsv);
      const uploadFile = new File([normalizedCsv], bulkFile.name || "students-upload.csv", {
        type: "text/csv"
      });
      await bulkUploadStudents(uploadFile);
      setBulkFile(null);
      await loadStudents();
      setBulkMessage("Bulk upload completed successfully.");
    } catch (err) {
      setBulkMessage(err?.message || "Bulk upload failed.");
    }
  }

  function handleRowClick(row) {
    navigate(`/students/${row.id}`);
  }

  const selectedClass = classes.find((c) => String(c.id) === String(classId));
  const sections = selectedClass?.sections || [];

  return (
    <>
      <TopBar
        title="Students"
        subTitle="Find all student details here"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadCsvTemplate}>
              Download CSV Format
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Bulk Upload CSV</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bulk Upload Students</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use names for session/class/section (not IDs). Keep header names unchanged.
                  </p>
                  {bulkMessage && (
                    <p
                      className={`text-xs ${
                        bulkMessage.toLowerCase().includes("completed")
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {bulkMessage}
                    </p>
                  )}
                  <Button onClick={handleBulkUpload}>Upload</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Add Student</Button>
              </DialogTrigger>

              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Student</DialogTitle>
                </DialogHeader>

                <StudentForm onSubmit={handleCreate} errors={errors} />
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Class</Label>
          <select
            className="border rounded-md px-3 py-2 bg-background"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSectionId("");
            }}
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.medium ? ` (${c.medium})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <Label>Section</Label>
          <select
            className="border rounded-md px-3 py-2 bg-background"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            disabled={!classId}
          >
            <option value="">All Sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={students}
        onRowClick={handleRowClick}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Sheet open={!!editingStudent} onOpenChange={() => setEditingStudent(null)}>
        <SheetContent>
          <form onSubmit={handleUpdate} className="space-y-3">
            <SheetHeader>
              <SheetTitle>Edit Student</SheetTitle>
            </SheetHeader>

            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input
                value={editingStudent?.name || ""}
                onChange={(e) =>
                  setEditingStudent((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>

            <div className="grid gap-2">
              <Label>Phone *</Label>
              <Input
                value={editingStudent?.phone || ""}
                onChange={(e) =>
                  setEditingStudent((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
              {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
            </div>

            <div className="grid gap-2">
              <Label>Gender *</Label>
              <select
                className="border rounded p-2"
                value={editingStudent?.gender || ""}
                onChange={(e) =>
                  setEditingStudent((prev) => ({ ...prev, gender: e.target.value }))
                }
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              {errors.gender && <p className="text-xs text-red-500">{errors.gender}</p>}
            </div>

            <div className="grid gap-2">
              <Label>DOB *</Label>
              <Input
                type="date"
                value={editingStudent?.dob || ""}
                onChange={(e) =>
                  setEditingStudent((prev) => ({ ...prev, dob: e.target.value }))
                }
              />
              {errors.dob && <p className="text-xs text-red-500">{errors.dob}</p>}
            </div>

            <SheetFooter>
              <Button type="submit">Update</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

    </>
  );
}

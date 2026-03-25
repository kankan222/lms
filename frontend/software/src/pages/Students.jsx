import { useEffect, useEffectEvent, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePermissions } from "../hooks/usePermissions";
import { formatReadableDate } from "../lib/dateTime";

const columns = [
  {
    header: "Student",
    accessor: "student_summary",
    className: "w-[28%] max-w-0",
    cell: (row) => (
      <div className="min-w-0 space-y-1">
        <p className="truncate font-medium text-foreground">{row.name || "-"}</p>
        <p className="truncate text-xs text-muted-foreground">{row.display_id}</p>
        {row.admission_no ? (
          <p className="truncate text-xs text-muted-foreground">Adm: {row.admission_no}</p>
        ) : null}
      </div>
    ),
  },
  {
    header: "Academic",
    accessor: "academic_summary",
    className: "w-[30%] max-w-0",
    cell: (row) => (
      <div className="min-w-0 space-y-1">
        <p className="truncate font-medium text-foreground">{row.academic_summary || "-"}</p>
        <p className="truncate text-xs text-muted-foreground">{row.session_name || "-"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {row.class_scope || "-"}
        </p>
      </div>
    ),
  },
  {
    header: "Contact",
    accessor: "contact_summary",
    className: "w-[18%] max-w-0",
    cell: (row) => (
      <div className="min-w-0 space-y-1">
        <p className="truncate font-medium text-foreground">{row.contact_summary || "-"}</p>
        <p className="truncate text-xs text-muted-foreground">Phone</p>
      </div>
    ),
  },
  {
    header: "Gender",
    accessor: "gender",
    className: "w-24 max-w-24",
    cell: (row) => {
      const value = String(row.gender || "").trim().toLowerCase();
      const classes =
        value === "male"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
          : value === "female"
            ? "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-200"
            : "bg-muted text-muted-foreground";

      return (
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize ${classes}`}>
          {row.gender || "-"}
        </span>
      );
    },
  },
  {
    header: "Dates",
    accessor: "date_summary",
    className: "w-[24%] max-w-0",
    cell: (row) => (
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm text-foreground">DOB: {row.dob_display || "-"}</p>
        <p className="truncate text-xs text-muted-foreground">
          Admission: {row.date_of_admission_display || "-"}
        </p>
      </div>
    ),
  }
];

function formatClassScope(value) {
  const scope = String(value || "").trim().toLowerCase();
  if (scope === "hs") return "Higher Secondary";
  if (scope === "school") return "School";
  return value || "-";
}

function formatDateOnly(value) {
  return formatReadableDate(value);
}

function formatDateInputValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

const FIELD_CLASSNAME =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-hidden transition focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60";

async function fetchStudentsData({ classId, sectionId, classes, sessions }) {
  const res = await getStudents({
    class_id: classId || undefined,
    section_id: sectionId || undefined
  });
  const rows = Array.isArray(res) ? res : (res?.data ?? []);
  const classById = new Map(classes.map((c) => [String(c.id), c]));
  const classByName = new Map(classes.map((c) => [String(c.name || "").toLowerCase(), c]));
  const sessionById = new Map(sessions.map((session) => [String(session.id), session]));

  return rows.map((row) => {
    const matched =
      classById.get(String(row.class_id ?? "")) ||
      classByName.get(String(row.class || "").toLowerCase());
    const matchedSection = (matched?.sections || []).find(
      (s) => String(s.id) === String(row.section_id || "")
    );
    const session = sessionById.get(String(row.session_id || ""));
    const medium = String(row.medium || "").trim() || String(matchedSection?.medium || "").trim() || "-";

    return {
      ...row,
      display_id: `KKV-${row.id}`,
      dob: formatDateInputValue(row.dob),
      dob_display: formatDateOnly(row.dob),
      date_of_admission: formatDateInputValue(row.date_of_admission),
      date_of_admission_display: formatDateOnly(row.date_of_admission),
      session_name: session?.name || "-",
      academic_summary: [
        row.class,
        row.section ? `Sec ${row.section}` : "",
        row.roll_number ? `Roll ${row.roll_number}` : "",
        row.stream_name && row.stream_name !== "-" ? row.stream_name : "",
        medium && medium !== "-" ? medium : "",
      ]
        .filter(Boolean)
        .join(" | "),
      contact_summary: String(row.phone || "").trim() || "-",
      medium,
      mediums: matched?.mediums || [],
      class_scope: formatClassScope(row.class_scope || matched?.class_scope || "school"),
      raw_class_scope: row.class_scope || matched?.class_scope || "school",
      stream_name: row.stream_name || "-"
    };
  });
}

export default function Student() {
  const { hasRole, can } = usePermissions();
  const isParent = hasRole("parent");
  const isTeacher = hasRole("teacher");
  const canCreateStudents = can("student.create");
  const canEditStudents = can("student.update");
  const canDeleteStudents = can("student.delete");
  const canManageStudents = canCreateStudents || canEditStudents || canDeleteStudents;
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [open, setOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(null);
  const [errors, setErrors] = useState({});
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const STREAM_OPTIONS = [
    { value: "Arts", label: "Arts" },
    { value: "Commerce", label: "Commerce" },
    { value: "Science", label: "Science" },
  ];

  function showNotice(title, message, variant = "success") {
    setNotice({ title, message, variant });
  }

  async function refreshStudents() {
    setRefreshing(true);
    try {
      const enriched = await fetchStudentsData({ classId, sectionId, classes, sessions });
      setStudents(enriched);
      setLastUpdatedAt(new Date().toISOString());
    } finally {
      setRefreshing(false);
    }
  }

  const refreshStudentsEvent = useEffectEvent(() => {
    if (!classes.length || !sessions.length) return;
    refreshStudents();
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const [classRes, sessionRes] = await Promise.all([getClassStructure(), getSessions()]);
      if (cancelled) return;
      setClasses(classRes?.data || []);
      setSessions(sessionRes?.data || []);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const enriched = await fetchStudentsData({ classId, sectionId, classes, sessions });
      if (cancelled) return;
      setStudents(enriched);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [classId, sectionId, classes, sessions]);

  useEffect(() => {
    function handleWindowFocus() {
      refreshStudentsEvent();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshStudentsEvent();
      }
    }

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  function validateCreatePayload(payload) {
    const next = {};

    if (!payload?.student?.name?.trim()) next.student_name = "Student name is required";
    if (String(payload?.student?.mobile || "").trim() && !/^\d{10}$/.test(String(payload?.student?.mobile || "").trim())) {
      next.student_mobile = "Student phone must be 10 digits";
    }
    if (!payload?.student?.gender) next.student_gender = "Gender is required";
    if (!payload?.student?.dob) next.student_dob = "DOB is required";
    if (!payload?.student?.date_of_admission) next.student_date_of_admission = "Date of admission is required";

    if (!payload?.enrollment?.session_id) next.session_id = "Session is required";
    if (!payload?.enrollment?.class_id) next.class_id = "Class is required";
    if (!payload?.enrollment?.section_id) next.section_id = "Section is required";
    if (!payload?.enrollment?.medium) next.medium = "Medium is required";
    if (!payload?.enrollment?.roll_number) next.roll_number = "Roll number is required";
    const selectedClass = classes.find((c) => String(c.id) === String(payload?.enrollment?.class_id));
    if (selectedClass?.class_scope === "hs" && !String(payload?.enrollment?.stream || payload?.enrollment?.stream_id || "").trim()) {
      next.stream = "Stream is required for higher secondary classes";
    }

    const fatherMobile = String(payload?.father?.mobile || "").trim();
    const motherMobile = String(payload?.mother?.mobile || "").trim();

    if (!fatherMobile && !motherMobile) next.parent_mobile = "Enter at least one parent phone number";

    if (fatherMobile && !payload?.father?.name?.trim()) next.father_name = "Father name is required when father phone is entered";
    if (fatherMobile && !/^\d{10}$/.test(fatherMobile)) next.father_mobile = "Father phone must be 10 digits";
    if (payload?.father?.email && !/^\S+@\S+\.\S+$/.test(payload.father.email)) {
      next.father_email = "Invalid father email";
    }

    if (motherMobile && !payload?.mother?.name?.trim()) next.mother_name = "Mother name is required when mother phone is entered";
    if (motherMobile && !/^\d{10}$/.test(motherMobile)) next.mother_mobile = "Mother phone must be 10 digits";
    if (payload?.mother?.email && !/^\S+@\S+\.\S+$/.test(payload.mother.email)) {
      next.mother_email = "Invalid mother email";
    }

    return next;
  }

  async function handleCreate(data) {
    const validation = validateCreatePayload(data);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    try {
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
      await refreshStudents();
      setOpen(false);
      setErrors({});
      showNotice("Student Created", "Student record created successfully.");
    } catch (err) {
      showNotice("Create Failed", err?.message || "Failed to create student.", "error");
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (!editingStudent) return;

    const localErrors = {};
    if (!editingStudent.name?.trim()) localErrors.name = "Name is required";
    if (String(editingStudent.phone || "").trim() && !/^\d{10}$/.test(String(editingStudent.phone || "").trim())) {
      localErrors.phone = "Phone must be 10 digits";
    }
    if (!editingStudent.gender) localErrors.gender = "Gender is required";
    if (!editingStudent.dob) localErrors.dob = "DOB is required";
    if (!editingStudent.date_of_admission) localErrors.date_of_admission = "Date of admission is required";
    if (!editingStudent.session_id) localErrors.session_id = "Session is required";
    if (!editingStudent.class_id) localErrors.class_id = "Class is required";
    if (!editingStudent.section_id) localErrors.section_id = "Section is required";
    if (!editingStudent.roll_number) localErrors.roll_number = "Roll number is required";
    if (editingStudent.raw_class_scope === "hs" && !String(editingStudent.stream_name || editingStudent.stream_id || "").trim()) {
      localErrors.stream = "Stream is required for higher secondary classes";
    }

    setErrors(localErrors);
    if (Object.keys(localErrors).length > 0) return;

    try {
      await updateStudent(editingStudent.id, {
        name: editingStudent.name,
        mobile: editingStudent.phone,
        gender: editingStudent.gender,
        dob: editingStudent.dob,
        date_of_admission: editingStudent.date_of_admission,
        session_id: editingStudent.session_id,
        class_id: editingStudent.class_id,
        section_id: editingStudent.section_id,
        roll_number: editingStudent.roll_number,
        stream: editingStudent.raw_class_scope === "hs" ? editingStudent.stream_name : "",
      });
      await refreshStudents();
      setEditingStudent(null);
      setErrors({});
      showNotice("Student Updated", "Student record updated successfully.");
    } catch (err) {
      showNotice("Update Failed", err?.message || "Failed to update student.", "error");
    }
  }

  async function handleDelete() {
    if (!deletingStudent?.id) return;

    try {
      await deleteStudent(deletingStudent.id);
      await refreshStudents();
      setDeletingStudent(null);
      showNotice("Student Deleted", "Student record deleted successfully.");
    } catch (err) {
      showNotice("Delete Failed", err?.message || "Failed to delete student.", "error");
    }
  }

  function handleEdit(row) {
    setEditingStudent({
      ...row,
      dob: formatDateInputValue(row.dob),
      date_of_admission: formatDateInputValue(row.date_of_admission),
    });
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
      "stream",
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
    const schoolSample = [
      "ADM-2026-001",
      "Rahul Das",
      "2012-05-10",
      "male",
      "9876543210",
      "2026-04-01",
      "2026-2027",
      "Class 8",
      "A",
      "English",
      "",
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
      "/uploads/students/sample-school.jpg"
    ];
    const hsSample = [
      "ADM-2026-101",
      "Ankita Sharma",
      "2008-07-12",
      "female",
      "9876543222",
      "2026-04-01",
      "2026-2027",
      "HS 1st Year",
      "A1",
      "English",
      "Science",
      "12",
      "Madan Sharma",
      "9876500011",
      "madan@example.com",
      "Business",
      "Graduate",
      "Mina Sharma",
      "9876500012",
      "mina@example.com",
      "Teacher",
      "Graduate",
      "/uploads/students/sample-hs.jpg"
    ];

    const csv = `${headers.join(",")}\n${schoolSample.join(",")}\n${hsSample.join(",")}\n`;
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
      .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map((value) => value.replace(/^"|"$/g, "").trim());
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
      "stream",
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
      const classScope = String(classObj?.class_scope || "school").trim().toLowerCase();
      const stream = getCell(values, "stream", "stream_name", "stream_id");

      if (classScope === "hs" && !String(stream || "").trim()) {
        errors.push(`Row ${rowNo}: Stream is required for higher secondary class '${classObj?.name || classToken}'.`);
        return;
      }

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
        stream,
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
      await refreshStudents();
      setBulkMessage("Bulk upload completed successfully.");
      setBulkOpen(false);
      showNotice("Bulk Upload Complete", "Students uploaded successfully.");
    } catch (err) {
      setBulkMessage(err?.message || "Bulk upload failed.");
      showNotice("Bulk Upload Failed", err?.message || "Bulk upload failed.", "error");
    }
  }

  function handleRowClick(row) {
    navigate(`/students/${row.id}`);
  }

  const selectedClass = classes.find((c) => String(c.id) === String(classId));
  const sections = selectedClass?.sections || [];
  const editingSelectedClass = classes.find((c) => String(c.id) === String(editingStudent?.class_id));
  const editingSections = editingSelectedClass?.sections || [];
  const activeFilterCount = [classId, sectionId].filter(Boolean).length;

  return (
    <>
      <div className="pointer-events-none fixed top-6 right-6 z-50 w-full max-w-sm">
        <div
          className={`transition-all duration-500 ease-out ${
            notice
              ? "translate-x-0 scale-100 opacity-100"
              : "translate-x-12 scale-95 opacity-0"
          }`}
        >
          {notice && (
            <Alert
              variant={notice.variant === "error" ? "destructive" : "success"}
              className="pointer-events-auto overflow-hidden border shadow-xl"
            >
              <AlertTitle>{notice.title}</AlertTitle>
              <AlertDescription>{notice.message}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      <TopBar
        title={isParent ? "My Children" : "Students"}
        subTitle={
          isParent
            ? "View your linked children"
            : isTeacher
              ? "View the latest student records for your assigned classes."
              : "Find all student details here"
        }
        action={!isParent ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshStudents} disabled={refreshing}>
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  {activeFilterCount ? `Filters (${activeFilterCount})` : "Filters"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-4">
                <PopoverHeader>
                  <PopoverTitle>Filter Students</PopoverTitle>
                  <PopoverDescription>
                    Narrow the students list by class and section.
                  </PopoverDescription>
                </PopoverHeader>

                <div className="grid gap-4">
                  <div className="grid gap-1.5">
                    <Label>Class</Label>
                    <select
                      className={FIELD_CLASSNAME}
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
                      className={FIELD_CLASSNAME}
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

                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setClassId("");
                      setSectionId("");
                    }}
                  >
                    Reset Filters
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            {canManageStudents ? (
              <>
                <Button variant="outline" onClick={downloadCsvTemplate}>
                  Download CSV Format
                </Button>
                {canCreateStudents ? (
                  <Dialog
                    open={bulkOpen}
                    onOpenChange={(nextOpen) => {
                      setBulkOpen(nextOpen);
                      if (!nextOpen) {
                        setBulkFile(null);
                        setBulkMessage("");
                      }
                    }}
                  >
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
                          Use names for session, class, and section. Scope is derived automatically from the selected class. Keep `stream` blank for School classes and fill it only for Higher Secondary rows.
                        </p>
                        {bulkMessage && (
                          <p
                            className={`text-xs ${
                              bulkMessage.toLowerCase().includes("completed")
                                ? "text-emerald-700 dark:text-emerald-200"
                                : "text-red-700 dark:text-red-200"
                            }`}
                          >
                            {bulkMessage}
                          </p>
                        )}
                        <Button onClick={handleBulkUpload}>Upload</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : null}
                {canCreateStudents ? (
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
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      />

      {!isParent && lastUpdatedAt ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Last refreshed: {new Date(lastUpdatedAt).toLocaleString()}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        data={students}
        tableClassName="table-fixed"
        tableWrapperClassName="overflow-hidden"
        onRowClick={handleRowClick}
        onEdit={!isParent && canEditStudents ? handleEdit : undefined}
        onDelete={!isParent && canDeleteStudents ? setDeletingStudent : undefined}
      />

      <Dialog open={!isParent && !!editingStudent} onOpenChange={() => setEditingStudent(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleUpdate} className="space-y-3">
            <DialogHeader>
              <DialogTitle>Edit Student</DialogTitle>
              <DialogDescription>
                Update student personal and enrollment details.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div>
                <p className="text-sm font-medium">Personal Details</p>
                <p className="text-xs text-muted-foreground">
                  Basic identity and contact information.
                </p>
              </div>

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
                  className={FIELD_CLASSNAME}
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

              <div className="grid gap-2">
                <Label>Date of Admission *</Label>
                <Input
                  type="date"
                  value={editingStudent?.date_of_admission || ""}
                  onChange={(e) =>
                    setEditingStudent((prev) => ({ ...prev, date_of_admission: e.target.value }))
                  }
                />
                {errors.date_of_admission && (
                  <p className="text-xs text-red-500">{errors.date_of_admission}</p>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div>
                <p className="text-sm font-medium">Enrollment Details</p>
                <p className="text-xs text-muted-foreground">
                  Class placement, academic session, and section mapping.
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Session *</Label>
                <select
                  className={FIELD_CLASSNAME}
                  value={editingStudent?.session_id || ""}
                  onChange={(e) =>
                    setEditingStudent((prev) => ({ ...prev, session_id: e.target.value }))
                  }
                >
                  <option value="">Select</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name}
                    </option>
                  ))}
                </select>
                {errors.session_id && <p className="text-xs text-red-500">{errors.session_id}</p>}
              </div>

              <div className="grid gap-2">
                <Label>Class *</Label>
                <select
                  className={FIELD_CLASSNAME}
                  value={editingStudent?.class_id || ""}
                  onChange={(e) => {
                    const nextClass = classes.find((item) => String(item.id) === String(e.target.value));
                    setEditingStudent((prev) => ({
                      ...prev,
                      class_id: e.target.value,
                      section_id: "",
                      class_scope: formatClassScope(nextClass?.class_scope || "school"),
                      raw_class_scope: nextClass?.class_scope || "school",
                      stream_name: nextClass?.class_scope === "hs" ? prev?.stream_name || "" : "",
                      stream_id: nextClass?.class_scope === "hs" ? prev?.stream_id || "" : "",
                    }));
                  }}
                >
                  <option value="">Select</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {errors.class_id && <p className="text-xs text-red-500">{errors.class_id}</p>}
              </div>

              <div className="grid gap-2">
                <Label>Section *</Label>
                <select
                  className={FIELD_CLASSNAME}
                  value={editingStudent?.section_id || ""}
                  onChange={(e) => {
                    const nextSection = editingSections.find((item) => String(item.id) === String(e.target.value));
                    setEditingStudent((prev) => ({
                      ...prev,
                      section_id: e.target.value,
                      medium: nextSection?.medium || prev?.medium || "",
                    }));
                  }}
                  disabled={!editingStudent?.class_id}
                >
                  <option value="">Select</option>
                  {editingSections.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}{item.medium ? ` (${item.medium})` : ""}
                    </option>
                  ))}
                </select>
                {errors.section_id && <p className="text-xs text-red-500">{errors.section_id}</p>}
              </div>

              <div className="grid gap-2">
                <Label>Roll Number *</Label>
                <Input
                  value={editingStudent?.roll_number || ""}
                  onChange={(e) =>
                    setEditingStudent((prev) => ({ ...prev, roll_number: e.target.value }))
                  }
                />
                {errors.roll_number && <p className="text-xs text-red-500">{errors.roll_number}</p>}
              </div>
            </div>

            {editingSelectedClass?.class_scope === "hs" ? (
              <>
                <Separator />
                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                  <div>
                    <p className="text-sm font-medium">Higher Secondary Details</p>
                    <p className="text-xs text-muted-foreground">
                      Required only for higher secondary enrollments.
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label>Stream *</Label>
                    <select
                      className={FIELD_CLASSNAME}
                      value={editingStudent?.stream_name || ""}
                      onChange={(e) =>
                        setEditingStudent((prev) => ({
                          ...prev,
                          stream_name: e.target.value,
                          stream_id: "",
                        }))
                      }
                    >
                      <option value="">Select</option>
                      {STREAM_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    {errors.stream && <p className="text-xs text-red-500">{errors.stream}</p>}
                  </div>
                </div>
              </>
            ) : null}

            <DialogFooter showCloseButton>
              <Button type="submit">Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!isParent && !!deletingStudent}
        onOpenChange={(open) => {
          if (!open) setDeletingStudent(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete student?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingStudent
                ? `This will remove ${deletingStudent.name} from the students list if no linked enrollment, marks, fee, or parent records exist. Students with existing academic or financial history cannot be deleted.`
                : "This action cannot be undone. Students with linked enrollment, marks, fee, or parent records cannot be deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import TopBar from "../../components/TopBar";
import { getStudent, updateStudent as updateStudentApi } from "../../api/students.api";
import { getStudentAttendanceSessions } from "../../api/attendance.api";
import {
  getMyPayments,
  getMyStudentFeeOptions,
  getStudentFeeOptions,
  getPayments
} from "../../api/fee.api";
import {
  getExams,
} from "../../api/exam.api";
import {
  getStudentSubjectRegistrations,
  replaceStudentSubjectRegistrations,
} from "../../api/subjects.api";
import {
  downloadMyMarksheet,
  downloadFinalMarksheet,
  getAccessibleExams,
  getMyResults,
  downloadStudentMarksheet,
  getStudentReport,
} from "../../api/marks.api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, BookOpen, CalendarDays, CreditCard, IdCard, Phone, UserRound } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { usePermissions } from "../../hooks/usePermissions";
import { resolveServerImageUrl } from "../../lib/serverImage";
import { formatReadableDate } from "../../lib/dateTime";

function feeStatusColor(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "paid") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (value === "partial") return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  if (value === "pending") return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200";
  return "bg-muted text-muted-foreground";
}

function normalizeFeeStatus(value, fallback = "-") {
  const status = String(value || "").trim().toLowerCase();
  return status || fallback;
}

function formatClassScope(value) {
  const scope = String(value || "").trim().toLowerCase();
  if (scope === "hs") return "Higher Secondary";
  if (scope === "school") return "School";
  return value || "-";
}

function scopeBadgeClass(scope) {
  const value = String(scope || "").trim().toLowerCase();

  if (value === "hs") {
    return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-200";
  }

  if (value === "school") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200";
  }

  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-200";
}

function streamBadgeClass(stream) {
  const value = String(stream || "").trim().toLowerCase();

  if (!value || value === "-") {
    return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-200";
  }

  if (value.includes("science")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200";
  }

  if (value.includes("commerce")) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200";
  }

  if (value.includes("arts") || value.includes("humanities")) {
    return "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-200";
  }

  return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-200";
}

function mediumBadgeClass(medium) {
  const value = String(medium || "").trim().toLowerCase();

  if (value.includes("english")) {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200";
  }

  if (value.includes("assamese")) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200";
  }

  if (value.includes("hindi")) {
    return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-200";
  }

  if (value.includes("bengali")) {
    return "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/15 dark:text-teal-200";
  }

  return "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/15 dark:text-cyan-200";
}

function attendanceStatusColor(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "present") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (value === "absent") return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200";
  return "bg-muted text-muted-foreground";
}

function approvalStatusColor(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "approved") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (value === "pending") return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  if (value === "rejected") return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200";
  return "bg-muted text-muted-foreground";
}

function subjectGroupBadgeClass(group) {
  const value = String(group || "").trim().toLowerCase();
  if (value === "compulsory") {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200";
  }
  if (value === "elective") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200";
  }
  if (value === "optional") {
    return "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-200";
  }
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-200";
}

const EMPTY_PARENT = {
  name: "",
  mobile: "",
  email: "",
  occupation: "",
  qualification: "",
};

const StudentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasRole, can } = usePermissions();
  const isParent = hasRole("parent");
  const canEditParents = !isParent && can("student.update");
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [feeItems, setFeeItems] = useState([]);
  const [payments, setPayments] = useState([]);
  const [financeError, setFinanceError] = useState("");

  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [marksheetDownloading, setMarksheetDownloading] = useState(false);
  const [finalMarksheetDownloading, setFinalMarksheetDownloading] = useState(false);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [attendanceFilters, setAttendanceFilters] = useState({
    status: "",
    approval_status: "",
    date_from: "",
    date_to: "",
  });
  const [isEditingParents, setIsEditingParents] = useState(false);
  const [parentDraft, setParentDraft] = useState({
    father: { ...EMPTY_PARENT },
    mother: { ...EMPTY_PARENT },
  });
  const [parentSaveError, setParentSaveError] = useState("");
  const [parentSaveMessage, setParentSaveMessage] = useState("");
  const [savingParents, setSavingParents] = useState(false);
  const [subjectSelection, setSubjectSelection] = useState({
    enrollment: null,
    offerings: [],
  });
  const [selectedOfferingIds, setSelectedOfferingIds] = useState([]);
  const [subjectSelectionLoading, setSubjectSelectionLoading] = useState(false);
  const [subjectSelectionSaving, setSubjectSelectionSaving] = useState(false);
  const [subjectSelectionError, setSubjectSelectionError] = useState("");
  const [subjectSelectionMessage, setSubjectSelectionMessage] = useState("");
  const canEditSubjectSelection = !isParent && can("student.update");

  const loadStudent = useEffectEvent(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getStudent(id);
      const payload = res?.data ?? res ?? null;
      setStudent(payload);
      if (payload?.id) {
        await Promise.all([
          loadFinance(payload.id),
          loadExams(payload),
        ]);
      }
    } catch (err) {
      setError(err?.message || "Failed to load student details.");
    } finally {
      setLoading(false);
    }
  });

  const loadExams = useEffectEvent(async (studentPayload = null) => {
    try {
      const res = await (isParent
        ? getAccessibleExams()
        : getExams({
            session_id: studentPayload?.session_id,
            class_id: studentPayload?.class_id,
            section_id: studentPayload?.section_id,
            class_scope: studentPayload?.class_scope,
          }));
      const examList = res?.data || [];
      setExams(examList);
      setSelectedExamId((current) =>
        current && !examList.some((exam) => String(exam.id) === String(current)) ? "" : current
      );
    } catch {
      setExams([]);
      setSelectedExamId("");
    }
  });

  const loadReport = useEffectEvent(async (examId, studentId) => {
    setReportLoading(true);
    setReportError("");
    setReport(null);
    try {
      const res = await (isParent
        ? getMyResults({ exam_id: examId, student_id: studentId })
        : getStudentReport(examId, studentId));
      setReport(res?.data || null);
    } catch (err) {
      setReportError(err?.message || "Report not available for this exam.");
    } finally {
      setReportLoading(false);
    }
  });

  const loadAttendance = useEffectEvent(async (studentId) => {
    setAttendanceLoading(true);
    setAttendanceError("");
    try {
      const res = await getStudentAttendanceSessions({
        student_id: studentId,
        status: attendanceFilters.status || undefined,
        approval_status: attendanceFilters.approval_status || undefined,
        date_from: attendanceFilters.date_from || undefined,
        date_to: attendanceFilters.date_to || undefined,
      });
      setAttendanceRows(res?.data || []);
    } catch (err) {
      setAttendanceRows([]);
      setAttendanceError(err?.message || "Failed to load attendance records.");
    } finally {
      setAttendanceLoading(false);
    }
  });

  async function loadSubjectSelection(studentId) {
    setSubjectSelectionLoading(true);
    setSubjectSelectionError("");
    setSubjectSelectionMessage("");

    try {
      const res = await getStudentSubjectRegistrations(studentId);
      const data = res?.data || { enrollment: null, offerings: [] };
      const offerings = Array.isArray(data.offerings) ? data.offerings : [];

      setSubjectSelection({
        enrollment: data.enrollment || null,
        offerings,
      });
      setSelectedOfferingIds(
        offerings
          .filter((offering) => offering.auto_required || offering.registration_id)
          .map((offering) => Number(offering.id))
          .filter((offeringId) => Number.isFinite(offeringId)),
      );
    } catch (err) {
      setSubjectSelection({ enrollment: null, offerings: [] });
      setSelectedOfferingIds([]);
      setSubjectSelectionError(err?.message || "Failed to load subject choices.");
    } finally {
      setSubjectSelectionLoading(false);
    }
  }

  useEffect(() => {
    loadStudent();
  }, [id]);

  useEffect(() => {
    if (!student?.id || !selectedExamId) {
      setReport(null);
      return;
    }
    loadReport(selectedExamId, student.id);
  }, [selectedExamId, student?.id]);

  useEffect(() => {
    if (!student?.id) return;
    loadAttendance(student.id);
  }, [student?.id, attendanceFilters.status, attendanceFilters.approval_status, attendanceFilters.date_from, attendanceFilters.date_to]);

  useEffect(() => {
    if (!student?.id) return;
    loadSubjectSelection(student.id);
  }, [student?.id]);

  async function loadFinance(studentId) {
    setFinanceError("");
    try {
      const [feeRes, paymentRes] = await Promise.all(
        isParent
          ? [
              getMyStudentFeeOptions(studentId),
              getMyPayments({ student_id: studentId })
            ]
          : [
              getStudentFeeOptions(studentId),
              getPayments({ student_id: studentId })
            ]
      );
      setFeeItems(feeRes?.data || []);
      setPayments(paymentRes?.data || []);
    } catch (err) {
      const message = String(err?.message || "");
      if (message.toLowerCase().includes("fee structure not found")) {
        setFeeItems([]);
        setPayments([]);
        setFinanceError("No fee structure is configured for this student's class and session yet.");
        return;
      }

      setFinanceError(err?.message || "Failed to load fees and payments.");
    }
  }


  async function handleDownloadMarksheet() {
    if (!selectedExamId || !student?.id) return;
    setMarksheetDownloading(true);
    setReportError("");
    try {
      const blob = await (isParent
        ? downloadMyMarksheet({ exam_id: selectedExamId, student_id: student.id })
        : downloadStudentMarksheet(selectedExamId, student.id));
      if (!blob || blob.size === 0) {
        throw new Error("Downloaded file is empty");
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `marksheet-exam-${selectedExamId}-student-${student.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 5000);
    } catch (err) {
      setReportError(err?.message || "Failed to download marksheet.");
    } finally {
      setMarksheetDownloading(false);
    }
  }

  async function handleDownloadFinalMarksheet() {
    if (!student?.id) return;
    setFinalMarksheetDownloading(true);
    setReportError("");
    try {
      const blob = await downloadFinalMarksheet({ student_id: student.id });
      if (!blob || blob.size === 0) {
        throw new Error("Downloaded file is empty");
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `final-marksheet-student-${student.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 5000);
    } catch (err) {
      setReportError(err?.message || "Failed to download final marksheet.");
    } finally {
      setFinalMarksheetDownloading(false);
    }
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  const father = useMemo(
    () =>
      student?.parents?.find(
        (p) => String(p.relationship || "").trim().toLowerCase() === "father"
      ),
    [student]
  );
  const mother = useMemo(
    () =>
      student?.parents?.find(
        (p) => String(p.relationship || "").trim().toLowerCase() === "mother"
      ),
    [student]
  );
  const guardian = useMemo(
    () =>
      student?.parents?.find(
        (p) => String(p.relationship || "").trim().toLowerCase() === "guardian"
      ),
    [student]
  );
  const fatherDisplay = father || guardian || null;
  const motherDisplay = mother || guardian || null;

  useEffect(() => {
    setParentDraft({
      father: {
        name: String(fatherDisplay?.name || "").trim(),
        mobile: String(fatherDisplay?.mobile || "").trim(),
        email: String(fatherDisplay?.email || "").trim(),
        occupation: String(fatherDisplay?.occupation || "").trim(),
        qualification: String(fatherDisplay?.qualification || "").trim(),
      },
      mother: {
        name: String(motherDisplay?.name || "").trim(),
        mobile: String(motherDisplay?.mobile || "").trim(),
        email: String(motherDisplay?.email || "").trim(),
        occupation: String(motherDisplay?.occupation || "").trim(),
        qualification: String(motherDisplay?.qualification || "").trim(),
      },
    });
  }, [
    student?.id,
    fatherDisplay?.name,
    fatherDisplay?.mobile,
    fatherDisplay?.email,
    fatherDisplay?.occupation,
    fatherDisplay?.qualification,
    motherDisplay?.name,
    motherDisplay?.mobile,
    motherDisplay?.email,
    motherDisplay?.occupation,
    motherDisplay?.qualification,
  ]);

  function updateParentDraft(role, field, value) {
    setParentDraft((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [field]: value,
      },
    }));
  }

  function validateParentDraft() {
    const fatherMobile = String(parentDraft?.father?.mobile || "").trim();
    const motherMobile = String(parentDraft?.mother?.mobile || "").trim();
    const fatherName = String(parentDraft?.father?.name || "").trim();
    const motherName = String(parentDraft?.mother?.name || "").trim();
    const fatherEmail = String(parentDraft?.father?.email || "").trim();
    const motherEmail = String(parentDraft?.mother?.email || "").trim();

    if (!fatherMobile && !motherMobile) {
      return "At least one parent phone is required.";
    }
    if (fatherMobile && !/^\d{10}$/.test(fatherMobile)) {
      return "Father phone must be 10 digits.";
    }
    if (motherMobile && !/^\d{10}$/.test(motherMobile)) {
      return "Mother phone must be 10 digits.";
    }
    if (fatherMobile && !fatherName) {
      return "Father name is required when father phone is provided.";
    }
    if (motherMobile && !motherName) {
      return "Mother name is required when mother phone is provided.";
    }
    if (fatherEmail && !/^\S+@\S+\.\S+$/.test(fatherEmail)) {
      return "Father email is invalid.";
    }
    if (motherEmail && !/^\S+@\S+\.\S+$/.test(motherEmail)) {
      return "Mother email is invalid.";
    }
    return "";
  }

  async function handleSaveParents() {
    if (!student?.id || savingParents) return;
    setParentSaveError("");
    setParentSaveMessage("");

    const validation = validateParentDraft();
    if (validation) {
      setParentSaveError(validation);
      return;
    }

    setSavingParents(true);
    try {
      await updateStudentApi(student.id, {
        father: {
          name: String(parentDraft?.father?.name || "").trim(),
          mobile: String(parentDraft?.father?.mobile || "").trim(),
          email: String(parentDraft?.father?.email || "").trim(),
          occupation: String(parentDraft?.father?.occupation || "").trim(),
          qualification: String(parentDraft?.father?.qualification || "").trim(),
        },
        mother: {
          name: String(parentDraft?.mother?.name || "").trim(),
          mobile: String(parentDraft?.mother?.mobile || "").trim(),
          email: String(parentDraft?.mother?.email || "").trim(),
          occupation: String(parentDraft?.mother?.occupation || "").trim(),
          qualification: String(parentDraft?.mother?.qualification || "").trim(),
        },
      });
      setIsEditingParents(false);
      setParentSaveMessage("Parent details updated.");
      const refreshedRes = await getStudent(student.id);
      const refreshedPayload = refreshedRes?.data ?? refreshedRes ?? null;
      setStudent(refreshedPayload);
    } catch (err) {
      setParentSaveError(err?.message || "Failed to update parent details.");
    } finally {
      setSavingParents(false);
    }
  }

  function toggleSubjectOffering(offering) {
    if (offering.auto_required || !canEditSubjectSelection) return;

    const offeringId = Number(offering.id);
    if (!Number.isFinite(offeringId)) return;

    setSubjectSelectionMessage("");
    setSubjectSelectionError("");
    setSelectedOfferingIds((prev) =>
      prev.includes(offeringId)
        ? prev.filter((id) => id !== offeringId)
        : [...prev, offeringId],
    );
  }

  async function handleSaveSubjectSelection() {
    if (!student?.id || subjectSelectionSaving || !canEditSubjectSelection) return;

    setSubjectSelectionSaving(true);
    setSubjectSelectionError("");
    setSubjectSelectionMessage("");

    try {
      await replaceStudentSubjectRegistrations(student.id, {
        offering_ids: selectedOfferingIds,
      });
      await loadSubjectSelection(student.id);
      setSubjectSelectionMessage("Subject selection updated.");
    } catch (err) {
      setSubjectSelectionError(err?.message || "Failed to save subject selection.");
    } finally {
      setSubjectSelectionSaving(false);
    }
  }

  function handleCancelParentEdit() {
    setIsEditingParents(false);
    setParentSaveError("");
    setParentSaveMessage("");
    setParentDraft({
      father: {
        name: String(fatherDisplay?.name || "").trim(),
        mobile: String(fatherDisplay?.mobile || "").trim(),
        email: String(fatherDisplay?.email || "").trim(),
        occupation: String(fatherDisplay?.occupation || "").trim(),
        qualification: String(fatherDisplay?.qualification || "").trim(),
      },
      mother: {
        name: String(motherDisplay?.name || "").trim(),
        mobile: String(motherDisplay?.mobile || "").trim(),
        email: String(motherDisplay?.email || "").trim(),
        occupation: String(motherDisplay?.occupation || "").trim(),
        qualification: String(motherDisplay?.qualification || "").trim(),
      },
    });
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-700 dark:text-red-200">{error}</div>;
  }

  if (!student) {
    return <div>Student not found.</div>;
  }

  return (
    <div>
      {isParent ? (
        <TopBar title="Child Information" />
      ) : (
        <div className="mb-3 flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() =>
              navigate("/students", {
                state: {
                  focusStudentId: location.state?.focusStudentId || student.id,
                  tablePage: location.state?.tablePage,
                  tableRowsPerPage: location.state?.tableRowsPerPage,
                },
              })
            }
          >
            <ArrowLeft size={16} />
            Back to Students
          </Button>
          <div>
            <p className="text-3xl font-bold">Student Information</p>
          </div>
        </div>
      )}

      <div className="w-full bg-card rounded-xl border shadow-sm p-6 flex gap-6 items-start">
        <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted shrink-0">
          {student.photo_url ? (
            <img
              src={resolveServerImageUrl(student.photo_url)}
              alt={student.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <UserRound size={28} />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{student.name}</h2>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <IdCard size={15} /> {student.admission_no || "No admission no."}
                </span>
                <span className="flex items-center gap-1">
                  <Phone size={15} /> {student.mobile || "-"}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarDays size={15} /> DOB {formatReadableDate(student.dob)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{student.gender || "-"}</Badge>
              <Badge
                variant="outline"
                className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-200"
              >
                {student.class || "-"} - {student.section || "-"}
              </Badge>
              <Badge variant="outline" className={mediumBadgeClass(student.medium)}>
                {student.medium || "-"}
              </Badge>
              <Badge variant="outline" className={scopeBadgeClass(student.class_scope || "school")}>
                {formatClassScope(student.class_scope || "school")}
              </Badge>
              {student.class_scope === "hs" && student.stream_name ? (
                <Badge variant="outline" className={streamBadgeClass(student.stream_name)}>
                  {student.stream_name}
                </Badge>
              ) : null}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Roll No</p>
              <p className="font-medium">{student.roll_number || "-"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Session</p>
              <p className="font-medium">{student.session || "-"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Scope</p>
              <p className="font-medium">{formatClassScope(student.class_scope || "-")}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Medium</p>
              <p className="font-medium">{student.medium || "-"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Stream</p>
              <p className="font-medium">{student.class_scope === "hs" ? student.stream_name || "-" : "-"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Admission Date</p>
              <p className="font-medium">{formatReadableDate(student.date_of_admission)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Student ID</p>
              <p className="font-medium">#{student.id}</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-5">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="parents">Parents</TabsTrigger>
          <TabsTrigger value="subjects">Subject Selection</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="fees">Fees & Payments</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Class</p>
              <p className="text-base font-medium">{student.class || "-"}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Scope</p>
              <p className="text-base font-medium">{formatClassScope(student.class_scope || "-")}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Section</p>
              <p className="text-base font-medium">{student.section || "-"}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Medium</p>
              <p className="text-base font-medium">{student.medium || "-"}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Stream</p>
              <p className="text-base font-medium">{student.class_scope === "hs" ? student.stream_name || "-" : "-"}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Mobile</p>
              <p className="text-base font-medium">{student.mobile || "-"}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Gender</p>
              <p className="text-base font-medium">{student.gender || "-"}</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="parents" className="mt-4">
          {canEditParents ? (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {!isEditingParents ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditingParents(true);
                    setParentSaveError("");
                    setParentSaveMessage("");
                  }}
                >
                  Edit Parent Details
                </Button>
              ) : (
                <>
                  <Button onClick={handleSaveParents} disabled={savingParents}>
                    {savingParents ? "Saving..." : "Save Parent Details"}
                  </Button>
                  <Button variant="outline" onClick={handleCancelParentEdit} disabled={savingParents}>
                    Cancel
                  </Button>
                </>
              )}
            </div>
          ) : null}

          {parentSaveError ? (
            <p className="mb-3 text-sm text-red-700 dark:text-red-200">{parentSaveError}</p>
          ) : null}
          {parentSaveMessage ? (
            <p className="mb-3 text-sm text-emerald-700 dark:text-emerald-200">{parentSaveMessage}</p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-4 space-y-1">
              <h3 className="font-medium">Father</h3>
              {isEditingParents ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <Input
                      value={parentDraft?.father?.name || ""}
                      onChange={(e) => updateParentDraft("father", "name", e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <Input
                      value={parentDraft?.father?.mobile || ""}
                      inputMode="numeric"
                      onChange={(e) => updateParentDraft("father", "mobile", e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <Input
                      value={parentDraft?.father?.email || ""}
                      onChange={(e) => updateParentDraft("father", "email", e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Occupation</p>
                    <Input
                      value={parentDraft?.father?.occupation || ""}
                      onChange={(e) => updateParentDraft("father", "occupation", e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Qualification</p>
                    <Input
                      value={parentDraft?.father?.qualification || ""}
                      onChange={(e) => updateParentDraft("father", "qualification", e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm">Name: {fatherDisplay?.name || "-"}</p>
                  <p className="text-sm">Phone: {fatherDisplay?.mobile || "-"}</p>
                  <p className="text-sm">Email: {fatherDisplay?.email || "-"}</p>
                  <p className="text-sm">Occupation: {fatherDisplay?.occupation || "-"}</p>
                  <p className="text-sm">Qualification: {fatherDisplay?.qualification || "-"}</p>
                </>
              )}
            </div>

            <div className="rounded-lg border bg-card p-4 space-y-1">
              <h3 className="font-medium">Mother</h3>
              {isEditingParents ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <Input
                      value={parentDraft?.mother?.name || ""}
                      onChange={(e) => updateParentDraft("mother", "name", e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <Input
                      value={parentDraft?.mother?.mobile || ""}
                      inputMode="numeric"
                      onChange={(e) => updateParentDraft("mother", "mobile", e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <Input
                      value={parentDraft?.mother?.email || ""}
                      onChange={(e) => updateParentDraft("mother", "email", e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Occupation</p>
                    <Input
                      value={parentDraft?.mother?.occupation || ""}
                      onChange={(e) => updateParentDraft("mother", "occupation", e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Qualification</p>
                    <Input
                      value={parentDraft?.mother?.qualification || ""}
                      onChange={(e) => updateParentDraft("mother", "qualification", e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm">Name: {motherDisplay?.name || "-"}</p>
                  <p className="text-sm">Phone: {motherDisplay?.mobile || "-"}</p>
                  <p className="text-sm">Email: {motherDisplay?.email || "-"}</p>
                  <p className="text-sm">Occupation: {motherDisplay?.occupation || "-"}</p>
                  <p className="text-sm">Qualification: {motherDisplay?.qualification || "-"}</p>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="subjects" className="mt-4">
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold">Subject Selection</h3>
                <p className="text-sm text-muted-foreground">
                  Choose this student&apos;s elective or optional subjects. Compulsory subjects are always included.
                </p>
              </div>

              {canEditSubjectSelection ? (
                <Button
                  className="rounded-xl shadow-sm"
                  onClick={handleSaveSubjectSelection}
                  disabled={subjectSelectionSaving || subjectSelectionLoading}
                >
                  {subjectSelectionSaving ? "Saving..." : "Save Subjects"}
                </Button>
              ) : null}
            </div>

            {subjectSelection.enrollment ? (
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-200"
                >
                  {subjectSelection.enrollment.class_name || student.class || "-"}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-200"
                >
                  {subjectSelection.enrollment.section_name || student.section || "-"}
                </Badge>
                <Badge
                  variant="outline"
                  className={mediumBadgeClass(subjectSelection.enrollment.medium || student.medium)}
                >
                  {subjectSelection.enrollment.medium || student.medium || "-"}
                </Badge>
                {subjectSelection.enrollment.stream_name ? (
                  <Badge
                    variant="outline"
                    className={streamBadgeClass(subjectSelection.enrollment.stream_name)}
                  >
                    {subjectSelection.enrollment.stream_name}
                  </Badge>
                ) : null}
              </div>
            ) : null}

            {subjectSelectionError ? (
              <p className="text-sm text-red-700 dark:text-red-200">{subjectSelectionError}</p>
            ) : null}
            {subjectSelectionMessage ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-200">{subjectSelectionMessage}</p>
            ) : null}
            {subjectSelectionLoading ? (
              <p className="text-sm text-muted-foreground">Loading subject choices...</p>
            ) : null}

            {!subjectSelectionLoading && subjectSelection.offerings.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center">
                <p className="font-medium">No subjects available for this student</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Assign subjects to the student&apos;s class first, then return here to choose elective or optional subjects.
                </p>
              </div>
            ) : (
              <div className="grid gap-2">
                {subjectSelection.offerings.map((offering) => {
                  const offeringId = Number(offering.id);
                  const checked = offering.auto_required || selectedOfferingIds.includes(offeringId);
                  const disabled = offering.auto_required || !canEditSubjectSelection;
                  const groupLabel = String(offering.subject_group || "subject").replace(/^\w/, (char) => char.toUpperCase());

                  return (
                    <label
                      key={offering.id}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
                        checked
                          ? "border-foreground/20 bg-muted/70 text-foreground shadow-sm dark:border-border dark:bg-muted/30"
                          : "border-border bg-background text-foreground hover:bg-muted/40 dark:bg-background dark:hover:bg-muted/20"
                      } ${disabled ? "cursor-default" : "cursor-pointer"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        className="mt-1 size-4 rounded border-border accent-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 dark:accent-stone-300 dark:focus-visible:ring-offset-background"
                        onChange={() => toggleSubjectOffering(offering)}
                      />

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {offering.subject_name}
                            {offering.subject_code ? ` (${offering.subject_code})` : ""}
                          </span>
                          <Badge
                            variant="outline"
                            className={`rounded-full px-2 py-0 text-[11px] ${subjectGroupBadgeClass(offering.subject_group)}`}
                          >
                            {groupLabel}
                          </Badge>
                          {offering.auto_required ? (
                            <Badge
                              variant="outline"
                              className="rounded-full border-emerald-200 bg-emerald-50 px-2 py-0 text-[11px] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200"
                            >
                              Required
                            </Badge>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {offering.auto_required
                            ? "Compulsory subject is automatically selected."
                            : "Select this subject if the student takes it."}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4 space-y-4">
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:flex-wrap">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Attendance Status</label>
                <select
                  value={attendanceFilters.status}
                  onChange={(e) =>
                    setAttendanceFilters((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="min-w-40 rounded-md border bg-background px-3 py-2"
                >
                  <option value="">All Statuses</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Approval Status</label>
                <select
                  value={attendanceFilters.approval_status}
                  onChange={(e) =>
                    setAttendanceFilters((prev) => ({ ...prev, approval_status: e.target.value }))
                  }
                  className="min-w-40 rounded-md border bg-background px-3 py-2"
                >
                  <option value="">All Reviews</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">From Date</label>
                <Input
                  type="date"
                  value={attendanceFilters.date_from}
                  onChange={(e) =>
                    setAttendanceFilters((prev) => ({ ...prev, date_from: e.target.value }))
                  }
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">To Date</label>
                <Input
                  type="date"
                  value={attendanceFilters.date_to}
                  onChange={(e) =>
                    setAttendanceFilters((prev) => ({ ...prev, date_to: e.target.value }))
                  }
                />
              </div>

              <Button
                variant="outline"
                onClick={() =>
                  setAttendanceFilters({
                    status: "",
                    approval_status: "",
                    date_from: "",
                    date_to: "",
                  })
                }
              >
                Reset Filters
              </Button>
            </div>

            {attendanceError && <p className="text-sm text-red-700 dark:text-red-200">{attendanceError}</p>}
            {attendanceLoading && (
              <p className="text-sm text-muted-foreground">Loading attendance...</p>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Marked By</TableHead>
                  <TableHead>Reviewed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatReadableDate(row.date)}</TableCell>
                    <TableCell>
                      <span className={`px-3 py-1 text-xs rounded-full font-medium capitalize ${attendanceStatusColor(row.student_status)}`}>
                        {row.student_status || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-3 py-1 text-xs rounded-full font-medium capitalize ${approvalStatusColor(row.approval_status)}`}>
                        {row.approval_status || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{row.session_name || "-"}</TableCell>
                    <TableCell>{row.class_name || "-"}</TableCell>
                    <TableCell>{row.section_name || "-"}</TableCell>
                    <TableCell>{row.submitted_by_username || "-"}</TableCell>
                    <TableCell>{row.reviewed_by_username || "-"}</TableCell>
                  </TableRow>
                ))}
                {!attendanceLoading && attendanceRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No attendance records found for this student.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="fees" className="mt-4 space-y-4">
          {financeError && <p className="text-sm text-red-700 dark:text-red-200">{financeError}</p>}

          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <CreditCard size={16} /> Pending/Active Fee Items
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fee Type</TableHead>
                  <TableHead>Installment</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feeItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="capitalize">{item.fee_type || "-"}</TableCell>
                    <TableCell>{item.installment_name || "-"}</TableCell>
                    <TableCell>{formatReadableDate(item.due_date)}</TableCell>
                    <TableCell>{formatCurrency(item.amount)}</TableCell>
                    <TableCell>{formatCurrency(item.paid)}</TableCell>
                    <TableCell>{formatCurrency(item.remaining)}</TableCell>
                    <TableCell>
                      <span className={`px-3 py-1 text-xs rounded-full font-medium capitalize ${feeStatusColor(item.status)}`}>
                        {normalizeFeeStatus(item.status)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {feeItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No pending fee items for this student.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <BookOpen size={16} /> Payment History
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Fee Type</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatReadableDate(p.created_at)}</TableCell>
                    <TableCell>{formatCurrency(p.amount_paid)}</TableCell>
                    <TableCell className="capitalize">{p.fee_type || "-"}</TableCell>
                    <TableCell>{p.class_name || "-"}</TableCell>
                    <TableCell>{p.section_name || "-"}</TableCell>
                    <TableCell>
                      <span className={`px-3 py-1 text-xs rounded-full font-medium capitalize ${feeStatusColor(p.fee_status || p.status)}`}>
                        {normalizeFeeStatus(p.fee_status || p.status)}
                      </span>
                    </TableCell>
                    <TableCell>{p.remarks || "-"}</TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No payment history found for this student.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-4">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="font-semibold">Exam Report / Marksheet</h3>
            <div className="flex flex-col md:flex-row gap-2">
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="md:max-w-sm w-full border rounded-md px-3 py-2 bg-background"
              >
                <option value="">Select Exam</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </select>
              <Button
                onClick={handleDownloadMarksheet}
                disabled={!report || !selectedExamId || marksheetDownloading}
              >
                {marksheetDownloading ? "Downloading..." : "Download Marksheet"}
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadFinalMarksheet}
                disabled={!student?.id || finalMarksheetDownloading}
              >
                {finalMarksheetDownloading ? "Downloading..." : "Download Final"}
              </Button>
            </div>

            {reportLoading && <p className="text-sm text-muted-foreground">Loading report...</p>}
            {!selectedExamId && (
              <p className="text-sm text-muted-foreground">
                Select an exam to view this student&apos;s marksheet details.
              </p>
            )}
            {reportError && (
              <p className="text-sm text-muted-foreground">{reportError}</p>
            )}

            {report && (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground text-sm">Exam</p>
                    <p className="font-medium">{report.exam?.name}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground text-sm">Class</p>
                    <p className="font-medium">{report.exam?.class_name}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground text-sm">Section</p>
                    <p className="font-medium">{report.exam?.section_name}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground text-sm">Percentage</p>
                    <p className="font-medium">{report.summary?.percentage ?? 0}%</p>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Marks</TableHead>
                      <TableHead>Max Marks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report.subjects || []).map((row, idx) => (
                      <TableRow key={`${row.subject}-${idx}`}>
                        <TableCell>{row.subject}</TableCell>
                        <TableCell>{row.marks}</TableCell>
                        <TableCell>{row.max_marks}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentDetails;

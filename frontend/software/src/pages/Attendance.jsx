import { useEffect, useEffectEvent, useMemo, useState } from "react";
import TopBar from "../components/TopBar";
import DataTable from "../components/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "../components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAllTeacherAttendance } from "../api/teachers.api";
import { getClassStructure, getSessions } from "../api/academic.api";
import {
  getAbsenceMessageTemplates,
  getStudentAttendanceEntryScopes,
  getStudentAttendanceSessions,
  getPendingStudentAttendance,
  getStudentAttendanceRoster,
  getStudentAttendanceSession,
  notifyAbsentParents,
  reviewStudentAttendance,
  submitStudentAttendance,
} from "../api/attendance.api";
import { usePermissions } from "../hooks/usePermissions";
import { formatReadableDate, formatReadableDateTime } from "../lib/dateTime";

const teacherAttendanceColumns = [
  { header: "Teacher", accessor: "teacher" },
  {
    header: "Punch Time",
    accessor: "punch_time",
    cell: (row) => formatReadableDateTime(row.punch_time),
  },
  {
    header: "Punch Type",
    accessor: "punch_type",
    cell: (row) => String(row.punch_type || "-").toUpperCase(),
  },
  {
    header: "Device",
    accessor: "device_name",
    cell: (row) => row.device_name || row.device_code || "-",
  },
  { header: "Location", accessor: "location" },
];

const FIELD_CLASSNAME =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-hidden transition focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60";

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function SectionShell({ title, description, action, children }) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function Attendance() {
  const { can, hasRole } = usePermissions();
  const isTeacher = hasRole("teacher");
  const canManageTeachers = can("teacher.update");
  const canViewTeacherLogs = can("teacher.view");
  const canReviewStudentAttendance = can("student_attendance.review") || can("marks.approve");
  const canNotifyParents = can("student_attendance.notify");
  const [activeTab, setActiveTab] = useState("student-attendance");

  const [teacherAttendance, setTeacherAttendance] = useState([]);
  const [teacherLoading, setTeacherLoading] = useState(false);

  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [entryScopeMap, setEntryScopeMap] = useState({
    restricted: false,
    assignments: [],
  });
  const [form, setForm] = useState({
    session_id: "",
    class_id: "",
    section_id: "",
    date: todayDate(),
  });
  const [roster, setRoster] = useState([]);
  const [rosterMeta, setRosterMeta] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [pendingRows, setPendingRows] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [bulkReviewLoading, setBulkReviewLoading] = useState(false);
  const [selectedPendingId, setSelectedPendingId] = useState(null);
  const [selectedPending, setSelectedPending] = useState(null);
  const [selectedPendingIds, setSelectedPendingIds] = useState([]);
  const [pendingFilters, setPendingFilters] = useState({
    class_id: "",
    section_id: "",
    sort_by: "latest",
  });
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [approvedRows, setApprovedRows] = useState([]);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [selectedApprovedId, setSelectedApprovedId] = useState(null);
  const [selectedApproved, setSelectedApproved] = useState(null);
  const [notifyFilters, setNotifyFilters] = useState({
    class_id: "",
    section_id: "",
  });
  const [dailyRows, setDailyRows] = useState([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [selectedDaily, setSelectedDaily] = useState(null);
  const [messageTemplates, setMessageTemplates] = useState([]);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyForm, setNotifyForm] = useState({
    template_key: "",
    message: "",
    student_ids: [],
  });

  useEffect(() => {
    loadAcademicOptions();
    if (canViewTeacherLogs) {
      loadTeacherAttendance();
    }
    if (canReviewStudentAttendance) {
      loadPendingAttendance();
    }
    if (canNotifyParents) {
      loadApprovedAttendance();
      loadMessageTemplates();
    }
  }, [canViewTeacherLogs, canReviewStudentAttendance, canNotifyParents]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    setSelectedPendingIds((prev) =>
      prev.filter((id) => pendingRows.some((row) => Number(row.id) === Number(id)))
    );
  }, [pendingRows]);

  const autoLoadTabEvent = useEffectEvent(() => {
    if (activeTab === "student-attendance") {
      if (form.class_id && form.section_id) {
        handleLoadRoster();
      }
      return;
    }

    if (activeTab === "pending-approval" && canReviewStudentAttendance) {
      loadPendingAttendance();
      return;
    }

    if (activeTab === "parent-messages" && canNotifyParents) {
      loadApprovedAttendance();
      return;
    }

    if (activeTab === "teacher-approved" && isTeacher) {
      loadApprovedAttendance();
      return;
    }

    if (activeTab === "daily-data" && isTeacher) {
      loadDailyAttendance();
      return;
    }

    if (activeTab === "teacher-logs" && canViewTeacherLogs) {
      loadTeacherAttendance();
    }
  });

  useEffect(() => {
    autoLoadTabEvent();
  }, [activeTab]);

  const autoLoadSingleTeacherRosterEvent = useEffectEvent(() => {
    if (
      activeTab !== "student-attendance" ||
      !isTeacher ||
      !entryScopeMap.restricted ||
      !form.class_id ||
      !form.section_id
    ) {
      return;
    }

    const uniquePairs = new Map();
    entryScopeMap.assignments.forEach((row) => {
      const key = `${row.class_id}:${row.section_id}`;
      if (!uniquePairs.has(key)) {
        uniquePairs.set(key, row);
      }
    });

    if (uniquePairs.size !== 1) return;
    handleLoadRoster();
  });

  useEffect(() => {
    autoLoadSingleTeacherRosterEvent();
  }, [
    activeTab,
    isTeacher,
    entryScopeMap,
    form.class_id,
    form.section_id,
    form.session_id,
    form.date,
  ]);

  async function loadAcademicOptions() {
    try {
      const [classRes, sessionRes, entryScopeRes] = await Promise.all([
        getClassStructure(),
        getSessions(),
        getStudentAttendanceEntryScopes(),
      ]);
      const classRows = classRes?.data || [];
      const sessionRows = sessionRes?.data || [];
      const entryScopeData = entryScopeRes?.data || { restricted: false, assignments: [] };
      const assignmentRows = Array.isArray(entryScopeData.assignments)
        ? entryScopeData.assignments
        : [];

      if (entryScopeData.restricted) {
        const allowedClassIds = new Set(assignmentRows.map((row) => String(row.class_id)));
        const allowedSections = new Set(
          assignmentRows.map((row) => `${row.class_id}:${row.section_id}`)
        );
        const allowedSessionIds = new Set(assignmentRows.map((row) => String(row.session_id)));

        setClasses(
          classRows
            .filter((row) => allowedClassIds.has(String(row.id)))
            .map((row) => ({
              ...row,
              sections: Array.isArray(row.sections)
                ? row.sections.filter((section) =>
                    allowedSections.has(`${row.id}:${section.id}`)
                  )
                : [],
            }))
        );
        setSessions(sessionRows.filter((row) => allowedSessionIds.has(String(row.id))));
      } else {
        setClasses(classRows);
        setSessions(sessionRows);
      }

      setEntryScopeMap(entryScopeData);

      const activeSession = sessionRows.find((session) => session.is_active);
      if (entryScopeData.restricted && assignmentRows.length) {
        const defaultAssignment = assignmentRows[0];
        setForm((prev) => ({
          ...prev,
          session_id: String(defaultAssignment.session_id || ""),
          class_id: String(defaultAssignment.class_id || ""),
          section_id: String(defaultAssignment.section_id || ""),
        }));
      } else if (activeSession) {
        setForm((prev) => ({ ...prev, session_id: String(activeSession.id) }));
      }
    } catch (err) {
      setError(err?.message || "Failed to load attendance options.");
    }
  }

  async function loadTeacherAttendance() {
    setTeacherLoading(true);
    try {
      const res = await getAllTeacherAttendance();
      setTeacherAttendance(res?.data || []);
    } catch (err) {
      setTeacherAttendance([]);
      setError(err?.message || "Failed to load teacher attendance.");
    } finally {
      setTeacherLoading(false);
    }
  }

  async function loadPendingAttendance() {
    setPendingLoading(true);
    try {
      const res = await getPendingStudentAttendance();
      setPendingRows(res?.data || []);
    } catch (err) {
      setPendingRows([]);
      setError(err?.message || "Failed to load pending student attendance.");
    } finally {
      setPendingLoading(false);
    }
  }

  async function loadApprovedAttendance() {
    setApprovedLoading(true);
    try {
      const res = await getStudentAttendanceSessions({ approval_status: "approved" });
      setApprovedRows((res?.data || []).filter((row) => Number(row.absent_count || 0) > 0));
    } catch (err) {
      setApprovedRows([]);
      setError(err?.message || "Failed to load approved student attendance.");
    } finally {
      setApprovedLoading(false);
    }
  }

  async function loadDailyAttendance() {
    setDailyLoading(true);
    try {
      const res = await getStudentAttendanceSessions();
      setDailyRows(res?.data || []);
    } catch (err) {
      setDailyRows([]);
      setError(err?.message || "Failed to load daily attendance history.");
    } finally {
      setDailyLoading(false);
    }
  }

  async function loadMessageTemplates() {
    try {
      const res = await getAbsenceMessageTemplates();
      setMessageTemplates(res?.data || []);
    } catch {
      setMessageTemplates([]);
    }
  }

  async function handleOpenPending(sessionId) {
    setSelectedPendingId(sessionId);
    setReviewRemarks("");
    setReviewLoading(true);
    try {
      const res = await getStudentAttendanceSession(sessionId);
      setSelectedPending(res?.data || null);
    } catch (err) {
      setSelectedPending(null);
      setError(err?.message || "Failed to load attendance review details.");
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleOpenApproved(sessionId) {
    setSelectedApprovedId(sessionId);
    setNotifyForm({
      template_key: "",
      message: "",
      student_ids: [],
    });
    setReviewLoading(true);
    try {
      const res = await getStudentAttendanceSession(sessionId);
      const payload = res?.data || null;
      setSelectedApproved(payload);
      const absentStudentIds = (payload?.rows || [])
        .filter((row) => row.status === "absent")
        .map((row) => Number(row.student_id));
      setNotifyForm((prev) => ({
        ...prev,
        student_ids: absentStudentIds,
      }));
    } catch (err) {
      setSelectedApproved(null);
      setError(err?.message || "Failed to load approved attendance details.");
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleOpenDaily(sessionId) {
    setReviewLoading(true);
    try {
      const res = await getStudentAttendanceSession(sessionId);
      setSelectedDaily(res?.data || null);
    } catch (err) {
      setSelectedDaily(null);
      setError(err?.message || "Failed to load attendance details.");
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleLoadRoster() {
    if (!form.class_id || !form.section_id) {
      setError("Select class and section to load students.");
      return;
    }

    setRosterLoading(true);
    setError("");

    try {
      const res = await getStudentAttendanceRoster({
        class_id: form.class_id,
        section_id: form.section_id,
        session_id: form.session_id || undefined,
      });

      const payload = res?.data || {};
      const students = Array.isArray(payload.students) ? payload.students : [];

      setRoster(
        students.map((student) => ({
          ...student,
          status: student.status || "present",
        }))
      );
      setRosterMeta(payload);
    } catch (err) {
      setRoster([]);
      setRosterMeta(null);
      setError(err?.message || "Failed to load student roster.");
    } finally {
      setRosterLoading(false);
    }
  }

  function updateStudentStatus(studentId, status) {
    setRoster((prev) =>
      prev.map((student) =>
        student.student_id === studentId ? { ...student, status } : student
      )
    );
  }

  function bulkMark(status) {
    setRoster((prev) => prev.map((student) => ({ ...student, status })));
  }

  async function handleSubmitAttendance() {
    if (!form.class_id || !form.section_id || !form.date) {
      setError("Session, class, section, and date are required.");
      return;
    }
    if (!roster.length) {
      setError("Load the student roster before submitting attendance.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await submitStudentAttendance({
        session_id: form.session_id || rosterMeta?.academic_session_id || undefined,
        class_id: Number(form.class_id),
        section_id: Number(form.section_id),
        date: form.date,
        attendance: roster.map((student) => ({
          student_id: student.student_id,
          status: student.status,
        })),
      });

      const approvalStatus = res?.data?.approval_status || "pending";
      setNotice({
        title: "Attendance Submitted",
        message:
          approvalStatus === "approved"
            ? "Student attendance recorded and approved successfully."
            : "Student attendance submitted successfully for admin approval.",
      });
      setRoster([]);
      setRosterMeta(null);
      if (canReviewStudentAttendance) {
        await loadPendingAttendance();
      }
    } catch (err) {
      setError(err?.message || "Failed to submit attendance.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(status) {
    if (!selectedPendingId) return;

    setReviewLoading(true);
    try {
      await reviewStudentAttendance({
        attendance_session_id: selectedPendingId,
        status,
        remarks: reviewRemarks || undefined,
      });
      setNotice({
        title: `Attendance ${status === "approved" ? "Approved" : "Rejected"}`,
        message:
          status === "approved"
            ? "Student attendance approved successfully."
            : "Student attendance rejected successfully.",
      });
      setSelectedPending(null);
      setSelectedPendingId(null);
      setReviewRemarks("");
      await loadPendingAttendance();
      if (status === "approved" && canNotifyParents) {
        await loadApprovedAttendance();
      }
    } catch (err) {
      setError(err?.message || "Failed to review attendance.");
    } finally {
      setReviewLoading(false);
    }
  }

  function togglePendingSelection(sessionId, checked) {
    setSelectedPendingIds((prev) =>
      checked
        ? [...new Set([...prev, Number(sessionId)])]
        : prev.filter((id) => id !== Number(sessionId))
    );
  }

  function toggleSelectAllPending(checked, rows) {
    if (checked) {
      setSelectedPendingIds(rows.map((row) => Number(row.id)));
      return;
    }

    setSelectedPendingIds([]);
  }

  async function handleBulkApprove() {
    if (!selectedPendingIds.length) {
      setError("Select at least one pending attendance session to approve.");
      return;
    }

    setBulkReviewLoading(true);
    setError("");

    try {
      await Promise.all(
        selectedPendingIds.map((sessionId) =>
          reviewStudentAttendance({
            attendance_session_id: sessionId,
            status: "approved",
          })
        )
      );

      setNotice({
        title: "Attendance Approved",
        message: `${selectedPendingIds.length} attendance session${selectedPendingIds.length > 1 ? "s" : ""} approved successfully.`,
      });

      setSelectedPendingIds([]);
      if (selectedPendingId && selectedPendingIds.includes(Number(selectedPendingId))) {
        setSelectedPending(null);
        setSelectedPendingId(null);
        setReviewRemarks("");
      }
      await loadPendingAttendance();
      if (canNotifyParents) {
        await loadApprovedAttendance();
      }
    } catch (err) {
      setError(err?.message || "Failed to approve selected attendance sessions.");
    } finally {
      setBulkReviewLoading(false);
    }
  }

  function toggleNotifyStudent(studentId, checked) {
    setNotifyForm((prev) => ({
      ...prev,
      student_ids: checked
        ? [...new Set([...prev.student_ids, Number(studentId)])]
        : prev.student_ids.filter((id) => id !== Number(studentId)),
    }));
  }

  async function handleNotifyParents() {
    if (!selectedApprovedId) return;
    if (!notifyForm.student_ids.length) {
      setError("Select at least one absent student to notify parents.");
      return;
    }
    if (!notifyForm.template_key && !String(notifyForm.message || "").trim()) {
      setError("Choose a template or enter a custom message.");
      return;
    }

    setNotifyLoading(true);
    setError("");

    try {
      const res = await notifyAbsentParents(selectedApprovedId, {
        template_key: notifyForm.template_key || undefined,
        message: notifyForm.template_key ? undefined : notifyForm.message,
        student_ids: notifyForm.student_ids,
      });
      const sentCount = res?.data?.sent_count || 0;
      const failedCount = res?.data?.failed_count || 0;
      setNotice({
        title: sentCount > 0 ? "Parent Messages Sent" : "Parent Messages Failed",
        message:
          failedCount > 0
            ? `${sentCount} messages sent. ${failedCount} failed.`
            : `${sentCount} parent messages sent successfully.`,
      });
      await handleOpenApproved(selectedApprovedId);
    } catch (err) {
      setError(err?.message || "Failed to notify absent parents.");
    } finally {
      setNotifyLoading(false);
    }
  }

  const selectedClass = useMemo(
    () => classes.find((item) => String(item.id) === String(form.class_id)),
    [classes, form.class_id]
  );
  const availableSessions = useMemo(() => {
    if (!entryScopeMap.restricted || !form.class_id) return sessions;

    const allowedSessionIds = new Set(
      entryScopeMap.assignments
        .filter((row) => String(row.class_id) === String(form.class_id))
        .map((row) => String(row.session_id))
    );

    return sessions.filter((session) => allowedSessionIds.has(String(session.id)));
  }, [entryScopeMap, form.class_id, sessions]);
  const availableClasses = useMemo(() => {
    if (!entryScopeMap.restricted) return classes;

    const uniqueClassIds = [...new Set(entryScopeMap.assignments.map((row) => String(row.class_id)))];
    return uniqueClassIds
      .map((classId) => classes.find((item) => String(item.id) === classId))
      .filter(Boolean);
  }, [classes, entryScopeMap]);
  const sections = useMemo(() => {
    const classSections = selectedClass?.sections || [];
    if (!entryScopeMap.restricted || !form.class_id) return classSections;

    const allowedSectionIds = new Set(
      entryScopeMap.assignments
        .filter(
          (row) =>
            String(row.class_id) === String(form.class_id) &&
            (!form.session_id || String(row.session_id) === String(form.session_id))
        )
        .map((row) => String(row.section_id))
    );

    return classSections.filter((section) => allowedSectionIds.has(String(section.id)));
  }, [entryScopeMap, form.class_id, form.session_id, selectedClass]);
  const notifyFilterClasses = useMemo(() => {
    const uniqueClasses = new Map();
    approvedRows.forEach((row) => {
      const key = String(row.class_id || "");
      if (!key || uniqueClasses.has(key)) return;
      uniqueClasses.set(key, {
        id: Number(row.class_id),
        name: row.class_name || `Class ${key}`,
      });
    });
    return [...uniqueClasses.values()];
  }, [approvedRows]);
  const notifyFilterSections = useMemo(() => {
    const uniqueSections = new Map();
    approvedRows
      .filter(
        (row) =>
          !notifyFilters.class_id || String(row.class_id) === String(notifyFilters.class_id)
      )
      .forEach((row) => {
        const key = String(row.section_id || "");
        if (!key || uniqueSections.has(key)) return;
        uniqueSections.set(key, {
          id: Number(row.section_id),
          name: row.section_name || `Section ${key}`,
        });
      });
    return [...uniqueSections.values()];
  }, [approvedRows, notifyFilters.class_id]);
  const filteredApprovedRows = useMemo(
    () =>
      approvedRows.filter((row) => {
        if (notifyFilters.class_id && String(row.class_id) !== String(notifyFilters.class_id)) {
          return false;
        }
        if (
          notifyFilters.section_id &&
          String(row.section_id) !== String(notifyFilters.section_id)
        ) {
          return false;
        }
        return true;
      }),
    [approvedRows, notifyFilters.class_id, notifyFilters.section_id]
  );
  const pendingFilterClasses = useMemo(() => {
    if (entryScopeMap.restricted) {
      const uniqueClasses = new Map();
      entryScopeMap.assignments.forEach((row) => {
        const key = String(row.class_id);
        if (!uniqueClasses.has(key)) {
          uniqueClasses.set(key, {
            id: Number(row.class_id),
            name: row.class_name,
          });
        }
      });
      return [...uniqueClasses.values()];
    }

    const uniqueClasses = new Map();
    pendingRows.forEach((row) => {
      const key = String(row.class_id);
      if (!uniqueClasses.has(key)) {
        uniqueClasses.set(key, {
          id: Number(row.class_id),
          name: row.class_name || "-",
        });
      }
    });
    return [...uniqueClasses.values()];
  }, [entryScopeMap, pendingRows]);

  useEffect(() => {
    if (!notifyFilters.class_id) {
      if (notifyFilters.section_id) {
        setNotifyFilters((prev) => ({ ...prev, section_id: "" }));
      }
      return;
    }
    if (!notifyFilterSections.some((item) => String(item.id) === String(notifyFilters.section_id))) {
      setNotifyFilters((prev) => ({ ...prev, section_id: "" }));
    }
  }, [notifyFilters.class_id, notifyFilters.section_id, notifyFilterSections]);

  useEffect(() => {
    if (!selectedApprovedId) return;
    if (!filteredApprovedRows.some((row) => Number(row.id) === Number(selectedApprovedId))) {
      setSelectedApprovedId(null);
      setSelectedApproved(null);
      setNotifyForm((prev) => ({ ...prev, student_ids: [] }));
    }
  }, [filteredApprovedRows, selectedApprovedId]);
  const pendingFilterSections = useMemo(() => {
    if (entryScopeMap.restricted) {
      const uniqueSections = new Map();
      entryScopeMap.assignments
        .filter(
          (row) =>
            !pendingFilters.class_id || String(row.class_id) === String(pendingFilters.class_id)
        )
        .forEach((row) => {
          const key = `${row.class_id}:${row.section_id}`;
          if (!uniqueSections.has(key)) {
            uniqueSections.set(key, {
              id: Number(row.section_id),
              class_id: Number(row.class_id),
              name: row.section_name,
              medium: row.medium,
            });
          }
        });
      return [...uniqueSections.values()];
    }

    const uniqueSections = new Map();
    pendingRows
      .filter(
        (row) =>
          !pendingFilters.class_id || String(row.class_id) === String(pendingFilters.class_id)
      )
      .forEach((row) => {
        const key = `${row.class_id}:${row.section_id}`;
        if (!uniqueSections.has(key)) {
          uniqueSections.set(key, {
            id: Number(row.section_id),
            class_id: Number(row.class_id),
            name: row.section_name || "-",
            medium: row.medium || "",
          });
        }
      });
    return [...uniqueSections.values()];
  }, [entryScopeMap, pendingFilters.class_id, pendingRows]);
  const filteredPendingRows = useMemo(() => {
    const rows = pendingRows.filter((row) => {
      if (
        pendingFilters.class_id &&
        String(row.class_id) !== String(pendingFilters.class_id)
      ) {
        return false;
      }
      if (
        pendingFilters.section_id &&
        String(row.section_id) !== String(pendingFilters.section_id)
      ) {
        return false;
      }
      return true;
    });

    return [...rows].sort((a, b) => {
      if (pendingFilters.sort_by === "class") {
        return String(a.class_name || "").localeCompare(String(b.class_name || ""));
      }
      if (pendingFilters.sort_by === "section") {
        return String(a.section_name || "").localeCompare(String(b.section_name || ""));
      }
      return String(b.date || "").localeCompare(String(a.date || "")) || Number(b.id) - Number(a.id);
    });
  }, [pendingFilters, pendingRows]);
  const allFilteredPendingSelected =
    filteredPendingRows.length > 0 &&
    filteredPendingRows.every((row) => selectedPendingIds.includes(Number(row.id)));
  const presentCount = roster.filter((student) => student.status === "present").length;
  const absentCount = roster.filter((student) => student.status === "absent").length;
  const approvedAbsentRows = (selectedApproved?.rows || []).filter((row) => row.status === "absent");
  const teacherApprovedRows = useMemo(
    () => approvedRows.filter((row) => Number(row.absent_count || 0) >= 0),
    [approvedRows]
  );
  const existingAttendanceStatus = String(rosterMeta?.existing_approval_status || "").trim().toLowerCase();
  const hasExistingAttendance = Boolean(rosterMeta?.existing_session_id);
  const attendanceIsLocked =
    hasExistingAttendance &&
    existingAttendanceStatus !== "rejected";
  const attendanceStatusTone =
    existingAttendanceStatus === "approved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : existingAttendanceStatus === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : existingAttendanceStatus === "rejected"
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : "border-slate-200 bg-slate-50 text-slate-700";

  const tabCount =
    1 +
    (canReviewStudentAttendance ? 1 : 0) +
    (canNotifyParents ? 1 : 0) +
    (canViewTeacherLogs ? 1 : 0) +
    (isTeacher ? 2 : 0);

  return (
    <>
      <div className="pointer-events-none fixed top-6 right-6 z-50 w-full max-w-sm">
        {notice && (
          <Alert className="pointer-events-auto overflow-hidden border shadow-xl">
            <AlertTitle>{notice.title}</AlertTitle>
            <AlertDescription>{notice.message}</AlertDescription>
          </Alert>
        )}
      </div>

      <TopBar
        title={canManageTeachers ? "Attendance" : "Student Attendance"}
        subTitle={
          canManageTeachers
            ? "Record student attendance and review teacher machine logs"
            : canViewTeacherLogs
              ? "Record daily student attendance and review your machine attendance logs"
              : "Record daily student attendance for your assigned class and section"
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
        <TabsList
          variant="line"
          className={`grid w-full ${tabCount >= 6 ? "md:grid-cols-6" : tabCount === 5 ? "md:grid-cols-5" : tabCount === 4 ? "md:grid-cols-4" : tabCount === 3 ? "md:grid-cols-3" : tabCount === 2 ? "md:grid-cols-2" : "grid-cols-1"}`}
        >
          <TabsTrigger value="student-attendance">Take</TabsTrigger>
          {isTeacher ? (
            <TabsTrigger value="teacher-approved">Approved</TabsTrigger>
          ) : null}
          {isTeacher ? (
            <TabsTrigger value="daily-data">History</TabsTrigger>
          ) : null}
          {canReviewStudentAttendance ? (
            <TabsTrigger value="pending-approval">Review</TabsTrigger>
          ) : null}
          {canNotifyParents ? (
            <TabsTrigger value="parent-messages">Notify</TabsTrigger>
          ) : null}
          {canViewTeacherLogs ? (
            <TabsTrigger value="teacher-logs">Logs</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="student-attendance" className="mt-4 space-y-4">
          <SectionShell
            title="Attendance Entry"
            description="Start with the class, section, and date. Then load the student list."
          >
            {entryScopeMap.restricted ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                You can take attendance only for classes and sections assigned to you.
              </div>
            ) : null}

            {hasExistingAttendance ? (
              <div className={`rounded-md border px-4 py-3 text-sm ${attendanceStatusTone}`}>
                <p className="font-medium capitalize">
                  Attendance already recorded for {formatReadableDate(rosterMeta?.date)}.
                </p>
                <p className="mt-1">
                  Current status: {existingAttendanceStatus || "recorded"}.
                  {existingAttendanceStatus === "approved"
                    ? " This session is locked after admin approval and cannot be changed."
                    : existingAttendanceStatus === "pending"
                      ? " This session has already been submitted and is shown here for review only."
                      : existingAttendanceStatus === "rejected"
                        ? " This session was rejected. Update the attendance below and submit it again."
                        : " This session has already been submitted and is shown here for review only."}
                </p>
                <p className="mt-1 text-xs opacity-80">
                  Submitted by {rosterMeta?.existing_submitted_by_username || "-"}
                  {rosterMeta?.existing_reviewed_by_username
                    ? ` | Reviewed by ${rosterMeta.existing_reviewed_by_username}`
                    : ""}
                </p>
              </div>
            ) : null}

            <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Class And Date
              </div>
              <div className="grid gap-3 md:grid-cols-4">
              <div className="grid gap-2">
                <Label>Session</Label>
                <select
                  className={FIELD_CLASSNAME}
                  value={form.session_id}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      session_id: e.target.value,
                      section_id: entryScopeMap.restricted ? "" : prev.section_id,
                    }))
                  }
                >
                  <option value="">Active / Default Session</option>
                  {availableSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Class</Label>
                <select
                  className={FIELD_CLASSNAME}
                  value={form.class_id}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      class_id: e.target.value,
                      session_id:
                        entryScopeMap.restricted && e.target.value
                          ? String(
                              entryScopeMap.assignments.find(
                                (row) => String(row.class_id) === String(e.target.value)
                              )?.session_id || ""
                            )
                          : prev.session_id,
                      section_id: "",
                    }))
                  }
                >
                  <option value="">Select Class</option>
                  {availableClasses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Section</Label>
                <select
                  className={FIELD_CLASSNAME}
                  value={form.section_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, section_id: e.target.value }))}
                  disabled={!form.class_id || (isTeacher && sections.length === 0)}
                >
                  <option value="">Select Section</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}{section.medium ? ` (${section.medium})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleLoadRoster} disabled={rosterLoading}>
                {rosterLoading ? "Loading..." : "Load Students"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => bulkMark("present")}
                disabled={!roster.length || attendanceIsLocked}
              >
                Mark All Present
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => bulkMark("absent")}
                disabled={!roster.length || attendanceIsLocked}
              >
                Mark All Absent
              </Button>
              <Button
                type="button"
                onClick={handleSubmitAttendance}
                disabled={submitting || !roster.length || attendanceIsLocked}
              >
                {attendanceIsLocked
                  ? "Attendance Locked"
                  : submitting
                    ? "Submitting..."
                    : existingAttendanceStatus === "rejected"
                      ? "Resubmit Attendance"
                      : "Submit Attendance"}
              </Button>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            {rosterMeta ? (
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-sky-500/10 via-background to-transparent p-3 shadow-sm">
                  <p className="text-sm text-muted-foreground">Session</p>
                  <p className="font-medium">{rosterMeta.academic_session_name || "-"}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-violet-500/10 via-background to-transparent p-3 shadow-sm">
                  <p className="text-sm text-muted-foreground">Students</p>
                  <p className="font-medium">{roster.length}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-emerald-500/10 via-background to-transparent p-3 shadow-sm">
                  <p className="text-sm text-muted-foreground">Present</p>
                  <p className="font-medium text-emerald-700 dark:text-emerald-200">{presentCount}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-rose-500/10 via-background to-transparent p-3 shadow-sm">
                  <p className="text-sm text-muted-foreground">Absent</p>
                  <p className="font-medium text-red-700 dark:text-red-200">{absentCount}</p>
                </div>
                {hasExistingAttendance ? (
                  <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-amber-500/10 via-background to-transparent p-3 shadow-sm">
                    <p className="text-sm text-muted-foreground">Approval Status</p>
                    <p className="font-medium capitalize">{existingAttendanceStatus || "-"}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-xl border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Roll</th>
                    <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Student</th>
                    <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((student) => (
                    <tr key={student.student_id} className="border-b transition-colors hover:bg-muted/35">
                      <td className="px-3 py-2">{student.roll_number || "-"}</td>
                      <td className="px-3 py-2">{student.name}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={student.status === "present" ? "default" : "outline"}
                            onClick={() => updateStudentStatus(student.student_id, "present")}
                            disabled={attendanceIsLocked}
                          >
                            Present
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={student.status === "absent" ? "destructive" : "outline"}
                            onClick={() => updateStudentStatus(student.student_id, "absent")}
                            disabled={attendanceIsLocked}
                          >
                            Absent
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!rosterLoading && roster.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                        Load a class and section roster to record attendance.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </SectionShell>
        </TabsContent>

        {isTeacher ? (
          <TabsContent value="teacher-approved" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_460px]">
              <div className="rounded-xl border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Approved Attendance Sessions</h3>
                    <p className="text-sm text-muted-foreground">
                      View attendance sessions that have already been approved by admin.
                    </p>
                  </div>
                  <Button variant="outline" onClick={loadApprovedAttendance} disabled={approvedLoading}>
                    {approvedLoading ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>

                <div className="rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/40 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.16em] [&_th]:text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Class</th>
                        <th className="px-3 py-2 text-left">Section</th>
                        <th className="px-3 py-2 text-left">Absent</th>
                        <th className="px-3 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teacherApprovedRows.map((row) => (
                        <tr key={row.id} className="border-b">
                          <td className="px-3 py-2">{formatReadableDate(row.date)}</td>
                          <td className="px-3 py-2">{row.class_name || "-"}</td>
                          <td className="px-3 py-2">{row.section_name || "-"}</td>
                          <td className="px-3 py-2">{row.absent_count || 0}</td>
                          <td className="px-3 py-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => handleOpenApproved(row.id)}>
                              Open
                            </Button>
                          </td>
                        </tr>
                      ))}

                      {!approvedLoading && teacherApprovedRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                            No approved attendance sessions are available yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-4">
                <div>
                  <h3 className="font-semibold">Approved Session Details</h3>
                  <p className="text-sm text-muted-foreground">
                    Review the final locked attendance after admin approval.
                  </p>
                </div>

                {reviewLoading ? (
                  <p className="text-sm text-muted-foreground">Loading approved session...</p>
                ) : selectedApproved ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Date</p>
                        <p className="font-medium">{formatReadableDate(selectedApproved.date)}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Session</p>
                        <p className="font-medium">{selectedApproved.session_name || "-"}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Class</p>
                        <p className="font-medium">{selectedApproved.class_name || "-"}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Section</p>
                        <p className="font-medium">{selectedApproved.section_name || "-"}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border max-h-[360px] overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b bg-muted/40 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.16em] [&_th]:text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left">Roll</th>
                            <th className="px-3 py-2 text-left">Student</th>
                            <th className="px-3 py-2 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedApproved.rows || []).map((row) => (
                            <tr key={row.id} className="border-b">
                              <td className="px-3 py-2">{row.roll_number || "-"}</td>
                              <td className="px-3 py-2">{row.student_name || "-"}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                                    row.status === "present"
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                                      : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200"
                                  }`}
                                >
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Open an approved session to view its locked attendance data.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
        ) : null}

        {isTeacher ? (
          <TabsContent value="daily-data" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_460px]">
              <div className="rounded-xl border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Daily Attendance History</h3>
                    <p className="text-sm text-muted-foreground">
                      Track submitted, pending, approved, and rejected attendance sessions by day.
                    </p>
                  </div>
                  <Button variant="outline" onClick={loadDailyAttendance} disabled={dailyLoading}>
                    {dailyLoading ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>

                <div className="rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/40 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.16em] [&_th]:text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Class</th>
                        <th className="px-3 py-2 text-left">Section</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyRows.map((row) => (
                        <tr key={row.id} className="border-b">
                          <td className="px-3 py-2">{formatReadableDate(row.date)}</td>
                          <td className="px-3 py-2">{row.class_name || "-"}</td>
                          <td className="px-3 py-2">{row.section_name || "-"}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                                row.approval_status === "approved"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                                  : row.approval_status === "pending"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
                                    : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200"
                              }`}
                            >
                              {row.approval_status || "-"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => handleOpenDaily(row.id)}>
                              Open
                            </Button>
                          </td>
                        </tr>
                      ))}

                      {!dailyLoading && dailyRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                            No attendance history is available yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-4">
                <div>
                  <h3 className="font-semibold">Daily Session Details</h3>
                  <p className="text-sm text-muted-foreground">
                    Inspect the final daily roster and approval state for a specific session.
                  </p>
                </div>

                {reviewLoading ? (
                  <p className="text-sm text-muted-foreground">Loading attendance session...</p>
                ) : selectedDaily ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Date</p>
                        <p className="font-medium">{formatReadableDate(selectedDaily.date)}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Approval</p>
                        <p className="font-medium capitalize">{selectedDaily.approval_status || "-"}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Class</p>
                        <p className="font-medium">{selectedDaily.class_name || "-"}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Section</p>
                        <p className="font-medium">{selectedDaily.section_name || "-"}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border max-h-[360px] overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b bg-muted/40 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.16em] [&_th]:text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left">Roll</th>
                            <th className="px-3 py-2 text-left">Student</th>
                            <th className="px-3 py-2 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedDaily.rows || []).map((row) => (
                            <tr key={row.id} className="border-b">
                              <td className="px-3 py-2">{row.roll_number || "-"}</td>
                              <td className="px-3 py-2">{row.student_name || "-"}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                                    row.status === "present"
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                                      : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200"
                                  }`}
                                >
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Open a daily session to inspect its recorded attendance.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
        ) : null}

        {canReviewStudentAttendance ? (
          <TabsContent value="pending-approval" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
              <div className="rounded-xl border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Pending Student Attendance</h3>
                    <p className="text-sm text-muted-foreground">
                      Review teacher-submitted daily attendance before it becomes final.
                    </p>
                  </div>
                  <Button variant="outline" onClick={loadPendingAttendance} disabled={pendingLoading}>
                    {pendingLoading ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="grid gap-2">
                    <Label>Class Filter</Label>
                    <select
                      className={FIELD_CLASSNAME}
                      value={pendingFilters.class_id}
                      onChange={(e) =>
                        setPendingFilters((prev) => ({
                          ...prev,
                          class_id: e.target.value,
                          section_id: "",
                        }))
                      }
                    >
                      <option value="">All Classes</option>
                      {pendingFilterClasses.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Section Filter</Label>
                    <select
                      className={FIELD_CLASSNAME}
                      value={pendingFilters.section_id}
                      onChange={(e) =>
                        setPendingFilters((prev) => ({
                          ...prev,
                          section_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">All Sections</option>
                      {pendingFilterSections.map((section) => (
                        <option key={`${section.class_id}-${section.id}`} value={section.id}>
                          {section.name}{section.medium ? ` (${section.medium})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Sort By</Label>
                    <select
                      className={FIELD_CLASSNAME}
                      value={pendingFilters.sort_by}
                      onChange={(e) =>
                        setPendingFilters((prev) => ({
                          ...prev,
                          sort_by: e.target.value,
                        }))
                      }
                    >
                      <option value="latest">Latest First</option>
                      <option value="class">Class A-Z</option>
                      <option value="section">Section A-Z</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      onClick={handleBulkApprove}
                      disabled={bulkReviewLoading || !selectedPendingIds.length}
                      className="w-full"
                    >
                      {bulkReviewLoading ? "Approving..." : `Approve Selected (${selectedPendingIds.length})`}
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/40 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.16em] [&_th]:text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">
                          <input
                            type="checkbox"
                            checked={allFilteredPendingSelected}
                            onChange={(e) =>
                              toggleSelectAllPending(e.target.checked, filteredPendingRows)
                            }
                            aria-label="Select all filtered pending attendance rows"
                          />
                        </th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Class</th>
                        <th className="px-3 py-2 text-left">Section</th>
                        <th className="px-3 py-2 text-left">Absent</th>
                        <th className="px-3 py-2 text-left">Submitted By</th>
                        <th className="px-3 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPendingRows.map((row) => (
                        <tr key={row.id} className="border-b">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedPendingIds.includes(Number(row.id))}
                              onChange={(e) => togglePendingSelection(row.id, e.target.checked)}
                              aria-label={`Select attendance session ${row.id}`}
                            />
                          </td>
                          <td className="px-3 py-2">{formatReadableDate(row.date)}</td>
                          <td className="px-3 py-2">{row.class_name || "-"}</td>
                          <td className="px-3 py-2">{row.section_name || "-"}</td>
                          <td className="px-3 py-2">{row.absent_count || 0}</td>
                          <td className="px-3 py-2">{row.submitted_by_username || "-"}</td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenPending(row.id)}
                            >
                              Review
                            </Button>
                          </td>
                        </tr>
                      ))}

                      {!pendingLoading && filteredPendingRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                            No student attendance matches the current approval filters.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-4">
                <div>
                  <h3 className="font-semibold">Review Details</h3>
                  <p className="text-sm text-muted-foreground">
                    Inspect the submitted roster and approve or reject it.
                  </p>
                </div>

                {reviewLoading ? (
                  <p className="text-sm text-muted-foreground">Loading attendance session...</p>
                ) : selectedPending ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Date</p>
                        <p className="font-medium">{formatReadableDate(selectedPending.date)}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Session</p>
                        <p className="font-medium">{selectedPending.session_name || "-"}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Class</p>
                        <p className="font-medium">{selectedPending.class_name || "-"}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Section</p>
                        <p className="font-medium">{selectedPending.section_name || "-"}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border max-h-[320px] overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b bg-secondary">
                          <tr>
                            <th className="px-3 py-2 text-left">Roll</th>
                            <th className="px-3 py-2 text-left">Student</th>
                            <th className="px-3 py-2 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedPending.rows || []).map((row) => (
                            <tr key={row.id} className="border-b">
                              <td className="px-3 py-2">{row.roll_number || "-"}</td>
                              <td className="px-3 py-2">{row.student_name || "-"}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                                    row.status === "present"
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                                      : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200"
                                  }`}
                                >
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid gap-2">
                      <Label>Remarks</Label>
                      <textarea
                        className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-hidden transition focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60"
                        value={reviewRemarks}
                        onChange={(e) => setReviewRemarks(e.target.value)}
                        placeholder="Optional remarks for approval or rejection"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => handleReview("approved")}
                        disabled={reviewLoading}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => handleReview("rejected")}
                        disabled={reviewLoading}
                      >
                        Reject
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select a pending attendance session to review.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
        ) : null}

        {canNotifyParents ? (
          <TabsContent value="parent-messages" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_460px]">
              <div className="rounded-xl border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Approved Absence Sessions</h3>
                    <p className="text-sm text-muted-foreground">
                      Select an approved session and notify parents of absent students.
                    </p>
                  </div>
                  <Button variant="outline" onClick={loadApprovedAttendance} disabled={approvedLoading}>
                    {approvedLoading ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="notify-class-filter">Class</Label>
                    <select
                      id="notify-class-filter"
                      className={FIELD_CLASSNAME}
                      value={notifyFilters.class_id}
                      onChange={(e) =>
                        setNotifyFilters({ class_id: e.target.value, section_id: "" })
                      }
                    >
                      <option value="">All classes</option>
                      {notifyFilterClasses.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notify-section-filter">Section</Label>
                    <select
                      id="notify-section-filter"
                      className={FIELD_CLASSNAME}
                      value={notifyFilters.section_id}
                      onChange={(e) =>
                        setNotifyFilters((prev) => ({ ...prev, section_id: e.target.value }))
                      }
                    >
                      <option value="">All sections</option>
                      {notifyFilterSections.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-secondary">
                      <tr>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Class</th>
                        <th className="px-3 py-2 text-left">Section</th>
                        <th className="px-3 py-2 text-left">Absent</th>
                        <th className="px-3 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApprovedRows.map((row) => (
                        <tr key={row.id} className="border-b">
                          <td className="px-3 py-2">{formatReadableDate(row.date)}</td>
                          <td className="px-3 py-2">{row.class_name || "-"}</td>
                          <td className="px-3 py-2">{row.section_name || "-"}</td>
                          <td className="px-3 py-2">{row.absent_count || 0}</td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenApproved(row.id)}
                            >
                              Open
                            </Button>
                          </td>
                        </tr>
                      ))}

                      {!approvedLoading && filteredApprovedRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                            No approved absence sessions match the selected filters.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-4">
                <div>
                  <h3 className="font-semibold">Send Absence Message</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose absent students, use a template or custom message, and send through the app.
                  </p>
                </div>

                {reviewLoading ? (
                  <p className="text-sm text-muted-foreground">Loading approved session...</p>
                ) : selectedApproved ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Date</p>
                        <p className="font-medium">{formatReadableDate(selectedApproved.date)}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Session</p>
                        <p className="font-medium">{selectedApproved.session_name || "-"}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Class</p>
                        <p className="font-medium">{selectedApproved.class_name || "-"}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Section</p>
                        <p className="font-medium">{selectedApproved.section_name || "-"}</p>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label>Message Template</Label>
                      <select
                        className={FIELD_CLASSNAME}
                        value={notifyForm.template_key}
                        onChange={(e) =>
                          setNotifyForm((prev) => ({
                            ...prev,
                            template_key: e.target.value,
                          }))
                        }
                      >
                        <option value="">Custom Message</option>
                        {messageTemplates.map((template) => (
                          <option key={template.key} value={template.key}>
                            {template.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Custom Message</Label>
                      <textarea
                        className="min-h-32 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-hidden transition focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60"
                        value={notifyForm.message}
                        onChange={(e) =>
                          setNotifyForm((prev) => ({ ...prev, message: e.target.value }))
                        }
                        placeholder="Leave blank if you are using a template"
                        disabled={Boolean(notifyForm.template_key)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Absent Students</Label>
                      <div className="rounded-xl border max-h-[240px] overflow-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b bg-muted/40 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.16em] [&_th]:text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 text-left">Send</th>
                              <th className="px-3 py-2 text-left">Roll</th>
                              <th className="px-3 py-2 text-left">Student</th>
                            </tr>
                          </thead>
                          <tbody>
                            {approvedAbsentRows.map((row) => (
                              <tr key={row.id} className="border-b">
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={notifyForm.student_ids.includes(Number(row.student_id))}
                                    onChange={(e) => toggleNotifyStudent(row.student_id, e.target.checked)}
                                  />
                                </td>
                                <td className="px-3 py-2">{row.roll_number || "-"}</td>
                                <td className="px-3 py-2">{row.student_name || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={handleNotifyParents}
                        disabled={notifyLoading || !approvedAbsentRows.length}
                      >
                        {notifyLoading ? "Sending..." : "Send To Parents"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Open an approved attendance session to notify absent students&apos; parents.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
        ) : null}

        {canManageTeachers ? (
          <TabsContent value="teacher-logs" className="mt-4">
            <DataTable
              columns={teacherAttendanceColumns}
              data={teacherAttendance}
            />
            {teacherLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading teacher attendance...</p>
            ) : null}
          </TabsContent>
        ) : null}
      </Tabs>
    </>
  );
}

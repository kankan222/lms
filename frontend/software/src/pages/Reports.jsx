import { useEffect, useEffectEvent, useMemo, useState } from "react";
import TopBar from "../components/TopBar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { getClassStructure } from "../api/academic.api";
import { getExams, getExamById } from "../api/exam.api";
import { getSubjects } from "../api/subjects.api";
import {
  getAccessibleExamById,
  getAccessibleExams,
  approveMarks,
  downloadMyMarksheet,
  downloadStudentMarksheet,
  getMarksApprovalSummary,
  getMarksGrid,
  getPendingApprovalQueue,
  getMyResults,
  getMyStudents,
  rejectMarks,
  saveMarks,
  submitMarksForApproval,
} from "../api/marks.api";
import { usePermissions } from "../hooks/usePermissions";

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

function statusVariant(status) {
  if (status === "approved") return "default";
  if (status === "pending") return "secondary";
  if (status === "draft") return "outline";
  return "destructive";
}

function statusClassName(status) {
  if (status === "approved") return "bg-emerald-600 text-white";
  if (status === "pending") return "bg-amber-500 text-white";
  if (status === "draft") return "border-slate-300 text-slate-600";
  return "bg-red-600 text-white";
}

function uniqueMediums(sections) {
  return [...new Set((sections || []).map((item) => item.medium).filter(Boolean))];
}

function uniqueById(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item?.id ?? "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function downloadBlob(blob, fileName) {
  if (!blob || blob.size === 0) {
    throw new Error("Downloaded file is empty");
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 5000);
}

function FilterSection({ title, children }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function SurfaceCard({ className = "", accent = false, children }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm ${className}`}>
      {accent ? (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      ) : null}
      {children}
    </div>
  );
}

export default function Reports() {
  const { can } = usePermissions();
  const isAdmin = can("marks.approve");
  const canEnterMarks = can("marks.enter");
  const canUseEntryFlow = canEnterMarks || isAdmin;
  const canViewExamCatalog = can("exams.view");
  const selfViewOnly = !isAdmin && !canEnterMarks;
  const [activeTab, setActiveTab] = useState(
    selfViewOnly ? "results" : isAdmin ? "pending" : "entry"
  );

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [examSubjects, setExamSubjects] = useState([]);
  const [examScopes, setExamScopes] = useState([]);
  const [myStudents, setMyStudents] = useState([]);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selfFilters, setSelfFilters] = useState(EMPTY_SELF_FILTERS);

  const [grid, setGrid] = useState(null);
  const [selfReport, setSelfReport] = useState(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [editedMarks, setEditedMarks] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [pendingQueue, setPendingQueue] = useState({ total_pending: 0, groups: [] });
  const [approvalSummary, setApprovalSummary] = useState({ pending: 0, draft: 0, approved: 0 });
  const [reviewQueueSnapshot, setReviewQueueSnapshot] = useState(null);

  const [loading, setLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(false);
  const [selfLoading, setSelfLoading] = useState(false);
  const [examMetaLoading, setExamMetaLoading] = useState(false);
  const [banner, setBanner] = useState(null);

  const scopedClassIds = useMemo(
    () => [...new Set((examScopes || []).map((item) => String(item.class_id)))],
    [examScopes]
  );
  const availableClasses = useMemo(
    () =>
      !filters.exam_id
        ? classes
        : classes.filter((item) => scopedClassIds.includes(String(item.id))),
    [classes, filters.exam_id, scopedClassIds]
  );
  const selectedClass = useMemo(
    () => availableClasses.find((item) => String(item.id) === String(filters.class_id)) || null,
    [availableClasses, filters.class_id]
  );
  const availableSections = useMemo(() => {
    if (!selectedClass) return [];
    const sections = selectedClass.sections || [];
    if (!filters.exam_id) return sections;

    const allowedSectionIds = new Set(
      (examScopes || [])
        .filter((item) => String(item.class_id) === String(selectedClass.id))
        .map((item) => String(item.section_id))
    );

    return sections.filter((item) => allowedSectionIds.has(String(item.id)));
  }, [selectedClass, filters.exam_id, examScopes]);
  const mediums = uniqueMediums(availableSections);
  const filteredSubjects = examSubjects.length
    ? subjects.filter((subject) =>
        examSubjects.some((item) => String(item.subject_id) === String(subject.id))
      )
    : subjects;
  const selectedExam = useMemo(
    () => exams.find((item) => String(item.id) === String(filters.exam_id)) || null,
    [exams, filters.exam_id]
  );
  const selectedSection = useMemo(
    () => availableSections.find((item) => String(item.id) === String(filters.section_id)) || null,
    [availableSections, filters.section_id]
  );
  const selectedSubject = useMemo(
    () => filteredSubjects.find((item) => String(item.id) === String(filters.subject_id)) || null,
    [filteredSubjects, filters.subject_id]
  );
  const displayedPendingQueue = editMode && reviewQueueSnapshot ? reviewQueueSnapshot : pendingQueue;
  const pendingReviewMeta = displayedPendingQueue.groups?.[0] || null;
  const classOptions = useMemo(() => {
    if (
      !isAdmin ||
      activeTab !== "pending" ||
      !pendingReviewMeta ||
      availableClasses.some((item) => String(item.id) === String(filters.class_id))
    ) {
      return uniqueById(availableClasses);
    }

    return uniqueById([
      ...availableClasses,
      {
        id: pendingReviewMeta.class_id,
        name: pendingReviewMeta.class_name,
        class_scope: null,
        sections: [],
      },
    ]);
  }, [availableClasses, activeTab, filters.class_id, isAdmin, pendingReviewMeta]);
  const sectionOptions = useMemo(() => {
    if (
      !isAdmin ||
      activeTab !== "pending" ||
      !pendingReviewMeta ||
      availableSections.some((item) => String(item.id) === String(filters.section_id))
    ) {
      return uniqueById(availableSections);
    }

    return uniqueById([
      ...availableSections,
      {
        id: pendingReviewMeta.section_id,
        name: pendingReviewMeta.section_name,
        medium: pendingReviewMeta.medium || null,
      },
    ]);
  }, [availableSections, activeTab, filters.section_id, isAdmin, pendingReviewMeta]);

  const loadBootstrapEvent = useEffectEvent(() => {
    loadBootstrap();
  });

  useEffect(() => {
    loadBootstrapEvent();
  }, []);

  useEffect(() => {
    if (!banner) return undefined;
    const timeoutId = window.setTimeout(() => {
      setBanner(null);
    }, 3500);
    return () => window.clearTimeout(timeoutId);
  }, [banner]);

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
        const res = await examLoader(filters.exam_id);
        if (!ignore) {
          setExamSubjects(Array.isArray(res?.data?.subjects) ? res.data.subjects : []);
          setExamScopes(Array.isArray(res?.data?.scopes) ? res.data.scopes : []);
        }
      } catch (err) {
        if (!ignore) {
          setExamSubjects([]);
          setExamScopes([]);
          setBanner({
            type: "destructive",
            title: "Exam load failed",
            message: err?.message || "Failed to load exam subjects.",
          });
        }
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
      setFilters((prev) => ({
        ...prev,
        class_id: "",
        section_id: "",
        medium: "",
      }));
      return;
    }

    if (filters.section_id && !availableSections.some((item) => String(item.id) === String(filters.section_id))) {
      setFilters((prev) => ({
        ...prev,
        section_id: "",
        medium: "",
      }));
    }
  }, [
    filters.exam_id,
    filters.class_id,
    filters.section_id,
    availableClasses,
    availableSections,
    examMetaLoading,
  ]);

  const clearGridForScopeChangeEvent = useEffectEvent(() => {
    if (loading || selfViewOnly || !grid) return;
    if (editMode || gridLoading) return;

    const nextStatus =
      activeTab === "pending" ? "pending" : activeTab === "approved" ? "approved" : "";
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
      resetGridState({ rows: [] });
    }
  });

  useEffect(() => {
    clearGridForScopeChangeEvent();
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
  ]);

  const autoLoadScopedGridEvent = useEffectEvent(() => {
    if (loading || selfViewOnly) return;
    if (!filters.exam_id || !filters.class_id || !filters.section_id || !filters.subject_id) return;
    if (isAdmin && activeTab === "pending" && editMode) return;
    handleLoadGrid();
  });

  useEffect(() => {
    autoLoadScopedGridEvent();
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

  const autoLoadPendingReviewEvent = useEffectEvent(() => {
    if (!isAdmin || loading || activeTab !== "pending") return;
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
  });

  useEffect(() => {
    autoLoadPendingReviewEvent();
  }, [activeTab, pendingQueue, loading, editMode]);

  const refreshPendingReviewEvent = useEffectEvent(async () => {
    if (!isAdmin || loading || activeTab !== "pending" || gridLoading) return;

    try {
      const queueRes = await getPendingApprovalQueue();
      setPendingQueue(queueRes?.data || { total_pending: 0, groups: [] });
      const summaryRes = await getMarksApprovalSummary();
      setApprovalSummary(summaryRes?.data || { pending: 0, draft: 0, approved: 0 });

      if (
        !editMode &&
        !selectedStudentIds.length &&
        filters.exam_id &&
        filters.class_id &&
        filters.section_id &&
        filters.subject_id
      ) {
        const res = await getMarksGrid(filters);
        resetGridState(res?.data || { rows: [] });
      }
    } catch {
      // Silent background refresh failure; keep the current review state intact.
    }
  });

  useEffect(() => {
    if (!isAdmin || activeTab !== "pending" || loading) return undefined;

    const intervalId = window.setInterval(() => {
      refreshPendingReviewEvent();
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [activeTab, isAdmin, loading]);

  async function loadBootstrap() {
    setLoading(true);
    try {
      const requests = [
        getClassStructure(),
        getSubjects(),
        canViewExamCatalog ? getExams() : getAccessibleExams(),
      ];
      if (isAdmin) {
        requests.push(getPendingApprovalQueue());
        requests.push(getMarksApprovalSummary());
      }

      const [classRes, subjectRes, examRes, pendingRes, summaryRes] = await Promise.all(requests);

      setClasses(Array.isArray(classRes?.data) ? classRes.data : []);
      setSubjects(Array.isArray(subjectRes?.data) ? subjectRes.data : []);
      setExams(Array.isArray(examRes?.data) ? examRes.data : []);
      if (isAdmin) {
        setPendingQueue(pendingRes?.data || { total_pending: 0, groups: [] });
        setApprovalSummary(summaryRes?.data || { pending: 0, draft: 0, approved: 0 });
      }

      if (selfViewOnly) {
        const studentRes = await getMyStudents();
        const rows = Array.isArray(studentRes?.data) ? studentRes.data : [];
        setMyStudents(rows);
        if (rows.length === 1) {
          setSelfFilters((prev) => ({ ...prev, student_id: String(rows[0].id) }));
        }
      }
    } catch (err) {
      setBanner({
        type: "destructive",
        title: "Reports unavailable",
        message: err?.message || "Failed to load report filters.",
      });
    } finally {
      setLoading(false);
    }
  }

  function setSuccess(message) {
    setBanner({ type: "success", title: "Success", message });
  }

  function setError(message) {
    setBanner({ type: "destructive", title: "Request failed", message });
  }

  function resetGridState(nextGrid) {
    setGrid(nextGrid);
    setSelectedStudentIds([]);
    const draft = {};
    (nextGrid?.rows || []).forEach((row) => {
      draft[row.student_id] = row.marks ?? "";
    });
    setEditedMarks(draft);
    setEditMode(false);
  }

  async function handleLoadGrid() {
    if (!filters.exam_id || !filters.class_id || !filters.section_id || !filters.subject_id) {
      setError("Exam, class, section, and subject are required.");
      return;
    }

    setGridLoading(true);
    try {
      const res = await getMarksGrid(filters);
      resetGridState(res?.data || { rows: [] });
      setBanner(null);
    } catch (err) {
      resetGridState({ rows: [] });
      setError(err?.message || "Failed to load marks grid.");
    } finally {
      setGridLoading(false);
    }
  }

  function toggleRow(studentId, checked) {
    setSelectedStudentIds((prev) =>
      checked
        ? [...new Set([...prev, studentId])]
        : prev.filter((id) => id !== studentId)
    );
  }

  function toggleAllRows(checked) {
    if (!grid?.rows?.length) {
      setSelectedStudentIds([]);
      return;
    }

    setSelectedStudentIds(
      checked ? grid.rows.map((row) => Number(row.student_id)) : []
    );
  }

  function updateMarksValue(studentId, value) {
    setEditedMarks((prev) => ({
      ...prev,
      [studentId]: value,
    }));
  }

  function buildMutationPayload(extra = {}) {
    return {
      exam_id: filters.exam_id || grid?.exam_id || "",
      class_id: filters.class_id || grid?.class_id || "",
      section_id: filters.section_id || grid?.section_id || "",
      medium: filters.medium,
      subject_id: filters.subject_id || grid?.subject?.id || "",
      ...extra,
    };
  }

  async function handleSaveMarks() {
    if (!grid?.rows?.length) {
      setError("Load a marks grid first.");
      return;
    }

    const marks = grid.rows
      .map((row) => ({
        student_id: row.student_id,
        marks: editedMarks[row.student_id],
      }))
      .filter((row) => row.marks !== "" && row.marks !== null && row.marks !== undefined);

    if (!marks.length) {
      setError("Enter at least one mark to save.");
      return;
    }

    setGridLoading(true);
    try {
      await saveMarks(buildMutationPayload({ marks }));
      await handleLoadGrid();
      setEditMode(false);
      setSuccess("Marks saved.");
    } catch (err) {
      setError(err?.message || "Failed to save marks.");
      setGridLoading(false);
    }
  }

  async function handleSubmitMarks(applyAll) {
    setGridLoading(true);
    try {
      await submitMarksForApproval(
        buildMutationPayload(
          applyAll
            ? { apply_all: true }
            : { student_ids: selectedStudentIds }
        )
      );
      await handleLoadGrid();
      setSuccess(applyAll ? "All draft marks submitted." : "Selected draft marks submitted.");
    } catch (err) {
      setError(err?.message || "Failed to submit marks.");
      setGridLoading(false);
    }
  }

  async function handleApprove(applyAll) {
    setGridLoading(true);
    try {
      await approveMarks(
        buildMutationPayload(
          applyAll
            ? { apply_all: true }
            : { student_ids: selectedStudentIds }
        )
      );
      if (isAdmin) {
        const queueRes = await getPendingApprovalQueue();
        setPendingQueue(queueRes?.data || { total_pending: 0, groups: [] });
        const summaryRes = await getMarksApprovalSummary();
        setApprovalSummary(summaryRes?.data || { pending: 0, draft: 0, approved: 0 });
      }
      await handleLoadGrid();
      setSuccess(applyAll ? "All pending marks approved." : "Selected marks approved.");
    } catch (err) {
      setError(err?.message || "Failed to approve marks.");
      setGridLoading(false);
    }
  }

  async function handleReject() {
    setGridLoading(true);
    try {
      await rejectMarks(buildMutationPayload({ student_ids: selectedStudentIds }));
      if (isAdmin) {
        const queueRes = await getPendingApprovalQueue();
        setPendingQueue(queueRes?.data || { total_pending: 0, groups: [] });
        const summaryRes = await getMarksApprovalSummary();
        setApprovalSummary(summaryRes?.data || { pending: 0, draft: 0, approved: 0 });
      }
      await handleLoadGrid();
      setSuccess("Selected marks moved back to draft.");
    } catch (err) {
      setError(err?.message || "Failed to reject marks.");
      setGridLoading(false);
    }
  }

  async function handleDownloadStudent(studentId) {
    try {
      const blob = await downloadStudentMarksheet(filters.exam_id, studentId);
      downloadBlob(blob, `marksheet-exam-${filters.exam_id}-student-${studentId}.pdf`);
    } catch (err) {
      setError(err?.message || "Failed to download marksheet.");
    }
  }

  async function handleLoadSelfResults() {
    if (!selfFilters.exam_id) {
      setError("Select an exam first.");
      return;
    }

    setSelfLoading(true);
    try {
      const res = await getMyResults(selfFilters);
      setSelfReport(res?.data || null);
      setBanner(null);
    } catch (err) {
      setSelfReport(null);
      setError(err?.message || "Failed to load approved results.");
    } finally {
      setSelfLoading(false);
    }
  }

  async function handleDownloadMyResult() {
    try {
      const blob = await downloadMyMarksheet(selfFilters);
      downloadBlob(blob, `marksheet-exam-${selfFilters.exam_id}.pdf`);
    } catch (err) {
      setError(err?.message || "Failed to download marksheet.");
    }
  }

  const allSelected =
    grid?.rows?.length > 0 &&
    selectedStudentIds.length === grid.rows.length;

  function handleTabChange(nextTab) {
    setActiveTab(nextTab);
    setFilters((prev) => ({
      ...prev,
      approval_status:
        nextTab === "pending"
          ? "pending"
          : nextTab === "approved"
            ? "approved"
            : "",
    }));
  }

  function renderFilterPanel() {
    return (
      <SurfaceCard>
        <div className="space-y-4 p-4">
        {isAdmin && activeTab === "pending" && pendingReviewMeta ? (
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-sm text-amber-900">
            Reviewing latest submission:{" "}
            <span className="font-medium">
              {pendingReviewMeta.exam_name} / {pendingReviewMeta.class_name} / {pendingReviewMeta.section_name} / {pendingReviewMeta.subject_name}
            </span>
            {" "}with {pendingReviewMeta.pending_count} pending entr{pendingReviewMeta.pending_count === 1 ? "y" : "ies"}.
          </div>
        ) : null}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <FilterSection title="Choose Scope">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Exam</Label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={filters.exam_id}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, exam_id: e.target.value }))
                  }
                >
                  <option value="">Select exam</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Class</Label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={filters.class_id}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      class_id: e.target.value,
                      section_id: "",
                      medium: "",
                    }))
                  }
                >
                  <option value="">Select class</option>
                  {classOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Section</Label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={filters.section_id}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, section_id: e.target.value }))
                  }
                >
                  <option value="">Select section</option>
                  {sectionOptions.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Medium</Label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={filters.medium}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, medium: e.target.value }))
                  }
                >
                  <option value="">All mediums</option>
                  {mediums.map((medium) => (
                    <option key={medium} value={medium}>
                      {medium}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Subject</Label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={filters.subject_id}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, subject_id: e.target.value }))
                  }
                >
                  <option value="">Select subject</option>
                  {filteredSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </FilterSection>

          <FilterSection title="Refine And Load">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2 md:col-span-2">
                <Label>Student Search</Label>
                <Input
                  placeholder="Search name"
                  value={filters.name}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              {isAdmin ? (
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <select
                    className="min-w-[180px] rounded-md border px-3 py-2"
                    value={filters.approval_status}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, approval_status: e.target.value }))
                    }
                  >
                    <option value="">All statuses</option>
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                  </select>
                </div>
              ) : null}
              <div className="flex items-end justify-start md:justify-end">
                <Button onClick={handleLoadGrid} disabled={gridLoading} className="min-w-[160px]">
                  {gridLoading ? "Loading..." : "Load Students"}
                </Button>
              </div>
            </div>
          </FilterSection>
        </div>

        <div className="text-xs text-muted-foreground">
          Tip: keep the filters narrow before loading to reduce clutter in the marks grid.
        </div>
        </div>
      </SurfaceCard>
    );
  }

  function renderAdminSummary() {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        <SurfaceCard accent className="bg-gradient-to-br from-amber-500/15 via-background to-transparent">
          <div className="p-4">
          <p className="text-sm text-muted-foreground">Pending Approval</p>
          <p className="mt-2 text-2xl font-semibold">{approvalSummary.pending}</p>
          </div>
        </SurfaceCard>
        <SurfaceCard accent className="bg-gradient-to-br from-violet-500/15 via-background to-transparent">
          <div className="p-4">
          <p className="text-sm text-muted-foreground">Draft Entries</p>
          <p className="mt-2 text-2xl font-semibold">{approvalSummary.draft}</p>
          </div>
        </SurfaceCard>
        <SurfaceCard accent className="bg-gradient-to-br from-emerald-500/15 via-background to-transparent">
          <div className="p-4">
          <p className="text-sm text-muted-foreground">Approved Records</p>
          <p className="mt-2 text-2xl font-semibold">{approvalSummary.approved}</p>
          </div>
        </SurfaceCard>
      </div>
    );
  }

  function renderGridPanel({ mode = "entry" } = {}) {
    const isPendingMode = mode === "pending";
    const isApprovedMode = mode === "approved";
    const canEditMarks = isPendingMode ? editMode : !isApprovedMode && canUseEntryFlow;
    const canSelectRows = !isApprovedMode;
    const showEntryActions = canUseEntryFlow && !isPendingMode && !isApprovedMode;
    const showAdminEditActions = isAdmin && isPendingMode;
    const showAdminApprovalActions = isAdmin && isPendingMode;
    const emptyMessage = isPendingMode
      ? "Load a pending approval grid to review submitted marks."
      : isApprovedMode
        ? "Load approved records to download marksheets."
        : "Select the filters above and load a marks grid.";

    return (
      <SurfaceCard>
        <div className="p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">
              {grid?.subject?.name || "Marks Grid"}
            </p>
            <p className="text-sm text-muted-foreground">
              {grid?.rows?.length || 0} student{grid?.rows?.length === 1 ? "" : "s"} loaded
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {showEntryActions ? (
              <>
                <Button onClick={handleSaveMarks} disabled={gridLoading || !grid?.rows?.length}>
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSubmitMarks(false)}
                  disabled={gridLoading || !selectedStudentIds.length}
                >
                  Submit Selected
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSubmitMarks(true)}
                  disabled={gridLoading || !grid?.rows?.length}
                >
                  Submit All
                </Button>
              </>
            ) : null}

            {showAdminEditActions ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setEditMode((prev) => !prev)}
                  disabled={!grid?.rows?.length}
                >
                  {editMode ? "Cancel Edit" : "Edit"}
                </Button>
                {editMode ? (
                  <Button onClick={handleSaveMarks} disabled={gridLoading || !grid?.rows?.length}>
                    Save Changes
                  </Button>
                ) : null}
              </>
            ) : null}

            {showAdminApprovalActions ? (
              <>
                {isAdmin ? (
                  <Button
                    onClick={() => handleApprove(false)}
                    disabled={gridLoading || !selectedStudentIds.length}
                  >
                    Approve Selected
                  </Button>
                ) : null}
                {isAdmin && isPendingMode ? (
                  <Button
                    onClick={() => handleApprove(true)}
                    disabled={gridLoading || !grid?.rows?.length}
                  >
                    Approve All
                  </Button>
                ) : null}
                {isAdmin && isPendingMode ? (
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={gridLoading || !selectedStudentIds.length}
                  >
                    Reject
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            Current Scope
          </span>
          <span>Exam: {selectedExam?.name || "-"}</span>
          <span>Class: {selectedClass?.name || "-"}</span>
          <span>
            Section: {selectedSection ? `${selectedSection.name}${selectedSection.medium ? ` (${selectedSection.medium})` : ""}` : "-"}
          </span>
          <span>Subject: {selectedSubject?.name || grid?.subject?.name || "-"}</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-12 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                <Checkbox
                  checked={allSelected}
                  disabled={!canSelectRows}
                  onCheckedChange={(checked) => toggleAllRows(Boolean(checked))}
                />
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Roll Number</TableHead>
              <TableHead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Student Name</TableHead>
              <TableHead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Class</TableHead>
              <TableHead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Section</TableHead>
              <TableHead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Subject</TableHead>
              <TableHead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Marks</TableHead>
              <TableHead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Status</TableHead>
              {isAdmin ? <TableHead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Download</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(grid?.rows || []).map((row) => (
              <TableRow key={row.student_id} className="transition-colors hover:bg-muted/35">
                <TableCell>
                  <Checkbox
                    checked={selectedStudentIds.includes(Number(row.student_id))}
                    disabled={!canSelectRows}
                    onCheckedChange={(checked) =>
                      toggleRow(Number(row.student_id), Boolean(checked))
                    }
                  />
                </TableCell>
                <TableCell>{row.roll_number || "-"}</TableCell>
                <TableCell>
                  <div className="font-medium">{row.student_name}</div>
                  {row.medium ? (
                    <div className="text-xs text-muted-foreground">{row.medium}</div>
                  ) : null}
                </TableCell>
                <TableCell>{selectedClass?.name || grid?.exam?.class_name || "-"}</TableCell>
                <TableCell>
                  {selectedSection
                    ? `${selectedSection.name}${selectedSection.medium ? ` (${selectedSection.medium})` : ""}`
                    : grid?.exam?.section_name || "-"}
                </TableCell>
                <TableCell>{selectedSubject?.name || grid?.subject?.name || "-"}</TableCell>
                <TableCell>
                  {canEditMarks && row.approval_status !== "approved" ? (
                    <Input
                      type="number"
                      min="0"
                      max={grid?.subject?.max_marks || 100}
                      className="w-24"
                      value={editedMarks[row.student_id] ?? ""}
                      onChange={(e) => updateMarksValue(row.student_id, e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  ) : (
                    row.marks ?? "-"
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={statusVariant(row.approval_status)}
                    className={statusClassName(row.approval_status)}
                  >
                    {row.approval_status}
                  </Badge>
                </TableCell>
                {isAdmin ? (
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={row.approval_status !== "approved"}
                      onClick={() => handleDownloadStudent(row.student_id)}
                    >
                      Download
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}

            {!grid?.rows?.length ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 9 : 8}
                  className="py-8 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <>
      <div className="pointer-events-none fixed top-6 right-6 z-50 w-full max-w-sm">
        <div
          className={`transition-all duration-500 ease-out ${
            banner
              ? "translate-x-0 scale-100 opacity-100"
              : "translate-x-12 scale-95 opacity-0"
          }`}
        >
          {banner ? (
            <Alert
              variant={banner.type}
              className="pointer-events-auto overflow-hidden border shadow-xl"
            >
              <AlertTitle>{banner.title}</AlertTitle>
              <AlertDescription>{banner.message}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </div>

      <TopBar
        title="Reports"
        subTitle={
          selfViewOnly
            ? "View approved marks and download marksheets"
            : isAdmin
              ? "Review, edit, approve, and export marks"
              : "Save draft marks and submit them for approval"
        }
      />

      {loading ? <p>Loading...</p> : null}

      {!loading && selfViewOnly ? (
        <div className="grid gap-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Exam</Label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={selfFilters.exam_id}
                  onChange={(e) =>
                    setSelfFilters((prev) => ({ ...prev, exam_id: e.target.value }))
                  }
                >
                  <option value="">Select exam</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name}
                    </option>
                  ))}
                </select>
              </div>

              {myStudents.length > 1 ? (
                <div className="grid gap-2">
                  <Label>Student</Label>
                  <select
                    className="w-full rounded-md border px-3 py-2"
                    value={selfFilters.student_id}
                    onChange={(e) =>
                      setSelfFilters((prev) => ({ ...prev, student_id: e.target.value }))
                    }
                  >
                    <option value="">Select student</option>
                    {myStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} {student.class_name ? `(${student.class_name} - ${student.section_name})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label>Student</Label>
                  <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                    {myStudents[0]?.name || "Linked student will appear here"}
                  </div>
                </div>
              )}

              <div className="flex items-end gap-2">
                <Button onClick={handleLoadSelfResults} disabled={selfLoading}>
                  {selfLoading ? "Loading..." : "View Results"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadMyResult}
                  disabled={!selfReport}
                >
                  Download Marksheet
                </Button>
              </div>
            </div>
          </div>

          {selfReport ? (
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{selfReport.student?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selfReport.exam?.name} | {selfReport.exam?.class_name} / {selfReport.exam?.section_name}
                  </p>
                </div>
                <div className="grid gap-1 text-sm text-muted-foreground">
                  <span>Total: {selfReport.summary?.total}</span>
                  <span>Percentage: {selfReport.summary?.percentage}%</span>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Max</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selfReport.subjects || []).map((row) => (
                    <TableRow key={row.subject}>
                      <TableCell>{row.subject}</TableCell>
                      <TableCell>{row.marks}</TableCell>
                      <TableCell>{row.max_marks}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && !selfViewOnly ? (
        <div className="grid gap-4">
          {isAdmin ? renderAdminSummary() : null}

          <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-4">
            <TabsList variant="line" className="w-full justify-start overflow-x-auto">
              {isAdmin ? (
                <TabsTrigger value="pending">
                  <span className="inline-flex items-center gap-2">
                    <span>Review</span>
                    {displayedPendingQueue.total_pending > 0 ? (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                        {displayedPendingQueue.total_pending}
                      </span>
                    ) : null}
                  </span>
                </TabsTrigger>
              ) : null}
              <TabsTrigger value="entry">Entry</TabsTrigger>
              <TabsTrigger value="approved">Published</TabsTrigger>
            </TabsList>

            {isAdmin ? (
              <TabsContent value="pending" className="grid gap-4">
                {renderFilterPanel()}
                {renderGridPanel({ mode: "pending" })}
              </TabsContent>
            ) : null}

            <TabsContent value="entry" className="grid gap-4">
              {renderFilterPanel()}
              {renderGridPanel({ mode: "entry" })}
            </TabsContent>

            <TabsContent value="approved" className="grid gap-4">
              {renderFilterPanel()}
              {renderGridPanel({ mode: "approved" })}
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </>
  );
}


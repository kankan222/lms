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
import { getSubjects, getSubjectOfferings } from "../api/subjects.api";
import {
  getAccessibleExamById,
  getAccessibleExams,
  getApprovedMarkRecords,
  approveMarks,
  downloadFinalMarksheet,
  downloadMyMarksheet,
  downloadStudentMarksheet,
  getMarksApprovalSummary,
  getMarksGrid,
  getPendingApprovalQueue,
  getReportPublication,
  getMyResults,
  getMyStudents,
  rejectMarks,
  saveMarks,
  saveReportPublication,
  submitMarksForApproval,
} from "../api/marks.api";
import { usePermissions } from "../hooks/usePermissions";

const EMPTY_FILTERS = {
  class_scope: "",
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

const APPROVED_RECORDS_PAGE_SIZE = 25;
const SELECT_CLASSNAME =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/30 [&>option]:bg-background [&>option]:text-foreground";

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

function uniqueById(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item?.id ?? "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const classScopeLabels = {
  school: "School",
  hs: "Higher Secondary",
};

function normalizeClassScope(value) {
  const scope = String(value || "").trim().toLowerCase();
  if (scope === "higher_secondary" || scope === "higher-secondary") return "hs";
  if (scope === "hs" || scope === "school") return scope;
  return "";
}

function getClassScope(item) {
  return normalizeClassScope(item?.class_scope || item?.scope_code || item?.scope) || "school";
}

function getExamClassScopes(exam) {
  const scopes = String(exam?.class_scope || "")
    .split(",")
    .map(normalizeClassScope)
    .filter(Boolean);

  return scopes.length ? [...new Set(scopes)] : ["school"];
}

function matchesClassScope(item, classScope) {
  const scope = normalizeClassScope(classScope);
  if (!scope) return true;
  return getClassScope(item) === scope;
}

function examMatchesClassScope(exam, classScope) {
  const scope = normalizeClassScope(classScope);
  if (!scope) return true;
  return getExamClassScopes(exam).includes(scope);
}

function formatClassScopes(scopes) {
  return scopes.map((scope) => classScopeLabels[scope] || scope).join(", ");
}

function isSplitPattern(subject) {
  return String(subject?.mark_pattern || "single").trim().toLowerCase() === "split";
}

function hasSubjectComponents(subject) {
  return Array.isArray(subject?.components) && subject.components.length > 0;
}

function toNumberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatWholeNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(Math.round(parsed)) : String(value);
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

function MarksheetTemplatePreview({ type }) {
  const isFinal = type === "final";
  if (isFinal) {
    return (
      <div className="overflow-hidden rounded-xl border bg-background">
        <div className="flex items-start justify-between gap-3 border-b bg-muted/30 p-3">
          <div>
            <p className="font-semibold">Final Combined Marksheet</p>
            <p className="text-xs text-muted-foreground">
              Two-page front/back annual record card generated from published approved exams.
            </p>
          </div>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            Active
          </Badge>
        </div>

        <div className="grid gap-3 p-3 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-3 text-[10px] text-blue-950">
            <div className="mb-2 text-center text-xs font-bold uppercase">Front Page</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <div className="text-center font-bold">CO-SCHOLASTIC AREA</div>
                <div className="grid grid-cols-3 border-b border-blue-200 py-1 font-semibold">
                  <span>Value</span>
                  <span>Grade</span>
                  <span>Marks</span>
                </div>
                {["Excellent / A / 10", "Very Good / B / 08", "Good / C / 06"].map((row) => (
                  <div key={row} className="border-b border-blue-100 py-1">
                    {row}
                  </div>
                ))}
                <div className="pt-2 text-center font-bold">ATTENDANCE</div>
                <div className="border-b border-blue-100 py-1">Working Days</div>
                <div className="border-b border-blue-100 py-1">Days Present</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-extrabold uppercase leading-tight">Kalong Kapili Vidyapith</div>
                <div className="mt-1 font-semibold">(School Section)</div>
                <div className="mx-auto my-3 flex size-12 items-center justify-center rounded-full border text-[9px] font-bold">
                  LOGO
                </div>
                <div className="font-bold uppercase">Report Card</div>
                <div className="mx-auto mt-2 w-fit border-b-2 border-blue-950 px-4 py-1 font-bold">CLASS : X</div>
                <div className="mx-auto my-3 h-10 w-14 border border-blue-200" />
                <div className="font-bold">ACADEMIC YEAR : 2026-2027</div>
                <div className="mt-3 space-y-1 border-y-2 border-blue-950 py-2 text-left">
                  <div>Name: Sample Student</div>
                  <div>Guardian: Sample Guardian</div>
                  <div className="grid grid-cols-2 gap-2">
                    <span>Class: X</span>
                    <span>Medium: English</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span>Section: A</span>
                    <span>Roll No.: 12</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-3 text-[10px] text-blue-950">
            <div className="mb-2 text-center text-xs font-bold uppercase">Back Page</div>
            <div className="overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-blue-950">
                    <th className="py-1 text-left">Scholastic Area</th>
                    <th className="py-1">Unit Test</th>
                    <th className="py-1">Half Yearly</th>
                    <th className="py-1">Final Exam</th>
                    <th className="py-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["English", "42", "78", "86", "206"],
                    ["Mathematics", "45", "81", "90", "216"],
                    ["Science", "44", "79", "88", "211"],
                    ["Elective", "40", "76", "84", "200"],
                  ].map((row) => (
                    <tr key={row[0]} className="border-b border-blue-100">
                      <td className="py-1 font-semibold">{row[0]}</td>
                      {row.slice(1).map((cell, index) => (
                        <td key={`${row[0]}-${index}`} className="py-1 text-center">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-b border-blue-950 font-bold">
                    <td className="py-1">TOTAL</td>
                    <td className="py-1 text-center">171</td>
                    <td className="py-1 text-center">314</td>
                    <td className="py-1 text-center">348</td>
                    <td className="py-1 text-center">833</td>
                  </tr>
                  <tr className="font-bold">
                    <td className="py-1">Grade</td>
                    <td className="py-1 text-center" colSpan={4}>A+</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-blue-950 pt-3 text-center font-semibold">
              <div>Class Teacher</div>
              <div>Guardian</div>
              <div>Principal</div>
            </div>
            <div className="mt-3 border-t border-blue-950 pt-2 text-center font-bold">
              RESULT: PROMOTED TO CLASS ........ WITH A+ GRADE
            </div>
          </div>
        </div>
      </div>
    );
  }

  const examColumns = isFinal
    ? ["Unit Test", "Half Yearly", "Mock Test", "Final Exam", "Final Total"]
    : ["Total Marks", "Marks Obtained"];
  const sampleRows = isFinal
    ? [
        ["English", "42", "78", "82", "86", "288"],
        ["Mathematics", "45", "81", "84", "90", "300"],
        ["Science", "44", "79", "80", "88", "291"],
      ]
    : [
        ["English", "100", "88"],
        ["Mathematics", "100", "85"],
        ["Science", "100", "79"],
      ];

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <div className="flex items-start justify-between gap-3 border-b bg-muted/30 p-3">
        <div>
          <p className="font-semibold">
            {isFinal ? "Final Combined Marksheet" : "Single Exam Marksheet"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isFinal
              ? "Combines all selected exams into one annual record card."
              : "Used by the current Download Marksheet action."}
          </p>
        </div>
        <Badge variant={isFinal ? "secondary" : "outline"}>
          {isFinal ? "Planned" : "Active"}
        </Badge>
      </div>

      <div className="p-3">
        <div className="rounded-lg border border-emerald-700/40 p-3 text-[11px]">
          <div className="mb-3 grid grid-cols-[48px_1fr_72px] items-start gap-2">
            <div className="flex size-11 items-center justify-center rounded-full border border-emerald-700/50 text-[9px] font-semibold text-emerald-700">
              LOGO
            </div>
            <div className="text-center">
              <p className="text-sm font-bold uppercase text-emerald-800">Kalong Kapili Vidyapith</p>
              <p className="font-semibold text-emerald-700">
                {isFinal ? "College Evaluation Record Card" : "Report Card"}
              </p>
              <p className="text-[10px] text-muted-foreground">Nagaon, Assam</p>
            </div>
            <div className="text-right text-[10px] text-muted-foreground">
              Issued Date
              <br />
              25 Jun 2026
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-1 rounded-md border p-2 text-[10px]">
            <span>Name: Sample Student</span>
            <span>Roll: 12</span>
            <span>Class: XI</span>
            <span>Section: A</span>
            {isFinal ? <span>Stream: Science</span> : <span>Exam: Annual</span>}
            <span>Medium: English</span>
          </div>

          <div className="overflow-hidden rounded-md border">
            <table className="w-full border-collapse text-[10px]">
              <thead className="bg-emerald-50 text-emerald-900">
                <tr>
                  <th className="border px-1 py-1 text-left">Subject</th>
                  {examColumns.map((column) => (
                    <th key={column} className="border px-1 py-1 text-center">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, index) => (
                      <td key={`${row[0]}-${index}`} className={`border px-1 py-1 ${index ? "text-center" : ""}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex justify-between gap-3">
            <div className="text-[10px] text-muted-foreground">
              {isFinal ? "Result and promotion details appear here." : "Principal block appears here."}
            </div>
            <div className="rounded-md border px-3 py-2 text-[10px]">
              <div>Total Marks: {isFinal ? "1000" : "300"}</div>
              <div>Marks Obtained: {isFinal ? "879" : "252"}</div>
              <div>Percentage: {isFinal ? "87.90%" : "84.00%"}</div>
            </div>
          </div>
        </div>
      </div>
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
  const canViewAdminReportSections = isAdmin;
  const [activeTab, setActiveTab] = useState(
    selfViewOnly ? "results" : isAdmin ? "pending" : "entry"
  );

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subjectOfferings, setSubjectOfferings] = useState([]);
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
  const [reportPublication, setReportPublication] = useState(null);
  const [publicationDate, setPublicationDate] = useState("");
  const [approvedRecords, setApprovedRecords] = useState([]);
  const [approvedRecordsPage, setApprovedRecordsPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(false);
  const [publicationLoading, setPublicationLoading] = useState(false);
  const [approvedRecordsLoading, setApprovedRecordsLoading] = useState(false);
  const [selfLoading, setSelfLoading] = useState(false);
  const [selfDownloadLoading, setSelfDownloadLoading] = useState(false);
  const [selfFinalDownloadLoading, setSelfFinalDownloadLoading] = useState(false);
  const [downloadingStudentId, setDownloadingStudentId] = useState(null);
  const [downloadingFinalStudentId, setDownloadingFinalStudentId] = useState(null);
  const [examMetaLoading, setExamMetaLoading] = useState(false);
  const [banner, setBanner] = useState(null);

  const scopeFilteredExams = useMemo(
    () => exams.filter((exam) => examMatchesClassScope(exam, filters.class_scope)),
    [exams, filters.class_scope]
  );
  const scopeFilteredClasses = useMemo(
    () => classes.filter((item) => matchesClassScope(item, filters.class_scope)),
    [classes, filters.class_scope]
  );
  const scopedClassIds = useMemo(
    () => [...new Set((examScopes || []).map((item) => String(item.class_id)))],
    [examScopes]
  );
  const availableClasses = useMemo(
    () =>
      !filters.exam_id
        ? scopeFilteredClasses
        : scopeFilteredClasses.filter((item) => scopedClassIds.includes(String(item.id))),
    [scopeFilteredClasses, filters.exam_id, scopedClassIds]
  );
  const selectedClass = useMemo(
    () => availableClasses.find((item) => String(item.id) === String(filters.class_id)) || null,
    [availableClasses, filters.class_id]
  );
  const availableSections = useMemo(() => {
    if (!selectedClass) return [];
    const sections = selectedClass.sections || [];
    if (!filters.exam_id) return sections;

    const classScopeRows = (examScopes || []).filter(
      (item) => String(item.class_id) === String(selectedClass.id)
    );
    const hasClassWideScope = classScopeRows.some(
      (item) =>
        item.section_id === null ||
        item.section_id === undefined ||
        String(item.section_id).trim() === ""
    );
    if (hasClassWideScope) return sections;

    const allowedSectionIds = new Set(classScopeRows.map((item) => String(item.section_id)));

    return sections.filter((item) => allowedSectionIds.has(String(item.id)));
  }, [selectedClass, filters.exam_id, examScopes]);
  const scopedSubjectOfferings = useMemo(() => {
    if (!filters.class_id) return [];
    return subjectOfferings.filter((offering) => {
      const classMatches = String(offering.class_id || "") === String(filters.class_id);
      const sectionId = String(offering.section_id || "");
      const sectionMatches =
        !filters.section_id || !sectionId || sectionId === String(filters.section_id);
      return classMatches && sectionMatches;
    });
  }, [subjectOfferings, filters.class_id, filters.section_id]);
  const filteredSubjects = useMemo(() => {
    const examSubjectRows = examSubjects.length ? examSubjects : [];
    const examSubjectIds = new Set(examSubjectRows.map((item) => String(item.subject_id)));
    const hasScopedOfferings = filters.class_id && scopedSubjectOfferings.length > 0;
    const scopedSubjectIds = new Set(scopedSubjectOfferings.map((item) => String(item.subject_id)));
    const scopedOfferingIds = new Set(scopedSubjectOfferings.map((item) => String(item.id)));

    return subjects.filter((subject) => {
      const subjectId = String(subject.id);
      if (examSubjectRows.length && !examSubjectIds.has(subjectId)) return false;
      if (!hasScopedOfferings) return true;

      return examSubjectRows.some((examSubject) => {
        if (String(examSubject.subject_id) !== subjectId) return false;
        const offeringId = String(examSubject.subject_offering_id || "");
        return offeringId ? scopedOfferingIds.has(offeringId) : scopedSubjectIds.has(subjectId);
      });
    });
  }, [examSubjects, filters.class_id, scopedSubjectOfferings, subjects]);
  const selectedExam = useMemo(
    () => exams.find((item) => String(item.id) === String(filters.exam_id)) || null,
    [exams, filters.exam_id]
  );
  const selectedSection = useMemo(
    () => availableSections.find((item) => String(item.id) === String(filters.section_id)) || null,
    [availableSections, filters.section_id]
  );
  const publicationScope = useMemo(() => {
    if (!filters.exam_id || !filters.class_id || !filters.section_id) return null;
    return {
      exam_id: filters.exam_id,
      class_id: filters.class_id,
      section_id: filters.section_id,
      medium: filters.medium || selectedSection?.medium || "",
    };
  }, [filters.exam_id, filters.class_id, filters.section_id, filters.medium, selectedSection]);
  const selectedSubject = useMemo(
    () => filteredSubjects.find((item) => String(item.id) === String(filters.subject_id)) || null,
    [filteredSubjects, filters.subject_id]
  );
  const displayedPendingQueue = editMode && reviewQueueSnapshot ? reviewQueueSnapshot : pendingQueue;
  const pendingReviewMeta = displayedPendingQueue.groups?.[0] || null;
  const approvedRecordsTotalPages = Math.max(
    1,
    Math.ceil(approvedRecords.length / APPROVED_RECORDS_PAGE_SIZE)
  );
  const paginatedApprovedRecords = useMemo(() => {
    const start = (approvedRecordsPage - 1) * APPROVED_RECORDS_PAGE_SIZE;
    return approvedRecords.slice(start, start + APPROVED_RECORDS_PAGE_SIZE);
  }, [approvedRecords, approvedRecordsPage]);
  const approvedRecordsStart = approvedRecords.length
    ? (approvedRecordsPage - 1) * APPROVED_RECORDS_PAGE_SIZE + 1
    : 0;
  const approvedRecordsEnd = Math.min(
    approvedRecordsPage * APPROVED_RECORDS_PAGE_SIZE,
    approvedRecords.length
  );
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
        class_scope: pendingReviewMeta.class_scope || null,
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
    if (!filters.exam_id) return;
    if (scopeFilteredExams.some((item) => String(item.id) === String(filters.exam_id))) return;

    setFilters((prev) => ({
      ...prev,
      exam_id: "",
      class_id: "",
      section_id: "",
      medium: "",
      subject_id: "",
    }));
  }, [filters.class_scope, filters.exam_id, scopeFilteredExams]);

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
    if (!filters.class_id) {
      setSubjectOfferings([]);
      return;
    }

    let ignore = false;
    (async () => {
      try {
        const res = await getSubjectOfferings({
          class_id: filters.class_id,
          section_id: filters.section_id || undefined,
        });
        if (!ignore) {
          setSubjectOfferings(Array.isArray(res?.data) ? res.data : []);
        }
      } catch (err) {
        if (!ignore) {
          setSubjectOfferings([]);
          setBanner({
            type: "destructive",
            title: "Subjects load failed",
            message: err?.message || "Failed to load subjects for the selected class and section.",
          });
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [filters.class_id, filters.section_id]);

  useEffect(() => {
    if (!filters.subject_id) return;
    if (filteredSubjects.some((subject) => String(subject.id) === String(filters.subject_id))) return;

    setFilters((prev) => ({ ...prev, subject_id: "" }));
  }, [filteredSubjects, filters.subject_id]);

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
      activeTab === "pending" || activeTab === "manual-review"
        ? "pending"
        : activeTab === "approved"
          ? "approved"
          : "";
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
    if (activeTab === "manual-review") return;
    if (!filters.exam_id || !filters.class_id || !filters.section_id || !filters.subject_id) return;
    if (editMode) return;
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
        class_scope: normalizeClassScope(nextScope.class_scope) || prev.class_scope || "",
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

  const loadReportPublicationEvent = useEffectEvent(async () => {
    if (!isAdmin || activeTab !== "approved" || !publicationScope) {
      setReportPublication(null);
      setPublicationDate("");
      return;
    }

    setPublicationLoading(true);
    try {
      const res = await getReportPublication(publicationScope);
      const nextPublication = res?.data || null;
      setReportPublication(nextPublication);
      setPublicationDate(nextPublication?.published_on || "");
    } catch {
      setReportPublication(null);
      setPublicationDate("");
    } finally {
      setPublicationLoading(false);
    }
  });

  useEffect(() => {
    loadReportPublicationEvent();
  }, [activeTab, isAdmin, publicationScope]);

  const loadApprovedRecordsEvent = useEffectEvent(async () => {
    if (!canViewAdminReportSections || activeTab !== "records") return;

    setApprovedRecordsLoading(true);
    try {
      const res = await getApprovedMarkRecords({
        class_scope: filters.class_scope,
        exam_id: filters.exam_id,
        class_id: filters.class_id,
        section_id: filters.section_id,
        medium: filters.medium,
        subject_id: filters.subject_id,
        name: filters.name,
      });
      setApprovedRecords(Array.isArray(res?.data) ? res.data : []);
      setApprovedRecordsPage(1);
    } catch (err) {
      setApprovedRecords([]);
      setError(err?.message || "Failed to load approved records.");
    } finally {
      setApprovedRecordsLoading(false);
    }
  });

  useEffect(() => {
    loadApprovedRecordsEvent();
  }, [
    activeTab,
    filters.class_scope,
    filters.exam_id,
    filters.class_id,
    filters.section_id,
    filters.medium,
    filters.subject_id,
    filters.name,
  ]);

  useEffect(() => {
    if (!canViewAdminReportSections && ["records", "templates"].includes(activeTab)) {
      setActiveTab(selfViewOnly ? "results" : "entry");
    }
  }, [activeTab, canViewAdminReportSections, selfViewOnly]);

  useEffect(() => {
    if (approvedRecordsPage > approvedRecordsTotalPages) {
      setApprovedRecordsPage(approvedRecordsTotalPages);
    }
  }, [approvedRecordsPage, approvedRecordsTotalPages]);

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
    const splitPattern = isSplitPattern(nextGrid?.subject);
    const componentMode = hasSubjectComponents(nextGrid?.subject);
    const draft = {};
    (nextGrid?.rows || []).forEach((row) => {
      if (componentMode) {
        draft[row.student_id] = {
          marks: row.marks ?? "",
          theory_marks: row.theory_marks ?? "",
          practical_marks: row.practical_marks ?? "",
          components: (row.components || []).reduce((items, component) => {
            items[component.component_id] = {
              marks: component.marks ?? "",
              theory_marks: component.theory_marks ?? "",
              practical_marks: component.practical_marks ?? "",
            };
            return items;
          }, {}),
        };
        return;
      }

      if (splitPattern) {
        draft[row.student_id] = {
          marks: row.marks ?? "",
          theory_marks: row.theory_marks ?? "",
          practical_marks: row.practical_marks ?? "",
        };
        return;
      }

      draft[row.student_id] = {
        marks: row.marks ?? "",
        theory_marks: "",
        practical_marks: "",
      };
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

  async function handleSavePublicationDate() {
    if (!publicationScope) {
      setError("Select an exam, class, and section before publishing.");
      return;
    }

    if (!publicationDate) {
      setError("Enter the marksheet issue date before publishing.");
      return;
    }

    setPublicationLoading(true);
    try {
      const res = await saveReportPublication({
        ...publicationScope,
        published_on: publicationDate,
      });
      const nextPublication = res?.data || null;
      setReportPublication(nextPublication);
      setPublicationDate(nextPublication?.published_on || publicationDate);
      setSuccess("Marksheet publication date saved.");
    } catch (err) {
      setError(err?.message || "Failed to save marksheet publication date.");
    } finally {
      setPublicationLoading(false);
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

  function updateMarksValue(studentId, key, value) {
    setEditedMarks((prev) => ({
      ...prev,
      [studentId]: {
        marks:
          typeof prev?.[studentId] === "object"
            ? prev?.[studentId]?.marks ?? ""
            : prev?.[studentId] ?? "",
        theory_marks:
          typeof prev?.[studentId] === "object"
            ? prev?.[studentId]?.theory_marks ?? ""
            : "",
        practical_marks:
          typeof prev?.[studentId] === "object"
            ? prev?.[studentId]?.practical_marks ?? ""
            : "",
        [key]: value,
      },
    }));
  }

  function updateComponentMarksValue(studentId, componentId, key, value) {
    setEditedMarks((prev) => {
      const currentStudent = typeof prev?.[studentId] === "object" ? prev[studentId] : {};
      const currentComponents = currentStudent.components || {};
      const currentComponent = currentComponents[componentId] || {};

      return {
        ...prev,
        [studentId]: {
          marks: currentStudent.marks ?? "",
          theory_marks: currentStudent.theory_marks ?? "",
          practical_marks: currentStudent.practical_marks ?? "",
          components: {
            ...currentComponents,
            [componentId]: {
              marks: currentComponent.marks ?? "",
              theory_marks: currentComponent.theory_marks ?? "",
              practical_marks: currentComponent.practical_marks ?? "",
              [key]: value,
            },
          },
        },
      };
    });
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

    const splitPattern = isSplitPattern(grid?.subject);
    const componentMode = hasSubjectComponents(grid?.subject);
    const marks = grid.rows
      .map((row) => {
        const edited = editedMarks[row.student_id] || {};
        if (componentMode) {
          return {
            student_id: row.student_id,
            component_marks: (grid.subject.components || []).map((component) => {
              const editedComponent = edited?.components?.[component.id] || {};
              return {
                component_id: component.id,
                theory_marks: editedComponent.theory_marks ?? "",
                practical_marks: editedComponent.practical_marks ?? "",
                marks: editedComponent.marks ?? "",
              };
            }),
          };
        }

        if (splitPattern) {
          return {
            student_id: row.student_id,
            theory_marks: edited?.theory_marks ?? "",
            practical_marks: edited?.practical_marks ?? "",
          };
        }

        return {
          student_id: row.student_id,
          marks: edited?.marks ?? "",
        };
      })
      .filter((row) =>
        componentMode
          ? (row.component_marks || []).some(
              (component) =>
                component.marks !== "" ||
                component.theory_marks !== "" ||
                component.practical_marks !== ""
            )
          : splitPattern
          ? row.theory_marks !== "" || row.practical_marks !== ""
          : row.marks !== "" && row.marks !== null && row.marks !== undefined
      );

    if (!marks.length) {
      setError("Enter at least one mark value to save.");
      return;
    }

    setGridLoading(true);
    try {
      await saveMarks(buildMutationPayload({ marks }));
      await handleLoadGrid();
      setEditMode(false);
      setSuccess(
        activeTab === "approved"
          ? "Marks correction saved. Changed rows moved back to draft for review."
          : "Marks saved."
      );
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
    setDownloadingStudentId(Number(studentId));
    try {
      const blob = await downloadStudentMarksheet(filters.exam_id, studentId);
      downloadBlob(blob, `marksheet-exam-${filters.exam_id}-student-${studentId}.pdf`);
    } catch (err) {
      setError(err?.message || "Failed to download marksheet.");
    } finally {
      setDownloadingStudentId(null);
    }
  }

  async function handleDownloadFinalStudent(studentId) {
    setDownloadingFinalStudentId(Number(studentId));
    try {
      const blob = await downloadFinalMarksheet({
        student_id: studentId,
        session_id: selectedExam?.session_id || "",
        class_id: filters.class_id,
        section_id: filters.section_id,
      });
      downloadBlob(blob, `final-marksheet-student-${studentId}.pdf`);
    } catch (err) {
      setError(err?.message || "Failed to download final marksheet.");
    } finally {
      setDownloadingFinalStudentId(null);
    }
  }

  async function handleDownloadApprovedRecord(row, type) {
    const studentId = Number(row.student_id);
    if (type === "final") {
      setDownloadingFinalStudentId(studentId);
      try {
        const blob = await downloadFinalMarksheet({
          student_id: studentId,
          session_id: row.session_id || "",
          class_id: row.class_id || "",
          section_id: row.section_id || "",
        });
        downloadBlob(blob, `final-marksheet-student-${studentId}.pdf`);
      } catch (err) {
        setError(err?.message || "Failed to download final marksheet.");
      } finally {
        setDownloadingFinalStudentId(null);
      }
      return;
    }

    setDownloadingStudentId(studentId);
    try {
      const blob = await downloadStudentMarksheet(row.exam_id, studentId);
      downloadBlob(blob, `marksheet-exam-${row.exam_id}-student-${studentId}.pdf`);
    } catch (err) {
      setError(err?.message || "Failed to download marksheet.");
    } finally {
      setDownloadingStudentId(null);
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
    setSelfDownloadLoading(true);
    try {
      const blob = await downloadMyMarksheet(selfFilters);
      downloadBlob(blob, `marksheet-exam-${selfFilters.exam_id}.pdf`);
    } catch (err) {
      setError(err?.message || "Failed to download marksheet.");
    } finally {
      setSelfDownloadLoading(false);
    }
  }

  async function handleDownloadMyFinalResult() {
    setSelfFinalDownloadLoading(true);
    try {
      const blob = await downloadFinalMarksheet({
        student_id: selfFilters.student_id,
      });
      downloadBlob(blob, `final-marksheet-student-${selfFilters.student_id || "self"}.pdf`);
    } catch (err) {
      setError(err?.message || "Failed to download final marksheet.");
    } finally {
      setSelfFinalDownloadLoading(false);
    }
  }

  const allSelected =
    grid?.rows?.length > 0 &&
    selectedStudentIds.length === grid.rows.length;

  function handleTabChange(nextTab) {
    if (!canViewAdminReportSections && ["records", "templates"].includes(nextTab)) {
      return;
    }

    setActiveTab(nextTab);
    setFilters((prev) => ({
      ...prev,
      approval_status:
        nextTab === "pending"
          || nextTab === "manual-review"
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
                <Label>Scope</Label>
                <select
                  className={SELECT_CLASSNAME}
                  value={filters.class_scope}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      class_scope: e.target.value,
                      exam_id: "",
                      class_id: "",
                      section_id: "",
                      medium: "",
                      subject_id: "",
                    }))
                  }
                >
                  <option value="">All scopes</option>
                  <option value="school">School</option>
                  <option value="hs">Higher Secondary</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Exam</Label>
                <select
                  className={SELECT_CLASSNAME}
                  value={filters.exam_id}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, exam_id: e.target.value }))
                  }
                >
                  <option value="">Select exam</option>
                  {scopeFilteredExams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name} ({formatClassScopes(getExamClassScopes(exam))})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Class</Label>
                <select
                  className={SELECT_CLASSNAME}
                  value={filters.class_id}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      class_id: e.target.value,
                      section_id: "",
                      medium: "",
                      subject_id: "",
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
                <Label>Section (Medium)</Label>
                <select
                  className={SELECT_CLASSNAME}
                  value={filters.section_id}
                  onChange={(e) => {
                    const nextSectionId = e.target.value;
                    const nextSection = sectionOptions.find(
                      (section) => String(section.id) === String(nextSectionId)
                    );
                    setFilters((prev) => ({
                      ...prev,
                      section_id: nextSectionId,
                      medium: nextSection?.medium || "",
                    }));
                  }}
                >
                  <option value="">Select section</option>
                  {sectionOptions.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}{section.medium ? ` (${section.medium})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Subject</Label>
                <select
                  className={SELECT_CLASSNAME}
                  value={filters.subject_id}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, subject_id: e.target.value }))
                  }
                >
                  <option value="">
                    {!filters.exam_id
                      ? "Select exam first"
                      : !filters.class_id
                        ? "Select class first"
                        : !filters.section_id
                          ? "Select section first"
                          : filteredSubjects.length
                            ? "Select subject"
                            : "No subjects for selected scope"}
                  </option>
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
              {isAdmin && activeTab === "manual-review" ? (
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <div className="min-w-[180px] rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    Pending
                  </div>
                </div>
              ) : isAdmin ? (
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <select
                    className={`${SELECT_CLASSNAME} min-w-[180px]`}
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

  function renderPublicationPanel() {
    if (!isAdmin || activeTab !== "approved") return null;

    const today = new Date().toISOString().slice(0, 10);
    const isVisible = Boolean(reportPublication?.published_on) && reportPublication.published_on <= today;
    const scopeReady = Boolean(publicationScope);

    return (
      <SurfaceCard accent>
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="text-base font-semibold">Marksheet Publication</p>
            <p className="text-sm text-muted-foreground">
              Students and parents can view or download this marksheet only after this issue date is saved and reached.
            </p>
            <p className="text-xs text-muted-foreground">
              Current status:{" "}
              <span className={isVisible ? "font-medium text-emerald-600" : "font-medium text-amber-600"}>
                {isVisible
                  ? `Visible since ${reportPublication.published_on}`
                  : reportPublication?.published_on
                    ? `Scheduled for ${reportPublication.published_on}`
                    : "Not visible to students"}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="marksheet-published-on">Issue Date</Label>
              <Input
                id="marksheet-published-on"
                type="date"
                className="w-44"
                value={publicationDate}
                disabled={!scopeReady || publicationLoading}
                onChange={(event) => setPublicationDate(event.target.value)}
              />
            </div>
            <Button
              onClick={handleSavePublicationDate}
              disabled={!scopeReady || publicationLoading || !publicationDate}
            >
              {publicationLoading ? "Saving..." : "Publish Date"}
            </Button>
          </div>
        </div>
      </SurfaceCard>
    );
  }

  function renderApprovedRecordsPanel() {
    if (activeTab !== "records") return null;

    return (
      <SurfaceCard accent>
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold">Approved Records</p>
              <p className="text-sm text-muted-foreground">
                Showing all approved marks. Use filters above to narrow by exam, class, section, subject, or student name.
              </p>
            </div>
            <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">
              {approvedRecords.length} record{approvedRecords.length === 1 ? "" : "s"}
            </Badge>
          </div>

          {approvedRecordsLoading ? (
            <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              Loading approved records...
            </p>
          ) : approvedRecords.length ? (
            <>
            <div className="overflow-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Roll</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Downloads</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedApprovedRecords.map((record) => (
                    <TableRow
                      key={`${record.exam_id}-${record.student_id}-${record.subject_id}-${record.class_id}-${record.section_id}`}
                    >
                      <TableCell>{record.roll_number || "-"}</TableCell>
                      <TableCell>
                        <div className="font-medium">{record.student_name}</div>
                        <div className="text-xs text-muted-foreground">{record.exam_name}</div>
                      </TableCell>
                      <TableCell>{record.class_name}</TableCell>
                      <TableCell>
                        {record.section_name}
                        {record.medium ? ` (${record.medium})` : ""}
                      </TableCell>
                      <TableCell>{record.subject_name}</TableCell>
                      <TableCell>
                        {record.theory_marks !== null || record.practical_marks !== null ? (
                            <div className="text-xs">
                            <div>T: {formatWholeNumber(record.theory_marks)}</div>
                            <div>P: {formatWholeNumber(record.practical_marks)}</div>
                            <div className="font-medium">Total: {formatWholeNumber(record.marks)}</div>
                          </div>
                        ) : (
                          formatWholeNumber(record.marks)
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={statusVariant(record.approval_status)}
                          className={statusClassName(record.approval_status)}
                        >
                          {record.approval_status}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          {record.approved_at || ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={downloadingStudentId === Number(record.student_id)}
                            onClick={() => handleDownloadApprovedRecord(record, "single")}
                          >
                            {downloadingStudentId === Number(record.student_id) ? "Downloading..." : "Single"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={downloadingFinalStudentId === Number(record.student_id)}
                            onClick={() => handleDownloadApprovedRecord(record, "final")}
                          >
                            {downloadingFinalStudentId === Number(record.student_id) ? "Downloading..." : "Final"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                Showing {approvedRecordsStart}-{approvedRecordsEnd} of {approvedRecords.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={approvedRecordsPage <= 1}
                  onClick={() => setApprovedRecordsPage((page) => Math.max(1, page - 1))}
                >
                  Previous
                </Button>
                <span className="min-w-24 text-center text-sm font-medium">
                  Page {approvedRecordsPage} of {approvedRecordsTotalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={approvedRecordsPage >= approvedRecordsTotalPages}
                  onClick={() =>
                    setApprovedRecordsPage((page) => Math.min(approvedRecordsTotalPages, page + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
            </>
          ) : (
            <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              No approved records found for the current filters.
            </p>
          )}
        </div>
      </SurfaceCard>
    );
  }

  function renderGridPanel({ mode = "entry" } = {}) {
    const isPendingMode = mode === "pending";
    const isApprovedMode = mode === "approved";
    const canEditMarks = isPendingMode || isApprovedMode ? editMode : canUseEntryFlow;
    const canSelectRows = !isApprovedMode;
    const showEntryActions = canUseEntryFlow && !isPendingMode && !isApprovedMode;
    const showAdminEditActions = isAdmin && (isPendingMode || isApprovedMode);
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
              <TableHead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {hasSubjectComponents(grid?.subject)
                  ? "Branch Marks"
                  : isSplitPattern(grid?.subject)
                    ? "Marks (T/P/Total)"
                    : "Marks"}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Status</TableHead>
              {isAdmin ? <TableHead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Downloads</TableHead> : null}
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
                  {canEditMarks ? (
                    hasSubjectComponents(grid?.subject) ? (
                      <div className="space-y-3">
                        {(grid.subject.components || []).map((component) => {
                          const editedComponent =
                            editedMarks?.[row.student_id]?.components?.[component.id] || {};
                          const componentSplit =
                            String(component.mark_pattern || "single").trim().toLowerCase() === "split";
                          return (
                            <div
                              key={`${row.student_id}-${component.id}`}
                              className="rounded-lg border border-border bg-muted/20 p-2"
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-xs font-medium">{component.name}</span>
                                <span className="text-[11px] text-muted-foreground">
                                  Max {component.max_marks}
                                </span>
                              </div>
                              {componentSplit ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="w-5 text-[11px] text-muted-foreground">T</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    max={component.theory_max ?? component.max_marks ?? 100}
                                    className="w-20"
                                    value={editedComponent.theory_marks ?? ""}
                                    onChange={(e) =>
                                      updateComponentMarksValue(
                                        row.student_id,
                                        component.id,
                                        "theory_marks",
                                        e.target.value
                                      )
                                    }
                                    onWheel={(e) => e.currentTarget.blur()}
                                  />
                                  <span className="w-5 text-[11px] text-muted-foreground">P</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    max={component.practical_max ?? component.max_marks ?? 100}
                                    className="w-20"
                                    value={editedComponent.practical_marks ?? ""}
                                    onChange={(e) =>
                                      updateComponentMarksValue(
                                        row.student_id,
                                        component.id,
                                        "practical_marks",
                                        e.target.value
                                      )
                                    }
                                    onWheel={(e) => e.currentTarget.blur()}
                                  />
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="w-12 text-[11px] text-muted-foreground">Marks</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    max={component.max_marks ?? 100}
                                    className="w-24"
                                    value={editedComponent.marks ?? ""}
                                    onChange={(e) =>
                                      updateComponentMarksValue(
                                        row.student_id,
                                        component.id,
                                        "marks",
                                        e.target.value
                                      )
                                    }
                                    onWheel={(e) => e.currentTarget.blur()}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div className="text-[11px] font-medium text-muted-foreground">
                          Total:{" "}
                          {(grid.subject.components || []).reduce((sum, component) => {
                            const editedComponent =
                              editedMarks?.[row.student_id]?.components?.[component.id] || {};
                            const componentSplit =
                              String(component.mark_pattern || "single").trim().toLowerCase() === "split";
                            return (
                              sum +
                              (componentSplit
                                ? toNumberOrZero(editedComponent.theory_marks) +
                                  toNumberOrZero(editedComponent.practical_marks)
                                : toNumberOrZero(editedComponent.marks))
                            );
                          }, 0)}
                        </div>
                      </div>
                    ) : isSplitPattern(grid?.subject) ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-[11px] text-muted-foreground">T</span>
                          <Input
                            type="number"
                            min="0"
                            max={grid?.subject?.theory_max ?? grid?.subject?.max_marks ?? 100}
                            className="w-24"
                            value={editedMarks?.[row.student_id]?.theory_marks ?? ""}
                            onChange={(e) => updateMarksValue(row.student_id, "theory_marks", e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-[11px] text-muted-foreground">P</span>
                          <Input
                            type="number"
                            min="0"
                            max={grid?.subject?.practical_max ?? grid?.subject?.max_marks ?? 100}
                            className="w-24"
                            value={editedMarks?.[row.student_id]?.practical_marks ?? ""}
                            onChange={(e) => updateMarksValue(row.student_id, "practical_marks", e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                          />
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Total:{" "}
                          {toNumberOrZero(editedMarks?.[row.student_id]?.theory_marks) +
                            toNumberOrZero(editedMarks?.[row.student_id]?.practical_marks)}
                        </div>
                      </div>
                    ) : (
                      <Input
                        type="number"
                        min="0"
                        max={grid?.subject?.max_marks || 100}
                        className="w-24"
                        value={editedMarks?.[row.student_id]?.marks ?? ""}
                        onChange={(e) => updateMarksValue(row.student_id, "marks", e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()}
                      />
                    )
                  ) : hasSubjectComponents(grid?.subject) ? (
                    <div className="space-y-2 text-xs">
                      {(row.components || []).map((component) => (
                        <div key={`${row.student_id}-${component.component_id}`}>
                          <div className="font-medium">{component.name}</div>
                          <div>T: {component.theory_marks ?? "-"} | P: {component.practical_marks ?? "-"}</div>
                        </div>
                      ))}
                      <div className="font-medium">Total: {row.marks ?? "-"}</div>
                    </div>
                  ) : isSplitPattern(grid?.subject) ? (
                    <div className="text-xs">
                      <div>T: {row.theory_marks ?? "-"}</div>
                      <div>P: {row.practical_marks ?? "-"}</div>
                      <div className="font-medium">Total: {row.marks ?? "-"}</div>
                    </div>
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
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={row.approval_status !== "approved" || downloadingStudentId === Number(row.student_id)}
                        onClick={() => handleDownloadStudent(row.student_id)}
                      >
                        {downloadingStudentId === Number(row.student_id) ? "Downloading..." : "Single"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={row.approval_status !== "approved" || downloadingFinalStudentId === Number(row.student_id)}
                        onClick={() => handleDownloadFinalStudent(row.student_id)}
                      >
                        {downloadingFinalStudentId === Number(row.student_id) ? "Downloading..." : "Final"}
                      </Button>
                    </div>
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
                  className={SELECT_CLASSNAME}
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
                    className={SELECT_CLASSNAME}
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
                  disabled={!selfReport || selfDownloadLoading}
                >
                  {selfDownloadLoading ? "Downloading..." : "Download Marksheet"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadMyFinalResult}
                  disabled={!selfFilters.student_id || selfFinalDownloadLoading}
                >
                  {selfFinalDownloadLoading ? "Downloading..." : "Download Final"}
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
                    <TableHead>Theory</TableHead>
                    <TableHead>Practical</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Max</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selfReport.subjects || []).map((row) => (
                    <TableRow key={row.subject}>
                      <TableCell>{row.subject}</TableCell>
                      <TableCell>{row.theory_marks ?? "-"}</TableCell>
                      <TableCell>{row.practical_marks ?? "-"}</TableCell>
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
                    <span>Auto Review</span>
                    {displayedPendingQueue.total_pending > 0 ? (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                        {displayedPendingQueue.total_pending}
                      </span>
                    ) : null}
                  </span>
                </TabsTrigger>
              ) : null}
              {isAdmin ? <TabsTrigger value="manual-review">Review</TabsTrigger> : null}
              <TabsTrigger value="entry">Entry</TabsTrigger>
              <TabsTrigger value="approved">Published</TabsTrigger>
              {canViewAdminReportSections ? <TabsTrigger value="records">Records</TabsTrigger> : null}
              {canViewAdminReportSections ? <TabsTrigger value="templates">Templates</TabsTrigger> : null}
            </TabsList>

            {isAdmin ? (
              <TabsContent value="pending" className="grid gap-4">
                {renderFilterPanel()}
                {renderGridPanel({ mode: "pending" })}
              </TabsContent>
            ) : null}

            {isAdmin ? (
              <TabsContent value="manual-review" className="grid gap-4">
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
              {renderPublicationPanel()}
              {renderGridPanel({ mode: "approved" })}
            </TabsContent>

            {canViewAdminReportSections ? (
              <TabsContent value="records" className="grid gap-4">
                {renderFilterPanel()}
                {renderApprovedRecordsPanel()}
              </TabsContent>
            ) : null}

            {canViewAdminReportSections ? (
              <TabsContent value="templates" className="grid gap-4">
                <SurfaceCard accent>
                  <div className="space-y-4 p-4">
                    <div>
                      <p className="text-base font-semibold">Marksheet Templates</p>
                      <p className="text-sm text-muted-foreground">
                        Preview how downloaded marksheets are presented. The single-exam template is active; the final template is the combined-exam layout planned from the shared references.
                      </p>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      <MarksheetTemplatePreview type="single" />
                      <MarksheetTemplatePreview type="final" />
                    </div>
                  </div>
                </SurfaceCard>
              </TabsContent>
            ) : null}
          </Tabs>
        </div>
      ) : null}
    </>
  );
}


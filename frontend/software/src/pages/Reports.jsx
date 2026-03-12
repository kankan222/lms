import { useEffect, useMemo, useState } from "react";
import TopBar from "../components/TopBar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
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
  approveMarks,
  downloadMyMarksheet,
  downloadStudentMarksheet,
  getMarksGrid,
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

function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function Reports() {
  const { can } = usePermissions();
  const isAdmin = can("marks.approve");
  const canEnterMarks = can("marks.enter");
  const selfViewOnly = !isAdmin && !canEnterMarks;

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [examSubjects, setExamSubjects] = useState([]);
  const [myStudents, setMyStudents] = useState([]);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selfFilters, setSelfFilters] = useState(EMPTY_SELF_FILTERS);

  const [grid, setGrid] = useState(null);
  const [selfReport, setSelfReport] = useState(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [editedMarks, setEditedMarks] = useState({});
  const [editMode, setEditMode] = useState(false);

  const [loading, setLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(false);
  const [selfLoading, setSelfLoading] = useState(false);
  const [banner, setBanner] = useState(null);

  const selectedClass = useMemo(
    () => classes.find((item) => String(item.id) === String(filters.class_id)) || null,
    [classes, filters.class_id]
  );
  const sections = selectedClass?.sections || [];
  const mediums = uniqueMediums(sections);
  const filteredSubjects = examSubjects.length
    ? subjects.filter((subject) =>
        examSubjects.some((item) => String(item.subject_id) === String(subject.id))
      )
    : subjects;

  useEffect(() => {
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!banner) return undefined;
    const timeoutId = window.setTimeout(() => {
      setBanner(null);
    }, 3500);
    return () => window.clearTimeout(timeoutId);
  }, [banner]);

  useEffect(() => {
    if (!filters.exam_id) {
      setExamSubjects([]);
      setFilters((prev) => ({ ...prev, subject_id: "" }));
      return;
    }

    let ignore = false;
    (async () => {
      try {
        const res = await getExamById(filters.exam_id);
        if (!ignore) {
          setExamSubjects(Array.isArray(res?.data?.subjects) ? res.data.subjects : []);
        }
      } catch (err) {
        if (!ignore) {
          setExamSubjects([]);
          setBanner({
            type: "destructive",
            title: "Exam load failed",
            message: err?.message || "Failed to load exam subjects.",
          });
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [filters.exam_id]);

  async function loadBootstrap() {
    setLoading(true);
    try {
      const [classRes, subjectRes, examRes] = await Promise.all([
        getClassStructure(),
        getSubjects(),
        getExams(),
      ]);

      setClasses(Array.isArray(classRes?.data) ? classRes.data : []);
      setSubjects(Array.isArray(subjectRes?.data) ? subjectRes.data : []);
      setExams(Array.isArray(examRes?.data) ? examRes.data : []);

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
      exam_id: filters.exam_id,
      class_id: filters.class_id,
      section_id: filters.section_id,
      medium: filters.medium,
      subject_id: filters.subject_id,
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
      setSuccess("Marks saved as draft.");
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
                    <TableHead>Pass</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selfReport.subjects || []).map((row) => (
                    <TableRow key={row.subject}>
                      <TableCell>{row.subject}</TableCell>
                      <TableCell>{row.marks}</TableCell>
                      <TableCell>{row.max_marks}</TableCell>
                      <TableCell>{row.pass_marks}</TableCell>
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
          <div className="rounded-xl border bg-card p-4">
            <div className="grid gap-4 md:grid-cols-6">
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
                  {classes.map((item) => (
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
                  {sections.map((section) => (
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

              <div className="grid gap-2">
                <Label>Student Search</Label>
                <Input
                  placeholder="Search name"
                  value={filters.name}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
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

              <Button onClick={handleLoadGrid} disabled={gridLoading}>
                {gridLoading ? "Loading..." : "Load Students"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold">
                  {grid?.subject?.name || "Marks Grid"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {grid?.rows?.length || 0} student{grid?.rows?.length === 1 ? "" : "s"} loaded
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {canEnterMarks ? (
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

                {isAdmin ? (
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
                    <Button
                      onClick={() => handleApprove(false)}
                      disabled={gridLoading || !selectedStudentIds.length}
                    >
                      Approve Selected
                    </Button>
                    <Button
                      onClick={() => handleApprove(true)}
                      disabled={gridLoading || !grid?.rows?.length}
                    >
                      Approve All
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={gridLoading || !selectedStudentIds.length}
                    >
                      Reject
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => toggleAllRows(Boolean(checked))}
                    />
                  </TableHead>
                  <TableHead>Roll Number</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin ? <TableHead>Download</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(grid?.rows || []).map((row) => (
                  <TableRow key={row.student_id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedStudentIds.includes(Number(row.student_id))}
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
                    <TableCell>
                      {canEnterMarks || editMode ? (
                        <Input
                          type="number"
                          min="0"
                          max={grid?.subject?.max_marks || 100}
                          className="w-24"
                          value={editedMarks[row.student_id] ?? ""}
                          onChange={(e) => updateMarksValue(row.student_id, e.target.value)}
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
                      colSpan={isAdmin ? 6 : 5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Select the filters above and load a marks grid.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </>
  );
}


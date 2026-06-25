import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { ClipboardList, Trash2 } from "lucide-react";
import TopBar from "../components/TopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  assignTeacher,
  getTeacherAssignments,
  getTeachers,
  removeAssignment,
} from "../api/teachers.api";
import { getClassStructure, getSessions } from "../api/academic.api";
import { getSubjectOfferings } from "../api/subjects.api";

const scopeLabels = {
  school: "School",
  hs: "Higher Secondary",
};

const subjectGroupLabels = {
  compulsory: "Compulsory",
  elective: "Elective",
  optional: "Optional",
};

function resolveScopeCode(scopeCode, scopeName = "") {
  const code = String(scopeCode || "").trim().toLowerCase();
  if (code === "hs" || code === "school") return code;
  if (code.includes("higher secondary")) return "hs";
  if (code.includes("school")) return "school";

  const name = String(scopeName || "").trim().toLowerCase();
  if (name.includes("higher secondary")) return "hs";
  if (name.includes("school")) return "school";

  return "school";
}

function scopeBadgeClass(scope) {
  const value = String(scope || "").trim().toLowerCase();

  if (value === "hs") {
    return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-200";
  }

  if (value === "school") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200";
  }

  return "border-border bg-muted text-muted-foreground dark:bg-muted/40";
}

function teacherScopeBadgeClass(scope) {
  const value = String(scope || "").trim().toLowerCase();

  if (value === "hs") {
    return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-200";
  }

  return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200";
}

function subjectGroupBadgeClass(group) {
  const value = String(group || "").trim().toLowerCase();

  if (value === "elective") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200";
  }

  if (value === "optional") {
    return "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-200";
  }

  return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200";
}

function deriveAssignmentSelections(sourceAssignments, sessionId) {
  const normalizedSessionId = String(sessionId || "");
  const scopedAssignments = normalizedSessionId
    ? sourceAssignments.filter((assignment) => String(assignment.session_id) === normalizedSessionId)
    : sourceAssignments;

  return {
    sections: Array.from(
      new Set(
        scopedAssignments
          .filter((assignment) => assignment.class_id && assignment.section_id)
          .map((assignment) => `${assignment.class_id}-${assignment.section_id}`),
      ),
    ),
    subjects: Array.from(
      new Set(
        scopedAssignments
          .filter((assignment) => assignment.class_id && assignment.subject_id)
          .map((assignment) => `${assignment.class_id}-${assignment.subject_id}`),
      ),
    ),
  };
}

export default function AssignTeacherToClass() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [subjectOfferings, setSubjectOfferings] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedSections, setSelectedSections] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [assignError, setAssignError] = useState("");
  const [notice, setNotice] = useState(null);

  function showNotice(title, message, variant = "success") {
    setNotice({ title, message, variant });
  }

  const teacherById = useMemo(
    () => new Map(teachers.map((teacher) => [Number(teacher.id), teacher])),
    [teachers],
  );

  const selectedTeacherRow = teacherById.get(Number(selectedTeacher)) || null;

  const subjectOfferingsByClass = useMemo(() => {
    const grouped = new Map();

    subjectOfferings.forEach((offering) => {
      if (!offering?.class_id || !offering?.subject_id) return;

      const classId = Number(offering.class_id);
      const subjectId = Number(offering.subject_id);
      const existing = grouped.get(classId) || new Map();

      if (!existing.has(subjectId)) {
        existing.set(subjectId, {
          subject_id: subjectId,
          subject_name: offering.subject_name || offering.name || "Subject",
          subject_group: offering.subject_group || "compulsory",
        });
      }

      grouped.set(classId, existing);
    });

    return grouped;
  }, [subjectOfferings]);

  const scopedClasses = useMemo(() => {
    if (!selectedTeacherRow) return classes;
    const teacherScope = resolveScopeCode(selectedTeacherRow.class_scope, selectedTeacherRow.scope_name);
    return classes.filter((classRow) =>
      resolveScopeCode(classRow.class_scope, classRow.scope_name) === teacherScope
    );
  }, [classes, selectedTeacherRow]);

  const assignedClassCards = useMemo(() => {
    const grouped = new Map();

    assignments.forEach((assignment) => {
      const classKey = String(assignment.class_id || assignment.class || "unknown");
      const classRow = classes.find((item) => Number(item.id) === Number(assignment.class_id));
      const teacher = teacherById.get(Number(assignment.teacher_id));
      const existing = grouped.get(classKey) || {
        id: classKey,
        class_name: assignment.class || classRow?.name || "Unknown Class",
        class_scope: resolveScopeCode(classRow?.class_scope, classRow?.scope_name),
        scope_name: classRow?.scope_name || null,
        assignments: [],
      };

      existing.assignments.push({
        id: assignment.id,
        teacher_name: assignment.teacher || teacher?.name || "Unknown Teacher",
        teacher_scope: resolveScopeCode(teacher?.class_scope, teacher?.scope_name),
        section_name: assignment.section || "All Sections",
        subject_name: assignment.subject || "Subject",
        subject_group:
          subjectOfferingsByClass
            .get(Number(assignment.class_id))
            ?.get(Number(assignment.subject_id))
            ?.subject_group || "compulsory",
        session_name: assignment.session || "-",
      });

      grouped.set(classKey, existing);
    });

    return Array.from(grouped.values()).map((item) => ({
      ...item,
      assignments: item.assignments.sort((a, b) =>
        `${a.teacher_name}-${a.subject_name}-${a.section_name}`.localeCompare(
          `${b.teacher_name}-${b.subject_name}-${b.section_name}`,
        ),
      ),
    }));
  }, [assignments, classes, subjectOfferingsByClass, teacherById]);

  async function loadAssignmentsForTeachers(teacherRows) {
    const assignmentLists = await Promise.all(
      teacherRows.map(async (teacher) => {
        try {
          const res = await getTeacherAssignments(teacher.id);
          const rows = Array.isArray(res?.data) ? res.data : [];
          return rows.map((row) => ({
            ...row,
            teacher_id: teacher.id,
            teacher: row.teacher || teacher.name,
          }));
        } catch {
          return [];
        }
      }),
    );

    setAssignments(assignmentLists.flat());
  }

  async function loadInitialData() {
    const [teachersRes, classesRes, sessionsRes, offeringsRes] = await Promise.all([
      getTeachers(),
      getClassStructure(),
      getSessions(),
      getSubjectOfferings(),
    ]);

    const teacherRows = Array.isArray(teachersRes?.data) ? teachersRes.data : [];
    setTeachers(teacherRows);
    setClasses(Array.isArray(classesRes?.data) ? classesRes.data : []);
    setSessions(Array.isArray(sessionsRes?.data) ? sessionsRes.data : []);
    setSubjectOfferings(Array.isArray(offeringsRes?.data) ? offeringsRes.data : []);
    await loadAssignmentsForTeachers(teacherRows);
  }

  const loadInitialDataEvent = useEffectEvent(() => {
    loadInitialData();
  });

  useEffect(() => {
    loadInitialDataEvent();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  function resetAssignDialog() {
    setAssignError("");
    setSelectedTeacher("");
    setSelectedSession("");
    setSelectedSections([]);
    setSelectedSubjects([]);
  }

  function getAssignmentsForTeacher(teacherId) {
    return assignments.filter((assignment) => Number(assignment.teacher_id) === Number(teacherId));
  }

  function resolveDefaultSessionId(teacherAssignments) {
    return String(
      teacherAssignments[0]?.session_id ||
      sessions.find((session) => session.is_active)?.id ||
      sessions[0]?.id ||
      "",
    );
  }

  function applyTeacherAssignmentSelections(teacherId, sessionId = "") {
    const teacherAssignments = getAssignmentsForTeacher(teacherId);
    const nextSessionId = String(sessionId || resolveDefaultSessionId(teacherAssignments));
    const nextSelections = deriveAssignmentSelections(teacherAssignments, nextSessionId);

    setSelectedSession(nextSessionId);
    setSelectedSections(nextSelections.sections);
    setSelectedSubjects(nextSelections.subjects);
  }

  function toggleSelection(setter, value, checked) {
    setter((prev) =>
      checked
        ? Array.from(new Set([...prev, value]))
        : prev.filter((item) => item !== value),
    );
  }

  async function handleAssignTeacher() {
    if (!selectedTeacher) {
      setAssignError("Select a teacher.");
      return;
    }

    if (!selectedSession) {
      setAssignError("Select an academic session.");
      return;
    }

    if (!selectedSections.length) {
      setAssignError("Select at least one section.");
      return;
    }

    if (!selectedSubjects.length) {
      setAssignError("Select at least one subject.");
      return;
    }

    const assignmentPayloads = selectedSubjects.flatMap((value) => {
      const [classId, subjectId] = value.split("-");
      const matchingSections = selectedSections
        .map((sectionValue) => sectionValue.split("-"))
        .filter(([sectionClassId]) => sectionClassId === classId)
        .map(([, sectionId]) => sectionId);

      return matchingSections.map((sectionId) =>
        assignTeacher(selectedTeacher, {
          class_id: classId,
          section_id: sectionId,
          subject_id: subjectId,
          session_id: selectedSession,
        }),
      );
    });

    if (!assignmentPayloads.length) {
      setAssignError("Select sections for the chosen class subjects.");
      return;
    }

    try {
      setAssignError("");
      await Promise.all(assignmentPayloads);
      await loadAssignmentsForTeachers(teachers);
      setAssignOpen(false);
      resetAssignDialog();
      showNotice("Teacher Assigned", "Teacher class assignments updated successfully.");
    } catch (err) {
      const message = err?.message || "Failed to assign teacher.";
      setAssignError(message);
      showNotice("Assign Failed", message, "error");
    }
  }

  async function handleRemoveAssignment(assignmentId) {
    try {
      await removeAssignment(assignmentId);
      await loadAssignmentsForTeachers(teachers);
      showNotice("Assignment Removed", "Teacher assignment removed successfully.");
    } catch (err) {
      const message = err?.message || "Failed to remove assignment.";
      showNotice("Remove Failed", message, "error");
    }
  }

  return (
    <>
      <div className="pointer-events-none fixed top-6 right-6 z-50 w-full max-w-sm">
        <div
          className={`transition-all duration-500 ease-out ${
            notice ? "translate-x-0 scale-100 opacity-100" : "translate-x-12 scale-95 opacity-0"
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
        title="Assign Teacher to Class"
        subTitle="Manage teacher class, section, subject, and session assignments"
        action={
          <Dialog
            open={assignOpen}
            onOpenChange={(open) => {
              setAssignOpen(open);
              if (!open) resetAssignDialog();
            }}
          >
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-sm">Assign Teacher</Button>
            </DialogTrigger>

            <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl">
              <DialogHeader>
                <DialogTitle>Assign Teacher to Class</DialogTitle>
                <DialogDescription>
                  Select a teacher, academic session, sections, and subjects. Existing teacher-details assignment remains available.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm font-medium text-foreground">Teacher *</Label>
                    <select
                      className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30"
                      value={selectedTeacher}
                      onChange={(e) => {
                        const teacherId = e.target.value;
                        setSelectedTeacher(teacherId);
                        if (teacherId) {
                          applyTeacherAssignmentSelections(teacherId);
                        } else {
                          setSelectedSession("");
                          setSelectedSections([]);
                          setSelectedSubjects([]);
                        }
                      }}
                    >
                      <option value="">Select Teacher</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-foreground">Academic Session *</Label>
                    <select
                      className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30"
                      value={selectedSession}
                      onChange={(e) => {
                        const nextSessionId = e.target.value;
                        if (selectedTeacher) {
                          applyTeacherAssignmentSelections(selectedTeacher, nextSessionId);
                        } else {
                          setSelectedSession(nextSessionId);
                        }
                      }}
                    >
                      <option value="">Select Session</option>
                      {sessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3">
                  {scopedClasses.map((classRow) => (
                    <div
                      key={classRow.id}
                      className="rounded-xl border border-border bg-background p-3 dark:bg-input/20"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-foreground">{classRow.name}</p>
                        <Badge
                          variant="outline"
                          className={`rounded-full ${scopeBadgeClass(resolveScopeCode(classRow.class_scope, classRow.scope_name))}`}
                        >
                          {scopeLabels[resolveScopeCode(classRow.class_scope, classRow.scope_name)]}
                        </Badge>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Sections
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(classRow.sections || []).map((section) => {
                              const value = `${classRow.id}-${section.id}`;
                              return (
                                <label
                                  key={value}
                                  className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1.5 text-sm"
                                >
                                  <Checkbox
                                    checked={selectedSections.includes(value)}
                                    onCheckedChange={(checked) =>
                                      toggleSelection(setSelectedSections, value, Boolean(checked))
                                    }
                                  />
                                  <span>{section.name}{section.medium ? ` (${section.medium})` : ""}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Subjects
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {Array.from(subjectOfferingsByClass.get(Number(classRow.id))?.values() || []).length ? (
                              Array.from(subjectOfferingsByClass.get(Number(classRow.id))?.values() || []).map((subject) => {
                                const value = `${classRow.id}-${subject.subject_id}`;
                                return (
                                  <label
                                    key={value}
                                    className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1.5 text-sm"
                                  >
                                    <Checkbox
                                      checked={selectedSubjects.includes(value)}
                                      onCheckedChange={(checked) =>
                                        toggleSelection(setSelectedSubjects, value, Boolean(checked))
                                      }
                                    />
                                    <span>{subject.subject_name}</span>
                                    <Badge
                                      variant="outline"
                                      className={`rounded-full px-2 py-0 text-[11px] ${subjectGroupBadgeClass(subject.subject_group)}`}
                                    >
                                      {subjectGroupLabels[subject.subject_group] || subject.subject_group}
                                    </Badge>
                                  </label>
                                );
                              })
                            ) : (
                              <span className="rounded-full border border-dashed px-3 py-1.5 text-sm text-muted-foreground">
                                No subject offerings assigned
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {assignError ? <p className="text-sm text-red-600">{assignError}</p> : null}

              <DialogFooter>
                <Button className="rounded-xl shadow-sm" onClick={handleAssignTeacher}>
                  Assign
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="space-y-4">
        {assignedClassCards.length === 0 ? (
          <Card className="rounded-2xl border border-dashed border-border/70 bg-card shadow-sm">
            <CardContent className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <ClipboardList className="size-6" />
              </div>
              <div className="space-y-1">
                <CardTitle>No teacher assignments</CardTitle>
                <CardDescription>
                  Assign a teacher to classes, sections, subjects, and an academic session.
                </CardDescription>
              </div>
              <Button className="rounded-xl shadow-sm" onClick={() => setAssignOpen(true)}>
                Assign Teacher
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Accordion
            type="multiple"
            defaultValue={assignedClassCards.map((item) => item.id)}
            className="space-y-3"
          >
            {assignedClassCards.map((item) => {
              const scopeKey = resolveScopeCode(item.class_scope, item.scope_name);
              const scopeLabel = item.scope_name || scopeLabels[scopeKey] || "Class";

              return (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md"
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-3 pr-2">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base tracking-tight">{item.class_name}</CardTitle>
                        <CardDescription>
                          {item.assignments.length} assignment{item.assignments.length === 1 ? "" : "s"}
                        </CardDescription>
                      </div>
                      <Badge
                        variant="outline"
                        className={`rounded-full ${scopeBadgeClass(scopeKey)}`}
                      >
                        {scopeLabel}
                      </Badge>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="px-4 pb-4">
                    <div className="grid gap-3">
                      {Array.from(
                        item.assignments
                          .reduce((grouped, assignment) => {
                            const key = assignment.teacher_name;
                            const existing = grouped.get(key) || {
                              teacher_name: assignment.teacher_name,
                              teacher_scope: assignment.teacher_scope,
                              session_name: assignment.session_name,
                              sections: new Set(),
                              subjects: new Set(),
                              assignmentRows: [],
                            };

                            existing.sections.add(`${item.class_name} - ${assignment.section_name}`);
                            existing.subjects.add(assignment.subject_name);
                            existing.assignmentRows.push(assignment);
                            grouped.set(key, existing);
                            return grouped;
                          }, new Map())
                          .values(),
                      ).map((teacherAssignment) => (
                        <div
                          key={teacherAssignment.teacher_name}
                          className="rounded-xl border border-border/70 bg-muted/25 p-3 dark:bg-muted/10"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold leading-none text-foreground">
                                {teacherAssignment.teacher_name}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Session: {teacherAssignment.session_name || "-"}
                              </p>
                            </div>

                            <Badge
                              variant="outline"
                              className={`rounded-full ${teacherScopeBadgeClass(teacherAssignment.teacher_scope)}`}
                            >
                              {scopeLabels[teacherAssignment.teacher_scope] || "Teacher"}
                            </Badge>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Assigned Classes & Sections
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {Array.from(teacherAssignment.sections).map((section) => (
                                  <Badge
                                    key={section}
                                    variant="secondary"
                                    className="rounded-full font-normal text-muted-foreground"
                                  >
                                    {section}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Assigned Subjects
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {teacherAssignment.assignmentRows.map((assignment) => (
                                  <span
                                    key={assignment.id}
                                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground shadow-xs dark:bg-input/20"
                                  >
                                    <span>{assignment.subject_name}</span>
                                    <Badge
                                      variant="outline"
                                      className={`rounded-full px-2 py-0 text-[11px] ${subjectGroupBadgeClass(assignment.subject_group)}`}
                                    >
                                      {subjectGroupLabels[assignment.subject_group] || assignment.subject_group}
                                    </Badge>
                                    <span className="text-muted-foreground">
                                      {assignment.section_name}
                                    </span>
                                    <button
                                      type="button"
                                      className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                      aria-label={`Remove ${assignment.subject_name} assignment`}
                                      onClick={() => handleRemoveAssignment(assignment.id)}
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </>
  );
}

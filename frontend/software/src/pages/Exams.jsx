import { useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import TopBar from "../components/TopBar";
import { Button } from "../components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getClassStructure } from "../api/academic.api";
import { getSubjects } from "../api/subjects.api";
import { createExam, deleteExam, getExamById, getExams, updateExam } from "../api/exam.api";
import { getStudents } from "../api/students.api";

function toWholeNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).trim().replace(/,/g, "");
  if (!normalized) return fallback;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

function normalizeScopeRows(scopes) {
  return (Array.isArray(scopes) ? scopes : [])
    .map((scope) => {
      const classId = Number(scope.class_id);
      if (!classId) return null;
      const hasSection =
        scope.section_id !== null &&
        scope.section_id !== undefined &&
        String(scope.section_id).trim() !== "";
      const sectionId = hasSection ? Number(scope.section_id) : null;
      if (hasSection && !sectionId) return null;
      return { class_id: classId, section_id: sectionId };
    })
    .filter(Boolean);
}

function isSplitPattern(subject) {
  return String(subject?.mark_pattern || "single").trim().toLowerCase() === "split";
}

function makeDefaultSubject(subject) {
  return {
    subject_id: Number(subject.id),
    subject_name: subject.name,
    mark_pattern: "single",
    max_marks: 100,
    pass_marks: 33,
    theory_max: 80,
    theory_pass: 0,
    practical_max: 20,
    practical_pass: 0
  };
}

export default function Exams() {
  const [exams, setExams] = useState([]);
  const [classStructure, setClassStructure] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingExam, setDeletingExam] = useState(null);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState(null);
  const [scopeStudents, setScopeStudents] = useState([]);
  const [scopeStudentsLoading, setScopeStudentsLoading] = useState(false);
  const [useStudentSubjectMap, setUseStudentSubjectMap] = useState(false);
  const [studentSubjectMap, setStudentSubjectMap] = useState({});
  const [form, setForm] = useState({
    name: "",
    scopes: [{ class_id: "", section_id: "" }],
    subjects: []
  });

  const classMap = useMemo(
    () => new Map(classStructure.map((item) => [String(item.id), item])),
    [classStructure]
  );

  const normalizedScopes = useMemo(() => normalizeScopeRows(form.scopes), [form.scopes]);
  const selectedSubjectIds = useMemo(
    () =>
      form.subjects
        .map((subject) => Number(subject.subject_id))
        .filter((subjectId) => Number.isFinite(subjectId) && subjectId > 0),
    [form.subjects]
  );

  async function loadInitial() {
    const [examsRes, classesRes, subjectsRes] = await Promise.all([
      getExams(),
      getClassStructure(),
      getSubjects()
    ]);
    setExams(examsRes?.data || []);
    setClassStructure(classesRes?.data || []);
    setAllSubjects(subjectsRes?.data || []);
  }

  const loadInitialExamData = useEffectEvent(() => {
    loadInitial();
  });

  const loadScopeStudents = useCallback(async () => {
    if (!useStudentSubjectMap) {
      setScopeStudents([]);
      return;
    }

    const scopes = normalizeScopeRows(form.scopes);
    if (!scopes.length) {
      setScopeStudents([]);
      return;
    }

    setScopeStudentsLoading(true);
    try {
      const responses = await Promise.all(
        scopes.map((scope) =>
          getStudents({
            class_id: scope.class_id,
            section_id: scope.section_id ?? undefined
          })
        )
      );

      const dedupe = new Map();
      responses.forEach((res) => {
        const rows = Array.isArray(res?.data) ? res.data : [];
        rows.forEach((row) => {
          const id = Number(row.id);
          if (!id) return;

          const className = row.class || row.class_name || "";
          const sectionName = row.section || row.section_name || "";
          const rollNumber =
            row.roll_number === null || row.roll_number === undefined ? "" : String(row.roll_number);

          dedupe.set(String(id), {
            id,
            name: row.name || `Student ${id}`,
            class_name: className,
            section_name: sectionName,
            roll_number: rollNumber
          });
        });
      });

      const nextStudents = Array.from(dedupe.values()).sort((left, right) => {
        const classDiff = String(left.class_name || "").localeCompare(String(right.class_name || ""));
        if (classDiff !== 0) return classDiff;
        const sectionDiff = String(left.section_name || "").localeCompare(String(right.section_name || ""));
        if (sectionDiff !== 0) return sectionDiff;
        const leftRoll = Number(left.roll_number || 0);
        const rightRoll = Number(right.roll_number || 0);
        if (leftRoll && rightRoll && leftRoll !== rightRoll) return leftRoll - rightRoll;
        return String(left.name || "").localeCompare(String(right.name || ""));
      });

      setScopeStudents(nextStudents);
    } catch (err) {
      setScopeStudents([]);
      setFormError(err?.message || "Failed to load students for subject mapping.");
    } finally {
      setScopeStudentsLoading(false);
    }
  }, [form.scopes, useStudentSubjectMap]);

  useEffect(() => {
    loadInitialExamData();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (!open || !useStudentSubjectMap) return;
    void loadScopeStudents();
  }, [open, useStudentSubjectMap, normalizedScopes, loadScopeStudents]);

  useEffect(() => {
    if (!useStudentSubjectMap) return;

    const validSubjectIdSet = new Set(selectedSubjectIds);
    const validStudentIdSet = new Set(scopeStudents.map((student) => Number(student.id)));
    const shouldFilterStudents = scopeStudents.length > 0;

    setStudentSubjectMap((prev) => {
      let changed = false;
      const next = {};

      Object.entries(prev).forEach(([studentId, subjectIds]) => {
        if (shouldFilterStudents && !validStudentIdSet.has(Number(studentId))) {
          changed = true;
          return;
        }

        const current = Array.isArray(subjectIds) ? subjectIds : [];
        const filtered = Array.from(
          new Set(
            current
              .map((subjectId) => Number(subjectId))
              .filter((subjectId) => validSubjectIdSet.has(subjectId))
          )
        );

        if (filtered.length) {
          next[studentId] = filtered;
        }

        if (filtered.length !== current.length) {
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [useStudentSubjectMap, selectedSubjectIds, scopeStudents]);

  function showNotice(title, message, variant = "success") {
    setNotice({ title, message, variant });
  }

  function resetForm() {
    setEditingId(null);
    setFormError("");
    setUseStudentSubjectMap(false);
    setStudentSubjectMap({});
    setScopeStudents([]);
    setScopeStudentsLoading(false);
    setForm({
      name: "",
      scopes: [{ class_id: "", section_id: "" }],
      subjects: []
    });
  }

  function setScope(index, key, value) {
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.map((scope, scopeIndex) =>
        scopeIndex === index
          ? key === "class_id"
            ? { class_id: value, section_id: "" }
            : { ...scope, [key]: value }
          : scope
      )
    }));
  }

  function addScopeRow() {
    setForm((prev) => ({
      ...prev,
      scopes: [...prev.scopes, { class_id: "", section_id: "" }]
    }));
  }

  function removeScopeRow(index) {
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.filter((_, scopeIndex) => scopeIndex !== index)
    }));
  }

  function toggleSubject(subject) {
    const subjectId = Number(subject.id);
    const exists = form.subjects.some((item) => Number(item.subject_id) === subjectId);

    if (exists) {
      setForm((prev) => ({
        ...prev,
        subjects: prev.subjects.filter((item) => Number(item.subject_id) !== subjectId)
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      subjects: [...prev.subjects, makeDefaultSubject(subject)]
    }));
  }

  function setSubjectPattern(subjectId, pattern) {
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.map((subject) => {
        if (Number(subject.subject_id) !== Number(subjectId)) return subject;

        if (pattern === "split") {
          const baseMax = toWholeNumber(subject.max_marks, 100);
          const practicalMax =
            subject.practical_max !== null && subject.practical_max !== undefined
              ? toWholeNumber(subject.practical_max, 0)
              : Math.min(20, baseMax);
          const theoryMax =
            subject.theory_max !== null && subject.theory_max !== undefined
              ? toWholeNumber(subject.theory_max, 0)
              : Math.max(baseMax - practicalMax, 0);
          const totalMax = theoryMax + practicalMax;

          return {
            ...subject,
            mark_pattern: "split",
            theory_max: theoryMax,
            theory_pass: toWholeNumber(subject.theory_pass, 0),
            practical_max: practicalMax,
            practical_pass: toWholeNumber(subject.practical_pass, 0),
            max_marks: totalMax,
            pass_marks: Math.min(toWholeNumber(subject.pass_marks, 0), totalMax)
          };
        }

        const maxMarks = Math.max(
          1,
          toWholeNumber(subject.theory_max, 0) + toWholeNumber(subject.practical_max, 0) || toWholeNumber(subject.max_marks, 100)
        );
        const passMarks = Math.min(
          maxMarks,
          toWholeNumber(subject.theory_pass, 0) + toWholeNumber(subject.practical_pass, 0) || toWholeNumber(subject.pass_marks, 33)
        );

        return {
          ...subject,
          mark_pattern: "single",
          max_marks: maxMarks,
          pass_marks: passMarks
        };
      })
    }));
  }

  function updateSubjectField(subjectId, key, value) {
    const wholeNumber = toWholeNumber(value, 0);
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.map((subject) =>
        Number(subject.subject_id) === Number(subjectId)
          ? { ...subject, [key]: wholeNumber }
          : subject
      )
    }));
  }

  function setStudentCustomMapping(studentId, checked) {
    const normalizedStudentId = String(Number(studentId));
    if (!normalizedStudentId) return;

    setStudentSubjectMap((prev) => {
      if (!checked) {
        const { [normalizedStudentId]: _removed, ...rest } = prev;
        return rest;
      }

      if (!selectedSubjectIds.length) return prev;

      const existing = Array.isArray(prev[normalizedStudentId]) ? prev[normalizedStudentId] : [];
      const next = existing.length ? existing : [...selectedSubjectIds];
      return {
        ...prev,
        [normalizedStudentId]: Array.from(new Set(next.map((subjectId) => Number(subjectId)).filter(Boolean)))
      };
    });
  }

  function setStudentSubject(studentId, subjectId, checked) {
    const normalizedStudentId = String(Number(studentId));
    const normalizedSubjectId = Number(subjectId);
    if (!normalizedStudentId || !normalizedSubjectId) return;

    setStudentSubjectMap((prev) => {
      const current = Array.isArray(prev[normalizedStudentId]) ? prev[normalizedStudentId] : [];
      const currentSet = new Set(current.map((item) => Number(item)).filter(Boolean));

      if (checked) currentSet.add(normalizedSubjectId);
      else currentSet.delete(normalizedSubjectId);

      const nextList = Array.from(currentSet);
      if (!nextList.length) {
        const { [normalizedStudentId]: _removed, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [normalizedStudentId]: nextList
      };
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFormError("");

    const cleanName = String(form.name || "").trim();
    if (!cleanName) {
      setFormError("Exam name is required.");
      return;
    }

    const cleanScopes = normalizeScopeRows(form.scopes);
    if (!cleanScopes.length) {
      setFormError("At least one valid class scope is required.");
      return;
    }

    const cleanSubjects = [];
    for (const subject of form.subjects) {
      const subjectId = Number(subject.subject_id);
      if (!subjectId) continue;

      if (isSplitPattern(subject)) {
        const theoryMax = toWholeNumber(subject.theory_max, 0);
        const practicalMax = toWholeNumber(subject.practical_max, 0);
        const theoryPass = toWholeNumber(subject.theory_pass, 0);
        const practicalPass = toWholeNumber(subject.practical_pass, 0);
        const maxMarks = theoryMax + practicalMax;
        const passMarks = theoryPass + practicalPass;

        if (maxMarks <= 0) {
          setFormError(`Split max marks for '${subject.subject_name}' must be greater than 0.`);
          return;
        }
        if (theoryPass > theoryMax || practicalPass > practicalMax || passMarks > maxMarks) {
          setFormError(
            `Pass marks cannot exceed max marks for '${subject.subject_name}'.`
          );
          return;
        }

        cleanSubjects.push({
          subject_id: subjectId,
          mark_pattern: "split",
          max_marks: maxMarks,
          pass_marks: passMarks,
          theory_max: theoryMax,
          theory_pass: theoryPass,
          practical_max: practicalMax,
          practical_pass: practicalPass
        });
        continue;
      }

      const maxMarks = toWholeNumber(subject.max_marks, 0);
      const passMarks = toWholeNumber(subject.pass_marks, 0);
      if (maxMarks <= 0) {
        setFormError(`Max marks for '${subject.subject_name}' must be greater than 0.`);
        return;
      }
      if (passMarks > maxMarks) {
        setFormError(`Pass marks cannot exceed max marks for '${subject.subject_name}'.`);
        return;
      }

      cleanSubjects.push({
        subject_id: subjectId,
        mark_pattern: "single",
        max_marks: maxMarks,
        pass_marks: passMarks
      });
    }

    if (!cleanSubjects.length) {
      setFormError("At least one subject is required.");
      return;
    }

    const subjectIdSet = new Set(cleanSubjects.map((subject) => Number(subject.subject_id)));
    const cleanStudentSubjects = useStudentSubjectMap
      ? Object.entries(studentSubjectMap)
          .map(([studentId, subjectIds]) => ({
            student_id: Number(studentId),
            subject_ids: Array.from(
              new Set(
                (Array.isArray(subjectIds) ? subjectIds : [])
                  .map((subjectId) => Number(subjectId))
                  .filter((subjectId) => subjectIdSet.has(subjectId))
              )
            )
          }))
          .filter((row) => row.student_id && row.subject_ids.length > 0)
      : [];

    const payload = {
      name: cleanName,
      scopes: cleanScopes,
      subjects: cleanSubjects,
      student_subjects: cleanStudentSubjects
    };

    try {
      if (editingId) await updateExam(editingId, payload);
      else await createExam(payload);
    } catch (err) {
      showNotice(
        editingId ? "Update Failed" : "Create Failed",
        err?.message || "Failed to save exam.",
        "error"
      );
      setFormError(err?.message || "Failed to save exam.");
      return;
    }

    await loadInitial();
    setOpen(false);
    resetForm();
    showNotice(
      editingId ? "Exam Updated" : "Exam Created",
      editingId ? "Exam updated successfully." : "Exam created successfully."
    );
  }

  async function onEdit(examId) {
    try {
      const res = await getExamById(examId);
      const exam = res?.data;
      if (!exam) return;

      setEditingId(exam.id);
      setForm({
        name: exam.name || "",
        scopes:
          (exam.scopes || []).map((scope) => ({
            class_id: String(scope.class_id),
            section_id:
              scope.section_id === null || scope.section_id === undefined ? "" : String(scope.section_id)
          })) || [{ class_id: "", section_id: "" }],
        subjects: (exam.subjects || []).map((subject) => ({
          subject_id: Number(subject.subject_id),
          subject_name: subject.subject_name,
          mark_pattern: isSplitPattern(subject) ? "split" : "single",
          max_marks: toWholeNumber(subject.max_marks, 0),
          pass_marks: toWholeNumber(subject.pass_marks, 0),
          theory_max: toWholeNumber(subject.theory_max, 0),
          theory_pass: toWholeNumber(subject.theory_pass, 0),
          practical_max: toWholeNumber(subject.practical_max, 0),
          practical_pass: toWholeNumber(subject.practical_pass, 0)
        }))
      });

      const groupedMappings = {};
      (exam.student_subjects || []).forEach((row) => {
        const studentId = Number(row.student_id);
        const subjectId = Number(row.subject_id);
        if (!studentId || !subjectId) return;
        const key = String(studentId);
        if (!groupedMappings[key]) groupedMappings[key] = [];
        groupedMappings[key].push(subjectId);
      });

      Object.keys(groupedMappings).forEach((studentId) => {
        groupedMappings[studentId] = Array.from(new Set(groupedMappings[studentId]));
      });

      setUseStudentSubjectMap(Object.keys(groupedMappings).length > 0);
      setStudentSubjectMap(groupedMappings);
      setScopeStudents([]);
      setFormError("");
      setOpen(true);
    } catch (err) {
      showNotice("Load Failed", err?.message || "Failed to load exam.", "error");
    }
  }

  async function onDelete(examId) {
    try {
      await deleteExam(examId);
      await loadInitial();
      setDeletingExam(null);
      showNotice("Exam Deleted", "Exam deleted successfully.");
    } catch (err) {
      showNotice("Delete Failed", err?.message || "Failed to delete exam.", "error");
    }
  }

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
        title="Exams"
        subTitle="Create exam scopes, configure single/split marks, and optionally map subject combinations per student"
        action={
          <Dialog
            open={open}
            onOpenChange={(value) => {
              setOpen(value);
              if (!value) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>{editingId ? "Edit Exam" : "Add Exam"}</Button>
            </DialogTrigger>

            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <form onSubmit={onSubmit} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Update Exam" : "Create Exam"}</DialogTitle>
                  <DialogDescription>
                    Set scope, define subject-wise mark pattern, and optionally choose custom subjects per student.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-2">
                  <Label>Exam Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Class Scopes (Section Optional) *</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addScopeRow}>
                      Add Scope
                    </Button>
                  </div>

                  {form.scopes.map((scope, index) => {
                    const selectedClass = classMap.get(String(scope.class_id));
                    const sections = selectedClass?.sections || [];
                    return (
                      <div key={index} className="grid grid-cols-12 gap-2 border rounded p-2">
                        <select
                          className="border rounded p-2 col-span-5"
                          value={scope.class_id}
                          onChange={(e) => setScope(index, "class_id", e.target.value)}
                          required
                        >
                          <option value="">Class</option>
                          {classStructure.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>

                        <select
                          className="border rounded p-2 col-span-5"
                          value={scope.section_id}
                          onChange={(e) => setScope(index, "section_id", e.target.value)}
                        >
                          <option value="">All Sections</option>
                          {sections.map((section) => (
                            <option key={section.id} value={section.id}>
                              {section.name}
                              {section.medium ? ` (${section.medium})` : ""}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          className="col-span-2 inline-flex items-center justify-center rounded border border-red-200/70 bg-red-50 text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
                          onClick={() => removeScopeRow(index)}
                          disabled={form.scopes.length === 1}
                          aria-label="Delete scope"
                          title="Delete scope"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <Label>Subjects *</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto border rounded p-2">
                    {allSubjects.map((subject) => {
                      const checked = form.subjects.some(
                        (item) => Number(item.subject_id) === Number(subject.id)
                      );
                      return (
                        <label key={subject.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSubject(subject)}
                          />
                          {subject.name}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {form.subjects.length > 0 && (
                  <div className="space-y-2">
                    {form.subjects.map((subject) => {
                      const split = isSplitPattern(subject);
                      const totalMax =
                        toWholeNumber(subject.theory_max, 0) + toWholeNumber(subject.practical_max, 0);
                      const totalPass =
                        toWholeNumber(subject.theory_pass, 0) + toWholeNumber(subject.practical_pass, 0);

                      return (
                        <div key={subject.subject_id} className="border rounded p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium">{subject.subject_name}</div>
                            <select
                              className="border rounded p-2 text-sm"
                              value={subject.mark_pattern || "single"}
                              onChange={(e) => setSubjectPattern(subject.subject_id, e.target.value)}
                            >
                              <option value="single">Single Total</option>
                              <option value="split">Theory + Practical</option>
                            </select>
                          </div>

                          {!split ? (
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                value={subject.max_marks}
                                onChange={(e) => updateSubjectField(subject.subject_id, "max_marks", e.target.value)}
                                placeholder="Max Marks"
                              />
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={subject.pass_marks}
                                onChange={(e) => updateSubjectField(subject.subject_id, "pass_marks", e.target.value)}
                                placeholder="Pass Marks"
                              />
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={subject.theory_max}
                                  onChange={(e) => updateSubjectField(subject.subject_id, "theory_max", e.target.value)}
                                  placeholder="Theory Max"
                                />
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={subject.theory_pass}
                                  onChange={(e) => updateSubjectField(subject.subject_id, "theory_pass", e.target.value)}
                                  placeholder="Theory Pass"
                                />
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={subject.practical_max}
                                  onChange={(e) => updateSubjectField(subject.subject_id, "practical_max", e.target.value)}
                                  placeholder="Practical Max"
                                />
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={subject.practical_pass}
                                  onChange={(e) => updateSubjectField(subject.subject_id, "practical_pass", e.target.value)}
                                  placeholder="Practical Pass"
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Total Max: {totalMax} | Total Pass: {totalPass}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-3 border rounded p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <Label>Custom Student Subject Mapping</Label>
                      <p className="text-xs text-muted-foreground">
                        Enable this only when students in the same scope have different subject combinations.
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={useStudentSubjectMap}
                        onChange={(e) => {
                          const checked = Boolean(e.target.checked);
                          setUseStudentSubjectMap(checked);
                          if (!checked) {
                            setStudentSubjectMap({});
                            setScopeStudents([]);
                          }
                        }}
                      />
                      Enable
                    </label>
                  </div>

                  {useStudentSubjectMap && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          Students are loaded from selected class scopes. If Custom Subjects is off for a student, all exam subjects apply to that student.
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={loadScopeStudents}
                          disabled={scopeStudentsLoading || !normalizedScopes.length}
                        >
                          {scopeStudentsLoading ? "Loading..." : "Reload Students"}
                        </Button>
                      </div>

                      {!normalizedScopes.length && (
                        <p className="text-xs text-amber-600">
                          Add at least one valid class scope to configure student mappings.
                        </p>
                      )}

                      {normalizedScopes.length > 0 && !scopeStudentsLoading && scopeStudents.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No students found in the selected scopes.
                        </p>
                      )}

                      {scopeStudents.length > 0 && (
                        <div className="max-h-56 overflow-auto rounded border">
                          {scopeStudents.map((student) => {
                            const studentKey = String(student.id);
                            const subjectIds = Array.isArray(studentSubjectMap[studentKey])
                              ? studentSubjectMap[studentKey]
                              : [];
                            const hasCustom = subjectIds.length > 0;

                            return (
                              <div key={student.id} className="border-b p-3 last:border-b-0">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium">{student.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {student.class_name || "-"} / {student.section_name || "-"}
                                      {student.roll_number ? ` | Roll: ${student.roll_number}` : ""}
                                    </p>
                                  </div>
                                  <label className="inline-flex items-center gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={hasCustom}
                                      onChange={(e) =>
                                        setStudentCustomMapping(student.id, Boolean(e.target.checked))
                                      }
                                    />
                                    Custom Subjects
                                  </label>
                                </div>

                                {hasCustom && (
                                  <div className="mt-2 grid grid-cols-2 gap-2">
                                    {form.subjects.map((subject) => {
                                      const subjectId = Number(subject.subject_id);
                                      return (
                                        <label
                                          key={`${student.id}-${subjectId}`}
                                          className="inline-flex items-center gap-2 text-xs"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={subjectIds.includes(subjectId)}
                                            onChange={(e) =>
                                              setStudentSubject(
                                                student.id,
                                                subjectId,
                                                Boolean(e.target.checked)
                                              )
                                            }
                                          />
                                          {subject.subject_name}
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {formError && <p className="text-sm text-red-600">{formError}</p>}

                <DialogFooter showCloseButton>
                  <Button type="submit" className="w-full sm:w-auto">
                    {editingId ? "Update Exam" : "Save Exam"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {exams.map((exam) => (
          <div key={exam.id} className="border rounded p-4 bg-secondary/70">
            <p className="font-semibold text-lg">{exam.name}</p>
            <p className="text-xs text-muted-foreground">Session: {exam.session_name || "-"}</p>
            <p className="text-xs text-muted-foreground">Exam ID: {exam.id}</p>
            <div className="flex gap-2 mt-3">
              <Button variant="secondary" size="sm" onClick={() => onEdit(exam.id)}>
                Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setDeletingExam(exam)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog
        open={!!deletingExam}
        onOpenChange={(dialogOpen) => {
          if (!dialogOpen) setDeletingExam(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete exam?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingExam
                ? `This will delete the exam '${deletingExam.name}'.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => onDelete(deletingExam.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import TopBar from "../components/TopBar";
import { Button } from "../components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardList, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getClassStructure } from "../api/academic.api";
import { getSubjectOfferings } from "../api/subjects.api";
import { createExam, deleteExam, getExamById, getExams, updateExam } from "../api/exam.api";

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

function hasSubjectComponents(subject) {
  return Array.isArray(subject?.components) && subject.components.length > 0;
}

function makeDefaultSubject(subject) {
  return {
    subject_id: Number(subject.subject_id || subject.id),
    subject_name: subject.subject_name || subject.name,
    subject_group: subject.subject_group || "compulsory",
    mark_pattern: "single",
    max_marks: 100,
    pass_marks: 33,
    theory_max: 80,
    theory_pass: 0,
    practical_max: 20,
    practical_pass: 0,
    components: []
  };
}

function makeDefaultBiologyComponents(subject) {
  const maxMarks = toWholeNumber(subject?.max_marks, 100);
  const passMarks = toWholeNumber(subject?.pass_marks, 33);
  const halfMax = Math.max(1, Math.trunc(maxMarks / 2));
  const secondMax = Math.max(1, maxMarks - halfMax);
  const halfPass = Math.trunc(passMarks / 2);
  const secondPass = Math.max(0, passMarks - halfPass);

  return [
    {
      name: "Botany",
      mark_pattern: "split",
      theory_max: Math.max(0, halfMax - Math.min(10, halfMax)),
      theory_pass: halfPass,
      practical_max: Math.min(10, halfMax),
      practical_pass: 0,
      max_marks: halfMax,
      pass_marks: halfPass,
      sort_order: 0,
    },
    {
      name: "Zoology",
      mark_pattern: "split",
      theory_max: Math.max(0, secondMax - Math.min(10, secondMax)),
      theory_pass: secondPass,
      practical_max: Math.min(10, secondMax),
      practical_pass: 0,
      max_marks: secondMax,
      pass_marks: secondPass,
      sort_order: 1,
    },
  ];
}

function rollupSubjectComponents(subject) {
  const components = Array.isArray(subject.components) ? subject.components : [];
  if (!components.length) return subject;

  const normalizedComponents = components.map((component, index) => {
    if (String(component.mark_pattern || "split").trim().toLowerCase() === "single") {
      return {
        ...component,
        mark_pattern: "single",
        max_marks: toWholeNumber(component.max_marks, 0),
        pass_marks: toWholeNumber(component.pass_marks, 0),
        theory_max: 0,
        theory_pass: 0,
        practical_max: 0,
        practical_pass: 0,
        sort_order: index,
      };
    }

    const theoryMax = toWholeNumber(component.theory_max, 0);
    const practicalMax = toWholeNumber(component.practical_max, 0);
    const theoryPass = toWholeNumber(component.theory_pass, 0);
    const practicalPass = toWholeNumber(component.practical_pass, 0);
    return {
      ...component,
      mark_pattern: "split",
      theory_max: theoryMax,
      theory_pass: theoryPass,
      practical_max: practicalMax,
      practical_pass: practicalPass,
      max_marks: theoryMax + practicalMax,
      pass_marks: theoryPass + practicalPass,
      sort_order: index,
    };
  });

  return {
    ...subject,
    components: normalizedComponents,
    mark_pattern: "split",
    max_marks: normalizedComponents.reduce((sum, component) => sum + toWholeNumber(component.max_marks, 0), 0),
    pass_marks: normalizedComponents.reduce((sum, component) => sum + toWholeNumber(component.pass_marks, 0), 0),
    theory_max: normalizedComponents.reduce((sum, component) => sum + toWholeNumber(component.theory_max, 0), 0),
    theory_pass: normalizedComponents.reduce((sum, component) => sum + toWholeNumber(component.theory_pass, 0), 0),
    practical_max: normalizedComponents.reduce((sum, component) => sum + toWholeNumber(component.practical_max, 0), 0),
    practical_pass: normalizedComponents.reduce((sum, component) => sum + toWholeNumber(component.practical_pass, 0), 0),
  };
}

const subjectGroupLabels = {
  compulsory: "Compulsory",
  elective: "Elective",
  optional: "Optional",
};

const classScopeLabels = {
  school: "School",
  hs: "Higher Secondary",
};

const FIELD_CLASSNAME =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30";

function preventNumberWheel(e) {
  e.currentTarget.blur();
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

function markPatternBadgeClass(pattern) {
  return String(pattern || "single").trim().toLowerCase() === "split"
    ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-200"
    : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200";
}

export default function Exams() {
  const [exams, setExams] = useState([]);
  const [scopeFilter, setScopeFilter] = useState("all");
  const [classStructure, setClassStructure] = useState([]);
  const [subjectOfferings, setSubjectOfferings] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingExam, setDeletingExam] = useState(null);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({
    name: "",
    scopes: [{ class_id: "", section_id: "" }],
    subjects: []
  });

  const classMap = useMemo(
    () => new Map(classStructure.map((item) => [String(item.id), item])),
    [classStructure]
  );

  const availableExamSubjects = useMemo(() => {
    const scopes = normalizeScopeRows(form.scopes);
    if (!scopes.length) return [];

    const subjectMap = new Map();
    subjectOfferings.forEach((offering) => {
      if (!offering?.class_id || !offering?.subject_id) return;

      const offeringClassId = Number(offering.class_id);
      const offeringSectionId =
        offering.section_id === null || offering.section_id === undefined
          ? null
          : Number(offering.section_id);
      const matchesScope = scopes.some((scope) => {
        if (Number(scope.class_id) !== offeringClassId) return false;
        if (scope.section_id === null) return true;
        return offeringSectionId === null || Number(scope.section_id) === offeringSectionId;
      });

      if (!matchesScope) return;

      const subjectId = Number(offering.subject_id);
      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          id: subjectId,
          subject_id: subjectId,
          name: offering.subject_name || offering.name || "Subject",
          subject_name: offering.subject_name || offering.name || "Subject",
          subject_group: offering.subject_group || "compulsory",
        });
      }
    });

    if (editingId) {
      form.subjects.forEach((subject) => {
        const subjectId = Number(subject.subject_id);
        if (!subjectId || subjectMap.has(subjectId)) return;
        subjectMap.set(subjectId, {
          id: subjectId,
          subject_id: subjectId,
          name: subject.subject_name || "Subject",
          subject_name: subject.subject_name || "Subject",
          subject_group: subject.subject_group || "compulsory",
        });
      });
    }

    return Array.from(subjectMap.values()).sort((left, right) =>
      String(left.subject_name || "").localeCompare(String(right.subject_name || ""))
    );
  }, [editingId, form.scopes, form.subjects, subjectOfferings]);
  const examCards = useMemo(
    () =>
      exams.map((exam) => {
        const scopes = Array.isArray(exam.scopes) ? exam.scopes : [];
        const subjects = Array.isArray(exam.subjects) ? exam.subjects : [];
        const classScopes = String(exam.class_scope || "school")
          .split(",")
          .map((scope) => scope.trim().toLowerCase())
          .filter(Boolean);
        const scopeLabels = scopes.map((scope) => {
          const className = scope.class_name || scope.class || `Class ${scope.class_id}`;
          const sectionName =
            scope.section_id === null || scope.section_id === undefined
              ? "All Sections"
              : scope.section_name || scope.section || `Section ${scope.section_id}`;
          return `${className} · ${sectionName}`;
        });

        return {
          ...exam,
          scopes,
          subjects,
          classScopes: classScopes.length ? classScopes : ["school"],
          scopeLabels,
        };
      }),
    [exams]
  );
  const visibleExamCards = useMemo(
    () =>
      scopeFilter === "all"
        ? examCards
        : examCards.filter((exam) => exam.classScopes.includes(scopeFilter)),
    [examCards, scopeFilter]
  );
  const schoolExamCards = useMemo(
    () => visibleExamCards.filter((exam) => exam.classScopes.includes("school")),
    [visibleExamCards]
  );
  const hsExamCards = useMemo(
    () => visibleExamCards.filter((exam) => exam.classScopes.includes("hs")),
    [visibleExamCards]
  );

  async function loadInitial() {
    const [examsRes, classesRes, offeringsRes] = await Promise.all([
      getExams(),
      getClassStructure(),
      getSubjectOfferings()
    ]);
    setExams(examsRes?.data || []);
    setClassStructure(classesRes?.data || []);
    setSubjectOfferings(offeringsRes?.data || []);
  }

  const loadInitialExamData = useEffectEvent(() => {
    loadInitial();
  });

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

  function showNotice(title, message, variant = "success") {
    setNotice({ title, message, variant });
  }

  function resetForm() {
    setEditingId(null);
    setFormError("");
    setForm({
      name: "",
      scopes: [{ class_id: "", section_id: "" }],
      subjects: []
    });
  }

  function getAvailableSubjectIdsForScopes(scopes) {
    const normalized = normalizeScopeRows(scopes);
    const subjectIds = new Set();

    if (!normalized.length) return subjectIds;

    subjectOfferings.forEach((offering) => {
      if (!offering?.class_id || !offering?.subject_id) return;

      const offeringClassId = Number(offering.class_id);
      const offeringSectionId =
        offering.section_id === null || offering.section_id === undefined
          ? null
          : Number(offering.section_id);
      const matchesScope = normalized.some((scope) => {
        if (Number(scope.class_id) !== offeringClassId) return false;
        if (scope.section_id === null) return true;
        return offeringSectionId === null || Number(scope.section_id) === offeringSectionId;
      });

      if (matchesScope) subjectIds.add(Number(offering.subject_id));
    });

    return subjectIds;
  }

  function pruneSubjectsForScopes(subjects, scopes) {
    if (editingId) return subjects;
    const validSubjectIds = getAvailableSubjectIdsForScopes(scopes);
    return subjects.filter((subject) => validSubjectIds.has(Number(subject.subject_id)));
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
      ),
      subjects: pruneSubjectsForScopes(
        prev.subjects,
        prev.scopes.map((scope, scopeIndex) =>
          scopeIndex === index
            ? key === "class_id"
              ? { class_id: value, section_id: "" }
              : { ...scope, [key]: value }
            : scope
        )
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
      scopes: prev.scopes.filter((_, scopeIndex) => scopeIndex !== index),
      subjects: pruneSubjectsForScopes(
        prev.subjects,
        prev.scopes.filter((_, scopeIndex) => scopeIndex !== index)
      )
    }));
  }

  function toggleSubject(subject) {
    const subjectId = Number(subject.subject_id || subject.id);
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
          components: [],
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

  function enableSubjectComponents(subjectId) {
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.map((subject) =>
        Number(subject.subject_id) === Number(subjectId)
          ? rollupSubjectComponents({
              ...subject,
              components: makeDefaultBiologyComponents(subject),
            })
          : subject
      ),
    }));
  }

  function clearSubjectComponents(subjectId) {
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.map((subject) =>
        Number(subject.subject_id) === Number(subjectId)
          ? { ...subject, components: [] }
          : subject
      ),
    }));
  }

  function updateSubjectComponentField(subjectId, componentIndex, key, value) {
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.map((subject) => {
        if (Number(subject.subject_id) !== Number(subjectId)) return subject;
        const components = (subject.components || []).map((component, index) =>
          index === componentIndex
            ? {
                ...component,
                [key]: key === "name" ? value : toWholeNumber(value, 0),
              }
            : component
        );
        return rollupSubjectComponents({ ...subject, components });
      }),
    }));
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

      if (hasSubjectComponents(subject)) {
        const cleanComponents = [];
        for (const [index, component] of subject.components.entries()) {
          const name = String(component.name || "").trim();
          if (!name) {
            setFormError(`Component ${index + 1} name is required for '${subject.subject_name}'.`);
            return;
          }

          const theoryMax = toWholeNumber(component.theory_max, 0);
          const practicalMax = toWholeNumber(component.practical_max, 0);
          const theoryPass = toWholeNumber(component.theory_pass, 0);
          const practicalPass = toWholeNumber(component.practical_pass, 0);
          const maxMarks = theoryMax + practicalMax;
          const passMarks = theoryPass + practicalPass;

          if (maxMarks <= 0) {
            setFormError(`${name} max marks for '${subject.subject_name}' must be greater than 0.`);
            return;
          }
          if (theoryPass > theoryMax || practicalPass > practicalMax || passMarks > maxMarks) {
            setFormError(`Pass marks cannot exceed max marks for '${name}'.`);
            return;
          }

          cleanComponents.push({
            name,
            mark_pattern: "split",
            max_marks: maxMarks,
            pass_marks: passMarks,
            theory_max: theoryMax,
            theory_pass: theoryPass,
            practical_max: practicalMax,
            practical_pass: practicalPass,
            sort_order: index,
          });
        }

        cleanSubjects.push({
          subject_id: subjectId,
          mark_pattern: "split",
          max_marks: cleanComponents.reduce((sum, component) => sum + component.max_marks, 0),
          pass_marks: cleanComponents.reduce((sum, component) => sum + component.pass_marks, 0),
          theory_max: cleanComponents.reduce((sum, component) => sum + component.theory_max, 0),
          theory_pass: cleanComponents.reduce((sum, component) => sum + component.theory_pass, 0),
          practical_max: cleanComponents.reduce((sum, component) => sum + component.practical_max, 0),
          practical_pass: cleanComponents.reduce((sum, component) => sum + component.practical_pass, 0),
          components: cleanComponents,
        });
        continue;
      }

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

    const payload = {
      name: cleanName,
      scopes: cleanScopes,
      subjects: cleanSubjects
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
          subject_group: subject.subject_group || "compulsory",
          mark_pattern: isSplitPattern(subject) ? "split" : "single",
          max_marks: toWholeNumber(subject.max_marks, 0),
          pass_marks: toWholeNumber(subject.pass_marks, 0),
          theory_max: toWholeNumber(subject.theory_max, 0),
          theory_pass: toWholeNumber(subject.theory_pass, 0),
          practical_max: toWholeNumber(subject.practical_max, 0),
          practical_pass: toWholeNumber(subject.practical_pass, 0),
          components: (subject.components || []).map((component, index) => ({
            id: component.id,
            name: component.name,
            mark_pattern: component.mark_pattern || "split",
            max_marks: toWholeNumber(component.max_marks, 0),
            pass_marks: toWholeNumber(component.pass_marks, 0),
            theory_max: toWholeNumber(component.theory_max, 0),
            theory_pass: toWholeNumber(component.theory_pass, 0),
            practical_max: toWholeNumber(component.practical_max, 0),
            practical_pass: toWholeNumber(component.practical_pass, 0),
            sort_order: Number(component.sort_order ?? index),
          }))
        }))
      });

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

  function renderExamCard(exam) {
    return (
      <Card
        key={exam.id}
        className="gap-0 rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md"
      >
        <CardHeader className="p-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-base tracking-tight">{exam.name}</CardTitle>
              <CardDescription>Session: {exam.session_name || "-"}</CardDescription>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {exam.classScopes.map((scope) => (
                <Badge key={scope} variant="outline" className="rounded-full border-border bg-muted/40">
                  {classScopeLabels[scope] || scope}
                </Badge>
              ))}
              <Badge variant="secondary" className="rounded-full">
                #{exam.id}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 p-4 pt-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="rounded-full border-border bg-muted/40 text-muted-foreground">
              {exam.subjects.length} subject{exam.subjects.length === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline" className="rounded-full border-border bg-muted/40 text-muted-foreground">
              {exam.scopes.length} scope{exam.scopes.length === 1 ? "" : "s"}
            </Badge>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scopes</p>
            <div className="flex flex-wrap gap-2">
              {exam.scopeLabels.length ? (
                exam.scopeLabels.slice(0, 3).map((scopeLabel) => (
                  <Badge
                    key={scopeLabel}
                    variant="outline"
                    className="rounded-full border-border bg-background font-normal text-muted-foreground dark:bg-input/20"
                  >
                    {scopeLabel}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">No scope data</span>
              )}
              {exam.scopeLabels.length > 3 ? (
                <Badge variant="outline" className="rounded-full border-border bg-muted/40 text-muted-foreground">
                  +{exam.scopeLabels.length - 3} more
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-8 rounded-xl px-3" onClick={() => onEdit(exam.id)}>
              Edit
            </Button>
            <Button size="sm" variant="destructive" className="h-8 rounded-xl px-3" onClick={() => setDeletingExam(exam)}>
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    );
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

            <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-[980px]">
              <form onSubmit={onSubmit} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Update Exam" : "Create Exam"}</DialogTitle>
                  <DialogDescription>
                    Select the class scope first. Subjects are pulled from assigned subject offerings.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="space-y-4">
                    <Card className="gap-0 rounded-2xl border-border/70 bg-card shadow-sm">
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-base">Exam Details</CardTitle>
                        <CardDescription>Name and class/section scope</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 p-4 pt-2">
                        <div className="grid gap-2">
                          <Label>Exam Name *</Label>
                          <Input
                            className="rounded-xl"
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                            required
                          />
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <Label>Class Scopes *</Label>
                            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={addScopeRow}>
                              Add Scope
                            </Button>
                          </div>

                          {form.scopes.map((scope, index) => {
                            const selectedClass = classMap.get(String(scope.class_id));
                            const sections = selectedClass?.sections || [];
                            return (
                              <div
                                key={index}
                                className="grid grid-cols-12 gap-2 rounded-xl border border-border bg-muted/20 p-3 dark:bg-muted/10"
                              >
                                <select
                                  className={`${FIELD_CLASSNAME} col-span-12 sm:col-span-5`}
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
                                  className={`${FIELD_CLASSNAME} col-span-10 sm:col-span-5`}
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
                                  className="col-span-2 inline-flex items-center justify-center rounded-xl border border-red-200/70 bg-red-50 text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
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
                      </CardContent>
                    </Card>
                  </div>
                  <div className="space-y-4">
                    <Card className="gap-0 rounded-2xl border-border/70 bg-card shadow-sm">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-base">Exam Subjects</CardTitle>
                            <CardDescription>
                              Loaded from active subject offerings for the selected scope
                            </CardDescription>
                          </div>
                          <Badge variant="secondary" className="rounded-full">
                            {form.subjects.length} selected
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 p-4 pt-2">
                        <div className="grid max-h-56 grid-cols-1 gap-2 overflow-auto rounded-xl border border-border bg-background p-2 sm:grid-cols-2">
                          {availableExamSubjects.length ? (
                            availableExamSubjects.map((subject) => {
                              const checked = form.subjects.some(
                                (item) => Number(item.subject_id) === Number(subject.subject_id)
                              );
                              return (
                                <label
                                  key={subject.subject_id}
                                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                                    checked
                                      ? "border-foreground/20 bg-muted/70 text-foreground shadow-sm dark:border-border dark:bg-muted/30"
                                      : "border-border bg-background text-foreground hover:bg-muted/40 dark:hover:bg-muted/20"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleSubject(subject)}
                                    className="size-4 rounded border-border accent-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:accent-stone-300 dark:focus-visible:ring-offset-background"
                                  />
                                  <span className="min-w-0 flex-1 truncate">{subject.subject_name}</span>
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
                            <p className="col-span-full rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                              Select a class scope with assigned subject offerings before choosing exam subjects.
                            </p>
                          )}
                        </div>

                        {form.subjects.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Marks Setup
                            </p>
                            {form.subjects.map((subject) => {
                              const split = isSplitPattern(subject);
                              const componentMode = hasSubjectComponents(subject);
                              const totalMax =
                                toWholeNumber(subject.theory_max, 0) + toWholeNumber(subject.practical_max, 0);
                              const totalPass =
                                toWholeNumber(subject.theory_pass, 0) + toWholeNumber(subject.practical_pass, 0);

                              return (
                                <div
                                  key={subject.subject_id}
                                  className="space-y-3 rounded-xl border border-border bg-muted/20 p-3 dark:bg-muted/10"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-foreground">{subject.subject_name}</p>
                                      <div className="mt-1 flex flex-wrap gap-2">
                                        <Badge
                                          variant="outline"
                                          className={`rounded-full px-2 py-0 text-[11px] ${subjectGroupBadgeClass(subject.subject_group)}`}
                                        >
                                          {subjectGroupLabels[subject.subject_group] || subject.subject_group}
                                        </Badge>
                                        <Badge
                                          variant="outline"
                                          className={`rounded-full px-2 py-0 text-[11px] ${markPatternBadgeClass(subject.mark_pattern)}`}
                                        >
                                          {split ? "Theory + Practical" : "Single Total"}
                                        </Badge>
                                      </div>
                                    </div>
                                    <select
                                      className={`${FIELD_CLASSNAME} h-9 w-auto min-w-40 rounded-xl py-1.5`}
                                      value={subject.mark_pattern || "single"}
                                      onChange={(e) => setSubjectPattern(subject.subject_id, e.target.value)}
                                      disabled={componentMode}
                                    >
                                      <option value="single">Single Total</option>
                                      <option value="split">Theory + Practical</option>
                                    </select>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    {componentMode ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => clearSubjectComponents(subject.subject_id)}
                                      >
                                        Remove Branches
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => enableSubjectComponents(subject.subject_id)}
                                      >
                                        Use Botany/Zoology
                                      </Button>
                                    )}
                                    {componentMode ? (
                                      <span className="text-xs text-muted-foreground">
                                        Parent total is calculated from branch marks.
                                      </span>
                                    ) : null}
                                  </div>

                                  {componentMode ? (
                                    <div className="space-y-3">
                                      {(subject.components || []).map((component, componentIndex) => {
                                        const componentMax =
                                          toWholeNumber(component.theory_max, 0) + toWholeNumber(component.practical_max, 0);
                                        const componentPass =
                                          toWholeNumber(component.theory_pass, 0) + toWholeNumber(component.practical_pass, 0);

                                        return (
                                          <div
                                            key={`${subject.subject_id}-${componentIndex}`}
                                            className="rounded-xl border border-border bg-background p-3"
                                          >
                                            <div className="mb-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                                              <Input
                                                className="rounded-xl"
                                                value={component.name}
                                                onChange={(e) =>
                                                  updateSubjectComponentField(
                                                    subject.subject_id,
                                                    componentIndex,
                                                    "name",
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="Branch Name"
                                              />
                                              <Badge variant="outline" className="w-fit rounded-full px-2 py-1 text-[11px]">
                                                Total {componentMax} / Pass {componentPass}
                                              </Badge>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                              <Input
                                                className="rounded-xl"
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={component.theory_max}
                                                onWheel={preventNumberWheel}
                                                onChange={(e) =>
                                                  updateSubjectComponentField(
                                                    subject.subject_id,
                                                    componentIndex,
                                                    "theory_max",
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="Theory Max"
                                              />
                                              <Input
                                                className="rounded-xl"
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={component.theory_pass}
                                                onWheel={preventNumberWheel}
                                                onChange={(e) =>
                                                  updateSubjectComponentField(
                                                    subject.subject_id,
                                                    componentIndex,
                                                    "theory_pass",
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="Theory Pass"
                                              />
                                              <Input
                                                className="rounded-xl"
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={component.practical_max}
                                                onWheel={preventNumberWheel}
                                                onChange={(e) =>
                                                  updateSubjectComponentField(
                                                    subject.subject_id,
                                                    componentIndex,
                                                    "practical_max",
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="Practical Max"
                                              />
                                              <Input
                                                className="rounded-xl"
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={component.practical_pass}
                                                onWheel={preventNumberWheel}
                                                onChange={(e) =>
                                                  updateSubjectComponentField(
                                                    subject.subject_id,
                                                    componentIndex,
                                                    "practical_pass",
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="Practical Pass"
                                              />
                                            </div>
                                          </div>
                                        );
                                      })}
                                      <p className="text-xs text-muted-foreground">
                                        {subject.subject_name} Report Total Max: {subject.max_marks} | Total Pass: {subject.pass_marks}
                                      </p>
                                    </div>
                                  ) : !split ? (
                                    <div className="grid grid-cols-2 gap-2">
                                      <Input
                                        className="rounded-xl"
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={subject.max_marks}
                                        onWheel={preventNumberWheel}
                                        onChange={(e) => updateSubjectField(subject.subject_id, "max_marks", e.target.value)}
                                        placeholder="Max Marks"
                                      />
                                      <Input
                                        className="rounded-xl"
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={subject.pass_marks}
                                        onWheel={preventNumberWheel}
                                        onChange={(e) => updateSubjectField(subject.subject_id, "pass_marks", e.target.value)}
                                        placeholder="Pass Marks"
                                      />
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <div className="grid grid-cols-2 gap-2">
                                        <Input
                                          className="rounded-xl"
                                          type="number"
                                          min="0"
                                          step="1"
                                          value={subject.theory_max}
                                          onWheel={preventNumberWheel}
                                          onChange={(e) => updateSubjectField(subject.subject_id, "theory_max", e.target.value)}
                                          placeholder="Theory Max"
                                        />
                                        <Input
                                          className="rounded-xl"
                                          type="number"
                                          min="0"
                                          step="1"
                                          value={subject.theory_pass}
                                          onWheel={preventNumberWheel}
                                          onChange={(e) => updateSubjectField(subject.subject_id, "theory_pass", e.target.value)}
                                          placeholder="Theory Pass"
                                        />
                                        <Input
                                          className="rounded-xl"
                                          type="number"
                                          min="0"
                                          step="1"
                                          value={subject.practical_max}
                                          onWheel={preventNumberWheel}
                                          onChange={(e) => updateSubjectField(subject.subject_id, "practical_max", e.target.value)}
                                          placeholder="Practical Max"
                                        />
                                        <Input
                                          className="rounded-xl"
                                          type="number"
                                          min="0"
                                          step="1"
                                          value={subject.practical_pass}
                                          onWheel={preventNumberWheel}
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
                        ) : null}
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground dark:bg-muted/10">
                  Student-specific elective or optional choices are managed in Student Details. Exam setup now uses class subject offerings and student registrations automatically during marks and reports.
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[
          ["all", "All Exams"],
          ["school", "School"],
          ["hs", "Higher Secondary"],
        ].map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={scopeFilter === value ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setScopeFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {examCards.length === 0 ? (
        <Card className="rounded-2xl border border-dashed border-border/70 bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <ClipboardList className="size-6" />
            </div>
            <div className="space-y-1">
              <CardTitle>No exams configured</CardTitle>
              <CardDescription>
                Create an exam after assigning subjects to classes.
              </CardDescription>
            </div>
            <Button className="rounded-xl shadow-sm" onClick={() => setOpen(true)}>
              Add Exam
            </Button>
          </CardContent>
        </Card>
      ) : visibleExamCards.length === 0 ? (
        <Card className="rounded-2xl border border-dashed border-border/70 bg-card shadow-sm">
          <CardContent className="px-6 py-10 text-center">
            <CardTitle>No exams in this scope</CardTitle>
            <CardDescription className="mt-1">
              Switch scope filters or create an exam for this class scope.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {schoolExamCards.length ? (
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">School Exams</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {schoolExamCards.map(renderExamCard)}
              </div>
            </section>
          ) : null}

          {hsExamCards.length ? (
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Higher Secondary Exams
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {hsExamCards.map(renderExamCard)}
              </div>
            </section>
          ) : null}
        </div>
      )}

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

import { useEffect, useMemo, useState } from "react";
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

export default function Exams() {
  const [exams, setExams] = useState([]);
  const [classStructure, setClassStructure] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
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
    () => new Map(classStructure.map((c) => [String(c.id), c])),
    [classStructure]
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

  useEffect(() => {
    loadInitial();
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

  function setScope(idx, key, value) {
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.map((s, i) =>
        i === idx
          ? key === "class_id"
            ? { class_id: value, section_id: "" }
            : { ...s, [key]: value }
          : s
      )
    }));
  }

  function addScopeRow() {
    setForm((prev) => ({
      ...prev,
      scopes: [...prev.scopes, { class_id: "", section_id: "" }]
    }));
  }

  function removeScopeRow(idx) {
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.filter((_, i) => i !== idx)
    }));
  }

  function toggleSubject(subject) {
    const exists = form.subjects.find((s) => Number(s.subject_id) === Number(subject.id));
    if (exists) {
      setForm((prev) => ({
        ...prev,
        subjects: prev.subjects.filter((s) => Number(s.subject_id) !== Number(subject.id))
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      subjects: [
        ...prev.subjects,
        {
          subject_id: subject.id,
          subject_name: subject.name,
          max_marks: 100
        }
      ]
    }));
  }

  function updateSubjectField(subjectId, key, value) {
    const digitsOnly = String(value || "").replace(/[^\d]/g, "");
    const wholeNumber = digitsOnly ? Number.parseInt(digitsOnly, 10) : 0;
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) =>
        Number(s.subject_id) === Number(subjectId) ? { ...s, [key]: wholeNumber } : s
      )
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

    const cleanScopes = form.scopes
      .map((s) => ({
        class_id: Number(s.class_id),
        section_id: Number(s.section_id)
      }))
      .filter((s) => s.class_id && s.section_id);

    if (!cleanScopes.length) {
      setFormError("At least one valid class-section scope is required.");
      return;
    }

    const cleanSubjects = form.subjects
      .map((s) => ({
        subject_id: Number(s.subject_id),
        max_marks: Math.trunc(Number(s.max_marks))
      }))
      .filter((s) => s.subject_id && s.max_marks > 0);

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
    const res = await getExamById(examId);
    const exam = res?.data;
    if (!exam) return;

    setEditingId(exam.id);
    setForm({
      name: exam.name || "",
      scopes:
        (exam.scopes || []).map((s) => ({
          class_id: String(s.class_id),
          section_id: String(s.section_id)
        })) || [{ class_id: "", section_id: "" }],
      subjects: (exam.subjects || []).map((s) => ({
        subject_id: s.subject_id,
        subject_name: s.subject_name,
        max_marks: Math.trunc(Number(s.max_marks || 0))
      }))
    });
    setOpen(true);
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
        subTitle="Create exams for multiple classes/sections with subject mark allocation"
        action={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) resetForm();
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
                    Create exam scopes and assign subjects with marks for each exam.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-2">
                  <Label>Exam Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Class-Section Scopes *</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addScopeRow}>
                      Add Scope
                    </Button>
                  </div>

                  {form.scopes.map((scope, idx) => {
                    const selectedClass = classMap.get(String(scope.class_id));
                    const sections = selectedClass?.sections || [];
                    return (
                      <div key={idx} className="grid grid-cols-12 gap-2 border rounded p-2">
                        <select
                          className="border rounded p-2 col-span-5"
                          value={scope.class_id}
                          onChange={(e) => setScope(idx, "class_id", e.target.value)}
                          required
                        >
                          <option value="">Class</option>
                          {classStructure.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>

                        <select
                          className="border rounded p-2 col-span-5"
                          value={scope.section_id}
                          onChange={(e) => setScope(idx, "section_id", e.target.value)}
                          required
                        >
                          <option value="">Section</option>
                          {sections.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}{s.medium ? ` (${s.medium})` : ""}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          className="col-span-2 inline-flex items-center justify-center rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                          onClick={() => removeScopeRow(idx)}
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
                  <Label>Subjects (select and set marks) *</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto border rounded p-2">
                    {allSubjects.map((subject) => {
                      const checked = form.subjects.some(
                        (s) => Number(s.subject_id) === Number(subject.id)
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
                    {form.subjects.map((s) => (
                      <div key={s.subject_id} className="grid grid-cols-2 gap-2 border rounded p-2">
                        <div className="text-sm flex items-center">{s.subject_name}</div>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={s.max_marks}
                          onChange={(e) => updateSubjectField(s.subject_id, "max_marks", e.target.value)}
                          placeholder="Max"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {formError && (
                  <p className="text-sm text-red-600">{formError}</p>
                )}
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
        onOpenChange={(open) => {
          if (!open) setDeletingExam(null);
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
            <AlertDialogAction
              variant="destructive"
              onClick={() => onDelete(deletingExam.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

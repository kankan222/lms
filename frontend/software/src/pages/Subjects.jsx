import { useEffect, useEffectEvent, useState } from "react";
import { Book, TrashIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import TopBar from "../components/TopBar";

import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getStudentSubjectRegistrations,
  replaceStudentSubjectRegistrations,
} from "../api/subjects.api.js";

import { getClasses, getClassStructure } from "../api/academic.api.js";
import { getStudents } from "../api/students.api.js";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

const Subjects = () => {

  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classStructure, setClassStructure] = useState([]);
  const [students, setStudents] = useState([]);
  
  const [createOpen, setCreateOpen] = useState(false);
  const [studentChoiceOpen, setStudentChoiceOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [deletingSubject, setDeletingSubject] = useState(null);

  const [newSubject, setNewSubject] = useState({
    name: "",
    code: "",
  });
  const [studentChoiceClass, setStudentChoiceClass] = useState("");
  const [studentChoiceSection, setStudentChoiceSection] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [studentSubjectOfferings, setStudentSubjectOfferings] = useState([]);
  const [selectedOfferingIds, setSelectedOfferingIds] = useState([]);
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");
  const [studentChoiceError, setStudentChoiceError] = useState("");
  const [notice, setNotice] = useState(null);

  function showNotice(title, message, variant = "success") {
    setNotice({ title, message, variant });
  }

  async function loadSubjects() {
    const res = await getSubjects();
    setSubjects(res.data);
  }
  async function loadClasses() {
    const res = await getClasses();
    setClasses(res.data);
  }
  async function loadClassStructure() {
    const res = await getClassStructure();
    setClassStructure(Array.isArray(res?.data) ? res.data : []);
  }

  const loadInitialSubjects = useEffectEvent(() => {
    loadSubjects();
    loadClasses();
    loadClassStructure();
  });

  useEffect(() => {
    loadInitialSubjects();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (!studentChoiceOpen || !studentChoiceClass) return;

    let ignore = false;

    async function loadStudentsForChoice() {
      setStudentChoiceError("");
      setSelectedStudent("");
      setStudentSubjectOfferings([]);
      setSelectedOfferingIds([]);
      try {
        const res = await getStudents({
          class_id: studentChoiceClass,
          section_id: studentChoiceSection,
        });
        if (ignore) return;
        setStudents(Array.isArray(res?.data) ? res.data : []);
      } catch (err) {
        if (!ignore) {
          setStudents([]);
          setStudentChoiceError(err?.message || "Failed to load students.");
        }
      }
    }

    loadStudentsForChoice();
    return () => {
      ignore = true;
    };
  }, [studentChoiceOpen, studentChoiceClass, studentChoiceSection]);

  useEffect(() => {
    if (!studentChoiceOpen || !selectedStudent) return;

    let ignore = false;

    async function loadStudentSubjects() {
      setStudentChoiceError("");
      try {
        const res = await getStudentSubjectRegistrations(selectedStudent);
        if (ignore) return;
        const offerings = Array.isArray(res?.data?.offerings) ? res.data.offerings : [];
        setStudentSubjectOfferings(offerings);
        setSelectedOfferingIds(
          offerings
            .filter((offering) => offering.registration_id || offering.auto_required)
            .map((offering) => Number(offering.id))
            .filter((id) => Number.isFinite(id))
        );
      } catch (err) {
        if (!ignore) {
          setStudentSubjectOfferings([]);
          setSelectedOfferingIds([]);
          setStudentChoiceError(err?.message || "Failed to load student subject choices.");
        }
      }
    }

    loadStudentSubjects();
    return () => {
      ignore = true;
    };
  }, [studentChoiceOpen, selectedStudent]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError("");
    if (!String(newSubject.name || "").trim()) {
      setCreateError("Subject name is required.");
      return;
    }
    if (!String(newSubject.code || "").trim()) {
      setCreateError("Subject code is required.");
      return;
    }

    try {
      await createSubject(newSubject);
    } catch (err) {
      showNotice("Create Failed", err?.message || "Failed to create subject.", "error");
      setCreateError(err?.message || "Failed to create subject.");
      return;
    }

    await loadSubjects();

    setNewSubject({
      name: "",
      code: "",
    });

    setCreateOpen(false);
    showNotice("Subject Created", "Subject record created successfully.");
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setEditError("");
    if (!String(editingSubject?.name || "").trim()) {
      setEditError("Subject name is required.");
      return;
    }
    if (!String(editingSubject?.code || "").trim()) {
      setEditError("Subject code is required.");
      return;
    }

    try {
      await updateSubject(editingSubject.id, editingSubject);
    } catch (err) {
      showNotice("Update Failed", err?.message || "Failed to update subject.", "error");
      setEditError(err?.message || "Failed to update subject.");
      return;
    }

    await loadSubjects();

    setEditingSubject(null);
    showNotice("Subject Updated", "Subject record updated successfully.");
  }

  async function handleDelete() {
    if (!deletingSubject?.id) return;
    try {
      await deleteSubject(deletingSubject.id);
      setSubjects((prev) => prev.filter((s) => s.id !== deletingSubject.id));
      setDeletingSubject(null);
      showNotice("Subject Deleted", "Subject record deleted successfully.");
    } catch (err) {
      showNotice("Delete Failed", err?.message || "Failed to delete subject.", "error");
    }
  }
  const sectionOptions = classStructure
    .filter((row) => String(row.class_id) === String(studentChoiceClass) && row.section_id)
    .reduce((items, row) => {
      if (!items.some((item) => Number(item.id) === Number(row.section_id))) {
        items.push({
          id: row.section_id,
          name: row.section_name,
          medium: row.section_medium,
        });
      }
      return items;
    }, []);

  async function handleSaveStudentSubjects() {
    setStudentChoiceError("");
    if (!selectedStudent) {
      setStudentChoiceError("Student is required.");
      return;
    }

    try {
      await replaceStudentSubjectRegistrations(selectedStudent, {
        offering_ids: selectedOfferingIds,
      });
    } catch (err) {
      const message = err?.message || "Failed to save student subjects.";
      setStudentChoiceError(message);
      showNotice("Subject Choice Failed", message, "error");
      return;
    }

    setStudentChoiceOpen(false);
    setStudentChoiceClass("");
    setStudentChoiceSection("");
    setSelectedStudent("");
    setStudents([]);
    setStudentSubjectOfferings([]);
    setSelectedOfferingIds([]);
    showNotice("Student Subjects Saved", "Student subject choices saved successfully.");
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
        title="Subjects"
        subTitle="Find all subjects here"
        action={
          <div className="flex gap-2">
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetTrigger asChild>
              <Button>Add Subject</Button>
            </SheetTrigger>

            <SheetContent>
              <form onSubmit={handleCreate} className="px-4">

                <SheetHeader>
                  <SheetTitle>Add Subject</SheetTitle>
                </SheetHeader>

                <div className="grid gap-2 mb-4">
                  <Label>Subject Name *</Label>
                  <Input
                    required
                    value={newSubject.name}
                    onChange={(e) =>
                      setNewSubject({
                        ...newSubject,
                        name: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid gap-2 mb-4">
                  <Label>Code *</Label>
                  <Input
                    required
                    value={newSubject.code}
                    onChange={(e) =>
                      setNewSubject({
                        ...newSubject,
                        code: e.target.value,
                      })
                    }
                  />
                </div>
                {createError && <p className="text-sm text-red-600 mb-3">{createError}</p>}

                <SheetFooter>
                  <Button type="submit">Save</Button>
                </SheetFooter>

              </form>
            </SheetContent>
          </Sheet>
            <Dialog
              open={studentChoiceOpen}
              onOpenChange={(open) => {
                setStudentChoiceOpen(open);
                if (!open) {
                  setStudentChoiceError("");
                  setStudentChoiceClass("");
                  setStudentChoiceSection("");
                  setSelectedStudent("");
                  setStudents([]);
                  setStudentSubjectOfferings([]);
                  setSelectedOfferingIds([]);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline">
                  Choose Student Subjects
                </Button>
              </DialogTrigger>

              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Choose Student Subjects</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div>
                    <Label>Class *</Label>
                    <select
                      className="w-full border p-2 rounded"
                      value={studentChoiceClass}
                      onChange={(e) => {
                        setStudentChoiceClass(e.target.value);
                        setStudentChoiceSection("");
                        setSelectedStudent("");
                      }}
                    >
                      <option value="">Select Class</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label>Section</Label>
                    <select
                      className="w-full border p-2 rounded"
                      value={studentChoiceSection}
                      onChange={(e) => {
                        setStudentChoiceSection(e.target.value);
                        setSelectedStudent("");
                      }}
                      disabled={!studentChoiceClass}
                    >
                      <option value="">All Sections</option>
                      {sectionOptions.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.name}
                          {section.medium ? ` (${section.medium})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label>Student *</Label>
                    <select
                      className="w-full border p-2 rounded"
                      value={selectedStudent}
                      onChange={(e) => setSelectedStudent(e.target.value)}
                      disabled={!studentChoiceClass}
                    >
                      <option value="">Select Student</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name}
                          {student.roll_number ? ` - Roll ${student.roll_number}` : ""}
                          {student.section ? ` (${student.section})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label>Subjects</Label>
                    <div className="grid gap-2 mt-2">
                      {!selectedStudent ? (
                        <p className="text-sm text-muted-foreground">
                          Select a student to load subject choices.
                        </p>
                      ) : studentSubjectOfferings.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No subject offerings found for this student's current class.
                        </p>
                      ) : (
                        studentSubjectOfferings.map((offering) => {
                          const offeringId = Number(offering.id);
                          const checked = selectedOfferingIds.includes(offeringId);
                          const locked = Boolean(offering.auto_required);

                          return (
                            <label
                              key={offering.id}
                              className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 transition-colors ${
                                checked
                                  ? "border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-950/30"
                                  : "border-border bg-background"
                              }`}
                            >
                              <span className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={locked}
                                  onChange={() => {
                                    if (locked) return;
                                    setSelectedOfferingIds((prev) =>
                                      prev.includes(offeringId)
                                        ? prev.filter((id) => id !== offeringId)
                                        : [...prev, offeringId]
                                    );
                                  }}
                                />
                                <span>
                                  {offering.subject_name}
                                  {offering.subject_code ? ` (${offering.subject_code})` : ""}
                                </span>
                              </span>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
                                {offering.subject_group}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {studentChoiceError && <p className="text-sm text-red-600">{studentChoiceError}</p>}

                <DialogFooter>
                  <Button onClick={handleSaveStudentSubjects}>
                    Save Choices
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </div>
        }
      />

      {/* SUBJECT LIST */}

      <div className="grid grid-cols-3 gap-2">

        {subjects.map((data) => (

          <div
            key={data.id}
            className="flex bg-secondary border border-border rounded-sm px-5 py-5 gap-2.5 items-start w-full"
          >

            <div>
              <Button size="icon">
                <Book />
              </Button>
            </div>

            <div className="flex-1">
              <p className="text-xl font-bold">{data.name}</p>
              <p className="text-sm">CODE : {data.code}</p>
            </div>

            <div className="flex gap-2 items-center">

              <Button
                variant="outline"
                onClick={() => setEditingSubject(data)}
              >
                Edit
              </Button>

              <Button
                variant="destructive"
                onClick={() => setDeletingSubject(data)}
              >
                <TrashIcon />
              </Button>

            </div>

          </div>

        ))}

      </div>

      {/* EDIT DIALOG */}

      <Dialog
        open={!!editingSubject}
        onOpenChange={(open) => {
          if (!open) {
            setEditError("");
            setEditingSubject(null);
          }
        }}
      >
        <DialogContent>

          <form onSubmit={handleUpdate}>

            <DialogHeader>
              <DialogTitle>Edit Subject</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">

              <Label>Name *</Label>
              <Input
                required
                value={editingSubject?.name || ""}
                onChange={(e) =>
                  setEditingSubject({
                    ...editingSubject,
                    name: e.target.value,
                  })
                }
              />

              <Label>Code *</Label>
              <Input
                required
                value={editingSubject?.code || ""}
                onChange={(e) =>
                  setEditingSubject({
                    ...editingSubject,
                    code: e.target.value,
                  })
                }
              />

            </div>
            {editError && <p className="text-sm text-red-600">{editError}</p>}

            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>

          </form>

        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingSubject}
        onOpenChange={(open) => {
          if (!open) setDeletingSubject(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete subject?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingSubject
                ? `This will remove ${deletingSubject.name} from the subjects list.`
                : "This action cannot be undone."}
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
};

export default Subjects;

import { useEffect, useEffectEvent, useState } from "react";
import { Book, TrashIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import TopBar from "../components/TopBar";

import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  assignSubjects,
  getClassSubjects,
} from "../api/subjects.api.js";

import { getClasses } from "../api/academic.api.js";

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
  
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [deletingSubject, setDeletingSubject] = useState(null);

  const [newSubject, setNewSubject] = useState({
    name: "",
    code: "",
  });
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");
  const [assignError, setAssignError] = useState("");
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

  const loadInitialSubjects = useEffectEvent(() => {
    loadSubjects();
    loadClasses();
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
    if (!assignOpen || !selectedClass) return;

    let ignore = false;

    async function loadAssignedSubjects() {
      try {
        const res = await getClassSubjects(selectedClass);
        if (ignore) return;
        const assigned = Array.isArray(res?.data) ? res.data : [];
        setSelectedSubjects(
          assigned
            .map((item) => Number(item.id))
            .filter((id) => Number.isFinite(id))
        );
      } catch {
        if (!ignore) {
          setSelectedSubjects([]);
        }
      }
    }

    loadAssignedSubjects();
    return () => {
      ignore = true;
    };
  }, [assignOpen, selectedClass]);

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
  async function handleAssign() {
    setAssignError("");
    if (!selectedClass) {
      setAssignError("Class is required.");
      return;
    }
    if (selectedSubjects.length === 0) {
      setAssignError("Select at least one subject.");
      return;
    }

    try {
      await assignSubjects({
        classId: selectedClass,
        subjectIds: selectedSubjects,
      });
    } catch (err) {
      const message = err?.message || "Failed to assign subjects.";
      setAssignError(message);
      showNotice("Assign Failed", message, "error");
      return;
    }

    setAssignOpen(false);
    setSelectedClass("");
    setSelectedSubjects([]);
    showNotice("Subjects Assigned", "Subjects assigned to the selected class successfully.");
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
              open={assignOpen}
              onOpenChange={(open) => {
                setAssignOpen(open);
                if (!open) {
                  setAssignError("");
                  setSelectedClass("");
                  setSelectedSubjects([]);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="secondary">
                  Assign Subjects
                </Button>
              </DialogTrigger>

              <DialogContent className="max-h-[85vh] overflow-y-auto">

                <DialogHeader>
                  <DialogTitle>Assign Subjects to Class</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">

                  <div>
                    <Label>Class *</Label>

                    <select
                      className="w-full border p-2 rounded"
                      value={selectedClass}
                      onChange={(e) => {
                        setSelectedClass(e.target.value);
                        setSelectedSubjects([]);
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
                    <Label>Subjects *</Label>

                    <div className="grid gap-2 mt-2">

                      {subjects.map((s) => (
                        <label
                          key={s.id}
                          className={`flex items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                            selectedSubjects.includes(s.id)
                              ? "border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-950/30"
                              : "border-border bg-background"
                          }`}
                        >

                          <input
                            type="checkbox"
                            checked={selectedSubjects.includes(s.id)}
                            onChange={() => {

                              if (selectedSubjects.includes(s.id)) {
                                setSelectedSubjects(
                                  selectedSubjects.filter((id) => id !== s.id)
                                );
                              } else {
                                setSelectedSubjects([
                                  ...selectedSubjects,
                                  s.id,
                                ]);
                              }

                            }}
                          />

                          {s.name} ({s.code})

                        </label>
                      ))}

                    </div>
                  </div>

                </div>
                {assignError && <p className="text-sm text-red-600">{assignError}</p>}

                <DialogFooter>
                  <Button onClick={handleAssign}>
                    Assign
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

      {/* EDIT SHEET */}

      <Sheet
        open={!!editingSubject}
        onOpenChange={() => setEditingSubject(null)}
      >
        <SheetContent>

          <form onSubmit={handleUpdate}>

            <SheetHeader>
              <SheetTitle>Edit Subject</SheetTitle>
            </SheetHeader>

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

            <SheetFooter>
              <Button type="submit">Save</Button>
            </SheetFooter>

          </form>

        </SheetContent>
      </Sheet>

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

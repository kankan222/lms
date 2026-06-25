import { useEffect, useEffectEvent, useState } from "react";
import { Book, TrashIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import TopBar from "../components/TopBar";

import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
} from "../api/subjects.api.js";

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
import { Skeleton } from "@/components/ui/skeleton";

const Subjects = () => {

  const [subjects, setSubjects] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subjectsError, setSubjectsError] = useState("");
  
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [deletingSubject, setDeletingSubject] = useState(null);

  const [newSubject, setNewSubject] = useState({
    name: "",
    code: "",
  });
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");
  const [notice, setNotice] = useState(null);

  function showNotice(title, message, variant = "success") {
    setNotice({ title, message, variant });
  }

  async function loadSubjects({ showSkeleton = false } = {}) {
    if (showSkeleton) {
      setSubjectsLoading(true);
    }
    setSubjectsError("");

    try {
      const res = await getSubjects();
      setSubjects(res.data);
    } catch (err) {
      setSubjectsError(err?.message || "Failed to load subjects.");
    } finally {
      setSubjectsLoading(false);
    }
  }

  const loadInitialSubjects = useEffectEvent(() => {
    loadSubjects({ showSkeleton: true });
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
        }
      />

      {/* SUBJECT LIST */}

      {subjectsError && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Unable to load subjects</AlertTitle>
          <AlertDescription>{subjectsError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">

        {subjectsLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`subject-skeleton-${index}`}
                className="flex bg-secondary border border-border rounded-sm px-5 py-5 gap-2.5 items-start w-full"
              >
                <Skeleton className="h-10 w-10 rounded-md" />
                <div className="flex-1 space-y-3 pt-1">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
                <div className="flex gap-2 items-center">
                  <Skeleton className="h-9 w-16" />
                  <Skeleton className="h-9 w-9" />
                </div>
              </div>
            ))
          : subjects.map((data) => (

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

      {!subjectsLoading && !subjectsError && subjects.length === 0 && (
        <div className="mt-4 rounded-sm border border-dashed border-border bg-secondary/50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No subjects found.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a subject to start building the subject master list.
          </p>
        </div>
      )}

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

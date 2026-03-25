import { useEffect, useEffectEvent, useState } from "react";
import { NotebookPen, TrashIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import TopBar from "../components/TopBar";
import {
  createClass,
  getClasses,
  updateClass,
  deleteClass,
} from "../api/academic.api.js";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const Classes = () => {
  const [classes, setClasses] = useState([]);
  const [editingClass, setEditingClass] = useState(null);
  const [deletingClass, setDeletingClass] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newClass, setNewClass] = useState({
    name: "",
    class_scope: "school",
    sections: [{ name: "", medium: "" }],
  });
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");
  const [notice, setNotice] = useState(null);

  function showNotice(title, message, variant = "success") {
    setNotice({ title, message, variant });
  }

  function normalizeSections(value) {
    if (Array.isArray(value)) {
      return value
        .map((s) => ({
          name: String(s?.name || "").trim(),
          medium: String(s?.medium || "").trim(),
        }))
        .filter((s) => s.name);
    }
    return String(value || "")
      .split(",")
      .map((v) => ({ name: v.trim(), medium: "" }))
      .filter((s) => s.name);
  }

  async function loadClasses() {
    const res = await getClasses();

    const normalized = res.data.map((c) => {
      const sections = normalizeSections(c.section_details || c.sections);
      return {
        ...c,
        class_scope: c.class_scope || "school",
        sections,
        subjects: String(c.subjects || "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      };
    });

    setClasses(normalized);
  }

  const loadInitialClasses = useEffectEvent(() => {
    loadClasses();
  });

  useEffect(() => {
    loadInitialClasses();
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

    const cleanName = String(newClass.name || "").trim();
    const cleanSections = (newClass.sections || [])
      .map((s) => ({
        name: String(s?.name || "").trim(),
        medium: String(s?.medium || "").trim(),
      }))
      .filter((s) => s.name);

    if (!cleanName) {
      setCreateError("Class name is required.");
      return;
    }
    if (!newClass.class_scope) {
      setCreateError("Class scope is required.");
      return;
    }
    if (!cleanSections.length) {
      setCreateError("At least one section is required.");
      return;
    }
    if (cleanSections.some((s) => !s.medium)) {
      setCreateError("Each section must have a medium.");
      return;
    }

    try {
      await createClass({
        name: cleanName,
        class_scope: newClass.class_scope,
        sections: cleanSections,
      });
    } catch (err) {
      showNotice("Create Failed", err?.message || "Failed to create class.", "error");
      setCreateError(err?.message || "Failed to create class.");
      return;
    }

    await loadClasses();

    setNewClass({
      name: "",
      class_scope: "school",
      sections: [{ name: "", medium: "" }],
    });

    setCreateOpen(false);
    showNotice("Class Created", "Class record created successfully.");
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setEditError("");
    const cleanName = String(editingClass?.name || "").trim();
    const cleanSections = (editingClass?.sections || [])
      .map((s) => ({
        name: String(s?.name || "").trim(),
        medium: String(s?.medium || "").trim(),
      }))
      .filter((s) => s.name);

    if (!cleanName) {
      setEditError("Class name is required.");
      return;
    }
    if (!editingClass?.class_scope) {
      setEditError("Class scope is required.");
      return;
    }
    if (!cleanSections.length) {
      setEditError("At least one section is required.");
      return;
    }
    if (cleanSections.some((s) => !s.medium)) {
      setEditError("Each section must have a medium.");
      return;
    }

    try {
      await updateClass(editingClass.id, {
        name: cleanName,
        class_scope: editingClass.class_scope,
        sections: cleanSections,
      });
    } catch (err) {
      showNotice("Update Failed", err?.message || "Failed to update class.", "error");
      setEditError(err?.message || "Failed to update class.");
      return;
    }
    setEditingClass(null);
    loadClasses();
    showNotice("Class Updated", "Class record updated successfully.");
  }

  async function handleDelete() {
    if (!deletingClass?.id) return;
    try {
      await deleteClass(deletingClass.id);
      setClasses((prev) => prev.filter((c) => c.id !== deletingClass.id));
      setDeletingClass(null);
      showNotice("Class Deleted", "Class record deleted successfully.");
    } catch (err) {
      showNotice("Delete Failed", err?.message || "Failed to delete class.", "error");
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
        ButtonText="Add Class"
        title="Classes"
        subTitle="Find all classes here"
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>Add a New Class</Button>
            </DialogTrigger>

            <DialogContent>
              <form onSubmit={handleCreate} className="px-1">
                <DialogHeader>
                  <DialogTitle className="mb-5 text-center">Add Class</DialogTitle>
                </DialogHeader>

                <div className="grid mb-4 gap-2">
                  <Label>Class Name *</Label>

                  <Input
                    required
                    value={newClass.name}
                    onChange={(e) =>
                      setNewClass({
                        ...newClass,
                        name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid mb-4 gap-2">
                  <Label>Class Scope *</Label>
                  <select
                    className="border rounded p-2 w-full bg-background"
                    value={newClass.class_scope}
                    onChange={(e) =>
                      setNewClass({
                        ...newClass,
                        class_scope: e.target.value,
                      })
                    }
                  >
                    <option value="school">School</option>
                    <option value="hs">Higher Secondary</option>
                  </select>
                </div>
                <div className="grid gap-2 mb-2">
                  <Label>Sections *</Label>
                  {newClass.sections.map((sec, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2">
                      <Input
                        required={i === 0}
                        value={sec.name}
                        placeholder={`Section ${i + 1}`}
                        onChange={(e) => {
                          const updated = [...newClass.sections];
                          updated[i] = { ...updated[i], name: e.target.value };
                          setNewClass({ ...newClass, sections: updated });
                        }}
                      />
                      <select
                        className="border rounded p-2 w-full bg-background"
                        required={i === 0}
                        value={sec.medium}
                        onChange={(e) => {
                          const updated = [...newClass.sections];
                          updated[i] = { ...updated[i], medium: e.target.value };
                          setNewClass({ ...newClass, sections: updated });
                        }}
                      >
                        <option value="">Select Medium</option>
                        <option value="English">English</option>
                        <option value="Assamese">Assamese</option>
                      </select>
                    </div>
                  ))}
                </div>
                {createError && (
                  <p className="text-sm text-red-600 mb-2">{createError}</p>
                )}
                <div className="flex gap-2 items-center">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() =>
                      setNewClass({
                        ...newClass,
                        sections: [...newClass.sections, { name: "", medium: "" }],
                      })
                    }
                  >
                    Add a new Section
                  </Button>

                  <DialogFooter>
                    <Button className="flex-1" type="submit">Save</Button>
                  </DialogFooter>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-3 gap-2">
        {classes.map((data) => (
          <div
            key={data.id}
            className="flex bg-secondary border border-border rounded-sm relative px-5 py-5 gap-2.5 items-start w-full"
          >
            <div>
              <Button variant="ghost">
                <NotebookPen />
              </Button>
            </div>
            <div className="flex-1">
              <p className="text-xl font-bold">Class : {data.name}</p>
              <p className="text-sm">
                <span className="font-medium">Scope: </span>
                {data.class_scope === "hs" ? "Higher Secondary" : "School"}
              </p>
              <div className="text-sm flex-1">
                <p className="font-medium">Sections:</p>
                <ul className="mt-1 list-disc pl-5 space-y-1">
                  {data.sections.map((sec, i) => (
                    <li key={i}>
                      {sec.name}
                      {sec.medium ? ` (${sec.medium})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-sm">
                <span className="font-medium">Subjects: </span>
                {data.subjects.length === 0 && " None"}
                {data.subjects.map((sub, i) => (
                  <span key={i}>
                    {sub}
                    {i < data.subjects.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <Button variant="outline" onClick={() => setEditingClass(data)}>
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={() => setDeletingClass(data)}
              >
                <TrashIcon />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={!!editingClass}
        onOpenChange={(open) => {
          if (!open) {
            setEditError("");
            setEditingClass(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <form onSubmit={handleUpdate} className="space-y-4 px-1">
            <DialogHeader>
              <DialogTitle>Edit Class</DialogTitle>
            </DialogHeader>

            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input
                required
                value={editingClass?.name || ""}
                onChange={(e) =>
                  setEditingClass({
                    ...editingClass,
                    name: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Class Scope *</Label>
              <select
                className="border rounded p-2 w-full bg-background"
                value={editingClass?.class_scope || "school"}
                onChange={(e) =>
                  setEditingClass({
                    ...editingClass,
                    class_scope: e.target.value,
                  })
                }
              >
                <option value="school">School</option>
                <option value="hs">Higher Secondary</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label>Sections *</Label>
              {editingClass?.sections?.map((sec, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <Input
                    required={i === 0}
                    value={sec.name}
                    placeholder={`Section ${i + 1}`}
                    onChange={(e) => {
                      const updated = [...editingClass.sections];
                      updated[i] = { ...updated[i], name: e.target.value };
                      setEditingClass({
                        ...editingClass,
                        sections: updated,
                      });
                    }}
                  />
                  <select
                    className="border rounded p-2 w-full bg-background"
                    required={i === 0}
                    value={sec.medium}
                    onChange={(e) => {
                      const updated = [...editingClass.sections];
                      updated[i] = { ...updated[i], medium: e.target.value };
                      setEditingClass({
                        ...editingClass,
                        sections: updated,
                      });
                    }}
                  >
                    <option value="">Select Medium</option>
                    <option value="English">English</option>
                    <option value="Assamese">Assamese</option>
                  </select>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setEditingClass({
                  ...editingClass,
                  sections: [...editingClass.sections, { name: "", medium: "" }],
                })
              }
            >
              Add a New Section
            </Button>

            {editError && <p className="text-sm text-red-600">{editError}</p>}

            <DialogFooter showCloseButton>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingClass}
        onOpenChange={(open) => {
          if (!open) setDeletingClass(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete class?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingClass
                ? `This will remove ${deletingClass.name} from the active classes list.`
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

export default Classes;

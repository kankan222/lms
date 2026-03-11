import { useEffect, useState } from "react";
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
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const Classes = () => {
  const [classes, setClasses] = useState([]);
  const [editingClass, setEditingClass] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newClass, setNewClass] = useState({
    name: "",
    sections: [{ name: "", medium: "" }],
  });
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");
  useEffect(() => {
    loadClasses();
  }, []);

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
        sections,
        subjects: String(c.subjects || "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      };
    });

    setClasses(normalized);
  }

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
        sections: cleanSections,
      });
    } catch (err) {
      setCreateError(err?.message || "Failed to create class.");
      return;
    }

    await loadClasses(); // wait for refresh first

    setNewClass({
      name: "",
      sections: [{ name: "", medium: "" }],
    });

    setCreateOpen(false); // close sheet last
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
        sections: cleanSections,
      });
    } catch (err) {
      setEditError(err?.message || "Failed to update class.");
      return;
    }
    setEditingClass(null);
    loadClasses();
  }

  async function handleDelete(id) {
    const confirmDelete = confirm("Delete this class?");
    if (!confirmDelete) return;
    await deleteClass(id);
    setClasses((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <>
      <TopBar
        ButtonText="Add Class"
        title="Classes"
        subTitle="Find all classes here"
        action={
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetTrigger asChild>
              <Button>Add a New Class</Button>
            </SheetTrigger>

            <SheetContent>
              <form onSubmit={handleCreate} className="px-4">
                <SheetHeader>
                  <SheetTitle>Add Class</SheetTitle>
                </SheetHeader>

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

                  <SheetFooter>
                    <Button type="submit">Save</Button>
                  </SheetFooter>
                </div>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      <div className="grid grid-cols-3 gap-2">
        {classes.map((data) => (
          <div
            key={data.id}
            className="flex bg-secondary border border-border rounded-sm relative px-5 py-5 gap-2.5 items-start w-full"
          >
            <div>
              <Button size="">
                <NotebookPen />
              </Button>
            </div>
            <div className="flex-1">
              <p className="text-xl font-bold">Class : {data.name}</p>
              <p className="text-sm flex-1">
                Section :{" "}
                {data.sections.map((sec, i) => (
                  <span key={i}>
                    {sec.name}{sec.medium ? ` (${sec.medium})` : ""}
                    {i < data.sections.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
              {/* <p className="text-sm">{data.total_students} students</p> */}
              <p className="text-sm">
                Subjects:
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
                onClick={() => handleDelete(data.id)}
              >
                <TrashIcon />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* SINGLE GLOBAL SHEET */}
      <Sheet open={!!editingClass} onOpenChange={() => setEditingClass(null)}>
        <SheetContent>
          <form onSubmit={handleUpdate}>
            <SheetHeader>
              <SheetTitle>Edit Class</SheetTitle>
            </SheetHeader>

            <div className="grid gap-4 py-4">
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
              {editError && (
                <p className="text-sm text-red-600">{editError}</p>
              )}
            </div>

            <SheetFooter>
              <Button type="submit">Save</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default Classes;

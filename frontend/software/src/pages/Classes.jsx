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
  SheetClose,
  SheetContent,
  SheetDescription,
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
    sections: [""],
  });
  useEffect(() => {
    loadClasses();
  }, []);
  async function loadClasses() {
    const res = await getClasses();

    const normalized = res.data.map((c) => ({
      ...c,
      sections: c.sections ? c.sections.split(",") : [],
      subjects: c.subjects ? c.subjects.split(",") : [],
    }));

    setClasses(normalized);
  }

  async function handleCreate(e) {
    e.preventDefault();

    await createClass({
      name: newClass.name,
      sections: newClass.sections.filter((s) => s.trim() !== ""),
    });

    await loadClasses(); // wait for refresh first

    setNewClass({
      name: "",
      sections: [""],
    });

    setCreateOpen(false); // close sheet last
  }
  async function handleUpdate(e) {
    e.preventDefault();

    await updateClass(editingClass.id, {
      name: editingClass.name,
      sections: editingClass.sections || [],
    });
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
                  <Label>Class Name</Label>

                  <Input
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
                  <Label>Section Name</Label>
                  {newClass.sections.map((sec, i) => (
                    <Input
                      key={i}
                      value={sec}
                      onChange={(e) => {
                        const updated = [...newClass.sections];
                        updated[i] = e.target.value;

                        setNewClass({
                          ...newClass,
                          sections: updated,
                        });
                      }}
                    />
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() =>
                      setNewClass({
                        ...newClass,
                        sections: [...newClass.sections, ""],
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
              <p className="text-xl font-bold">{data.name}</p>
              <p className="text-base flex-1">
                Section :{" "}
                {data.sections.map((sec, i) => (
                  <span key={i}>
                    {sec}
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
              <Label>Name</Label>

              <Input
                value={editingClass?.name || ""}
                onChange={(e) =>
                  setEditingClass({
                    ...editingClass,
                    name: e.target.value,
                  })
                }
              />

              <Label>Sections</Label>

              {editingClass?.sections?.map((sec, i) => (
                <Input
                  key={i}
                  value={sec}
                  onChange={(e) => {
                    const updated = [...editingClass.sections];
                    updated[i] = e.target.value;

                    setEditingClass({
                      ...editingClass,
                      sections: updated,
                    });
                  }}
                />
              ))}

              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setEditingClass({
                    ...editingClass,
                    sections: [...editingClass.sections, ""],
                  })
                }
              >
                Add a New Section
              </Button>
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

import { useEffect, useState } from "react";
import { Book, TrashIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import TopBar from "../components/TopBar";

import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  assignSubjects
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

const Subjects = () => {

  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);

  const [newSubject, setNewSubject] = useState({
    name: "",
    code: "",
  });
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState([]);

  useEffect(() => {
    loadSubjects();
    loadClasses();
  }, []);

  async function loadSubjects() {
    const res = await getSubjects();
    console.log(res.data)
    setSubjects(res.data);
  }
  async function loadClasses() {
    const res = await getClasses();
    setClasses(res.data);
  }
  async function handleCreate(e) {
    e.preventDefault();

    await createSubject(newSubject);

    await loadSubjects();

    setNewSubject({
      name: "",
      code: "",
    });

    setCreateOpen(false);
  }

  async function handleUpdate(e) {
    e.preventDefault();

    await updateSubject(editingSubject.id, editingSubject);

    await loadSubjects();

    setEditingSubject(null);
  }

  async function handleDelete(id) {
    const confirmDelete = confirm("Delete this subject?");
    if (!confirmDelete) return;

    await deleteSubject(id);

    setSubjects((prev) => prev.filter((s) => s.id !== id));
  }
async function handleAssign() {
    if (!selectedClass || selectedSubjects.length === 0) return;

    await assignSubjects({
      classId: selectedClass,
      subjectIds: selectedSubjects,
    });

    setAssignOpen(false);
    setSelectedClass("");
    setSelectedSubjects([]);
  }
  return (
    <>
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
                  <Label>Subject Name</Label>
                  <Input
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
                  <Label>Code</Label>
                  <Input
                    value={newSubject.code}
                    onChange={(e) =>
                      setNewSubject({
                        ...newSubject,
                        code: e.target.value,
                      })
                    }
                  />
                </div>

                <SheetFooter>
                  <Button type="submit">Save</Button>
                </SheetFooter>

              </form>
            </SheetContent>
          </Sheet>
                      <Sheet open={assignOpen} onOpenChange={setAssignOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary">
                  Assign Subjects
                </Button>
              </SheetTrigger>

              <SheetContent>

                <SheetHeader>
                  <SheetTitle>Assign Subjects to Class</SheetTitle>
                </SheetHeader>

                <div className="grid gap-4 py-4">

                  <div>
                    <Label>Class</Label>

                    <select
                      className="w-full border p-2 rounded"
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
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
                    <Label>Subjects</Label>

                    <div className="grid gap-2 mt-2">

                      {subjects.map((s) => (
                        <label key={s.id} className="flex items-center gap-2">

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

                <SheetFooter>
                  <Button onClick={handleAssign}>
                    Assign
                  </Button>
                </SheetFooter>

              </SheetContent>
            </Sheet>

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
                onClick={() => handleDelete(data.id)}
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

              <Label>Name</Label>
              <Input
                value={editingSubject?.name || ""}
                onChange={(e) =>
                  setEditingSubject({
                    ...editingSubject,
                    name: e.target.value,
                  })
                }
              />

              <Label>Code</Label>
              <Input
                value={editingSubject?.code || ""}
                onChange={(e) =>
                  setEditingSubject({
                    ...editingSubject,
                    code: e.target.value,
                  })
                }
              />

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

export default Subjects;
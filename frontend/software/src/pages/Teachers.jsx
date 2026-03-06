import { useEffect, useState } from "react";
import DataTable from "../components/DataTable";
import TopBar from "../components/TopBar";

import {
  getTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher
} from "../api/teachers.api";

import { Button } from "../components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";

const columns = [
  { header: "Employee ID", accessor: "employee_id" },
  { header: "Name", accessor: "name" },
  { header: "Phone", accessor: "phone" },
  { header: "Email", accessor: "email" }
];

const Teachers = () => {

  const [teachers, setTeachers] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);

  const [newTeacher, setNewTeacher] = useState({
    employee_id: "",
    name: "",
    phone: "",
    email: "",
    photo_url: ""
  });

  useEffect(() => {
    loadTeachers();
  }, []);

  async function loadTeachers() {
    const res = await getTeachers();
    setTeachers(res.data);
  }

  async function handleCreate(e) {
    e.preventDefault();

    await createTeacher(newTeacher);

    await loadTeachers();

    setNewTeacher({
      employee_id: "",
      name: "",
      phone: "",
      email: "",
      photo_url: ""
    });

    setCreateOpen(false);
  }

  async function handleUpdate(e) {
    e.preventDefault();

    await updateTeacher(editingTeacher.id, editingTeacher);

    await loadTeachers();

    setEditingTeacher(null);
  }

  async function handleDelete(row) {
    if (!confirm("Delete this teacher?")) return;

    await deleteTeacher(row.id);

    setTeachers(prev => prev.filter(t => t.id !== row.id));
  }

  function handleEdit(row) {
    setEditingTeacher(row);
  }

  return (
    <>
      <TopBar
        title="Teachers"
        subTitle="Manage all teachers"
        action={
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetTrigger asChild>
              <Button>Add Teacher</Button>
            </SheetTrigger>

            <SheetContent>
              <form onSubmit={handleCreate} className="px-4">

                <SheetHeader>
                  <SheetTitle>Add Teacher</SheetTitle>
                </SheetHeader>

                <div className="grid gap-3 py-4">

                  <Label>Employee ID</Label>
                  <Input
                    value={newTeacher.employee_id}
                    onChange={(e) =>
                      setNewTeacher({
                        ...newTeacher,
                        employee_id: e.target.value
                      })
                    }
                  />

                  <Label>Name</Label>
                  <Input
                    value={newTeacher.name}
                    onChange={(e) =>
                      setNewTeacher({
                        ...newTeacher,
                        name: e.target.value
                      })
                    }
                  />

                  <Label>Phone</Label>
                  <Input
                    value={newTeacher.phone}
                    onChange={(e) =>
                      setNewTeacher({
                        ...newTeacher,
                        phone: e.target.value
                      })
                    }
                  />

                  <Label>Email</Label>
                  <Input
                    value={newTeacher.email}
                    onChange={(e) =>
                      setNewTeacher({
                        ...newTeacher,
                        email: e.target.value
                      })
                    }
                  />

                  <Label>Photo URL</Label>
                  <Input
                    value={newTeacher.photo_url}
                    onChange={(e) =>
                      setNewTeacher({
                        ...newTeacher,
                        photo_url: e.target.value
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
        }
      />

      <DataTable
        columns={columns}
        data={teachers}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* EDIT FORM */}

      <Sheet
        open={!!editingTeacher}
        onOpenChange={() => setEditingTeacher(null)}
      >
        <SheetContent>

          <form onSubmit={handleUpdate}>

            <SheetHeader>
              <SheetTitle>Edit Teacher</SheetTitle>
            </SheetHeader>

            <div className="grid gap-3 py-4">

              <Label>Employee ID</Label>
              <Input
                value={editingTeacher?.employee_id || ""}
                onChange={(e) =>
                  setEditingTeacher({
                    ...editingTeacher,
                    employee_id: e.target.value
                  })
                }
              />

              <Label>Name</Label>
              <Input
                value={editingTeacher?.name || ""}
                onChange={(e) =>
                  setEditingTeacher({
                    ...editingTeacher,
                    name: e.target.value
                  })
                }
              />

              <Label>Phone</Label>
              <Input
                value={editingTeacher?.phone || ""}
                onChange={(e) =>
                  setEditingTeacher({
                    ...editingTeacher,
                    phone: e.target.value
                  })
                }
              />

              <Label>Email</Label>
              <Input
                value={editingTeacher?.email || ""}
                onChange={(e) =>
                  setEditingTeacher({
                    ...editingTeacher,
                    email: e.target.value
                  })
                }
              />

            </div>

            <SheetFooter>
              <Button type="submit">Update</Button>
            </SheetFooter>

          </form>

        </SheetContent>
      </Sheet>
    </>
  );
};

export default Teachers;
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../../components/DataTable";
import TopBar from "../../components/TopBar";

import {
  getTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
} from "../../api/teachers.api";

import { Button } from "../../components/ui/button";
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

const columns = [
  { header: "Employee ID", accessor: "employee_id" },
  { header: "Name", accessor: "name" },
  { header: "Scope", accessor: "scope" },
  { header: "Phone", accessor: "phone" },
  { header: "Email", accessor: "email" },
];

const Teachers = () => {
  const [teachers, setTeachers] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [errors, setErrors] = useState({});
  const [editError, setEditError] = useState("");

  const [newTeacher, setNewTeacher] = useState({
    employee_id: "",
    name: "",
    class_scope: "school",
    phone: "",
    email: "",
    photo: null,
    password: "",
  });

  const navigate = useNavigate();
  function handleRowClick(row) {
    navigate(`/teachers/${row.id}`);
  }
  useEffect(() => {
    loadTeachers();
  }, []);

  async function loadTeachers() {
    const res = await getTeachers();
    const rows = Array.isArray(res?.data) ? res.data : [];
    setTeachers(
      rows.map((row) => ({
        ...row,
        class_scope: row.class_scope || "school",
        scope: row.class_scope === "hs" ? "Higher Secondary" : "School",
      })),
    );
  }

  function validateTeacher(data) {
    const errors = {};

    if (!data.employee_id) {
      errors.employee_id = "Employee ID required";
    }

    if (!data.name || /^\d+$/.test(data.name)) {
      errors.name = "Name cannot be numeric";
    }

    if (!/^\d{10}$/.test(data.phone)) {
      errors.phone = "Phone must be 10 digits";
    }

    if (!/^\S+@\S+\.\S+$/.test(data.email)) {
      errors.email = "Invalid email";
    }
    if (!["school", "hs"].includes(String(data.class_scope || ""))) {
      errors.class_scope = "Class scope required";
    }

    if (!data.password || data.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    return errors;
  }
  async function handleCreate(e) {
    e.preventDefault();
    const validation = validateTeacher(newTeacher);

    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }
    setErrors({});
    const formData = new FormData();
    formData.append("employee_id", newTeacher.employee_id);
    formData.append("name", newTeacher.name);
    formData.append("phone", newTeacher.phone);
    formData.append("email", newTeacher.email);
    formData.append("class_scope", newTeacher.class_scope || "school");
    formData.append("password", newTeacher.password);

    if (newTeacher.photo) {
      formData.append("photo", newTeacher.photo);
    }

    for (const [k, v] of formData.entries()) {
      console.log(k, v);
    }
    try {
      await createTeacher(formData);
    } catch (err) {
      setErrors({ form: err?.message || "Failed to create teacher." });
      return;
    }

    await loadTeachers();
    setNewTeacher({
      employee_id: "",
      name: "",
      class_scope: "school",
      phone: "",
      email: "",
      photo: null,
      password: "",
    });

    setCreateOpen(false);
  }

  function validateEditTeacher(data) {
    const next = {};

    if (!data.employee_id) next.employee_id = "Employee ID required";
    if (!data.name || /^\d+$/.test(data.name)) next.name = "Name cannot be numeric";
    if (!/^\d{10}$/.test(data.phone || "")) next.phone = "Phone must be 10 digits";
    if (!/^\S+@\S+\.\S+$/.test(data.email || "")) next.email = "Invalid email";
    if (!["school", "hs"].includes(String(data.class_scope || ""))) next.class_scope = "Class scope required";

    return next;
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setEditError("");

    const validation = validateEditTeacher(editingTeacher || {});
    if (Object.keys(validation).length > 0) {
      setEditError(Object.values(validation)[0]);
      return;
    }

    try {
      await updateTeacher(editingTeacher.id, {
        employee_id: editingTeacher.employee_id,
        name: editingTeacher.name,
        phone: editingTeacher.phone,
        email: editingTeacher.email,
        class_scope: editingTeacher.class_scope || "school",
      });
    } catch (err) {
      setEditError(err?.message || "Failed to update teacher.");
      return;
    }

   await loadTeachers();
    setEditingTeacher(null);
  }

  async function handleDelete(row) {
    if (!confirm("Delete this teacher?")) return;

    await deleteTeacher(row.id);

    setTeachers((prev) => prev.filter((t) => t.id !== row.id));
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
          <Sheet open={createOpen} onOpenChange={setCreateOpen} >
            <SheetTrigger asChild>
              <Button>Add Teacher</Button>
            </SheetTrigger>

            <SheetContent className="overflow-y-scroll">
              <form onSubmit={handleCreate} className="px-4">
                <SheetHeader>
                  <SheetTitle>Add Teacher</SheetTitle>
                </SheetHeader>

                <div className="grid gap-3 py-4">
                  <Label>Employee ID *</Label>
                  <Input
                    value={newTeacher.employee_id}
                    onChange={(e) =>
                      setNewTeacher((prev) => ({
                        ...prev,
                        employee_id: e.target.value,
                      }))
                    }
                  />
                  {errors.employee_id && (
                    <p className="text-red-500 text-xs">{errors.employee_id}</p>
                  )}
                  <Label>Name *</Label>
                  <Input
                    value={newTeacher.name}
                    onChange={(e) =>
                      setNewTeacher((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                  {errors.name && (
                    <p className="text-red-500 text-xs">{errors.name}</p>
                  )}
                  <Label>Phone *</Label>
                  <Input
                    value={newTeacher.phone}
                    onChange={(e) =>
                      setNewTeacher((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                  />
                  {errors.phone && (
                    <p className="text-red-500 text-xs">{errors.phone}</p>
                  )}
                  <Label>Class Scope *</Label>
                  <select
                    className="border rounded p-2 bg-background"
                    value={newTeacher.class_scope}
                    onChange={(e) =>
                      setNewTeacher((prev) => ({
                        ...prev,
                        class_scope: e.target.value,
                      }))
                    }
                  >
                    <option value="school">School</option>
                    <option value="hs">Higher Secondary</option>
                  </select>
                  {errors.class_scope && (
                    <p className="text-red-500 text-xs">{errors.class_scope}</p>
                  )}
                  <Label>Email *</Label>
                  <Input
                    value={newTeacher.email}
                    onChange={(e) =>
                      setNewTeacher((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs">{errors.email}</p>
                  )}
                  <Label>Photo URL</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setNewTeacher((prev) => ({
                        ...prev,
                        photo: e.target.files[0],
                      }))
                    }
                  />
                  <Label>Password *</Label>
                  <Input
                    type="password"
                    value={newTeacher.password}
                    onChange={(e) =>
                      setNewTeacher((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                  />
                  {errors.password && (
                    <p className="text-red-500 text-xs">{errors.password}</p>
                  )}
                  {errors.form && (
                    <p className="text-red-500 text-xs">{errors.form}</p>
                  )}
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
        onRowClick={handleRowClick}
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
              <Label>Employee ID *</Label>
              <Input
                value={editingTeacher?.employee_id || ""}
                onChange={(e) =>
                  setEditingTeacher((prev) => ({
                    ...prev,
                    employee_id: e.target.value,
                  }))
                }
              />

              <Label>Name *</Label>
              <Input
                value={editingTeacher?.name || ""}
                onChange={(e) =>
                  setEditingTeacher({
                    ...editingTeacher,
                    name: e.target.value,
                  })
                }
              />

              <Label>Phone *</Label>
              <Input
                value={editingTeacher?.phone || ""}
                onChange={(e) =>
                  setEditingTeacher((prev) => ({
                    ...prev,
                    phone: e.target.value,
                  }))
                }
              />

              <Label>Class Scope *</Label>
              <select
                className="border rounded p-2 bg-background"
                value={editingTeacher?.class_scope || "school"}
                onChange={(e) =>
                  setEditingTeacher((prev) => ({
                    ...prev,
                    class_scope: e.target.value,
                  }))
                }
              >
                <option value="school">School</option>
                <option value="hs">Higher Secondary</option>
              </select>

              <Label>Email *</Label>
              <Input
                value={editingTeacher?.email || ""}
                onChange={(e) =>
                  setEditingTeacher((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
              />
            </div>
            {editError && <p className="text-sm text-red-600">{editError}</p>}

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

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../../components/DataTable";
import TopBar from "../../components/TopBar";
import { usePermissions } from "../../hooks/usePermissions";

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

const columns = [
  { header: "Employee ID", accessor: "employee_id" },
  { header: "Name", accessor: "name" },
  { header: "Scope", accessor: "scope" },
  { header: "Phone", accessor: "phone" },
  { header: "Email", accessor: "email" },
];

const Teachers = () => {
  const { can } = usePermissions();
  const canManageTeachers = can("teacher.update");
  const [teachers, setTeachers] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [deletingTeacher, setDeletingTeacher] = useState(null);
  const [errors, setErrors] = useState({});
  const [editError, setEditError] = useState("");
  const [notice, setNotice] = useState(null);

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
      showNotice("Create Failed", err?.message || "Failed to create teacher.", "error");
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
    showNotice("Teacher Created", "Teacher record created successfully.");
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
      showNotice("Update Failed", err?.message || "Failed to update teacher.", "error");
      setEditError(err?.message || "Failed to update teacher.");
      return;
    }

   await loadTeachers();
    setEditingTeacher(null);
    showNotice("Teacher Updated", "Teacher record updated successfully.");
  }

  async function handleDelete() {
    if (!deletingTeacher?.id) return;
    try {
      await deleteTeacher(deletingTeacher.id);
      setTeachers((prev) => prev.filter((t) => t.id !== deletingTeacher.id));
      setDeletingTeacher(null);
      showNotice("Teacher Deleted", "Teacher record deleted successfully.");
    } catch (err) {
      showNotice("Delete Failed", err?.message || "Failed to delete teacher.", "error");
    }
  }

  function handleEdit(row) {
    setEditingTeacher(row);
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
        title={canManageTeachers ? "Teachers" : "My Profile"}
        subTitle={canManageTeachers ? "Manage all teachers" : "View your teacher profile"}
        action={canManageTeachers ? (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>Add Teacher</Button>
            </DialogTrigger>

            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <form onSubmit={handleCreate} className="px-1">
                <DialogHeader>
                  <DialogTitle className="mb-5 text-center">Add Teacher</DialogTitle>
                </DialogHeader>

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

                <DialogFooter>
                  <Button type="submit">Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      />

      {canManageTeachers ? (
        <DataTable
          columns={columns}
          data={teachers}
          onEdit={handleEdit}
          onDelete={setDeletingTeacher}
          onRowClick={handleRowClick}
        />
      ) : (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {teachers[0] ? (
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">{teachers[0].name}</h2>
                <div className="grid gap-1 text-sm text-muted-foreground">
                  <p>Employee ID: {teachers[0].employee_id || "-"}</p>
                  <p>Phone: {teachers[0].phone || "-"}</p>
                  <p>Email: {teachers[0].email || "-"}</p>
                  <p>Scope: {teachers[0].class_scope === "hs" ? "Higher Secondary" : "School"}</p>
                </div>
              </div>
              <div>
                <Button onClick={() => handleRowClick(teachers[0])}>Open Full Profile</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Teacher profile not found.</p>
          )}
        </div>
      )}

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

      <AlertDialog
        open={!!deletingTeacher}
        onOpenChange={(open) => {
          if (!open) setDeletingTeacher(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete teacher?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingTeacher
                ? `This will remove ${deletingTeacher.name} from the teachers list.`
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

export default Teachers;

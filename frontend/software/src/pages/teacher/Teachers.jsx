import { useEffect, useEffectEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import DataTable from "../../components/DataTable";
import TopBar from "../../components/TopBar";
import { usePermissions } from "../../hooks/usePermissions";
import { resolveServerImageUrl } from "../../lib/serverImage";

import {
  getTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  getAttendanceDevices,
  getAttendanceDeviceUsers,
  upsertAttendanceDeviceUser,
} from "../../api/teachers.api";
import { getScopes } from "../../api/academic.api";

import { Button } from "../../components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

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

const DEFAULT_SCOPE_OPTIONS = [
  { code: "school", name: "School" },
  { code: "hs", name: "Higher Secondary" },
];

function normalizeMachineUserId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/^\d+$/.test(raw)) return raw;
  const normalized = raw.replace(/^0+(?=\d)/, "");
  return normalized || "0";
}

function resolveScopeCode(scopeCode, scopeName = "") {
  const code = String(scopeCode || "").trim().toLowerCase();
  if (code === "hs" || code === "school") return code;
  if (code.includes("higher secondary")) return "hs";
  if (code.includes("school")) return "school";

  const name = String(scopeName || "").trim().toLowerCase();
  if (name.includes("higher secondary")) return "hs";
  if (name.includes("school")) return "school";

  return "school";
}

function formatScopeLabel(scopeCode) {
  return resolveScopeCode(scopeCode) === "hs" ? "Higher Secondary" : "School";
}

const Teachers = () => {
  const { can } = usePermissions();
  const canManageTeachers = can("teacher.update");
  const canManageDeviceMappings = can("teacher.assign");
  const [teachers, setTeachers] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [deletingTeacher, setDeletingTeacher] = useState(null);
  const [errors, setErrors] = useState({});
  const [editError, setEditError] = useState("");
  const [notice, setNotice] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [attendanceDevices, setAttendanceDevices] = useState([]);
  const [scopeOptions, setScopeOptions] = useState(DEFAULT_SCOPE_OPTIONS);
  const [scopeFilter, setScopeFilter] = useState("all");

  const [newTeacher, setNewTeacher] = useState({
    employee_id: "",
    name: "",
    class_scope: "school",
    phone: "",
    email: "",
    device_id: "",
    device_user_id: "",
    photo: null,
    password: "",
  });

  const navigate = useNavigate();
  const allowedScopeCodes = scopeOptions.map((item) => item.code);
  const filteredTeachers = teachers.filter((row) =>
    scopeFilter === "all" ? true : resolveScopeCode(row.class_scope, row.scope_name) === scopeFilter,
  );
  const activeFilterCount = scopeFilter === "all" ? 0 : 1;

  function handleRowClick(row) {
    navigate(`/teachers/${row.id}`);
  }
  function showNotice(title, message, variant = "success") {
    setNotice({ title, message, variant });
  }

  async function loadTeachers() {
    const res = await getTeachers();
    const rows = Array.isArray(res?.data) ? res.data : [];
    setTeachers(
      rows.map((row) => ({
        ...row,
        class_scope: resolveScopeCode(row.class_scope, row.scope_name || row.scope),
        scope: formatScopeLabel(resolveScopeCode(row.class_scope, row.scope_name || row.scope)),
      })),
    );
  }

  async function loadScopeOptions() {
    try {
      const res = await getScopes();
      const rows = Array.isArray(res?.data) ? res.data : [];
      const mapped = rows
        .map((row) => {
          const code = resolveScopeCode(row.code, row.name);
          const name = String(row.name || "").trim() || formatScopeLabel(code);
          return { code, name };
        })
        .filter((row) => row.code === "school" || row.code === "hs");

      const deduped = Array.from(new Map(mapped.map((row) => [row.code, row])).values());
      setScopeOptions(deduped.length ? deduped : DEFAULT_SCOPE_OPTIONS);
    } catch {
      setScopeOptions(DEFAULT_SCOPE_OPTIONS);
    }
  }

  async function loadAttendanceDevices() {
    try {
      const res = await getAttendanceDevices();
      setAttendanceDevices(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setAttendanceDevices([]);
    }
  }

  const loadInitialTeachers = useEffectEvent(() => {
    loadScopeOptions();
    loadTeachers();
    if (canManageDeviceMappings) {
      loadAttendanceDevices();
    }
  });

  useEffect(() => {
    loadInitialTeachers();
  }, []);

  useEffect(() => {
    if (canManageDeviceMappings) {
      loadAttendanceDevices();
    }
  }, [canManageDeviceMappings]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  function validateTeacher(data) {
    const errors = {};
    const phone = String(data.phone || "").trim();
    const email = String(data.email || "").trim();

    if (!data.name || /^\d+$/.test(data.name)) {
      errors.name = "Name cannot be numeric";
    }

    if (!phone && !email) {
      errors.contact = "Provide either phone or email";
    }

    if (phone && !/^\d{10}$/.test(phone)) {
      errors.phone = "Phone must be 10 digits";
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      errors.email = "Invalid email";
    }
    if (!allowedScopeCodes.includes(String(data.class_scope || "").trim().toLowerCase())) {
      errors.class_scope = "Class scope required";
    }

    if (!data.password || data.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    const deviceId = String(data.device_id || "").trim();
    const deviceUserId = normalizeMachineUserId(data.device_user_id);
    if (canManageDeviceMappings && ((deviceId && !deviceUserId) || (!deviceId && deviceUserId))) {
      errors.device_mapping = "Select both device and machine user ID for mapping";
    }
    if (canManageDeviceMappings && deviceUserId && !/^\d+$/.test(deviceUserId)) {
      errors.device_user_id = "Machine user ID must be numeric";
    }

    return errors;
  }

  async function resolveCreatedTeacherId(createRes, sourceTeacher = {}) {
    const immediateId = Number(
      createRes?.data?.teacherId ||
      createRes?.teacherId ||
      createRes?.data?.id ||
      0
    );
    if (immediateId > 0) return immediateId;

    const fallbackRes = await getTeachers();
    const rows = Array.isArray(fallbackRes?.data) ? fallbackRes.data : [];
    const employeeId = String(sourceTeacher.employee_id || "").trim();
    const name = String(sourceTeacher.name || "").trim().toLowerCase();
    const phone = String(sourceTeacher.phone || "").trim();
    const email = String(sourceTeacher.email || "").trim().toLowerCase();

    const byEmployee =
      employeeId
        ? rows.find((row) => String(row.employee_id || "").trim() === employeeId)
        : null;
    if (byEmployee?.id) return Number(byEmployee.id);

    const byContact = rows.find((row) => {
      const rowName = String(row.name || "").trim().toLowerCase();
      const rowPhone = String(row.phone || "").trim();
      const rowEmail = String(row.email || "").trim().toLowerCase();
      return (
        rowName === name &&
        ((phone && rowPhone === phone) || (email && rowEmail === email))
      );
    });

    return byContact?.id ? Number(byContact.id) : 0;
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
    formData.append("employee_id", newTeacher.employee_id.trim());
    formData.append("name", newTeacher.name);
    formData.append("phone", newTeacher.phone.trim());
    formData.append("email", newTeacher.email.trim());
    formData.append("class_scope", resolveScopeCode(newTeacher.class_scope));
    formData.append("password", newTeacher.password);

    if (newTeacher.photo) {
      formData.append("photo", newTeacher.photo);
    }

    const selectedDeviceId = String(newTeacher.device_id || "").trim();
    const selectedDeviceUserId = normalizeMachineUserId(newTeacher.device_user_id);

    if (canManageDeviceMappings && selectedDeviceId && selectedDeviceUserId) {
      try {
        const existingRes = await getAttendanceDeviceUsers({ device_id: selectedDeviceId });
        const existingRows = Array.isArray(existingRes?.data) ? existingRes.data : [];
        const conflict = existingRows.find(
          (row) =>
            normalizeMachineUserId(row.device_user_id) === selectedDeviceUserId
        );
        if (conflict) {
          setErrors({
            device_user_id: `Machine User ID already mapped to ${conflict.teacher_name || "another teacher"}.`,
          });
          return;
        }
      } catch (err) {
        setErrors({
          form: err?.message || "Failed to validate machine user mapping before create.",
        });
        return;
      }
    }

    let createdTeacherId = 0;
    try {
      const createRes = await createTeacher(formData);
      createdTeacherId = await resolveCreatedTeacherId(createRes, newTeacher);
    } catch (err) {
      showNotice("Create Failed", err?.message || "Failed to create teacher.", "error");
      setErrors({ form: err?.message || "Failed to create teacher." });
      return;
    }

    if (canManageDeviceMappings && selectedDeviceId && selectedDeviceUserId) {
      try {
        if (!createdTeacherId) {
          throw new Error("Could not resolve teacher id for automatic device mapping.");
        }

        await upsertAttendanceDeviceUser({
          device_id: Number(selectedDeviceId),
          device_user_id: selectedDeviceUserId,
          teacher_id: createdTeacherId,
        });
      } catch (err) {
        await loadTeachers();
        showNotice(
          "Teacher Created, Mapping Failed",
          err?.message || "Teacher was created, but device mapping failed. Fix in Attendance > Device Mapping tab.",
          "error"
        );
        return;
      }
    }

    await loadTeachers();
    setNewTeacher({
      employee_id: "",
      name: "",
      class_scope: "school",
      phone: "",
      email: "",
      device_id: "",
      device_user_id: "",
      photo: null,
      password: "",
    });
    setShowPassword(false);

    setCreateOpen(false);
    showNotice("Teacher Created", "Teacher record created successfully.");
  }

  function validateEditTeacher(data) {
    const next = {};
    const phone = String(data.phone || "").trim();
    const email = String(data.email || "").trim();

    if (!data.name || /^\d+$/.test(data.name)) next.name = "Name cannot be numeric";
    if (!phone && !email) next.contact = "Provide either phone or email";
    if (phone && !/^\d{10}$/.test(phone)) next.phone = "Phone must be 10 digits";
    if (email && !/^\S+@\S+\.\S+$/.test(email)) next.email = "Invalid email";
    if (!allowedScopeCodes.includes(String(data.class_scope || "").trim().toLowerCase())) {
      next.class_scope = "Class scope required";
    }
    const deviceId = String(data.device_id || "").trim();
    const deviceUserId = normalizeMachineUserId(data.device_user_id);
    if (canManageDeviceMappings && ((deviceId && !deviceUserId) || (!deviceId && deviceUserId))) {
      next.device_mapping = "Select both device and machine user ID for mapping";
    }
    if (canManageDeviceMappings && deviceUserId && !/^\d+$/.test(deviceUserId)) {
      next.device_user_id = "Machine user ID must be numeric";
    }

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

    if (canManageDeviceMappings) {
      const selectedDeviceId = String(editingTeacher?.device_id || "").trim();
      const selectedDeviceUserId = normalizeMachineUserId(editingTeacher?.device_user_id);
      if (selectedDeviceId && selectedDeviceUserId) {
        try {
          const existingRes = await getAttendanceDeviceUsers({ device_id: selectedDeviceId });
          const existingRows = Array.isArray(existingRes?.data) ? existingRes.data : [];
          const conflict = existingRows.find(
            (row) =>
              normalizeMachineUserId(row.device_user_id) === selectedDeviceUserId &&
              Number(row.teacher_id) !== Number(editingTeacher.id)
          );
          if (conflict) {
            setEditError(
              `Machine User ID already mapped to ${conflict.teacher_name || "another teacher"}.`
            );
            return;
          }
        } catch (err) {
          setEditError(err?.message || "Failed to validate machine user mapping before update.");
          return;
        }
      }
    }

    try {
      const formData = new FormData();
      formData.append("employee_id", String(editingTeacher.employee_id || "").trim());
      formData.append("name", String(editingTeacher.name || "").trim());
      formData.append("phone", String(editingTeacher.phone || "").trim());
      formData.append("email", String(editingTeacher.email || "").trim());
      formData.append("class_scope", resolveScopeCode(editingTeacher.class_scope));
      if (editingTeacher.photo) {
        formData.append("photo", editingTeacher.photo);
      }

      await updateTeacher(editingTeacher.id, formData);

      if (canManageDeviceMappings) {
        const selectedDeviceId = String(editingTeacher?.device_id || "").trim();
        const selectedDeviceUserId = normalizeMachineUserId(editingTeacher?.device_user_id);
        if (selectedDeviceId && selectedDeviceUserId) {
          await upsertAttendanceDeviceUser({
            device_id: Number(selectedDeviceId),
            device_user_id: selectedDeviceUserId,
            teacher_id: Number(editingTeacher.id),
          });
        }
      }
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

  async function handleEdit(row) {
    const nextTeacher = {
      ...row,
      class_scope: resolveScopeCode(row.class_scope, row.scope_name || row.scope),
      device_id: "",
      device_user_id: "",
      photo: null,
    };

    if (canManageDeviceMappings) {
      try {
        const res = await getAttendanceDeviceUsers();
        const mappings = Array.isArray(res?.data) ? res.data : [];
        const mapping = mappings.find((item) => Number(item.teacher_id) === Number(row.id));
        if (mapping) {
          nextTeacher.device_id = String(mapping.device_id || "");
          nextTeacher.device_user_id = String(mapping.device_user_id || "");
        }
      } catch {
        // Keep edit usable even if mapping list fails.
      }
    }

    setEditingTeacher(nextTeacher);
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
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  {activeFilterCount ? `Filters (${activeFilterCount})` : "Filters"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-4">
                <PopoverHeader>
                  <PopoverTitle>Filter Teachers</PopoverTitle>
                  <PopoverDescription>
                    Narrow the teachers list by scope.
                  </PopoverDescription>
                </PopoverHeader>
                <div className="grid gap-1.5">
                  <Label htmlFor="teachers-scope-filter">Scope</Label>
                  <select
                    id="teachers-scope-filter"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={scopeFilter}
                    onChange={(e) => setScopeFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    {scopeOptions.map((scope) => (
                      <option key={scope.code} value={scope.code}>
                        {scope.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => setScopeFilter("all")}
                    disabled={scopeFilter === "all"}
                  >
                    Reset Filters
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
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
                    <Label>Employee ID</Label>
                    <Input
                      value={newTeacher.employee_id}
                      onChange={(e) =>
                        setNewTeacher((prev) => ({
                          ...prev,
                          employee_id: e.target.value,
                        }))
                      }
                    />
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
                    <Label>Phone</Label>
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
                    {errors.contact && (
                      <p className="text-red-500 text-xs">{errors.contact}</p>
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
                      {scopeOptions.map((scope) => (
                        <option key={scope.code} value={scope.code}>
                          {scope.name}
                        </option>
                      ))}
                    </select>
                    {errors.class_scope && (
                      <p className="text-red-500 text-xs">{errors.class_scope}</p>
                    )}
                    <Label>Email</Label>
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

                    {canManageDeviceMappings ? (
                      <>
                        <Label>Attendance Device (Optional)</Label>
                        <select
                          className="border rounded p-2 bg-background"
                          value={newTeacher.device_id}
                          onChange={(e) =>
                            setNewTeacher((prev) => ({
                              ...prev,
                              device_id: e.target.value,
                            }))
                          }
                        >
                          <option value="">No mapping</option>
                          {attendanceDevices.map((device) => (
                            <option key={device.id} value={device.id}>
                              {device.name || device.device_name || device.device_code || `Device #${device.id}`}
                            </option>
                          ))}
                        </select>

                        <Label>Machine User ID (Optional)</Label>
                        <Input
                          value={newTeacher.device_user_id}
                          onChange={(e) =>
                            setNewTeacher((prev) => ({
                              ...prev,
                              device_user_id: e.target.value,
                            }))
                          }
                          placeholder="e.g. 00000001"
                        />
                        {errors.device_mapping && (
                          <p className="text-red-500 text-xs">{errors.device_mapping}</p>
                        )}
                        {errors.device_user_id && (
                          <p className="text-red-500 text-xs">{errors.device_user_id}</p>
                        )}
                      </>
                    ) : null}

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
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={newTeacher.password}
                        onChange={(e) =>
                          setNewTeacher((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }))
                        }
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
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
          </div>
        ) : null}
      />

      {canManageTeachers ? (
        <DataTable
          columns={columns}
          data={filteredTeachers}
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
                  <p>Scope: {formatScopeLabel(teachers[0].class_scope)}</p>
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

      <Dialog open={!!editingTeacher} onOpenChange={() => setEditingTeacher(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>Edit Teacher</DialogTitle>
            </DialogHeader>

            <div className="grid gap-3 py-4">
              <Label>Employee ID</Label>
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
                  setEditingTeacher((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
              />

              <Label>Phone</Label>
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
                {scopeOptions.map((scope) => (
                  <option key={scope.code} value={scope.code}>
                    {scope.name}
                  </option>
                ))}
              </select>

              <Label>Email</Label>
              <Input
                value={editingTeacher?.email || ""}
                onChange={(e) =>
                  setEditingTeacher((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
              />

              {canManageDeviceMappings ? (
                <>
                  <Label>Attendance Device (Optional)</Label>
                  <select
                    className="border rounded p-2 bg-background"
                    value={editingTeacher?.device_id || ""}
                    onChange={(e) =>
                      setEditingTeacher((prev) => ({
                        ...prev,
                        device_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">No mapping change</option>
                    {attendanceDevices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name || device.device_name || device.device_code || `Device #${device.id}`}
                      </option>
                    ))}
                  </select>

                  <Label>Machine User ID (Optional)</Label>
                  <Input
                    value={editingTeacher?.device_user_id || ""}
                    onChange={(e) =>
                      setEditingTeacher((prev) => ({
                        ...prev,
                        device_user_id: e.target.value,
                      }))
                    }
                    placeholder="e.g. 00000001"
                  />
                </>
              ) : null}

              <div className="grid gap-2">
                <Label>Current Photo</Label>
                {editingTeacher?.photo ? (
                  <img
                    src={URL.createObjectURL(editingTeacher.photo)}
                    alt={editingTeacher?.name || "Teacher"}
                    className="h-24 w-24 rounded-xl border object-cover"
                  />
                ) : editingTeacher?.photo_url ? (
                  <img
                    src={resolveServerImageUrl(editingTeacher.photo_url)}
                    alt={editingTeacher?.name || "Teacher"}
                    className="h-24 w-24 rounded-xl border object-cover"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No photo uploaded.</p>
                )}
              </div>

              <Label>Replace Photo</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setEditingTeacher((prev) => ({
                    ...prev,
                    photo: e.target.files?.[0] || null,
                  }))
                }
              />
            </div>
            {editError && <p className="text-sm text-red-600">{editError}</p>}

            <DialogFooter>
              <Button type="submit">Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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

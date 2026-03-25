import { useEffect, useEffectEvent, useMemo, useState } from "react";
import TopBar from "../components/TopBar";
import DataTable from "../components/DataTable";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
  DialogDescription,
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
import { getClassStructure } from "../api/academic.api";
import {
  createUser,
  getPermissions,
  getUserPermissions,
  getUserRoles,
  getUsers,
  grantUserPermissions,
  updateUserStatus,
} from "../api/users.api";

const ROLE_FILTERS = [
  { label: "All", value: "" },
  { label: "Teachers", value: "teacher" },
  { label: "Parents", value: "parent" },
  { label: "Accounts", value: "accounts" },
  { label: "Staff", value: "staff" },
];

const STATUS_FILTERS = [
  { label: "All Status", value: "" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

const DEFAULT_ROLES = [
  "teacher",
  "student",
  "parent",
  "accounts",
  "staff",
];

const columns = [
  { header: "User ID", accessor: "id" },
  { header: "Name", accessor: "name" },
  { header: "Username", accessor: "username_display" },
  { header: "Email", accessor: "email" },
  { header: "Phone", accessor: "phone" },
  { header: "Role", accessor: "roles" },
  { header: "Parent Class", accessor: "parent_classes" },
  { header: "Parent Section", accessor: "parent_sections" },
  { header: "Status", accessor: "status" },
];

function normalizePermissionNames(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function toTitleCase(value) {
  return String(value || "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function singularizeResource(resource) {
  if (!resource) return "";
  if (resource.endsWith("ies")) return `${resource.slice(0, -3)}y`;
  if (resource.endsWith("sses")) return resource;
  if (resource.endsWith("s")) return resource.slice(0, -1);
  return resource;
}

function formatPermissionLabel(permissionName) {
  const [resourcePart = "", actionPart = ""] = String(permissionName || "").split(".");
  const resource = toTitleCase(singularizeResource(resourcePart));
  const actionMap = {
    create: "Create",
    view: "View",
    update: "Update",
    delete: "Delete",
    enter: "Enter",
    approve: "Approve",
    take: "Take",
    send: "Send",
    manage: "Manage",
    reset: "Reset",
  };
  const action = actionMap[actionPart] || toTitleCase(actionPart);
  return [action, resource].filter(Boolean).join(" ");
}

function metricValueClass(value) {
  return value === "danger"
    ? "text-red-700 dark:text-red-200"
    : value === "success"
      ? "text-emerald-700 dark:text-emerald-200"
      : "text-foreground";
}

function SurfaceCard({ className = "", accent = false, children }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm ${className}`}>
      {accent ? (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      ) : null}
      {children}
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [allPermissions, setAllPermissions] = useState([]);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 1,
  });
  const [openCreate, setOpenCreate] = useState(false);
  const [grantingUser, setGrantingUser] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [createError, setCreateError] = useState("");
  const [permissionError, setPermissionError] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [notice, setNotice] = useState(null);
  const [createForm, setCreateForm] = useState({
    username: "",
    email: "",
    phone: "",
    password: "",
    status: "active",
    roles: [],
  });

  const selectedClass = useMemo(
    () => classes.find((c) => String(c.id) === String(classId)),
    [classes, classId]
  );
  const sections = selectedClass?.sections || [];
  const activeCount = users.filter((user) => user.status === "active").length;
  const inactiveCount = users.filter((user) => user.status === "inactive").length;
  const activeFilterCount = [role, status, classId, sectionId].filter(Boolean).length;

  async function loadClasses() {
    const res = await getClassStructure();
    setClasses(res?.data || []);
  }

  async function loadReferenceData() {
    try {
      const roleRes = await getUserRoles();
      const dynamicRoles = Array.isArray(roleRes?.data)
        ? roleRes.data
            .map((item) => item.name || item)
            .filter((item) => item && item !== "super_admin")
        : [];
      if (dynamicRoles.length) setRoles(dynamicRoles);
    } catch {
      setRoles(DEFAULT_ROLES);
    }

    try {
      const permissionRes = await getPermissions();
      const dynamicPermissions = normalizePermissionNames(permissionRes).map((item) =>
        item.name || item
      );
      setAllPermissions(dynamicPermissions.filter(Boolean));
    } catch {
      setAllPermissions([]);
    }
  }

  async function loadUsers() {
    const res = await getUsers({
      page,
      limit,
      role: role || undefined,
      status: status || undefined,
      class_id: role === "parent" ? classId || undefined : undefined,
      section_id: role === "parent" ? sectionId || undefined : undefined,
    });

    const rows = (res?.data || []).map((row) => ({
      ...row,
      name: row.teacher_name || row.parent_name || row.username || "-",
      username_display: row.username || "-",
      email: row.email || "-",
      phone: row.phone || "-",
      roles: row.roles || "-",
      parent_classes: row.parent_classes || "-",
      parent_sections: row.parent_sections || "-",
    }));
    setUsers(rows);
    setPagination(
      res?.pagination || {
        page: 1,
        limit,
        total: rows.length,
        totalPages: 1,
      }
    );
  }

  function resetCreateForm() {
    setCreateError("");
    setCreateForm({
      username: "",
      email: "",
      phone: "",
      password: "",
      status: "active",
      roles: [],
    });
  }

  function toggleRoleSelection(roleName) {
    setCreateForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(roleName)
        ? prev.roles.filter((item) => item !== roleName)
        : [...prev.roles, roleName],
    }));
  }

  function togglePermissionSelection(permissionName) {
    setSelectedPermissions((prev) =>
      prev.includes(permissionName)
        ? prev.filter((item) => item !== permissionName)
        : [...prev, permissionName]
    );
  }

  function showNotice(title, message, variant = "success") {
    setNotice({ title, message, variant });
  }

  async function loadPermissionDialog(userId) {
    setPermissionError("");
    try {
      const [permissionRes, userPermissionRes] = await Promise.all([
        allPermissions.length ? Promise.resolve({ data: allPermissions }) : getPermissions(),
        getUserPermissions(userId),
      ]);

      const permissionNames = normalizePermissionNames(permissionRes).map((item) => item.name || item);
      const grantedPermissions = normalizePermissionNames(userPermissionRes).map(
        (item) => item.name || item
      );

      if (!allPermissions.length) setAllPermissions(permissionNames.filter(Boolean));
      setSelectedPermissions(grantedPermissions.filter(Boolean));
    } catch (err) {
      setPermissionError(err?.message || "Failed to load permissions.");
      setSelectedPermissions([]);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setCreateError("");

    if (!createForm.password.trim()) {
      setCreateError("Password is required.");
      return;
    }
    if (!createForm.email.trim() && !createForm.phone.trim()) {
      setCreateError("Enter either email or phone for login.");
      return;
    }
    if (!createForm.roles.length) {
      setCreateError("Select at least one role.");
      return;
    }

    try {
      await createUser({
        username: createForm.username.trim(),
        email: createForm.email.trim() || null,
        phone: createForm.phone.trim() || null,
        password: createForm.password,
        status: createForm.status,
        roles: createForm.roles,
      });
    } catch (err) {
      showNotice("Create Failed", err?.message || "Failed to create user.", "error");
      setCreateError(err?.message || "Failed to create user.");
      return;
    }

    setOpenCreate(false);
    resetCreateForm();
    await loadUsers();
    showNotice("User Created", "User account created successfully.");
  }

  async function handleGrantPermissions() {
    if (!grantingUser?.id) return;
    setPermissionError("");

    try {
      await grantUserPermissions(grantingUser.id, selectedPermissions);
    } catch (err) {
      showNotice("Update Failed", err?.message || "Failed to grant permissions.", "error");
      setPermissionError(err?.message || "Failed to grant permissions.");
      return;
    }

    setGrantingUser(null);
    showNotice("Permissions Updated", "Direct permissions saved successfully.");
  }

  async function handleStatusUpdate() {
    if (!statusTarget?.id) return;
    const nextStatus = statusTarget.status === "active" ? "inactive" : "active";
    try {
      await updateUserStatus(statusTarget.id, nextStatus);
      setStatusTarget(null);
      await loadUsers();
      showNotice(
        "User Updated",
        `User status changed to ${nextStatus}.`
      );
    } catch (err) {
      showNotice("Update Failed", err?.message || "Failed to update user status.", "error");
    }
  }

  const loadInitialUsers = useEffectEvent(() => {
    loadClasses();
    loadReferenceData();
  });

  const loadFilteredUsers = useEffectEvent(() => {
    loadUsers();
  });

  const loadGrantingUserPermissions = useEffectEvent(() => {
    if (!grantingUser) return;
    loadPermissionDialog(grantingUser.id);
  });

  useEffect(() => {
    loadInitialUsers();
  }, []);

  useEffect(() => {
    loadFilteredUsers();
  }, [role, status, classId, sectionId, page, limit]);

  useEffect(() => {
    loadGrantingUserPermissions();
  }, [grantingUser]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

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
        title="Users"
        subTitle="View all users, create accounts, and manage direct permissions"
        action={
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-4">
                <PopoverHeader className="space-y-1">
                  <PopoverTitle>Filters</PopoverTitle>
                  <PopoverDescription>
                    Narrow users by role, status, and parent enrollment scope.
                  </PopoverDescription>
                </PopoverHeader>

                <Separator />

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>User Category</Label>
                    <select
                      className="w-full rounded-md border bg-background px-3 py-2"
                      value={role}
                      onChange={(e) => {
                        setRole(e.target.value);
                        setClassId("");
                        setSectionId("");
                        setPage(1);
                      }}
                    >
                      {ROLE_FILTERS.map((item) => (
                        <option key={item.value || "all"} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Status</Label>
                    <select
                      className="w-full rounded-md border bg-background px-3 py-2"
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value);
                        setPage(1);
                      }}
                    >
                      {STATUS_FILTERS.map((item) => (
                        <option key={item.value || "all-status"} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Parent Class</Label>
                    <select
                      className="w-full rounded-md border bg-background px-3 py-2"
                      value={classId}
                      disabled={role !== "parent"}
                      onChange={(e) => {
                        setClassId(e.target.value);
                        setSectionId("");
                        setPage(1);
                      }}
                    >
                      <option value="">All Classes</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.medium ? ` (${c.medium})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Parent Section</Label>
                    <select
                      className="w-full rounded-md border bg-background px-3 py-2"
                      value={sectionId}
                      disabled={role !== "parent" || !classId}
                      onChange={(e) => {
                        setSectionId(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">All Sections</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Separator />

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setRole("");
                    setStatus("");
                    setClassId("");
                    setSectionId("");
                    setPage(1);
                  }}
                >
                  Reset Filters
                </Button>
              </PopoverContent>
            </Popover>

            <Button
              onClick={() => {
                resetCreateForm();
                setOpenCreate(true);
              }}
            >
              Add User
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <SurfaceCard accent className="bg-gradient-to-br from-sky-500/15 via-background to-transparent">
            <div className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Visible Users</p>
            <p className="mt-1 text-2xl font-semibold">{pagination.total}</p>
            </div>
          </SurfaceCard>
          <SurfaceCard accent className="bg-gradient-to-br from-emerald-500/15 via-background to-transparent">
            <div className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Active On Page</p>
            <p className={`mt-1 text-2xl font-semibold ${metricValueClass("success")}`}>{activeCount}</p>
            </div>
          </SurfaceCard>
          <SurfaceCard accent className="bg-gradient-to-br from-rose-500/15 via-background to-transparent">
            <div className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Inactive On Page</p>
            <p className={`mt-1 text-2xl font-semibold ${metricValueClass("danger")}`}>{inactiveCount}</p>
            </div>
          </SurfaceCard>
        </div>
      </div>

      <SurfaceCard>
        <div className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold">User Directory</p>
            <p className="text-sm text-muted-foreground">
              Manage status, direct permissions, and account records from one table.
            </p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={users}
          rowsPerPageOptions={[5, 10, 20, 50]}
          paginationMode="server"
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalRows={pagination.total}
          rowsPerPage={pagination.limit}
          onPageChange={setPage}
          onRowsPerPageChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
          renderActions={(row) => (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setGrantingUser(row);
                }}
              >
                Grant Permission
              </Button>
              <Button
                size="sm"
                variant={row.status === "active" ? "destructive" : "secondary"}
                onClick={(e) => {
                  e.stopPropagation();
                  setStatusTarget(row);
                }}
              >
                {row.status === "active" ? "Deactivate" : "Activate"}
              </Button>
            </div>
          )}
        />
        </div>
      </SurfaceCard>

      <Dialog
        open={openCreate}
        onOpenChange={(nextOpen) => {
          setOpenCreate(nextOpen);
          if (!nextOpen) resetCreateForm();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <form onSubmit={handleCreateUser} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add User</DialogTitle>
              <DialogDescription>
                Create a user account and assign one or more roles.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Label>Username</Label>
              <Input
                value={createForm.username}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, username: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Optional display name for the account.
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input
                value={createForm.phone}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Enter at least one login identifier: email or phone.
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Password *</Label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, password: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <select
                className="border rounded-md px-3 py-2 bg-background"
                value={createForm.status}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, status: e.target.value }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label>Roles *</Label>
              <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-2">
                {roles.map((roleName) => (
                  <label key={roleName} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={createForm.roles.includes(roleName)}
                      onChange={() => toggleRoleSelection(roleName)}
                    />
                    {roleName}
                  </label>
                ))}
              </div>
            </div>

            {createError && <p className="text-sm text-red-600">{createError}</p>}

            <DialogFooter showCloseButton>
              <Button type="submit">Create User</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!grantingUser}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setGrantingUser(null);
            setPermissionError("");
            setSelectedPermissions([]);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Grant Permission</DialogTitle>
              <DialogDescription>
                {grantingUser
                  ? `Select direct permissions for user #${grantingUser.id}.`
                  : "Select direct permissions for the chosen user."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-2">
              {allPermissions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No permissions loaded yet.
                </p>
              )}
              {allPermissions.map((permissionName) => (
                <label
                  key={permissionName}
                  className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm shadow-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(permissionName)}
                    onChange={() => togglePermissionSelection(permissionName)}
                    className="mt-1"
                  />
                  <div className="min-w-0">
                    <p className="font-medium">{formatPermissionLabel(permissionName)}</p>
                    <p className="text-xs text-muted-foreground">{permissionName}</p>
                  </div>
                </label>
              ))}
            </div>

            {permissionError && (
              <p className="text-sm text-red-600">{permissionError}</p>
            )}

            <DialogFooter showCloseButton>
              <Button onClick={handleGrantPermissions}>Save Permissions</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!statusTarget}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setStatusTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTarget?.status === "active" ? "Deactivate user?" : "Activate user?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget
                ? `Change user #${statusTarget.id} status to ${
                    statusTarget.status === "active" ? "inactive" : "active"
                  }?`
                : "Confirm status change."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStatusUpdate}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

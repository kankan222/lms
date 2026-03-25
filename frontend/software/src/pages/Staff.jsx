import { useEffect, useMemo, useState } from "react";
import TopBar from "../components/TopBar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  bulkCreateStaff,
  createStaff,
  deleteStaff,
  listStaff,
  updateStaff,
} from "../api/staff.api";
import { getUsers } from "../api/users.api";
import { usePermissions } from "../hooks/usePermissions";
import { resolveServerImageUrl } from "../lib/serverImage";
const SECTION_OPTIONS = [
  { value: "head", label: "Head Staff" },
  { value: "teaching", label: "Teaching Staff" },
  { value: "non_teaching", label: "Non Teaching Staff" },
];
const TYPE_OPTIONS = [
  { value: "school", label: "School" },
  { value: "college", label: "College" },
];

const EMPTY_FORM = {
  user_id: "",
  image: null,
  image_url: "",
  name: "",
  section: "head",
  type: "school",
};

const EMPTY_BULK_FORM = {
  type: "school",
  section: "teaching",
  images: [],
};

function sectionLabel(value) {
  return (
    SECTION_OPTIONS.find((item) => item.value === value)?.label ||
    String(value || "")
  );
}

function titleToSection(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");

  if (normalized === "HEADSTAFF") return "head";
  if (normalized === "TEACHINGSTAFF") return "teaching";
  if (normalized === "NONTEACHINGSTAFF") return "non_teaching";
  return "head";
}

function userOptionLabel(user) {
  return `#${user.id} ${user.username || user.email || user.phone || "Staff User"}`;
}

export default function StaffPage() {
  const { can } = usePermissions();
  const canManageStaff = can("dashboard.view");

  const [rows, setRows] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [createErr, setCreateErr] = useState("");

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState(EMPTY_BULK_FORM);
  const [bulkErr, setBulkErr] = useState("");

  const [editRow, setEditRow] = useState(null);
  const [editErr, setEditErr] = useState("");
  const [deletingRow, setDeletingRow] = useState(null);

  const grouped = useMemo(() => {
    const map = { head: [], teaching: [], non_teaching: [] };
    for (const row of rows) {
      const key = row.section || titleToSection(row.title);
      if (map[key]) map[key].push(row);
    }
    return map;
  }, [rows]);

  useEffect(() => {
    loadRows();
    if (canManageStaff) {
      loadStaffUsers();
    }
  }, [canManageStaff]);

  async function loadRows() {
    setLoading(true);
    setError("");
    try {
      const res = await listStaff();
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(err?.message || "Failed to load staff.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadStaffUsers() {
    try {
      const res = await getUsers({ role: "staff", limit: 50 });
      setStaffUsers(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setStaffUsers([]);
    }
  }

  function validate(data, requireImage = false) {
    if (!String(data.name || "").trim()) return "Name is required.";
    if (!String(data.section || "").trim()) return "Section is required.";
    if (!["school", "college"].includes(String(data.type || "").toLowerCase())) {
      return "Type must be school or college.";
    }
    if (requireImage && !(data.image instanceof File)) {
      return "Image is required.";
    }
    return "";
  }

  async function handleCreate(e) {
    e.preventDefault();
    const msg = validate(createForm, true);
    setCreateErr(msg);
    if (msg) return;

    try {
      await createStaff({
        user_id: createForm.user_id || "",
        image: createForm.image,
        name: createForm.name.trim(),
        section: createForm.section,
        type: createForm.type,
      });
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
      await loadRows();
    } catch (err) {
      setCreateErr(err?.message || "Failed to create staff.");
    }
  }

  async function handleBulkCreate(e) {
    e.preventDefault();
    setBulkErr("");

    if (!bulkForm.section) {
      setBulkErr("Section is required.");
      return;
    }
    if (!bulkForm.images.length) {
      setBulkErr("Select one or more image files.");
      return;
    }

    try {
      await bulkCreateStaff(bulkForm);
      setBulkOpen(false);
      setBulkForm(EMPTY_BULK_FORM);
      await loadRows();
    } catch (err) {
      setBulkErr(err?.message || "Failed to bulk upload staff.");
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    const msg = validate(editRow || {}, false);
    setEditErr(msg);
    if (msg || !editRow?.id) return;

    try {
      await updateStaff(editRow.id, {
        user_id: editRow.user_id || "",
        image: editRow.image || null,
        image_url: String(editRow.image_url || "").trim(),
        name: String(editRow.name || "").trim(),
        section: editRow.section || titleToSection(editRow.title),
        type: String(editRow.type || "").toLowerCase(),
      });
      setEditRow(null);
      await loadRows();
    } catch (err) {
      setEditErr(err?.message || "Failed to update staff.");
    }
  }

  async function handleDelete() {
    if (!deletingRow?.id) return;
    try {
      await deleteStaff(deletingRow.id);
      setDeletingRow(null);
      await loadRows();
    } catch (err) {
      setError(err?.message || "Failed to delete staff.");
    }
  }

  return (
    <>
      <TopBar
        title={canManageStaff ? "Staff Module" : "My Profile"}
        subTitle={
          canManageStaff
            ? "Manage staff records and linked staff accounts"
            : "View your staff profile details"
        }
        action={canManageStaff ? (
          <div className="flex gap-2">
            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Bulk Upload</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <form onSubmit={handleBulkCreate} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>Bulk Upload Staff</DialogTitle>
                    <DialogDescription>
                      Select one campus and section, then upload multiple staff photos at once.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Type *</Label>
                      <select
                        className="w-full rounded-md border px-3 py-2"
                        value={bulkForm.type}
                        onChange={(e) =>
                          setBulkForm((prev) => ({ ...prev, type: e.target.value }))
                        }
                      >
                        {TYPE_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Section *</Label>
                      <select
                        className="w-full rounded-md border px-3 py-2"
                        value={bulkForm.section}
                        onChange={(e) =>
                          setBulkForm((prev) => ({ ...prev, section: e.target.value }))
                        }
                      >
                        {SECTION_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Images *</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) =>
                        setBulkForm((prev) => ({
                          ...prev,
                          images: Array.from(e.target.files || []),
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Staff names will be generated automatically from the file names.
                    </p>
                  </div>

                  {bulkForm.images.length > 0 && (
                    <div className="rounded-lg border p-3">
                      <p className="mb-2 text-sm font-medium">Selected Files</p>
                      <div className="grid gap-1 text-sm text-muted-foreground">
                        {bulkForm.images.map((file) => (
                          <span key={`${file.name}-${file.size}`}>{file.name}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {bulkErr ? <p className="text-sm text-red-600">{bulkErr}</p> : null}

                  <DialogFooter showCloseButton>
                    <Button type="submit">Upload Staff</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>Add Staff</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <form onSubmit={handleCreate} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>Add Staff</DialogTitle>
                    <DialogDescription>
                      Add a single staff record with section, campus, photo, and optional linked user.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-2">
                    <Label>Name *</Label>
                    <Input
                      value={createForm.name}
                      onChange={(e) =>
                        setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Linked User</Label>
                    <select
                      className="w-full rounded-md border px-3 py-2"
                      value={createForm.user_id}
                      onChange={(e) =>
                        setCreateForm((prev) => ({ ...prev, user_id: e.target.value }))
                      }
                    >
                      <option value="">No linked user</option>
                      {staffUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {userOptionLabel(user)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Section *</Label>
                      <select
                        className="w-full rounded-md border px-3 py-2"
                        value={createForm.section}
                        onChange={(e) =>
                          setCreateForm((prev) => ({ ...prev, section: e.target.value }))
                        }
                      >
                        {SECTION_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Type *</Label>
                      <select
                        className="w-full rounded-md border px-3 py-2"
                        value={createForm.type}
                        onChange={(e) =>
                          setCreateForm((prev) => ({ ...prev, type: e.target.value }))
                        }
                      >
                        {TYPE_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Image *</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          image: e.target.files?.[0] || null,
                        }))
                      }
                      required
                    />
                  </div>

                  {createErr ? <p className="text-sm text-red-600">{createErr}</p> : null}

                  <DialogFooter showCloseButton>
                    <Button type="submit">Save</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        ) : null}
      />

      {loading ? <p>Loading...</p> : null}
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      {canManageStaff ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Head Staff</p>
              <p className="mt-1 text-2xl font-semibold">{grouped.head.length}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Teaching Staff</p>
              <p className="mt-1 text-2xl font-semibold">{grouped.teaching.length}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Non Teaching Staff</p>
              <p className="mt-1 text-2xl font-semibold">{grouped.non_teaching.length}</p>
            </div>
          </div>

          {SECTION_OPTIONS.map((section) => (
            <div key={section.value} className="mb-6">
              <h3 className="mb-2 text-lg font-semibold">{section.label}</h3>
              <div className="overflow-x-auto rounded-md border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.16em] [&_th]:text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Photo</th>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Type</th>
                      <th className="p-2 text-left">Section</th>
                      <th className="p-2 text-left">Linked User</th>
                      <th className="p-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(grouped[section.value] || []).map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="p-2">
                          {row.image_url ? (
                            <img
                              src={resolveServerImageUrl(row.image_url)}
                              alt={row.name}
                              className="h-12 w-12 rounded object-cover"
                            />
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="p-2">{row.name}</td>
                        <td className="p-2 capitalize">{row.type}</td>
                        <td className="p-2">{sectionLabel(row.section || titleToSection(row.title))}</td>
                        <td className="p-2">{row.user_id || "-"}</td>
                        <td className="flex gap-2 p-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditErr("");
                              setEditRow({
                                ...row,
                                image: null,
                                user_id: row.user_id ? String(row.user_id) : "",
                                section: row.section || titleToSection(row.title),
                              });
                            }}
                          >
                            Edit
                          </Button>
                          <Button variant="destructive" onClick={() => setDeletingRow(row)}>
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!grouped[section.value]?.length ? (
                      <tr>
                        <td className="p-3 text-muted-foreground" colSpan={6}>
                          No records.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      ) : (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {rows[0] ? (
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="h-24 w-24 overflow-hidden rounded-lg bg-muted">
                {rows[0].image_url ? (
                  <img
                    src={resolveServerImageUrl(rows[0].image_url)}
                    alt={rows[0].name}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">{rows[0].name}</h2>
                <div className="grid gap-1 text-sm text-muted-foreground">
                  <p>Type: {String(rows[0].type || "-").replace(/^./, (char) => char.toUpperCase())}</p>
                  <p>Section: {sectionLabel(rows[0].section || titleToSection(rows[0].title))}</p>
                  <p>Linked User ID: {rows[0].user_id || "-"}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Staff profile not found. Link this staff account to a staff record first.
            </p>
          )}
        </div>
      )}

      <Dialog open={!!editRow} onOpenChange={() => setEditRow(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <form onSubmit={handleUpdate} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit Staff</DialogTitle>
              <DialogDescription>
                Update the staff record, linked user, section, campus, or replace the photo.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input
                value={editRow?.name || ""}
                onChange={(e) =>
                  setEditRow((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Linked User</Label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={editRow?.user_id || ""}
                onChange={(e) =>
                  setEditRow((prev) => ({ ...prev, user_id: e.target.value }))
                }
              >
                <option value="">No linked user</option>
                {staffUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {userOptionLabel(user)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Section *</Label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={editRow?.section || "head"}
                  onChange={(e) =>
                    setEditRow((prev) => ({ ...prev, section: e.target.value }))
                  }
                >
                  {SECTION_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Type *</Label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={editRow?.type || "school"}
                  onChange={(e) =>
                    setEditRow((prev) => ({ ...prev, type: e.target.value }))
                  }
                >
                  {TYPE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Replace Photo</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setEditRow((prev) => ({
                    ...prev,
                    image: e.target.files?.[0] || null,
                  }))
                }
              />
            </div>

            {editRow?.image_url ? (
              <div className="grid gap-2">
                <Label>Current Photo</Label>
                <img
                  src={resolveServerImageUrl(editRow.image_url)}
                  alt={editRow.name}
                  className="h-24 w-24 rounded object-cover"
                />
              </div>
            ) : null}

            {editErr ? <p className="text-sm text-red-600">{editErr}</p> : null}

            <DialogFooter showCloseButton>
              <Button type="submit">Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingRow}
        onOpenChange={(open) => {
          if (!open) setDeletingRow(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete staff record?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingRow
                ? `This will delete ${deletingRow.name} and remove the stored photo.`
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
}

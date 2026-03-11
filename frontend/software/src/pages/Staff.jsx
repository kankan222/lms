import { useEffect, useMemo, useState } from "react";
import TopBar from "../components/TopBar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet";
import {
  createStaff,
  deleteStaff,
  listStaff,
  updateStaff,
} from "../api/staff.api";

const EMPTY_FORM = {
  image_url: "",
  name: "",
  title: "",
  type: "school",
};

const TITLE_OPTIONS = ["HEADSTAFF", "TEACHINGSTAFF", "NONTEACHINGSTAFF"];

function normalizeTitle(value) {
  return String(value || "").toUpperCase().replace(/[\s_-]+/g, "");
}

export default function StaffPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [createErr, setCreateErr] = useState("");

  const [editRow, setEditRow] = useState(null);
  const [editErr, setEditErr] = useState("");

  const grouped = useMemo(() => {
    const map = { HEADSTAFF: [], TEACHINGSTAFF: [], NONTEACHINGSTAFF: [] };
    for (const row of rows) {
      const key = normalizeTitle(row.title);
      if (map[key]) map[key].push(row);
    }
    return map;
  }, [rows]);

  useEffect(() => {
    loadRows();
  }, []);

  async function loadRows() {
    setLoading(true);
    setError("");
    try {
      const res = await listStaff();
      setRows(res?.data || []);
    } catch (err) {
      setError(err?.message || "Failed to load staff.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  function validate(data) {
    if (!String(data.name || "").trim()) return "Name is required.";
    if (!String(data.title || "").trim()) return "Title is required.";
    if (!["school", "college"].includes(String(data.type || "").toLowerCase())) {
      return "Type must be school or college.";
    }
    return "";
  }

  async function handleCreate(e) {
    e.preventDefault();
    const msg = validate(createForm);
    setCreateErr(msg);
    if (msg) return;

    try {
      await createStaff({
        image_url: createForm.image_url.trim(),
        name: createForm.name.trim(),
        title: normalizeTitle(createForm.title),
        type: createForm.type,
      });
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
      await loadRows();
    } catch (err) {
      setCreateErr(err?.message || "Failed to create staff.");
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    const msg = validate(editRow || {});
    setEditErr(msg);
    if (msg || !editRow?.id) return;

    try {
      await updateStaff(editRow.id, {
        image_url: String(editRow.image_url || "").trim(),
        name: String(editRow.name || "").trim(),
        title: normalizeTitle(editRow.title),
        type: String(editRow.type || "").toLowerCase(),
      });
      setEditRow(null);
      await loadRows();
    } catch (err) {
      setEditErr(err?.message || "Failed to update staff.");
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this staff record?")) return;
    try {
      await deleteStaff(id);
      await loadRows();
    } catch (err) {
      alert(err?.message || "Failed to delete staff.");
    }
  }

  return (
    <>
      <TopBar
        title="Staff Module"
        subTitle="Manage website staff records"
        action={
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetTrigger asChild>
              <Button>Add Staff</Button>
            </SheetTrigger>
            <SheetContent>
              <form onSubmit={handleCreate} className="px-3">
                <SheetHeader>
                  <SheetTitle>Add Staff</SheetTitle>
                </SheetHeader>

                <div className="grid gap-2 my-3">
                  <Label>Name *</Label>
                  <Input value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} required />
                </div>

                <div className="grid gap-2 my-3">
                  <Label>Title *</Label>
                  <select className="w-full border rounded-md h-10 px-2" value={createForm.title} onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))} required>
                    <option value="">Select title</option>
                    {TITLE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="grid gap-2 my-3">
                  <Label>Type *</Label>
                  <select className="w-full border rounded-md h-10 px-2" value={createForm.type} onChange={(e) => setCreateForm((p) => ({ ...p, type: e.target.value }))}>
                    <option value="school">school</option>
                    <option value="college">college</option>
                  </select>
                </div>

                <div className="grid gap-2 my-3">
                  <Label>Image URL</Label>
                  <Input value={createForm.image_url} onChange={(e) => setCreateForm((p) => ({ ...p, image_url: e.target.value }))} placeholder="https://..." />
                </div>

                {createErr ? <p className="text-sm text-red-600 mb-2">{createErr}</p> : null}

                <SheetFooter>
                  <Button type="submit">Save</Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      {loading ? <p>Loading...</p> : null}
      {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}

      {["HEADSTAFF", "TEACHINGSTAFF", "NONTEACHINGSTAFF"].map((section) => (
        <div key={section} className="mb-6">
          <h3 className="text-lg font-semibold mb-2">{section}</h3>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Image URL</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(grouped[section] || []).map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2 truncate max-w-[280px]">{row.image_url || "-"}</td>
                    <td className="p-2">{row.name}</td>
                    <td className="p-2 uppercase">{row.type}</td>
                    <td className="p-2 flex gap-2">
                      <Button variant="outline" onClick={() => { setEditErr(""); setEditRow(row); }}>Edit</Button>
                      <Button variant="destructive" onClick={() => handleDelete(row.id)}>Delete</Button>
                    </td>
                  </tr>
                ))}
                {!grouped[section]?.length ? (
                  <tr>
                    <td className="p-3 text-muted-foreground" colSpan={4}>No records.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <Sheet open={!!editRow} onOpenChange={() => setEditRow(null)}>
        <SheetContent>
          <form onSubmit={handleUpdate} className="px-3">
            <SheetHeader>
              <SheetTitle>Edit Staff</SheetTitle>
            </SheetHeader>

            <div className="grid gap-2 my-3">
              <Label>Name *</Label>
              <Input value={editRow?.name || ""} onChange={(e) => setEditRow((p) => ({ ...p, name: e.target.value }))} required />
            </div>

            <div className="grid gap-2 my-3">
              <Label>Title *</Label>
              <select className="w-full border rounded-md h-10 px-2" value={editRow?.title || ""} onChange={(e) => setEditRow((p) => ({ ...p, title: e.target.value }))} required>
                <option value="">Select title</option>
                {TITLE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="grid gap-2 my-3">
              <Label>Type *</Label>
              <select className="w-full border rounded-md h-10 px-2" value={editRow?.type || "school"} onChange={(e) => setEditRow((p) => ({ ...p, type: e.target.value }))}>
                <option value="school">school</option>
                <option value="college">college</option>
              </select>
            </div>

            <div className="grid gap-2 my-3">
              <Label>Image URL</Label>
              <Input value={editRow?.image_url || ""} onChange={(e) => setEditRow((p) => ({ ...p, image_url: e.target.value }))} />
            </div>

            {editErr ? <p className="text-sm text-red-600 mb-2">{editErr}</p> : null}

            <SheetFooter>
              <Button type="submit">Update</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import TopBar from "../components/TopBar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
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
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import {
  addWebsiteStaff,
  bulkUploadWebsiteStaff,
  deleteWebsiteStaff,
  getWebsiteStaff,
  updateWebsiteStaff,
} from "../api/website.api";

const TAB_OPTIONS = ["school", "college"];
const API_ROOT = "http://localhost:5000";
const SECTION_OPTIONS = [
  { value: "head", label: "Head Staff" },
  { value: "teaching", label: "Teaching Staff" },
  { value: "non_teaching", label: "Non Teaching Staff" },
];

const EMPTY_SINGLE_FORM = {
  image: null,
  name: "",
  section: "head",
  type: "school",
};

const EMPTY_BULK_FORM = {
  section: "teaching",
  images: [],
  type: "school",
};

function resolveImageUrl(path) {
  if (!path) return "";
  if (String(path).startsWith("http")) return path;
  return `${API_ROOT}${path}`;
}

function sectionLabel(value) {
  return SECTION_OPTIONS.find((item) => item.value === value)?.label || value;
}

function getCampusLabel(value) {
  return value === "college" ? "College" : "School";
}

export default function WebsiteModule() {
  const [tab, setTab] = useState("school");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [singleOpen, setSingleOpen] = useState(false);
  const [singleForm, setSingleForm] = useState(EMPTY_SINGLE_FORM);
  const [singleError, setSingleError] = useState("");

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState(EMPTY_BULK_FORM);
  const [bulkError, setBulkError] = useState("");

  const [editRow, setEditRow] = useState(null);
  const [editError, setEditError] = useState("");
  const [deletingRow, setDeletingRow] = useState(null);
  const [notice, setNotice] = useState(null);

  const grouped = useMemo(() => {
    const map = { head: [], teaching: [], non_teaching: [] };
    for (const row of rows) {
      if (map[row.section]) map[row.section].push(row);
    }
    return map;
  }, [rows]);

  useEffect(() => {
    loadCampusStaff(tab);
  }, [tab]);

  useEffect(() => {
    setSingleOpen(false);
    setBulkOpen(false);
    setEditRow(null);
    setDeletingRow(null);
    setSingleError("");
    setBulkError("");
    setEditError("");
    setSingleForm({ ...EMPTY_SINGLE_FORM, type: tab });
    setBulkForm({ ...EMPTY_BULK_FORM, type: tab });
  }, [tab]);

  useEffect(() => {
    setSingleForm((prev) => ({ ...prev, type: tab }));
    setBulkForm((prev) => ({ ...prev, type: tab }));
  }, [tab]);

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

  async function loadCampusStaff(type) {
    setLoading(true);
    setError("");
    try {
      const res = await getWebsiteStaff(type);
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      const message = err?.message || "Failed to load website staff.";
      setError(message);
      showNotice("Load Failed", message, "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSingleCreate(e) {
    e.preventDefault();
    setSingleError("");

    if (!String(singleForm.name || "").trim()) {
      setSingleError("Name is required.");
      return;
    }
    if (!(singleForm.image instanceof File)) {
      setSingleError("Image is required.");
      return;
    }

    try {
      await addWebsiteStaff(singleForm.type, {
        name: singleForm.name.trim(),
        section: singleForm.section,
        image: singleForm.image,
      });
      setSingleOpen(false);
      setSingleForm({ ...EMPTY_SINGLE_FORM, type: singleForm.type });
      if (singleForm.type !== tab) {
        setTab(singleForm.type);
      } else {
        await loadCampusStaff(tab);
      }
      showNotice("Staff Created", "Website staff card created successfully.");
    } catch (err) {
      showNotice("Create Failed", err?.message || "Failed to add website staff.", "error");
      setSingleError(err?.message || "Failed to add website staff.");
    }
  }

  async function handleBulkCreate(e) {
    e.preventDefault();
    setBulkError("");

    if (!bulkForm.images.length) {
      setBulkError("Select one or more image files.");
      return;
    }

    try {
      await bulkUploadWebsiteStaff(bulkForm.type, {
        section: bulkForm.section,
        images: bulkForm.images,
      });
      setBulkOpen(false);
      setBulkForm({ ...EMPTY_BULK_FORM, type: bulkForm.type });
      if (bulkForm.type !== tab) {
        setTab(bulkForm.type);
      } else {
        await loadCampusStaff(tab);
      }
      showNotice("Bulk Upload Complete", "Website staff cards uploaded successfully.");
    } catch (err) {
      showNotice("Create Failed", err?.message || "Failed to bulk upload staff.", "error");
      setBulkError(err?.message || "Failed to bulk upload staff.");
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setEditError("");

    if (!editRow?.id) return;
    if (!String(editRow.name || "").trim()) {
      setEditError("Name is required.");
      return;
    }

    try {
      await updateWebsiteStaff(editRow.id, editRow.type || tab, {
        name: String(editRow.name || "").trim(),
        section: editRow.section,
        image: editRow.image || null,
        image_url: editRow.image_url || "",
      });
      setEditRow(null);
      if ((editRow.type || tab) !== tab) {
        setTab(editRow.type || tab);
      } else {
        await loadCampusStaff(tab);
      }
      showNotice("Staff Updated", "Website staff card updated successfully.");
    } catch (err) {
      showNotice("Update Failed", err?.message || "Failed to update staff.", "error");
      setEditError(err?.message || "Failed to update staff.");
    }
  }

  async function handleDelete() {
    if (!deletingRow?.id) return;
    try {
      await deleteWebsiteStaff(deletingRow.id, deletingRow.type || tab);
      setDeletingRow(null);
      await loadCampusStaff(tab);
      showNotice("Staff Deleted", "Website staff card deleted successfully.");
    } catch (err) {
      const message = err?.message || "Failed to delete staff.";
      setError(message);
      showNotice("Delete Failed", message, "error");
    }
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
        title="Website Module"
        subTitle="Manage school and college staff cards displayed on the website"
        action={
          <div className="flex gap-2">
            <Dialog
              open={bulkOpen}
              onOpenChange={(open) => {
                setBulkOpen(open);
                if (!open) {
                  setBulkError("");
                  setBulkForm({ ...EMPTY_BULK_FORM, type: tab });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline">Bulk Upload</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <form onSubmit={handleBulkCreate} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>Bulk Upload Staff</DialogTitle>
                    <DialogDescription>
                      Upload multiple images for the {getCampusLabel(tab).toLowerCase()} website. Staff names are generated from file names automatically.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-2">
                    <Label>Type *</Label>
                    <select
                      className="w-full rounded-md border px-3 py-2"
                      value={bulkForm.type}
                      onChange={(e) =>
                        setBulkForm((prev) => ({ ...prev, type: e.target.value }))
                      }
                    >
                      <option value="school">School</option>
                      <option value="college">College</option>
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
                      {SECTION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
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

                  {bulkError ? <p className="text-sm text-red-600">{bulkError}</p> : null}

                  <DialogFooter showCloseButton>
                    <Button type="submit">Upload</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog
              open={singleOpen}
              onOpenChange={(open) => {
                setSingleOpen(open);
                if (!open) {
                  setSingleError("");
                  setSingleForm({ ...EMPTY_SINGLE_FORM, type: tab });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button>Add Staff</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <form onSubmit={handleSingleCreate} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>Add Staff</DialogTitle>
                    <DialogDescription>
                      Add a single staff card for the {getCampusLabel(tab).toLowerCase()} website.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-2">
                    <Label>Name *</Label>
                    <Input
                      value={singleForm.name}
                      onChange={(e) =>
                        setSingleForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Type *</Label>
                    <select
                      className="w-full rounded-md border px-3 py-2"
                      value={singleForm.type}
                      onChange={(e) =>
                        setSingleForm((prev) => ({ ...prev, type: e.target.value }))
                      }
                    >
                      <option value="school">School</option>
                      <option value="college">College</option>
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Section *</Label>
                    <select
                      className="w-full rounded-md border px-3 py-2"
                      value={singleForm.section}
                      onChange={(e) =>
                        setSingleForm((prev) => ({ ...prev, section: e.target.value }))
                      }
                    >
                      {SECTION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Photo *</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setSingleForm((prev) => ({
                          ...prev,
                          image: e.target.files?.[0] || null,
                        }))
                      }
                    />
                  </div>

                  {singleError ? <p className="text-sm text-red-600">{singleError}</p> : null}

                  <DialogFooter showCloseButton>
                    <Button type="submit">Save</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab} orientation="vertical" className="gap-6">
        <TabsList variant="line" className="min-w-[220px] items-stretch border-r pr-4">
          {TAB_OPTIONS.map((item) => (
            <TabsTrigger key={item} value={item}>
              {item === "college" ? "College" : "School"}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_OPTIONS.map((item) => (
          <TabsContent key={item} value={item}>
            <div className="grid gap-4">
              <div className="rounded-xl border bg-card p-4">
                <p className="text-base font-semibold">
                  {getCampusLabel(item)} Website Staff
                </p>
                <p className="text-sm text-muted-foreground">
                  Manage staff cards, bulk uploads, and image updates for this campus.
                </p>
              </div>

              {loading ? <p>Loading...</p> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <div className="grid gap-3 sm:grid-cols-3">
                {SECTION_OPTIONS.map((option) => (
                  <div key={option.value} className="rounded-lg border bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {option.label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold">
                      {grouped[option.value]?.length || 0}
                    </p>
                  </div>
                ))}
              </div>

              {SECTION_OPTIONS.map((option) => (
                <div key={option.value} className="mb-2">
                  <h3 className="mb-3 text-xl font-semibold">{option.label}</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
                    {(grouped[option.value] || []).map((row) => (
                      <div key={row.id} className="overflow-hidden rounded-md border bg-white">
                        <div className="aspect-[3/4] bg-muted">
                          <img
                            src={resolveImageUrl(row.image_url)}
                            alt={row.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="space-y-1 p-3">
                          <p className="font-semibold">{row.name}</p>
                          <p className="text-xs text-muted-foreground">{sectionLabel(row.section)}</p>
                          <p className="text-xs uppercase text-muted-foreground">{row.type}</p>
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditRow({ ...row, image: null })}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setDeletingRow(row)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!grouped[option.value]?.length ? (
                      <p className="text-sm text-muted-foreground">No records.</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog
        open={!!editRow}
        onOpenChange={(open) => {
          if (!open) {
            setEditError("");
            setEditRow(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <form onSubmit={handleUpdate} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit Website Staff</DialogTitle>
              <DialogDescription>
                Update the name, section, or photo for this {getCampusLabel(tab).toLowerCase()} website staff card.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input
                value={editRow?.name || ""}
                onChange={(e) =>
                  setEditRow((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Type *</Label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={editRow?.type || tab}
                onChange={(e) =>
                  setEditRow((prev) => ({ ...prev, type: e.target.value }))
                }
              >
                <option value="school">School</option>
                <option value="college">College</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label>Section *</Label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={editRow?.section || "head"}
                onChange={(e) =>
                  setEditRow((prev) => ({ ...prev, section: e.target.value }))
                }
              >
                {SECTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
                  src={resolveImageUrl(editRow.image_url)}
                  alt={editRow.name}
                  className="h-24 w-24 rounded object-cover"
                />
              </div>
            ) : null}

            {editError ? <p className="text-sm text-red-600">{editError}</p> : null}

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
            <AlertDialogTitle>Delete staff card?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingRow
                ? `This will delete ${deletingRow.name} and remove the stored photo from the server.`
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


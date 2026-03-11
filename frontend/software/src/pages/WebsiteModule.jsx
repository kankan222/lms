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
import { addWebsiteStaff, getWebsiteStaff } from "../api/website.api";

const TAB_OPTIONS = ["college", "school"];
const TITLE_OPTIONS = ["HEADSTAFF", "TEACHINGSTAFF", "NONTEACHINGSTAFF"];

const EMPTY_FORM = {
  image_url: "",
  name: "",
  title: "HEADSTAFF",
};

function titleLabel(value) {
  if (value === "HEADSTAFF") return "HEAD STAFF";
  if (value === "TEACHINGSTAFF") return "TEACHING STAFF";
  if (value === "NONTEACHINGSTAFF") return "NON TEACHING STAFF";
  return value;
}

export default function WebsiteModule() {
  const [tab, setTab] = useState("college");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const grouped = useMemo(() => {
    const map = { HEADSTAFF: [], TEACHINGSTAFF: [], NONTEACHINGSTAFF: [] };
    for (const row of rows) {
      const key = String(row.title || "").toUpperCase().replace(/[\s_-]+/g, "");
      if (map[key]) map[key].push(row);
    }
    return map;
  }, [rows]);

  useEffect(() => {
    loadData(tab);
  }, [tab]);

  async function loadData(nextType) {
    setLoading(true);
    setError("");
    try {
      const res = await getWebsiteStaff(nextType);
      setRows(res?.data || []);
    } catch (err) {
      setError(err?.message || "Failed to load website staff.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");

    if (!String(form.name || "").trim()) {
      setFormError("Name is required.");
      return;
    }

    if (!TITLE_OPTIONS.includes(String(form.title || "").toUpperCase())) {
      setFormError("Select a valid title.");
      return;
    }

    try {
      await addWebsiteStaff(tab, {
        image_url: String(form.image_url || "").trim(),
        name: String(form.name || "").trim(),
        title: String(form.title || "").toUpperCase(),
      });
      setOpen(false);
      setForm(EMPTY_FORM);
      await loadData(tab);
    } catch (err) {
      setFormError(err?.message || "Failed to add website staff.");
    }
  }

  return (
    <>
      <TopBar
        title="Website Module"
        subTitle="Manage staff cards displayed on website"
        action={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button>Add Staff Image</Button>
            </SheetTrigger>
            <SheetContent>
              <form onSubmit={handleCreate} className="px-3">
                <SheetHeader>
                  <SheetTitle>Add {tab.toUpperCase()} Staff</SheetTitle>
                </SheetHeader>

                <div className="grid gap-2 my-3">
                  <Label>Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
                </div>

                <div className="grid gap-2 my-3">
                  <Label>Title *</Label>
                  <select className="w-full border rounded-md h-10 px-2" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}>
                    {TITLE_OPTIONS.map((t) => (
                      <option key={t} value={t}>{titleLabel(t)}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2 my-3">
                  <Label>Image URL *</Label>
                  <Input value={form.image_url} onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))} placeholder="https://..." required />
                </div>

                {formError ? <p className="text-sm text-red-600 mb-2">{formError}</p> : null}

                <SheetFooter>
                  <Button type="submit">Save</Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      <div className="flex gap-2 mb-4">
        {TAB_OPTIONS.map((item) => (
          <Button key={item} variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>
            {item === "college" ? "College Staff" : "School Staff"}
          </Button>
        ))}
      </div>

      {loading ? <p>Loading...</p> : null}
      {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}

      {TITLE_OPTIONS.map((section) => (
        <div key={section} className="mb-8">
          <h3 className="text-xl font-semibold mb-3">{titleLabel(section)}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {(grouped[section] || []).map((row) => (
              <div key={row.id} className="border rounded-md bg-white overflow-hidden">
                <div className="aspect-[3/4] bg-muted">
                  <img src={row.image_url} alt={row.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{titleLabel(row.title)}</p>
                  <p className="text-xs uppercase text-muted-foreground mt-1">{row.type}</p>
                </div>
              </div>
            ))}
            {!grouped[section]?.length ? <p className="text-sm text-muted-foreground">No records.</p> : null}
          </div>
        </div>
      ))}
    </>
  );
}

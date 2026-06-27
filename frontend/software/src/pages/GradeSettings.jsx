import { useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createGradeSetting,
  deleteGradeSetting,
  getGradeSettings,
  updateGradeSetting,
} from "../api/marksheet.api";

const emptyForm = {
  scale_type: "percentage",
  grade_label: "",
  qualitative_value: "",
  min_value: "",
  max_value: "",
  mark_value: "",
  sort_order: 0,
  is_active: true,
};

function scaleBadgeClass(scaleType) {
  const value = String(scaleType || "").trim().toLowerCase();
  if (value === "activity") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200";
  }

  if (value === "percentage") {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200";
  }

  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-200";
}

export default function GradeSettings() {
  const [rows, setRows] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRows();
  }, []);

  async function loadRows() {
    const res = await getGradeSettings();
    setRows(Array.isArray(res?.data) ? res.data : []);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        min_value: Number(form.min_value),
        max_value: Number(form.max_value),
        mark_value: form.mark_value === "" ? null : Number(form.mark_value),
        sort_order: Number(form.sort_order || 0),
      };
      if (editingId) await updateGradeSetting(editingId, payload);
      else await createGradeSetting(payload);
      resetForm();
      await loadRows();
    } catch (err) {
      setError(err?.message || "Failed to save grade setting.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <TopBar title="Grade Settings" subTitle="Configure percentage and activity grade ranges for marksheets" />
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Grade" : "Add Grade"}</CardTitle>
            <CardDescription>Ranges are inclusive and used during marksheet generation.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-3">
              <div className="grid gap-2">
                <Label>Scale Type</Label>
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.scale_type}
                  onChange={(e) => setForm((prev) => ({ ...prev, scale_type: e.target.value }))}
                >
                  <option value="percentage">Percentage</option>
                  <option value="activity">Activity</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Grade</Label>
                <Input value={form.grade_label} onChange={(e) => setForm((p) => ({ ...p, grade_label: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Qualitative Value</Label>
                <Input value={form.qualitative_value} onChange={(e) => setForm((p) => ({ ...p, qualitative_value: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label>Min</Label>
                  <Input type="number" step="0.01" value={form.min_value} onChange={(e) => setForm((p) => ({ ...p, min_value: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Max</Label>
                  <Input type="number" step="0.01" value={form.max_value} onChange={(e) => setForm((p) => ({ ...p, max_value: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label>Activity Mark Value</Label>
                  <Input type="number" step="0.01" value={form.mark_value} onChange={(e) => setForm((p) => ({ ...p, mark_value: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Order</Label>
                  <Input type="number" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
                Active
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="flex gap-2">
                <Button disabled={saving}>{saving ? "Saving..." : editingId ? "Update" : "Create"}</Button>
                {editingId ? <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button> : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configured Grades</CardTitle>
            <CardDescription>Separate scales are kept for activity marks and percentage results.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {rows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{row.grade_label}</span>
                    <Badge variant="outline" className={`rounded-full capitalize ${scaleBadgeClass(row.scale_type)}`}>
                      {row.scale_type}
                    </Badge>
                    {!row.is_active ? <Badge variant="secondary">Inactive</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {row.min_value} to {row.max_value} · {row.qualitative_value || "-"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditingId(row.id);
                    setForm({
                      scale_type: row.scale_type,
                      grade_label: row.grade_label,
                      qualitative_value: row.qualitative_value || "",
                      min_value: row.min_value,
                      max_value: row.max_value,
                      mark_value: row.mark_value ?? "",
                      sort_order: row.sort_order || 0,
                      is_active: Boolean(row.is_active),
                    });
                  }}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={async () => {
                    await deleteGradeSetting(row.id);
                    await loadRows();
                  }}>Delete</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

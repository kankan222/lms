import { useEffect, useEffectEvent, useMemo, useState } from "react";
import TopBar from "../components/TopBar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getClassStructure } from "../api/academic.api";
import {
  createActivity,
  deleteActivity,
  getActivities,
  updateActivity,
} from "../api/marksheet.api";

const scopeLabels = {
  nursery_ukg: "Nursery to UKG",
  i_v: "I to V",
  vi_vii: "VI & VII",
  viii: "VIII",
  ix: "IX",
  x: "X",
};

const emptyActivity = {
  name: "",
  scope_key: "",
  class_id: "",
  class_ids: [],
  section_id: "",
  section_ids: [],
  sort_order: 0,
  max_marks: 10,
  is_active: true,
};

const checkboxClassName =
  "size-4 rounded border-border accent-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:accent-stone-300 dark:focus-visible:ring-offset-background";

function CheckboxChoice({ checked, disabled = false, label, onChange }) {
  return (
    <label
      className={`flex min-h-9 items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
        checked
          ? "border-punch-600 bg-punch-50 text-foreground dark:bg-muted/30"
          : "border-border bg-background text-foreground hover:bg-muted/40 dark:hover:bg-muted/20"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <input
        type="checkbox"
        className={checkboxClassName}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span className="truncate">{label}</span>
    </label>
  );
}

function toggleStringId(values = [], id) {
  const nextId = String(id);
  return values.some((value) => String(value) === nextId)
    ? values.filter((value) => String(value) !== nextId)
    : [...values, nextId];
}

function wholeNumberValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const number = Number(text);
  return Number.isFinite(number) ? String(Math.round(number)) : text.replace(/\D/g, "");
}

function activityScopeBadgeClass(activity) {
  if (activity.section_id) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200";
  }

  if (activity.class_id) {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200";
  }

  if (activity.scope_key) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200";
  }

  return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-200";
}

export default function Activities() {
  const [activities, setActivities] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyActivity);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);

  const selectedActivityClasses = useMemo(
    () => classes.filter((item) => (form.class_ids || []).some((id) => String(id) === String(item.id))),
    [classes, form.class_ids]
  );

  const selectedActivitySectionOptions = useMemo(
    () =>
      selectedActivityClasses.flatMap((classItem) =>
        (classItem.sections || []).map((section) => ({
          ...section,
          class_id: classItem.id,
          class_name: classItem.name,
        }))
      ),
    [selectedActivityClasses]
  );

  async function loadInitial() {
    const [activityRes, classRes] = await Promise.all([getActivities(), getClassStructure()]);
    setActivities(activityRes?.data || []);
    setClasses(classRes?.data || []);
  }

  const loadInitialActivities = useEffectEvent(() => {
    loadInitial();
  });

  useEffect(() => {
    loadInitialActivities();
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

  function resetForm() {
    setEditingId(null);
    setForm(emptyActivity);
    setError("");
  }

  function openCreateForm() {
    resetForm();
    setFormOpen(true);
  }

  function openEditForm(activity) {
    setEditingId(activity.id);
    setForm({
      name: activity.name,
      scope_key: activity.scope_key || "",
      class_id: activity.class_id ? String(activity.class_id) : "",
      class_ids: activity.class_id ? [String(activity.class_id)] : [],
      section_id: activity.section_id ? String(activity.section_id) : "",
      section_ids: activity.section_id ? [String(activity.section_id)] : [],
      sort_order: activity.sort_order || 0,
      max_marks: wholeNumberValue(activity.max_marks || 10),
      is_active: Boolean(activity.is_active),
    });
    setError("");
    setFormOpen(true);
  }

  async function saveDefinition(e) {
    e.preventDefault();
    setError("");
    try {
      const selectedClassIds = (form.class_ids || []).map(String);
      const selectedSectionIds = (form.section_ids || []).map(String);
      const sectionClassById = new Map(
        selectedActivitySectionOptions.map((section) => [String(section.id), String(section.class_id)])
      );
      const payloads = selectedSectionIds.length
        ? selectedSectionIds.map((sectionId) => ({
            ...form,
            class_id: sectionClassById.get(sectionId) || "",
            section_id: sectionId,
          }))
        : selectedClassIds.length
          ? selectedClassIds.map((classId) => ({ ...form, class_id: classId, section_id: "" }))
          : [{ ...form, class_id: "", section_id: "" }];
      const normalizedPayloads = payloads.map((payload) => ({
        ...payload,
        max_marks: Number(wholeNumberValue(payload.max_marks) || 0),
      }));

      if (editingId) {
        await updateActivity(editingId, normalizedPayloads[0]);
        if (normalizedPayloads.length > 1) {
          await Promise.all(normalizedPayloads.slice(1).map((payload) => createActivity(payload)));
        }
      } else {
        await Promise.all(normalizedPayloads.map((payload) => createActivity(payload)));
      }

      resetForm();
      setFormOpen(false);
      const res = await getActivities();
      setActivities(res?.data || []);
      showNotice(
        editingId ? "Activity Updated" : "Activity Created",
        editingId ? "Activity updated successfully." : "Activity created successfully."
      );
    } catch (err) {
      const message = err?.message || "Failed to save activity.";
      setError(message);
      showNotice(editingId ? "Update Failed" : "Create Failed", message, "error");
    }
  }

  async function removeActivity(activityId) {
    try {
      await deleteActivity(activityId);
      const res = await getActivities();
      setActivities(res?.data || []);
      showNotice("Activity Deleted", "Activity deleted successfully.");
    } catch (err) {
      showNotice("Delete Failed", err?.message || "Failed to delete activity.", "error");
    }
  }

  function activityScopeLabel(activity) {
    if (activity.class_id) {
      return `${activity.class_name || "Class"}${
        activity.section_id ? ` - ${activity.section_name || "Section"}` : " - All Sections"
      }`;
    }

    if (activity.scope_key) return scopeLabels[activity.scope_key] || activity.scope_key;
    return "All Classes";
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
          {notice ? (
            <Alert
              variant={notice.variant === "error" ? "destructive" : "success"}
              className="pointer-events-auto overflow-hidden border shadow-xl"
            >
              <AlertTitle>{notice.title}</AlertTitle>
              <AlertDescription>{notice.message}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </div>

      <TopBar
        title="Activities"
        subTitle="Configure class-scoped activities for the final marksheet"
        action={
          <Dialog
            open={formOpen}
            onOpenChange={(open) => {
              setFormOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button type="button" onClick={openCreateForm}>Add Activity</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[88vh] overflow-y-auto rounded-2xl sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Activity" : "Add Activity"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={saveDefinition} className="grid gap-4">
                <p className="text-sm text-muted-foreground">
                  Activities can apply to all classes, selected classes, or selected sections.
                </p>
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Class Scope</Label>
                    <div className="h-56 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-2">
                      <CheckboxChoice
                        checked={(form.class_ids || []).length === 0}
                        label="All Classes"
                        onChange={() =>
                          setForm((p) => ({
                            ...p,
                            class_id: "",
                            class_ids: [],
                            section_id: "",
                            section_ids: [],
                          }))
                        }
                      />
                      {classes.map((item) => (
                        <CheckboxChoice
                          key={item.id}
                          checked={(form.class_ids || []).some((id) => String(id) === String(item.id))}
                          label={item.name}
                          onChange={() =>
                            setForm((p) => {
                              const class_ids = toggleStringId(p.class_ids, item.id);
                              const allowedSectionIds = new Set(
                                classes
                                  .filter((classItem) =>
                                    class_ids.some((id) => String(id) === String(classItem.id))
                                  )
                                  .flatMap((classItem) => classItem.sections || [])
                                  .map((section) => String(section.id))
                              );
                              return {
                                ...p,
                                class_id: class_ids[0] || "",
                                class_ids,
                                section_id: "",
                                section_ids: (p.section_ids || []).filter((id) => allowedSectionIds.has(String(id))),
                              };
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Section Scope</Label>
                    <div className="h-56 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-2">
                      <CheckboxChoice
                        checked={(form.section_ids || []).length === 0}
                        disabled={(form.class_ids || []).length === 0}
                        label={(form.class_ids || []).length > 1 ? "All Sections for Selected Classes" : "All Sections"}
                        onChange={() => setForm((p) => ({ ...p, section_id: "", section_ids: [] }))}
                      />
                      {selectedActivitySectionOptions.map((section) => (
                        <CheckboxChoice
                          key={section.id}
                          checked={(form.section_ids || []).some((id) => String(id) === String(section.id))}
                          disabled={(form.class_ids || []).length === 0}
                          label={`${section.class_name} - ${section.name}${section.medium ? ` (${section.medium})` : ""}`}
                          onChange={() =>
                            setForm((p) => ({
                              ...p,
                              section_id: "",
                              section_ids: toggleStringId(p.section_ids, section.id),
                            }))
                          }
                        />
                      ))}
                      {(form.class_ids || []).length === 0 ? (
                        <p className="px-2 py-1 text-sm text-muted-foreground">Select one or more classes first.</p>
                      ) : null}
                      {(form.class_ids || []).length > 0 && !selectedActivitySectionOptions.length ? (
                        <p className="px-2 py-1 text-sm text-muted-foreground">No sections found for selected classes.</p>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-2">
                    <Label>Max Marks</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={form.max_marks}
                      onChange={(e) => setForm((p) => ({ ...p, max_marks: e.target.value.replace(/\D/g, "") }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Order</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={form.sort_order}
                      onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value.replace(/\D/g, "") }))}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                  />
                  Active
                </label>
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button className="w-full">{editingId ? "Update" : "Create"}</Button>
                  <Button type="button" variant="outline" className="w-full" onClick={() => setFormOpen(false)}>Cancel</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Activity Definitions</CardTitle>
          <CardDescription>These rows print on the front page of the final marksheet.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {activities.map((activity) => (
            <div key={activity.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{activity.name}</span>
                  <Badge variant="outline" className={`rounded-full ${activityScopeBadgeClass(activity)}`}>
                    {activityScopeLabel(activity)}
                  </Badge>
                  {!activity.is_active ? (
                    <Badge
                      variant="outline"
                      className="rounded-full border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200"
                    >
                      Inactive
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  Max {wholeNumberValue(activity.max_marks)} | Order {activity.sort_order}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEditForm(activity)}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => removeActivity(activity.id)}>Delete</Button>
              </div>
            </div>
          ))}
          {!activities.length ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              No activities found.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}

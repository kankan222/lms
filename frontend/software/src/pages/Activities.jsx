import { useEffect, useEffectEvent, useMemo, useState } from "react";
import TopBar from "../components/TopBar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getClassStructure, getSessions } from "../api/academic.api";
import {
  createActivity,
  deleteActivity,
  getActivities,
  getActivityMarkGrid,
  saveActivityMarks,
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

export default function Activities() {
  const [activities, setActivities] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyActivity);
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [filters, setFilters] = useState({ session_id: "", class_id: "", section_id: "" });
  const [grid, setGrid] = useState({ activities: [], students: [] });
  const [marks, setMarks] = useState({});
  const [error, setError] = useState("");

  const selectedClass = useMemo(
    () => classes.find((item) => String(item.id) === String(filters.class_id)),
    [classes, filters.class_id]
  );
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
    const [activityRes, sessionRes, classRes] = await Promise.all([
      getActivities(),
      getSessions(),
      getClassStructure(),
    ]);
    setActivities(activityRes?.data || []);
    setSessions(sessionRes?.data || []);
    setClasses(classRes?.data || []);
  }

  const loadInitialActivities = useEffectEvent(() => {
    loadInitial();
  });

  useEffect(() => {
    loadInitialActivities();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm(emptyActivity);
    setError("");
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

      if (editingId) {
        if (payloads.length !== 1) {
          throw new Error("Edit one class or section scope at a time.");
        }
        await updateActivity(editingId, payloads[0]);
      } else {
        await Promise.all(payloads.map((payload) => createActivity(payload)));
      }
      resetForm();
      const res = await getActivities();
      setActivities(res?.data || []);
    } catch (err) {
      setError(err?.message || "Failed to save activity.");
    }
  }

  async function loadMarkGrid() {
    setError("");
    try {
      const res = await getActivityMarkGrid(filters);
      const nextGrid = res?.data || { activities: [], students: [] };
      setGrid(nextGrid);
      const nextMarks = {};
      nextGrid.students.forEach((student) => {
        nextGrid.activities.forEach((activity) => {
          nextMarks[`${activity.id}-${student.student_id}`] =
            student.marks?.[activity.id] ?? "";
        });
      });
      setMarks(nextMarks);
    } catch (err) {
      setError(err?.message || "Failed to load activity marks.");
    }
  }

  async function saveMarksForActivity(activityId) {
    const rows = grid.students.map((student) => ({
      student_id: student.student_id,
      marks: marks[`${activityId}-${student.student_id}`] ?? "",
    }));
    await saveActivityMarks(activityId, { ...filters, rows });
    await loadMarkGrid();
  }

  return (
    <>
      <TopBar title="Activities" subTitle="Configure class-scoped activities and enter marksheet activity marks" />
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Activity" : "Add Activity"}</CardTitle>
            <CardDescription>Activities can apply to all classes, one class, or one section.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveDefinition} className="grid gap-3">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Class Scope</Label>
                <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-2">
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
                <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-2">
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
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label>Max Marks</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={form.max_marks}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
                      setForm((p) => ({ ...p, max_marks: value }));
                    }}
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
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
                Active
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="flex gap-2">
                <Button>{editingId ? "Update" : "Create"}</Button>
                {editingId ? <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button> : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4">
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
                      <Badge variant="outline">
                        {activity.class_id
                          ? `${activity.class_name || "Class"}${activity.section_id ? ` - ${activity.section_name || "Section"}` : " - All Sections"}`
                          : activity.scope_key
                            ? scopeLabels[activity.scope_key]
                            : "All Classes"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Max {activity.max_marks} · Order {activity.sort_order}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditingId(activity.id);
                      setForm({
                        name: activity.name,
                        scope_key: activity.scope_key || "",
                        class_id: activity.class_id ? String(activity.class_id) : "",
                        class_ids: activity.class_id ? [String(activity.class_id)] : [],
                        section_id: activity.section_id ? String(activity.section_id) : "",
                        section_ids: activity.section_id ? [String(activity.section_id)] : [],
                        sort_order: activity.sort_order || 0,
                        max_marks: activity.max_marks || 10,
                        is_active: Boolean(activity.is_active),
                      });
                    }}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={async () => {
                      await deleteActivity(activity.id);
                      const res = await getActivities();
                      setActivities(res?.data || []);
                    }}>Delete</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity Marks</CardTitle>
              <CardDescription>Enter marks per student. Grades are calculated from Grade Settings.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-2 md:grid-cols-4">
                <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.session_id} onChange={(e) => setFilters((p) => ({ ...p, session_id: e.target.value }))}>
                  <option value="">Session</option>
                  {sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
                </select>
                <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-2">
                  {classes.map((item) => (
                    <CheckboxChoice
                      key={item.id}
                      checked={String(filters.class_id) === String(item.id)}
                      label={item.name}
                      onChange={() =>
                        setFilters((p) => ({
                          ...p,
                          class_id: String(item.id),
                          section_id: "",
                        }))
                      }
                    />
                  ))}
                  {!classes.length ? (
                    <p className="px-2 py-1 text-sm text-muted-foreground">No classes found.</p>
                  ) : null}
                </div>
                <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-2">
                  {(selectedClass?.sections || []).map((section) => (
                    <CheckboxChoice
                      key={section.id}
                      checked={String(filters.section_id) === String(section.id)}
                      disabled={!filters.class_id}
                      label={`${section.name}${section.medium ? ` (${section.medium})` : ""}`}
                      onChange={() =>
                        setFilters((p) => ({
                          ...p,
                          section_id: String(section.id),
                        }))
                      }
                    />
                  ))}
                  {!filters.class_id ? (
                    <p className="px-2 py-1 text-sm text-muted-foreground">Select a class first.</p>
                  ) : null}
                  {filters.class_id && !(selectedClass?.sections || []).length ? (
                    <p className="px-2 py-1 text-sm text-muted-foreground">No sections found for this class.</p>
                  ) : null}
                </div>
                <Button type="button" onClick={loadMarkGrid} disabled={!filters.session_id || !filters.class_id || !filters.section_id}>Load</Button>
              </div>

              {grid.activities.length ? (
                <div className="overflow-auto rounded-lg border">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left">Student</th>
                        {grid.activities.map((activity) => <th key={activity.id} className="px-3 py-2 text-left">{activity.name}</th>)}
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {grid.students.map((student) => (
                        <tr key={student.student_id} className="border-t">
                          <td className="px-3 py-2 font-medium">{student.roll_number}. {student.student_name}</td>
                          {grid.activities.map((activity) => (
                            <td key={activity.id} className="px-3 py-2">
                              <Input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="h-8 w-24"
                                value={marks[`${activity.id}-${student.student_id}`] ?? ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setMarks((p) => ({
                                    ...p,
                                    [`${activity.id}-${student.student_id}`]: value === "" ? "" : value.replace(/\D/g, ""),
                                  }));
                                }}
                              />
                            </td>
                          ))}
                          <td></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex flex-wrap gap-2 border-t p-3">
                    {grid.activities.map((activity) => (
                      <Button key={activity.id} type="button" variant="outline" onClick={() => saveMarksForActivity(activity.id)}>
                        Save {activity.name}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Load a class section to enter activity marks.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

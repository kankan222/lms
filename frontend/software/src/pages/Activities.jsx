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
  section_id: "",
  sort_order: 0,
  max_marks: 10,
  is_active: true,
};

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
  const selectedActivityClass = useMemo(
    () => classes.find((item) => String(item.id) === String(form.class_id)),
    [classes, form.class_id]
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
      if (editingId) await updateActivity(editingId, form);
      else await createActivity(form);
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
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.class_id}
                  onChange={(e) => setForm((p) => ({ ...p, class_id: e.target.value, section_id: "" }))}
                >
                  <option value="">All Classes</option>
                  {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Section Scope</Label>
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.section_id}
                  onChange={(e) => setForm((p) => ({ ...p, section_id: e.target.value }))}
                  disabled={!form.class_id}
                >
                  <option value="">All Sections</option>
                  {(selectedActivityClass?.sections || []).map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}{section.medium ? ` (${section.medium})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label>Max Marks</Label>
                  <Input type="number" step="0.01" value={form.max_marks} onChange={(e) => setForm((p) => ({ ...p, max_marks: e.target.value }))} />
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
                        section_id: activity.section_id ? String(activity.section_id) : "",
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
                <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.class_id} onChange={(e) => setFilters((p) => ({ ...p, class_id: e.target.value, section_id: "" }))}>
                  <option value="">Class</option>
                  {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.section_id} onChange={(e) => setFilters((p) => ({ ...p, section_id: e.target.value }))}>
                  <option value="">Section</option>
                  {(selectedClass?.sections || []).map((section) => <option key={section.id} value={section.id}>{section.name}{section.medium ? ` (${section.medium})` : ""}</option>)}
                </select>
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
                                type="number"
                                step="0.01"
                                className="h-8 w-24"
                                value={marks[`${activity.id}-${student.student_id}`] ?? ""}
                                onChange={(e) => setMarks((p) => ({ ...p, [`${activity.id}-${student.student_id}`]: e.target.value }))}
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

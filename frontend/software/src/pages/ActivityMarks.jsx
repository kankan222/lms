import { useEffect, useEffectEvent, useMemo, useState } from "react";
import TopBar from "../components/TopBar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getClassStructure, getSessions } from "../api/academic.api";
import { getActivityMarkGrid, saveActivityMarks } from "../api/marksheet.api";

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

function wholeNumberValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const number = Number(text);
  return Number.isFinite(number) ? String(Math.round(number)) : text.replace(/\D/g, "");
}

export default function ActivityMarks() {
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [filters, setFilters] = useState({ session_id: "", class_id: "", section_id: "" });
  const [grid, setGrid] = useState({ activities: [], students: [] });
  const [marks, setMarks] = useState({});
  const [savedMarks, setSavedMarks] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);

  const selectedClass = useMemo(
    () => classes.find((item) => String(item.id) === String(filters.class_id)),
    [classes, filters.class_id]
  );

  async function loadInitial() {
    const [sessionRes, classRes] = await Promise.all([getSessions(), getClassStructure()]);
    setSessions(sessionRes?.data || []);
    setClasses(classRes?.data || []);
  }

  const loadInitialActivityMarks = useEffectEvent(() => {
    loadInitial();
  });

  useEffect(() => {
    loadInitialActivityMarks();
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

  function markStatus(activityId, studentId) {
    const key = `${activityId}-${studentId}`;
    const current = marks[key] ?? "";
    const saved = savedMarks[key] ?? "";
    if (!current) return { label: "Empty", tone: "empty" };
    if (current === saved) return { label: "Saved", tone: "saved" };
    return { label: "Unsaved", tone: "unsaved" };
  }

  function statusBadgeClass(tone) {
    if (tone === "saved") {
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200";
    }
    if (tone === "unsaved") {
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200";
    }
    return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-200";
  }

  async function loadMarkGrid({ showSuccess = true } = {}) {
    setError("");
    try {
      const res = await getActivityMarkGrid(filters);
      const nextGrid = res?.data || { activities: [], students: [] };
      setGrid(nextGrid);
      const nextMarks = {};
      nextGrid.students.forEach((student) => {
        nextGrid.activities.forEach((activity) => {
          nextMarks[`${activity.id}-${student.student_id}`] = wholeNumberValue(student.marks?.[activity.id]);
        });
      });
      setMarks(nextMarks);
      setSavedMarks(nextMarks);
      if (showSuccess) {
        showNotice("Activity Marks Loaded", "Activity marks loaded successfully.");
      }
    } catch (err) {
      const message = err?.message || "Failed to load activity marks.";
      setError(message);
      showNotice("Load Failed", message, "error");
    }
  }

  async function saveMarksForActivity(activityId) {
    const rows = grid.students.map((student) => ({
      student_id: student.student_id,
      marks: wholeNumberValue(marks[`${activityId}-${student.student_id}`]),
    }));
    const activity = grid.activities.find((item) => Number(item.id) === Number(activityId));
    try {
      await saveActivityMarks(activityId, { ...filters, rows });
      await loadMarkGrid({ showSuccess: false });
      showNotice("Activity Marks Saved", `${activity?.name || "Activity"} marks saved successfully.`);
    } catch (err) {
      showNotice("Save Failed", err?.message || "Failed to save activity marks.", "error");
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

      <TopBar title="Activity Marks" subTitle="Enter marksheet activity marks per class section" />
      <Card>
        <CardHeader>
          <CardTitle>Activity Marks Entry</CardTitle>
          <CardDescription>Enter marks per student. Grades are calculated from Grade Settings.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-4">
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={filters.session_id}
              onChange={(e) => setFilters((p) => ({ ...p, session_id: e.target.value }))}
            >
              <option value="">Session</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
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
            <Button
              type="button"
              onClick={loadMarkGrid}
              disabled={!filters.session_id || !filters.class_id || !filters.section_id}
            >
              Load
            </Button>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {grid.activities.length ? (
            <div className="overflow-auto rounded-lg border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Student</th>
                    {grid.activities.map((activity) => (
                      <th key={activity.id} className="px-3 py-2 text-left">
                        {activity.name}
                      </th>
                    ))}
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {grid.students.map((student) => (
                    <tr key={student.student_id} className="border-t">
                      <td className="px-3 py-2 font-medium">
                        {student.roll_number}. {student.student_name}
                      </td>
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
                                [`${activity.id}-${student.student_id}`]:
                                  value === "" ? "" : value.replace(/\D/g, ""),
                              }));
                            }}
                          />
                          {(() => {
                            const status = markStatus(activity.id, student.student_id);
                            return (
                              <Badge
                                variant="outline"
                                className={`mt-1 rounded-full text-[10px] ${statusBadgeClass(status.tone)}`}
                              >
                                {status.label}
                              </Badge>
                            );
                          })()}
                        </td>
                      ))}
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-wrap gap-2 border-t p-3">
                {grid.activities.map((activity) => (
                  <Button
                    key={activity.id}
                    type="button"
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => saveMarksForActivity(activity.id)}
                  >
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
    </>
  );
}

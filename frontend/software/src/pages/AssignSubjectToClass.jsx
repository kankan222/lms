import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import TopBar from "../components/TopBar";
import { Button } from "../components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  assignSubjects,
  getSubjectOfferings,
  getSubjects,
  getClassSubjects,
} from "../api/subjects.api.js";
import { getClasses } from "../api/academic.api.js";

const subjectGroupLabels = {
  compulsory: "Compulsory",
  elective: "Elective",
  optional: "Optional",
};

const classScopeLabels = {
  school: "School",
  hs: "Higher Secondary",
};

const subjectGroupSelectStyles = {
  compulsory:
    "border-border bg-muted text-foreground dark:bg-muted/40",
  elective:
    "border-border bg-background text-foreground dark:bg-input/30",
  optional:
    "border-border bg-accent text-accent-foreground dark:bg-accent/40",
};

const ASSIGN_SUBJECT_CACHE_TTL_MS = 5 * 60 * 1000;
let assignSubjectCache = null;

function getAssignSubjectCache() {
  if (!assignSubjectCache) return null;
  if (Date.now() - assignSubjectCache.timestamp >= ASSIGN_SUBJECT_CACHE_TTL_MS) return null;
  return assignSubjectCache;
}

function setAssignSubjectCache(nextCache) {
  assignSubjectCache = {
    ...nextCache,
    timestamp: Date.now(),
  };
}

function patchAssignSubjectCache(patch) {
  if (!assignSubjectCache) return;
  setAssignSubjectCache({
    ...assignSubjectCache,
    ...patch,
  });
}

function subjectGroupBadgeClass(group) {
  const value = String(group || "").trim().toLowerCase();

  if (value === "compulsory") {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200";
  }

  if (value === "elective") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200";
  }

  if (value === "optional") {
    return "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-200";
  }

  return "border-border bg-muted text-muted-foreground dark:bg-muted/40";
}

function scopeBadgeClass(scope) {
  const value = String(scope || "").trim().toLowerCase();

  if (value === "hs") {
    return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-200";
  }

  if (value === "school") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200";
  }

  return "border-border bg-muted text-muted-foreground dark:bg-muted/40";
}

const AssignSubjectToClass = () => {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedSubjectGroups, setSelectedSubjectGroups] = useState({});
  const [assignError, setAssignError] = useState("");
  const [notice, setNotice] = useState(null);

  function showNotice(title, message, variant = "success") {
    setNotice({ title, message, variant });
  }

  async function loadSubjects() {
    const res = await getSubjects();
    const rows = Array.isArray(res?.data) ? res.data : [];
    setSubjects(rows);
    return rows;
  }

  async function loadClasses() {
    const res = await getClasses();
    const rows = Array.isArray(res?.data) ? res.data : [];
    setClasses(rows);
    return rows;
  }

  async function loadLegacyClassSubjectOfferings(classRows = classes) {
    const rows = [];

    for (const classRow of classRows) {
      try {
        const res = await getClassSubjects(classRow.id);
        const assigned = Array.isArray(res?.data) ? res.data : [];
        assigned.forEach((subject) => {
          rows.push({
            id: `legacy-${classRow.id}-${subject.id}`,
            class_id: classRow.id,
            class_name: classRow.name,
            section_id: null,
            section_name: null,
            stream_id: null,
            stream_name: null,
            subject_id: subject.id,
            subject_name: subject.name,
            subject_code: subject.code,
            subject_group: "compulsory",
          });
        });
      } catch {
        // Keep rendering any classes that can be read through the legacy endpoint.
      }
    }

    return rows;
  }

  async function loadOfferings() {
    try {
      const res = await getSubjectOfferings();
      const rows = Array.isArray(res?.data) ? res.data : [];
      setOfferings(rows);
      patchAssignSubjectCache({ offerings: rows });
      return rows;
    } catch (err) {
      const fallbackClasses = classes.length ? classes : await loadClasses();
      const fallbackRows = await loadLegacyClassSubjectOfferings(fallbackClasses);
      setOfferings(fallbackRows);
      patchAssignSubjectCache({ classes: fallbackClasses, offerings: fallbackRows });

      if (err?.message) {
        showNotice(
          "Using Existing Assignments",
          "Subject offering API is not available from the running backend. Restart backend or apply the latest server changes.",
          "error",
        );
      }

      return fallbackRows;
    }
  }

  const loadInitialData = useEffectEvent(() => {
    const cached = getAssignSubjectCache();
    if (cached) {
      setSubjects(cached.subjects);
      setClasses(cached.classes);
      setOfferings(cached.offerings);
      return;
    }

    async function load() {
      const [subjectRows, classRows] = await Promise.all([loadSubjects(), loadClasses()]);
      let offeringRows = [];
      try {
        const res = await getSubjectOfferings();
        offeringRows = Array.isArray(res?.data) ? res.data : [];
      } catch (err) {
        offeringRows = await loadLegacyClassSubjectOfferings(classRows);
        if (err?.message) {
          showNotice(
            "Using Existing Assignments",
            "Subject offering API is not available from the running backend. Restart backend or apply the latest server changes.",
            "error",
          );
        }
      }

      setAssignSubjectCache({
        subjects: subjectRows,
        classes: classRows,
        offerings: offeringRows,
      });
      setOfferings(offeringRows);
    }

    load();
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (!assignOpen || !selectedClass) return;

    let ignore = false;

    async function loadAssignedSubjects() {
      try {
        const res = await getClassSubjects(selectedClass);
        if (ignore) return;

        const assigned = Array.isArray(res?.data) ? res.data : [];
        setSelectedSubjects(
          assigned
            .map((item) => Number(item.id))
            .filter((id) => Number.isFinite(id)),
        );

        let offeringRows = [];
        try {
          const offeringsRes = await getSubjectOfferings({ classId: selectedClass });
          offeringRows = Array.isArray(offeringsRes?.data) ? offeringsRes.data : [];
        } catch {
          offeringRows = assigned.map((subject) => ({
            subject_id: subject.id,
            subject_group: "compulsory",
          }));
        }

        if (ignore) return;

        const groupMap = {};
        offeringRows.forEach((offering) => {
          groupMap[Number(offering.subject_id)] = offering.subject_group || "compulsory";
        });
        setSelectedSubjectGroups(groupMap);
      } catch {
        if (!ignore) {
          setSelectedSubjects([]);
          setSelectedSubjectGroups({});
        }
      }
    }

    loadAssignedSubjects();
    return () => {
      ignore = true;
    };
  }, [assignOpen, selectedClass]);

  const assignedClassCards = useMemo(() => {
    const grouped = new Map();
    const classMetaById = new Map(
      classes.map((item) => [
        String(item.id),
        {
          class_scope: item.class_scope || "school",
          scope_name: item.scope_name || null,
        },
      ]),
    );

    offerings.forEach((offering) => {
      const classKey = String(offering.class_id || offering.class_name || "unknown");
      const classMeta = classMetaById.get(String(offering.class_id)) || {};
      const existing = grouped.get(classKey) || {
        id: classKey,
        class_name: offering.class_name || "Unknown Class",
        class_scope: offering.class_scope || classMeta.class_scope || "school",
        scope_name: offering.scope_name || classMeta.scope_name || null,
        subjects: [],
      };

      existing.subjects.push({
        id: offering.id,
        subject_name: offering.subject_name,
        section_name: offering.section_name || "All Sections",
        stream_name: offering.stream_name || "All Streams",
        subject_group_key: offering.subject_group || "compulsory",
        subject_group: subjectGroupLabels[offering.subject_group] || offering.subject_group,
      });

      grouped.set(classKey, existing);
    });

    return Array.from(grouped.values()).map((item) => ({
      ...item,
      subjects: item.subjects.sort((a, b) => a.subject_name.localeCompare(b.subject_name)),
    }));
  }, [classes, offerings]);

  function resetAssignDialog() {
    setAssignError("");
    setSelectedClass("");
    setSelectedSubjects([]);
    setSelectedSubjectGroups({});
  }

  async function handleAssign() {
    setAssignError("");

    if (!selectedClass) {
      setAssignError("Class is required.");
      return;
    }

    if (selectedSubjects.length === 0) {
      setAssignError("Select at least one subject.");
      return;
    }

    try {
      await assignSubjects({
        classId: selectedClass,
        subjectIds: selectedSubjects,
        subjectGroups: selectedSubjectGroups,
      });
      await loadOfferings();
    } catch (err) {
      const message = err?.message || "Failed to assign subjects.";
      setAssignError(message);
      showNotice("Assign Failed", message, "error");
      return;
    }

    setAssignOpen(false);
    resetAssignDialog();
    showNotice("Subjects Assigned", "Subjects assigned to the selected class successfully.");
  }

  function openAssignDialogForClass(classId = "") {
    setAssignError("");
    setSelectedClass(classId);
    setAssignOpen(true);
  }

  return (
    <>
      <div className="pointer-events-none fixed top-6 right-6 z-50 w-full max-w-sm">
        <div
          className={`transition-all duration-500 ease-out ${
            notice ? "translate-x-0 scale-100 opacity-100" : "translate-x-12 scale-95 opacity-0"
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
        title="Assign Subject to Class"
        subTitle="Manage class-level subject assignments and subject type"
        action={
          <Dialog
            open={assignOpen}
            onOpenChange={(open) => {
              setAssignOpen(open);
              if (!open) resetAssignDialog();
            }}
          >
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-sm">Assign Subjects</Button>
            </DialogTrigger>

            <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl">
              <DialogHeader>
                <DialogTitle>Assign Subjects to Class</DialogTitle>
                <DialogDescription>
                  Select the subjects offered by this class and mark whether each one is compulsory, elective, or optional.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div>
                  <Label className="text-sm font-medium text-foreground">Class *</Label>
                  <select
                    className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30"
                    value={selectedClass}
                    onChange={(e) => {
                      setSelectedClass(e.target.value);
                      setSelectedSubjects([]);
                      setSelectedSubjectGroups({});
                    }}
                  >
                    <option value="">Select Class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-sm font-medium text-foreground">Subjects *</Label>
                  <div className="grid gap-2 mt-2">
                    {subjects.map((subject) => {
                      const checked = selectedSubjects.includes(subject.id);

                      return (
                        <label
                          key={subject.id}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                            checked
                              ? "border-foreground/20 bg-muted/70 text-foreground shadow-sm dark:border-border dark:bg-muted/30"
                              : "border-border bg-background text-foreground hover:bg-muted/40 dark:bg-background dark:hover:bg-muted/20"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            className="size-4 rounded border-border accent-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:accent-stone-300 dark:focus-visible:ring-offset-background"
                            onChange={() => {
                              if (checked) {
                                setSelectedSubjects((prev) => prev.filter((id) => id !== subject.id));
                                setSelectedSubjectGroups((prev) => {
                                  const next = { ...prev };
                                  delete next[subject.id];
                                  return next;
                                });
                              } else {
                                setSelectedSubjects((prev) => [...prev, subject.id]);
                                setSelectedSubjectGroups((prev) => ({
                                  ...prev,
                                  [subject.id]: prev[subject.id] || "compulsory",
                                }));
                              }
                            }}
                          />

                          <span className="flex-1">
                            {subject.name} ({subject.code})
                          </span>

                          {checked ? (
                            <select
                              className={`rounded-xl border px-2 py-1 text-sm capitalize shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ${
                                subjectGroupSelectStyles[selectedSubjectGroups[subject.id] || "compulsory"]
                              }`}
                              value={selectedSubjectGroups[subject.id] || "compulsory"}
                              onChange={(e) =>
                                setSelectedSubjectGroups((prev) => ({
                                  ...prev,
                                  [subject.id]: e.target.value,
                                }))
                              }
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="compulsory">Compulsory</option>
                              <option value="elective">Elective</option>
                              <option value="optional">Optional</option>
                            </select>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {assignError && <p className="text-sm text-red-600">{assignError}</p>}

              <DialogFooter>
                <Button className="rounded-xl shadow-sm" onClick={handleAssign}>Assign</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="space-y-4">
        {assignedClassCards.length === 0 ? (
          <Card className="rounded-2xl border border-dashed border-border/70 bg-card shadow-sm">
            <CardContent className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <ClipboardList className="size-6" />
              </div>

              <div className="space-y-1">
                <CardTitle>No assigned subjects</CardTitle>
                <CardDescription>
                  Assign subjects such as Assamese, Mathematics, or Physics before exams and student subject choices are configured.
                </CardDescription>
              </div>

              <Button className="rounded-xl shadow-sm" onClick={() => openAssignDialogForClass()}>
                Assign Subjects
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {assignedClassCards.map((item) => {
              const scopeKey = String(item.class_scope || "school").toLowerCase();
              const scopeLabel =
                item.scope_name ||
                classScopeLabels[scopeKey] ||
                "Class";

              return (
                <Card
                  key={item.id}
                  className="gap-0 rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md"
                >
                  <CardHeader className="p-4 pb-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base tracking-tight">{item.class_name}</CardTitle>
                        <CardDescription>
                          {item.subjects.length} subject{item.subjects.length === 1 ? "" : "s"}
                        </CardDescription>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`rounded-full ${scopeBadgeClass(scopeKey)}`}
                        >
                          {scopeLabel}
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-xl px-3"
                          onClick={() => openAssignDialogForClass(item.id)}
                        >
                          Assign/Edit
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 p-4 pt-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
                      {item.subjects.map((subject, index) => (
                        <span key={subject.id} className="inline-flex items-center gap-2">
                          {index > 0 ? (
                            <span className="text-border" aria-hidden="true">
                              |
                            </span>
                          ) : null}
                          <span className="font-medium text-foreground">{subject.subject_name}</span>
                          <Badge
                            variant="outline"
                            className={`rounded-full px-2 py-0 text-[11px] ${subjectGroupBadgeClass(subject.subject_group_key)}`}
                          >
                            {subject.subject_group}
                          </Badge>
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default AssignSubjectToClass;

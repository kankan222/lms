import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  RefreshCcw,
  Send,
  SlidersHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import TopBar from "../components/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getClassStructure, getSessions, getStreams } from "../api/academic.api";
import { getClassSubjects, getSubjectOfferings } from "../api/subjects.api";
import { getAssignedTeachers, getTeachers } from "../api/teachers.api";
import { getExamById, getExams } from "../api/exam.api";
import { getActivities } from "../api/marksheet.api";
import { useAuth } from "../hooks/useAuth";
import {
  createClassRoutine,
  createExamRoutine,
  createTimeSlotTemplate,
  deleteClassRoutine,
  deleteExamRoutine,
  deleteTimeSlotTemplate,
  downloadClassRoutineXlsx,
  downloadExamRoutinePdf,
  getClassRoutine,
  getClassRoutineBoard,
  getClassRoutines,
  getExamRoutine,
  getExamRoutines,
  getTimeSlotTemplate,
  getTimeSlotTemplates,
  importClassRoutineSheet,
  importExamRoutineSheet,
  publishClassRoutine,
  publishExamRoutine,
  updateClassRoutineSlot,
  updateExamRoutine,
  updateTimeSlotTemplate,
} from "../api/routines.api";

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30";

const statusClass = {
  draft: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200",
  published: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200",
  archived: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-200",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200",
};

const weekdays = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "7", label: "Sunday" },
];

const weekdayColumns = weekdays.slice(0, 6);

function normalizeClassScopeValue(value) {
  const scope = String(value || "").trim().toLowerCase();
  if (scope === "higher_secondary" || scope === "higher-secondary") return "hs";
  if (scope === "hs" || scope === "school") return scope;
  return "";
}

function getExamClassScopes(exam) {
  const scopes = String(exam?.class_scope || "")
    .split(",")
    .map(normalizeClassScopeValue)
    .filter(Boolean);
  return scopes.length ? [...new Set(scopes)] : ["school"];
}

function examMatchesClassScope(exam, classScope) {
  const scope = normalizeClassScopeValue(classScope);
  if (!scope) return true;
  return getExamClassScopes(exam).includes(scope);
}

const emptyExamEntry = {
  exam_date: "",
  start_time: "08:00",
  end_time: "10:00",
  entry_type: "subject",
  subject_id: "",
  exam_subject_id: "",
  invigilator_id: "",
  title: "",
  room: "",
};

function createInitialExamForm() {
  return {
    class_scope: "school",
    exam_id: "",
    class_id: "",
    section_id: "",
    medium: "",
    stream_id: "",
    publish_announcement_requested: false,
    entries: [{ ...emptyExamEntry }],
  };
}

function createInitialTemplateForm() {
  return {
    name: "",
    scope_level: "school",
    slots: [
      { weekday: "", period_number: "1", label: "Period 1", start_time: "08:00", end_time: "08:40", default_entry_type: "subject" },
      { weekday: "", period_number: "2", label: "Break", start_time: "10:25", end_time: "10:45", default_entry_type: "break" },
    ],
  };
}

function unwrap(payload) {
  return payload?.data || [];
}

function toNumberOrNull(value) {
  return value === "" || value === undefined || value === null ? null : Number(value);
}

function isActiveSession(session) {
  return Boolean(
    session?.is_active ||
    session?.isActive ||
    session?.active ||
    session?.is_current ||
    String(session?.status || "").toLowerCase() === "active"
  );
}

function dateInputValue(value) {
  return value ? String(value).slice(0, 10) : "";
}

function timeInputValue(value, fallback = "") {
  return value ? String(value).slice(0, 5) : fallback;
}

function displayChangeType(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function timeFromMinutes(minutes) {
  const normalized = Math.max(0, minutes);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function fallbackSlotTime(period) {
  const start = 8 * 60 + (Number(period) - 1) * 40;
  return {
    start_time: timeFromMinutes(start),
    end_time: timeFromMinutes(start + 40),
  };
}

function entryTitle(entry) {
  return entry.title || entry.subject_name || entry.activity_name || displayChangeType(entry.entry_type);
}

function isBreakEntry(entry) {
  return entry?.entry_type === "break" || entry?.slot_default_entry_type === "break";
}

function isBreakSlot(slot) {
  return slot?.default_entry_type === "break" || Boolean(slot?.is_break);
}

function uniqueCsv(value) {
  const seen = new Set();
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    })
    .join(", ");
}

function entrySubtitle(entry, showTeachers = true) {
  if (isBreakEntry(entry)) return "Break";
  if (!showTeachers) return "";
  return uniqueCsv(entry.teacher_names) || "Teacher not assigned";
}

function displaySlotLabel({ entry, slot, period, displayPeriodLabel }) {
  const slotLabel = String(slot?.label || entry?.slot_label || "").trim();
  const isBreak = isBreakEntry(entry) || isBreakSlot(slot);
  if (isBreak) return slotLabel || "Break";
  if (displayPeriodLabel) return displayPeriodLabel;
  if (slotLabel && !/^period\s+\d+$/i.test(slotLabel)) return slotLabel;
  const entryTitleText = String(entry?.title || "").trim();
  if (entryTitleText && entry?.entry_type !== "subject") return entryTitleText;
  return `Period ${period}`;
}

function buildDisplayPeriodLabels(periods, entries = [], templateSlots = []) {
  let classPeriod = 0;
  return periods.reduce((map, period) => {
    const firstEntry = entries.find((entry) => Number(entry.period_number) === Number(period));
    const firstSlot = templateSlots.find((slot) => Number(slot.period_number) === Number(period));
    if (isBreakEntry(firstEntry) || isBreakSlot(firstSlot)) {
      map.set(period, displaySlotLabel({ entry: firstEntry, slot: firstSlot, period }));
      return map;
    }
    classPeriod += 1;
    map.set(period, `Period ${classPeriod}`);
    return map;
  }, new Map());
}

function uniqueCount(values) {
  return new Set(values.filter(Boolean).map((value) => String(value))).size;
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }) {
  return (
    <Badge variant="outline" className={statusClass[status] || statusClass.archived}>
      {status || "unknown"}
    </Badge>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
      <CalendarClock className="mb-3 size-8 text-muted-foreground" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function RoutineCard({ children }) {
  return (
    <Card className="rounded-lg border-border shadow-sm">
      {children}
    </Card>
  );
}

function RoutineEntryBlock({ entry, showTeachers = true }) {
  const isBreak = isBreakEntry(entry);
  const isFree = !entry || entry.entry_type === "free";
  const subtitle = !isFree ? entrySubtitle(entry, showTeachers) : "";
  return (
    <div
      className={[
        "flex min-h-14 min-w-0 items-center rounded-md border px-2 py-2 text-xs transition-colors",
        isBreak ? "border-border bg-muted/50" : isFree ? "border-dashed border-border bg-background hover:bg-muted/20" : "border-border bg-card shadow-xs",
      ].join(" ")}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {isFree ? (
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/20">
            <Plus className="size-4 text-muted-foreground" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className={["truncate font-semibold", isFree || isBreak ? "text-muted-foreground" : "text-foreground"].join(" ")}>
            {isFree ? "Add class" : entryTitle(entry)}
          </p>
          {!isFree && subtitle ? <p className="mt-0.5 truncate text-muted-foreground">{subtitle}</p> : null}
          {!isFree && entry.room ? <p className="mt-1 truncate text-muted-foreground">{entry.room}</p> : null}
        </div>
      </div>
    </div>
  );
}

function RoutineSlotTooltipContent({ entries = [], showTeachers = true }) {
  return (
    <div className="max-h-72 max-w-80 space-y-2 overflow-y-auto pr-1 text-left">
      {entries.map((entry, index) => {
        const subtitle = entrySubtitle(entry, showTeachers);
        return (
          <div
            key={entry.id || entry.entry_id || `${entry.entry_type}-${entry.subject_id || entry.title || index}`}
            className="rounded-md border border-border bg-background px-2.5 py-2 shadow-xs"
          >
            <p className="text-xs font-semibold leading-tight">{entryTitle(entry)}</p>
            {subtitle ? <p className="text-[11px] leading-tight opacity-80">{subtitle}</p> : null}
            {entry.room ? <p className="text-[11px] leading-tight opacity-80">{entry.room}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function RoutineSlotBlock({ entries = [], fallbackEntry = null, showTeachers = true }) {
  const visibleEntries = entries.length ? entries : fallbackEntry ? [fallbackEntry] : [];
  if (!visibleEntries.length) return <RoutineEntryBlock entry={null} />;
  const [primaryEntry, ...extraEntries] = visibleEntries;
  const entryBlock = (
    <div className="relative">
      <RoutineEntryBlock entry={primaryEntry} showTeachers={showTeachers} />
      {extraEntries.length ? (
        <span className="absolute right-1 top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-border bg-background px-1 text-[10px] font-semibold text-muted-foreground shadow-xs">
          +{extraEntries.length}
        </span>
      ) : null}
    </div>
  );

  if (!extraEntries.length) return entryBlock;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{entryBlock}</TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={6}
        className="border border-border bg-popover px-2 py-2 text-popover-foreground shadow-lg"
      >
        <RoutineSlotTooltipContent entries={visibleEntries} showTeachers={showTeachers} />
      </TooltipContent>
    </Tooltip>
  );
}

function ClassRoutineBoard({ routine, templateSlots = [], onSlotClick, showTeachers = true }) {
  const entries = Array.isArray(routine?.entries) ? routine.entries : [];
  const periods = [
    ...new Set(
      entries
        .map((entry) => Number(entry.period_number))
        .concat(templateSlots.map((slot) => Number(slot.period_number)))
        .filter(Boolean)
    ),
  ]
    .sort((a, b) => a - b);
  const rows = periods.length ? periods : [1, 2, 3, 4, 5, 6, 7];
  const displayPeriodLabels = buildDisplayPeriodLabels(rows, entries, templateSlots);
  const byDayPeriod = entries.reduce((map, entry) => {
    const key = `${entry.weekday}-${entry.period_number}`;
    const current = map.get(key) || [];
    current.push(entry);
    map.set(key, current);
    return map;
  }, new Map());
  const slotFor = (day, period) =>
    templateSlots.find((slot) => Number(slot.period_number) === Number(period) && Number(slot.weekday) === Number(day)) ||
    templateSlots.find((slot) => Number(slot.period_number) === Number(period) && !slot.weekday) ||
    null;
  const periodMeta = (period) => {
    const firstEntry = entries.find((entry) => Number(entry.period_number) === Number(period));
    const firstSlot = templateSlots.find((slot) => Number(slot.period_number) === Number(period));
    const timeSource = firstEntry || firstSlot;
    const displayPeriodLabel = displayPeriodLabels.get(period);
    return {
      label: displaySlotLabel({ entry: firstEntry, slot: firstSlot, period, displayPeriodLabel }),
      time: timeSource ? `${String(timeSource.start_time).slice(0, 5)} - ${String(timeSource.end_time).slice(0, 5)}` : "",
    };
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div
        className="grid w-full border-b border-border bg-muted/20"
        style={{ gridTemplateColumns: `88px repeat(${rows.length}, minmax(0, 1fr))` }}
      >
        <div className="px-2 py-3 text-center text-xs font-semibold text-foreground">Day</div>
        {rows.map((period) => {
          const meta = periodMeta(period);
          return (
            <div key={period} className="min-w-0 border-l border-border px-2 py-3 text-center text-xs font-semibold text-foreground">
              <div className="truncate">{meta.label}</div>
              {meta.time ? <div className="mt-1 truncate text-[11px] font-normal text-muted-foreground">{meta.time}</div> : null}
            </div>
          );
        })}
      </div>
      <div className="w-full">
        {weekdayColumns.map((day) => (
          <div
            key={day.value}
            className="grid border-b border-border last:border-b-0"
            style={{ gridTemplateColumns: `88px repeat(${rows.length}, minmax(0, 1fr))` }}
          >
            <div className="flex min-w-0 items-center justify-center px-2 py-3 text-center">
              <span className="truncate text-sm font-semibold text-foreground">{day.label}</span>
            </div>
            {rows.map((period) => {
                const slotEntries = byDayPeriod.get(`${day.value}-${period}`) || [];
                const slot = slotFor(day.value, period);
                const meta = periodMeta(period);
                return (
                  <button
                    key={`${day.value}-${period}`}
                    type="button"
                    className="min-w-0 border-l border-border p-1.5 text-left outline-none transition-colors hover:bg-muted/20 focus-visible:bg-muted/30"
                    onClick={() => onSlotClick?.({ day, period, displayPeriodLabel: meta.label, entries: slotEntries, entry: slotEntries[0] || null, slot })}
                  >
                    <RoutineSlotBlock
                      entries={slotEntries}
                      fallbackEntry={slot?.default_entry_type === "break" ? { entry_type: "break", title: slot.label } : null}
                      showTeachers={showTeachers}
                    />
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

function routineClassLabel(routine) {
  return `${routine?.class_name || "Class"}${routine?.section_name ? ` (${routine.section_name})` : ""}`;
}

function routineScopeLabel(routine) {
  return [routine?.medium, routine?.stream_name].filter(Boolean).join(" / ");
}

function ClassRoutineDayBoard({ board, weekday, onSlotClick, showTeachers = true }) {
  const selectedWeekday = Number(weekday);
  const dayMeta = (board?.weekdays || []).find((day) => Number(day.weekday) === selectedWeekday) ||
    weekdayColumns.find((day) => Number(day.value) === selectedWeekday) ||
    { label: "Day" };
  const routines = (board?.scopes || []).flatMap((scope) => {
    const day = (scope.weekdays || []).find((item) => Number(item.weekday) === selectedWeekday);
    return day?.routines || [];
  });
  const periods = [
    ...new Set(
      routines
        .flatMap((routine) => routine.entries || [])
        .map((entry) => Number(entry.period_number))
        .filter(Boolean)
    ),
  ].sort((a, b) => a - b);
  const rows = periods.length ? periods : [1, 2, 3, 4, 5, 6, 7];
  const allEntries = routines.flatMap((routine) => routine.entries || []);
  const displayPeriodLabels = buildDisplayPeriodLabels(rows, allEntries);
  const periodMeta = (period) => {
    const firstEntry = allEntries.find((entry) => Number(entry.period_number) === Number(period));
    const displayPeriodLabel = displayPeriodLabels.get(period);
    return {
      label: displaySlotLabel({ entry: firstEntry, period, displayPeriodLabel }),
      time: firstEntry ? `${String(firstEntry.start_time).slice(0, 5)} - ${String(firstEntry.end_time).slice(0, 5)}` : "",
    };
  };

  if (!routines.length) {
    return <EmptyState title="No day routine found" description="No class routine entries are available for the selected day and filters." />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div
        className="grid w-full border-b border-border bg-muted/20"
        style={{ gridTemplateColumns: `132px repeat(${rows.length}, minmax(0, 1fr))` }}
      >
        <div className="px-2 py-3 text-center text-xs font-semibold text-foreground">{dayMeta.label}</div>
        {rows.map((period) => {
          const meta = periodMeta(period);
          return (
            <div key={period} className="min-w-0 border-l border-border px-2 py-3 text-center text-xs font-semibold text-foreground">
              <div className="truncate">{meta.label}</div>
              {meta.time ? <div className="mt-1 truncate text-[11px] font-normal text-muted-foreground">{meta.time}</div> : null}
            </div>
          );
        })}
      </div>
      <div className="w-full">
        {routines.map((routine) => {
          const entriesByPeriod = (routine.entries || []).reduce((map, entry) => {
            const key = Number(entry.period_number);
            const current = map.get(key) || [];
            current.push(entry);
            map.set(key, current);
            return map;
          }, new Map());
          return (
            <div
              key={routine.routine_version_id}
              className="grid border-b border-border last:border-b-0"
              style={{ gridTemplateColumns: `132px repeat(${rows.length}, minmax(0, 1fr))` }}
            >
              <div className="flex min-w-0 flex-col justify-center px-2 py-3 text-center">
                <span className="truncate text-sm font-semibold text-foreground">{routineClassLabel(routine)}</span>
                {routineScopeLabel(routine) ? (
                  <span className="mt-0.5 truncate text-[11px] text-muted-foreground">{routineScopeLabel(routine)}</span>
                ) : null}
              </div>
              {rows.map((period) => {
                const slotEntries = entriesByPeriod.get(period) || [];
                const meta = periodMeta(period);
                return (
                  <button
                    key={`${routine.routine_version_id}-${period}`}
                    type="button"
                    className="min-w-0 border-l border-border p-1.5 text-left outline-none transition-colors hover:bg-muted/20 focus-visible:bg-muted/30"
                    onClick={() => onSlotClick?.({
                      day: { value: String(selectedWeekday), label: dayMeta.label },
                      period,
                      displayPeriodLabel: meta.label,
                      entries: slotEntries,
                      entry: slotEntries[0] || null,
                      slot: null,
                      routine: { ...routine, id: routine.routine_version_id },
                    })}
                  >
                    <RoutineSlotBlock entries={slotEntries} showTeachers={showTeachers} />
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function examEntryTitle(entry) {
  return entry.title || entry.subject_name || displayChangeType(entry.entry_type || "subject");
}

function weekdayFromDate(value) {
  const dateValue = dateInputValue(value);
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { weekday: "long" });
}

function ExamRoutineBoard({ routine }) {
  const entries = Array.isArray(routine?.entries) ? routine.entries : [];
  const groupedEntries = entries.reduce((groups, entry) => {
    const key = dateInputValue(entry.exam_date) || "Unscheduled";
    const current = groups.get(key) || [];
    current.push(entry);
    groups.set(key, current);
    return groups;
  }, new Map());
  const rows = [...groupedEntries.entries()]
    .sort(([dateA], [dateB]) => String(dateA).localeCompare(String(dateB)))
    .map(([date, items]) => ({
      date,
      entries: items.sort((a, b) =>
        String(a.start_time || "").localeCompare(String(b.start_time || "")) ||
        String(a.class_name || "").localeCompare(String(b.class_name || ""), undefined, { numeric: true, sensitivity: "base" }) ||
        String(a.section_name || "").localeCompare(String(b.section_name || ""), undefined, { numeric: true, sensitivity: "base" })
      ),
    }));

  if (!rows.length) {
    return <EmptyState title="No exam rows added" description="Create or import exam routine rows for this routine." />;
  }

  const displayRows = rows.flatMap((row) =>
    row.entries.map((entry, index) => ({
      date: row.date,
      showDate: index === 0,
      entry,
    }))
  );

  return (
    <div className="min-w-[720px] overflow-hidden rounded-lg border border-border bg-card text-xs">
      <div className="grid border-b border-border bg-muted/20" style={{ gridTemplateColumns: "132px minmax(0,1fr) 132px" }}>
        <div className="px-3 py-3 text-center font-semibold text-foreground">Date</div>
        <div className="border-l border-border px-3 py-3 font-semibold text-foreground">Subject / Invigilator</div>
        <div className="border-l border-border px-3 py-3 text-center font-semibold text-foreground">Time</div>
      </div>
      <div>
        {displayRows.map(({ date, showDate, entry }) => (
          <div
            key={entry.id || `${date}-${entry.subject_id}-${entry.start_time}-${entry.sort_order}`}
            className="grid min-h-[56px] border-b border-border last:border-b-0"
            style={{ gridTemplateColumns: "132px minmax(0,1fr) 132px" }}
          >
            <div className="flex min-w-0 flex-col justify-center px-3 py-3 text-center">
              {showDate ? (
                <>
                  <span className="truncate text-sm font-semibold text-foreground">{date}</span>
                  {weekdayFromDate(date) ? <span className="mt-1 truncate text-[11px] text-muted-foreground">{weekdayFromDate(date)}</span> : null}
                </>
              ) : null}
            </div>
            <div className="min-w-0 border-l border-border px-3 py-2.5">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{examEntryTitle(entry)}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{entry.invigilator_names || "No invigilator"}{entry.room ? ` / ${entry.room}` : ""}</p>
                </div>
                {entry.entry_type && entry.entry_type !== "subject" ? (
                  <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                    {displayChangeType(entry.entry_type)}
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-center border-l border-border px-2 py-2.5 text-center text-xs font-semibold text-foreground">
              {timeInputValue(entry.start_time, "--:--")} - {timeInputValue(entry.end_time, "--:--")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileField({ file, onChange }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 p-4">
      <Input
        type="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      <p className="mt-2 text-xs text-muted-foreground">
        {file ? file.name : "Upload an XLSX or CSV sheet exported from your routine workbook."}
      </p>
    </div>
  );
}

export default function Routines() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("class");
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [streams, setStreams] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [exams, setExams] = useState([]);
  const [examSubjectOptions, setExamSubjectOptions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [classRoutines, setClassRoutines] = useState([]);
  const [classRoutineBoard, setClassRoutineBoard] = useState(null);
  const [examRoutines, setExamRoutines] = useState([]);
  const [selectedClassRoutineId, setSelectedClassRoutineId] = useState("");
  const [selectedClassRoutine, setSelectedClassRoutine] = useState(null);
  const [selectedExamRoutineExamKey, setSelectedExamRoutineExamKey] = useState("");
  const [selectedExamRoutineId, setSelectedExamRoutineId] = useState("");
  const [selectedExamRoutine, setSelectedExamRoutine] = useState(null);
  const [classViewMode, setClassViewMode] = useState("week");
  const [selectedClassDay, setSelectedClassDay] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [classOpen, setClassOpen] = useState(false);
  const [examOpen, setExamOpen] = useState(false);
  const [editingExamRoutineId, setEditingExamRoutineId] = useState(null);
  const [classImportOpen, setClassImportOpen] = useState(false);
  const [examImportOpen, setExamImportOpen] = useState(false);
  const [classImportFile, setClassImportFile] = useState(null);
  const [examImportFile, setExamImportFile] = useState(null);
  const [selectedTemplateSlots, setSelectedTemplateSlots] = useState([]);
  const [slotEditorOpen, setSlotEditorOpen] = useState(false);
  const [slotContext, setSlotContext] = useState(null);
  const [slotSubjects, setSlotSubjects] = useState([]);
  const [slotTeacherOptions, setSlotTeacherOptions] = useState({});
  const [slotForm, setSlotForm] = useState({
    entry_type: "subject",
    activity_id: "",
    custom_title: "",
    custom_teacher_id: "",
    customRows: [{ key: "custom-1", title: "", teacher_id: "" }],
    save_mode: "replace",
    weekdays: [],
    subjectRows: [{ key: "subject-1", subject_id: "", teacher_id: "" }],
  });

  const [filters, setFilters] = useState({
    session_id: "",
    class_id: "",
    section_id: "",
    medium: "",
    stream_id: "",
    status: "",
  });

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters]
  );

  const slotSubjectIds = useMemo(
    () => [...new Set(
      (slotForm.subjectRows || [])
        .map((row) => row.subject_id)
        .filter(Boolean)
        .map((subjectId) => String(subjectId))
    )],
    [slotForm.subjectRows]
  );

  const slotSubjectIdsKey = useMemo(() => slotSubjectIds.join(","), [slotSubjectIds]);

  const [templateForm, setTemplateForm] = useState(createInitialTemplateForm);

  const [classForm, setClassForm] = useState({
    session_id: "",
    class_id: "",
    section_id: "",
    medium: "",
    stream_id: "",
    layout_mode: "standard",
    time_slot_template_id: "",
  });

  const [examForm, setExamForm] = useState(createInitialExamForm);

  const selectedClass = useMemo(
    () => classes.find((item) => String(item.id) === String(classForm.class_id)),
    [classes, classForm.class_id]
  );

  const selectedExamClass = useMemo(
    () => classes.find((item) => String(item.id) === String(examForm.class_id)),
    [classes, examForm.class_id]
  );
  const selectedRoutineClass = useMemo(
    () => classes.find((item) => String(item.id) === String(selectedClassRoutine?.class_id)),
    [classes, selectedClassRoutine?.class_id]
  );
  const isPackedClassForm = selectedClass?.class_scope === "hs" && classForm.layout_mode === "packed_hs";
  const isPackedSelectedRoutine = selectedClassRoutine?.layout_mode === "packed_hs";

  const examScopeClasses = useMemo(
    () => classes.filter((item) => String(item.class_scope || "school") === String(examForm.class_scope || "school")),
    [classes, examForm.class_scope]
  );

  const scopedExams = useMemo(
    () => exams.filter((exam) => examMatchesClassScope(exam, examForm.class_scope)),
    [exams, examForm.class_scope]
  );

  const filterClass = useMemo(
    () => classes.find((item) => String(item.id) === String(filters.class_id)),
    [classes, filters.class_id]
  );

  const selectedRoutineSummary = useMemo(() => {
    const entries = Array.isArray(selectedClassRoutine?.entries) ? selectedClassRoutine.entries : [];
    const subjectEntries = entries.filter((entry) => entry.entry_type === "subject");
    const periodKey = (entry) => `${entry.weekday}-${entry.period_number}`;
    const totalPeriodKeys = uniqueCount(entries.map(periodKey));
    const assignedPeriodKeys = uniqueCount(entries.filter((entry) => entry.entry_type !== "free").map(periodKey));
    const freePeriodKeys = uniqueCount(entries.filter((entry) => entry.entry_type === "free").map(periodKey));
    return {
      totalPeriods: totalPeriodKeys || selectedClassRoutine?.entry_count || 0,
      assignedPeriods: assignedPeriodKeys,
      freePeriods: freePeriodKeys,
      subjects: uniqueCount(subjectEntries.map((entry) => entry.subject_id || entry.subject_name)),
      teachers: uniqueCount(entries.flatMap((entry) => entry.teacher_ids || []).concat(entries.map((entry) => entry.teacher_names))),
    };
  }, [selectedClassRoutine]);

  const selectedClassDayMeta = useMemo(
    () => weekdayColumns.find((day) => String(day.value) === String(selectedClassDay)) || { label: "Day" },
    [selectedClassDay]
  );

  const selectedClassDaySummary = useMemo(() => {
    const selectedWeekday = Number(selectedClassDay);
    const routines = (classRoutineBoard?.scopes || []).flatMap((scope) => {
      const day = (scope.weekdays || []).find((item) => Number(item.weekday) === selectedWeekday);
      return day?.routines || [];
    });
    const periodRows = routines.flatMap((routine) =>
      (routine.entries || []).map((entry) => ({
        routineId: routine.routine_version_id || routine.id,
        entry,
      }))
    );
    const periodKey = (row) => `${row.routineId || "routine"}-${row.entry.period_number}`;
    return {
      totalPeriods: uniqueCount(periodRows.map(periodKey)),
      assignedPeriods: uniqueCount(periodRows.filter((row) => row.entry.entry_type !== "free").map(periodKey)),
      freePeriods: uniqueCount(periodRows.filter((row) => row.entry.entry_type === "free").map(periodKey)),
    };
  }, [classRoutineBoard, selectedClassDay]);

  const visibleClassRoutineSummary = classViewMode === "day" ? selectedClassDaySummary : selectedRoutineSummary;

  const showRoutineTeachers = useMemo(() => {
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    return !roles.some((role) => ["student", "parent"].includes(String(role).toLowerCase()));
  }, [user?.roles]);

  const routineNavigationItems = useMemo(
    () => [...classRoutines].sort((a, b) =>
      Number(a.class_id || 0) - Number(b.class_id || 0) ||
      String(a.section_name || "").localeCompare(String(b.section_name || ""), undefined, { numeric: true, sensitivity: "base" }) ||
      String(a.medium || "").localeCompare(String(b.medium || ""), undefined, { sensitivity: "base" }) ||
      Number(a.stream_id || 0) - Number(b.stream_id || 0)
    ),
    [classRoutines]
  );

  const selectedClassRoutineNavigationIndex = useMemo(
    () => routineNavigationItems.findIndex((routine) => String(routine.id) === String(selectedClassRoutineId)),
    [routineNavigationItems, selectedClassRoutineId]
  );

  const selectedClassRoutineHeader = useMemo(() => {
    if (!selectedClassRoutine) return "";
    return [
      selectedClassRoutine.class_name || "Class",
      selectedClassRoutine.section_name || "Section",
      selectedClassRoutine.medium,
      selectedClassRoutine.stream_name,
    ].filter(Boolean).join(" | ");
  }, [selectedClassRoutine]);

  const classRoutineHeaderLabel = classViewMode === "day"
    ? selectedClassDayMeta.label
    : selectedClassRoutineHeader || "Class Routine";

  const examRoutineNavigationItems = useMemo(
    () => [...examRoutines].sort((a, b) =>
      String(a.exam_name || "").localeCompare(String(b.exam_name || ""), undefined, { numeric: true, sensitivity: "base" }) ||
      String(a.class_scope || "").localeCompare(String(b.class_scope || ""), undefined, { numeric: true, sensitivity: "base" }) ||
      String(a.class_name || "").localeCompare(String(b.class_name || ""), undefined, { numeric: true, sensitivity: "base" }) ||
      String(a.section_name || "").localeCompare(String(b.section_name || ""), undefined, { numeric: true, sensitivity: "base" }) ||
      String(a.medium || "").localeCompare(String(b.medium || ""), undefined, { numeric: true, sensitivity: "base" }) ||
      String(a.stream_name || "").localeCompare(String(b.stream_name || ""), undefined, { numeric: true, sensitivity: "base" })
    ),
    [examRoutines]
  );

  const examRoutineExamGroups = useMemo(() => {
    const groups = new Map();
    examRoutineNavigationItems.forEach((routine) => {
      const key = String(routine.exam_id || routine.exam_name || "exam");
      const current = groups.get(key) || {
        key,
        exam_id: routine.exam_id || null,
        exam_name: routine.exam_name || "Exam",
        session_name: routine.session_name || "",
        routines: [],
      };
      current.routines.push(routine);
      groups.set(key, current);
    });
    return [...groups.values()];
  }, [examRoutineNavigationItems]);

  const selectedExamRoutineExamGroup = useMemo(
    () => examRoutineExamGroups.find((group) => group.key === selectedExamRoutineExamKey) || examRoutineExamGroups[0] || null,
    [examRoutineExamGroups, selectedExamRoutineExamKey]
  );

  const selectedExamRoutineClassItems = useMemo(
    () => selectedExamRoutineExamGroup?.routines || [],
    [selectedExamRoutineExamGroup]
  );

  const selectedExamRoutineNavigationIndex = useMemo(
    () => selectedExamRoutineClassItems.findIndex((routine) => String(routine.id) === String(selectedExamRoutineId)),
    [selectedExamRoutineClassItems, selectedExamRoutineId]
  );

  const selectedExamRoutineSummary = useMemo(() => {
    const entries = Array.isArray(selectedExamRoutine?.entries) ? selectedExamRoutine.entries : [];
    return {
      rows: entries.length || selectedExamRoutine?.entry_count || 0,
      subjects: uniqueCount(entries.map((entry) => entry.subject_id || entry.subject_name)),
      invigilators: uniqueCount(entries.flatMap((entry) => entry.invigilator_ids || []).concat(entries.map((entry) => entry.invigilator_names))),
    };
  }, [selectedExamRoutine]);

  const selectedExamRoutineHeader = useMemo(() => {
    if (!selectedExamRoutine) return "";
    const firstEntry = Array.isArray(selectedExamRoutine.entries) ? selectedExamRoutine.entries[0] : null;
    return [
      selectedExamRoutine.class_name || firstEntry?.class_name,
      selectedExamRoutine.section_name || firstEntry?.section_name,
      selectedExamRoutine.medium || firstEntry?.medium,
      selectedExamRoutine.stream_name || firstEntry?.stream_name,
    ].filter(Boolean).join(" | ");
  }, [selectedExamRoutine]);

  async function loadReferenceData() {
    const [sessionRes, classRes, streamRes, teacherRes, activityRes, examRes] = await Promise.all([
      getSessions(),
      getClassStructure(),
      getStreams(),
      getTeachers(),
      getActivities(),
      getExams({ class_scope: "school" }),
    ]);
    const nextSessions = unwrap(sessionRes);
    setSessions(nextSessions);
    setClassForm((current) => {
      if (current.session_id) return current;
      const activeSession = nextSessions.find(isActiveSession) || nextSessions[0];
      return activeSession?.id ? { ...current, session_id: String(activeSession.id) } : current;
    });
    setClasses(unwrap(classRes));
    setStreams(unwrap(streamRes));
    setTeachers(unwrap(teacherRes));
    setActivities(unwrap(activityRes));
    setExams(unwrap(examRes));
  }

  async function loadExamsForScope(classScope = examForm.class_scope) {
    const response = await getExams({ class_scope: classScope || "school" });
    const nextExams = unwrap(response);
    setExams(nextExams);
    return nextExams;
  }

  async function loadRoutineData(nextFilters = filters) {
    const cleanFilters = Object.fromEntries(
      Object.entries(nextFilters).filter(([, value]) => value !== "")
    );
    const [templateRes, classRes, examRoutineRes] = await Promise.all([
      getTimeSlotTemplates(),
      getClassRoutines(cleanFilters),
      getExamRoutines(cleanFilters),
    ]);
    const nextClassRoutines = unwrap(classRes);
    setTemplates(unwrap(templateRes));
    setClassRoutines(nextClassRoutines);
    if (!nextClassRoutines.length) setSelectedClassRoutine(null);
    setSelectedClassRoutineId((current) => {
      if (!nextClassRoutines.length) return "";
      if (current && nextClassRoutines.some((routine) => String(routine.id) === String(current))) return current;
      const preferred = nextClassRoutines.find((routine) => routine.status === "published") || nextClassRoutines[0];
      return preferred ? String(preferred.id) : "";
    });
    const nextExamRoutines = unwrap(examRoutineRes);
    setExamRoutines(nextExamRoutines);
    if (!nextExamRoutines.length) setSelectedExamRoutine(null);
  }

  async function loadClassRoutineBoardData(nextFilters = filters, weekday = selectedClassDay) {
    const cleanFilters = Object.fromEntries(
      Object.entries(nextFilters).filter(([, value]) => value !== "")
    );
    const response = await getClassRoutineBoard({ ...cleanFilters, weekday });
    setClassRoutineBoard(response.data || null);
  }

  async function loadAll(nextFilters = filters) {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadReferenceData(), loadRoutineData(nextFilters)]);
    } catch (err) {
      showError(err.message || "Failed to load routines");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadAll();
    }, 0);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedClassRoutineId) return;
    let active = true;
    getClassRoutine(selectedClassRoutineId)
      .then((response) => {
        if (active) setSelectedClassRoutine(response.data || null);
      })
      .catch((err) => {
        if (active) {
          setSelectedClassRoutine(classRoutines.find((routine) => String(routine.id) === String(selectedClassRoutineId)) || null);
          showError(err.message || "Failed to load selected class routine");
        }
      });
    return () => {
      active = false;
    };
  }, [classRoutines, selectedClassRoutineId]);

  useEffect(() => {
    if (!examRoutineExamGroups.length) {
      setSelectedExamRoutineExamKey("");
      setSelectedExamRoutineId("");
      return;
    }
    setSelectedExamRoutineExamKey((current) => {
      if (current && examRoutineExamGroups.some((group) => group.key === current)) return current;
      const groupWithPublished = examRoutineExamGroups.find((group) =>
        group.routines.some((routine) => routine.status === "published")
      );
      return (groupWithPublished || examRoutineExamGroups[0])?.key || "";
    });
  }, [examRoutineExamGroups]);

  useEffect(() => {
    if (!selectedExamRoutineClassItems.length) {
      setSelectedExamRoutineId("");
      return;
    }
    setSelectedExamRoutineId((current) => {
      if (current && selectedExamRoutineClassItems.some((routine) => String(routine.id) === String(current))) return current;
      const preferred = selectedExamRoutineClassItems.find((routine) => routine.status === "published") || selectedExamRoutineClassItems[0];
      return preferred ? String(preferred.id) : "";
    });
  }, [selectedExamRoutineClassItems]);

  useEffect(() => {
    if (activeTab !== "class" || classViewMode !== "day") return undefined;
    let active = true;
    const timeoutId = window.setTimeout(() => {
      if (!active) return;
      loadClassRoutineBoardData(filters, selectedClassDay)
        .catch((err) => {
          if (active) showError(err.message || "Failed to load day routine view");
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, classViewMode, selectedClassDay, filters]);

  useEffect(() => {
    if (!selectedExamRoutineId) {
      setSelectedExamRoutine(null);
      return;
    }
    let active = true;
    getExamRoutine(selectedExamRoutineId)
      .then((response) => {
        if (active) setSelectedExamRoutine(response.data || null);
      })
      .catch((err) => {
        if (active) {
          setSelectedExamRoutine(examRoutines.find((routine) => String(routine.id) === String(selectedExamRoutineId)) || null);
          showError(err.message || "Failed to load selected exam routine");
        }
      });
    return () => {
      active = false;
    };
  }, [examRoutines, selectedExamRoutineId]);

  useEffect(() => {
    if (!examOpen) return undefined;
    let active = true;
    const timeoutId = window.setTimeout(() => {
      if (!active) return;
      loadExamsForScope(examForm.class_scope)
        .then((nextExams) => {
          if (!active) return;
          setExamForm((current) => {
            if (!current.exam_id) return current;
            const selectedExam = nextExams.find((exam) => String(exam.id) === String(current.exam_id));
            return selectedExam && examMatchesClassScope(selectedExam, current.class_scope)
              ? current
              : { ...current, exam_id: "" };
          });
        })
        .catch((err) => {
          if (active) showError(err.message || "Failed to load exams for scope");
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examOpen, examForm.class_scope]);

  useEffect(() => {
    if (!examOpen || !examForm.exam_id || !examForm.class_id) {
      const timeoutId = window.setTimeout(() => setExamSubjectOptions([]), 0);
      return () => window.clearTimeout(timeoutId);
    }

    let active = true;
    const timeoutId = window.setTimeout(() => {
      if (!active) return;
      const offeringParams = {
        class_id: examForm.class_id,
        section_id: examForm.section_id,
        medium: examForm.medium,
        stream_id: examForm.stream_id,
      };
      Promise.all([
        getExamById(examForm.exam_id),
        getSubjectOfferings(offeringParams),
        getClassSubjects(examForm.class_id),
      ])
        .then(([examResponse, offeringResponse, classSubjectResponse]) => {
          const examSubjects = unwrap({ data: examResponse.data?.subjects || [] });
          const legacySubjects = unwrap(classSubjectResponse).map((subject) => ({
            subject_id: subject.id,
            subject_name: subject.name,
            subject_code: subject.code,
            subject_group: subject.subject_group,
          }));
          let offerings = unwrap(offeringResponse);
          if (!offerings.length) {
            offerings = legacySubjects;
          }
          const classSubjectIds = new Set(legacySubjects.map((subject) => String(subject.subject_id)).filter(Boolean));
          const offeringIds = new Set(offerings.map((offering) => String(offering.id)).filter(Boolean));
          const offeringSubjectIds = new Set(offerings.map((offering) => String(offering.subject_id)).filter(Boolean));
          const allowedSubjectIds = new Set([...offeringSubjectIds, ...classSubjectIds]);
          const rawOptions = examSubjects.length
            ? examSubjects.filter((subject) => {
                const offeringId = subject.subject_offering_id;
                if (offeringId) return offeringIds.has(String(offeringId)) || allowedSubjectIds.has(String(subject.subject_id));
                return allowedSubjectIds.has(String(subject.subject_id));
              })
            : Array.from(new Map([...offerings, ...legacySubjects].map((offering) => [
                String(offering.subject_id),
                {
                  subject_id: offering.subject_id,
                  subject_name: offering.subject_name,
                  subject_code: offering.subject_code,
                  subject_group: offering.subject_group,
                },
              ])).values());
          const options = Array.from(
            new Map(rawOptions
              .filter((subject) => subject.subject_id && subject.subject_name)
              .map((subject) => [String(subject.subject_id), {
                id: subject.subject_id,
                exam_subject_id: subject.exam_subject_id || subject.id || null,
                subject_offering_id: subject.subject_offering_id || null,
                name: subject.subject_name,
                code: subject.subject_code,
                subject_group: subject.subject_group,
              }]))
              .values()
          ).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
          if (!active) return;
          setExamSubjectOptions(options);
          setExamForm((current) => {
            let changed = false;
            const entries = (current.entries || []).map((entry) => {
              if (!entry.subject_id) return entry;
              const option = options.find((subject) => String(subject.id) === String(entry.subject_id));
              if (option) {
                if (String(entry.exam_subject_id || "") === String(option.exam_subject_id || "")) return entry;
                changed = true;
                return { ...entry, exam_subject_id: option.exam_subject_id ? String(option.exam_subject_id) : "" };
              }
              changed = true;
              return { ...entry, subject_id: "", exam_subject_id: "" };
            });
            return changed ? { ...current, entries } : current;
          });
        })
        .catch((err) => {
          if (active) {
            setExamSubjectOptions([]);
            showError(err.message || "Failed to load exam subjects for class");
          }
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [examOpen, examForm.exam_id, examForm.class_id, examForm.section_id, examForm.medium, examForm.stream_id]);

  useEffect(() => {
    if (!selectedClassRoutine?.time_slot_template_id) {
      const timeoutId = window.setTimeout(() => setSelectedTemplateSlots([]), 0);
      return () => window.clearTimeout(timeoutId);
    }
    let active = true;
    getTimeSlotTemplate(selectedClassRoutine.time_slot_template_id)
      .then((response) => {
        if (active) setSelectedTemplateSlots(response.data?.slots || []);
      })
      .catch(() => {
        if (active) setSelectedTemplateSlots([]);
      });
    return () => {
      active = false;
    };
  }, [selectedClassRoutine?.time_slot_template_id]);

  useEffect(() => {
    if (!slotEditorOpen || !selectedClassRoutine?.class_id) {
      const timeoutId = window.setTimeout(() => setSlotSubjects([]), 0);
      return () => window.clearTimeout(timeoutId);
    }

    let active = true;
    const params = {
      class_id: selectedClassRoutine.class_id,
      section_id: selectedClassRoutine.section_id,
      stream_id: selectedClassRoutine.stream_id,
    };

    getSubjectOfferings(params)
      .then(async (response) => {
        let options = unwrap(response)
          .map((offering) => ({
            id: offering.subject_id,
            name: offering.subject_name,
            code: offering.subject_code,
            subject_group: offering.subject_group,
          }))
          .filter((subject) => subject.id && subject.name);

        if (!options.length) {
          options = unwrap(await getClassSubjects(selectedClassRoutine.class_id));
        }

        const uniqueOptions = Array.from(
          new Map(options.map((subject) => [String(subject.id), subject])).values()
        ).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

        if (!active) return;
        setSlotSubjects(uniqueOptions);
        setSlotForm((current) => {
          if (current.entry_type !== "subject") return current;
          let changed = false;
          const subjectRows = (current.subjectRows || []).map((row) => {
            if (!row.subject_id) return row;
            const subjectExists = uniqueOptions.some((subject) => String(subject.id) === String(row.subject_id));
            if (subjectExists) return row;
            changed = true;
            return { ...row, subject_id: "", teacher_id: "" };
          });
          return changed ? { ...current, subjectRows } : current;
        });
      })
      .catch((err) => {
        if (active) {
          setSlotSubjects([]);
          showError(err.message || "Failed to load class subjects");
        }
      })

    return () => {
      active = false;
    };
  }, [
    slotEditorOpen,
    selectedClassRoutine?.class_id,
    selectedClassRoutine?.section_id,
    selectedClassRoutine?.stream_id,
  ]);

  useEffect(() => {
    const subjectIds = slotSubjectIdsKey ? slotSubjectIdsKey.split(",").filter(Boolean) : [];
    if (!slotEditorOpen || slotForm.entry_type !== "subject" || !selectedClassRoutine?.class_id || !subjectIds.length) {
      const timeoutId = window.setTimeout(() => setSlotTeacherOptions({}), 0);
      return () => window.clearTimeout(timeoutId);
    }

    let active = true;
    Promise.all(
      subjectIds.map((subjectId) =>
        getAssignedTeachers({
          class_id: selectedClassRoutine.class_id,
          section_id: selectedClassRoutine.section_id,
          session_id: selectedClassRoutine.session_id,
          subject_id: subjectId,
        }).then((response) => [subjectId, unwrap(response)])
      )
    )
      .then((pairs) => {
        if (!active) return;
        const optionsBySubject = Object.fromEntries(pairs);
        setSlotTeacherOptions(optionsBySubject);
        setSlotForm((current) => ({
          ...current,
          subjectRows: (current.subjectRows || []).map((row) => {
            if (!row.subject_id) return row;
            const options = optionsBySubject[String(row.subject_id)] || [];
            const teacherRows = (row.teacherRows || [emptyTeacherSplitRow(1, row.teacher_id)]).map((teacherRow) => {
              if (!teacherRow.teacher_id) return teacherRow;
              const teacherExists = options.some((teacher) => String(teacher.id) === String(teacherRow.teacher_id));
              return teacherExists ? teacherRow : { ...teacherRow, teacher_id: "" };
            });
            return { ...row, teacherRows, teacher_id: teacherRows[0]?.teacher_id || "" };
          }),
        }));
      })
      .catch((err) => {
        if (active) {
          setSlotTeacherOptions({});
          showError(err.message || "Failed to load assigned teachers");
        }
      });

    return () => {
      active = false;
    };
  }, [
    slotEditorOpen,
    slotForm.entry_type,
    slotSubjectIdsKey,
    selectedClassRoutine?.class_id,
    selectedClassRoutine?.section_id,
    selectedClassRoutine?.session_id,
  ]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  function showNotice(message, title = "Routine Updated", variant = "success") {
    setError("");
    setNotice({ title, message, variant });
  }

  function showError(message) {
    setNotice(null);
    setError(message);
  }

  function updateFilter(key, value) {
    const next = { ...filters, [key]: value };
    if (key === "class_id") {
      next.section_id = "";
      next.medium = "";
    }
    setFilters(next);
    loadRoutineData(next).catch((err) => showError(err.message || "Failed to filter routines"));
  }

  function moveSelectedExamRoutine(direction) {
    if (!selectedExamRoutineClassItems.length) return;
    const currentIndex = selectedExamRoutineNavigationIndex >= 0 ? selectedExamRoutineNavigationIndex : 0;
    const nextIndex = (currentIndex + direction + selectedExamRoutineClassItems.length) % selectedExamRoutineClassItems.length;
    setSelectedExamRoutineId(String(selectedExamRoutineClassItems[nextIndex].id));
  }

  function moveSelectedClassRoutine(direction) {
    if (!routineNavigationItems.length) return;
    const currentIndex = selectedClassRoutineNavigationIndex >= 0 ? selectedClassRoutineNavigationIndex : 0;
    const nextIndex = (currentIndex + direction + routineNavigationItems.length) % routineNavigationItems.length;
    setSelectedClassRoutineId(String(routineNavigationItems[nextIndex].id));
  }

  function openNewExamRoutine() {
    setEditingExamRoutineId(null);
    setExamForm(createInitialExamForm());
    setExamOpen(true);
  }

  function populateExamFormFromRoutine(routine) {
    const entries = Array.isArray(routine.entries) ? routine.entries : [];
    const firstEntry = entries[0] || {};
    setEditingExamRoutineId(routine.id);
    setExamForm({
      class_scope: routine.class_scope || firstEntry.class_scope || "school",
      exam_id: routine.exam_id ? String(routine.exam_id) : "",
      class_id: routine.class_id ? String(routine.class_id) : firstEntry.class_id ? String(firstEntry.class_id) : "",
      section_id: routine.section_id ? String(routine.section_id) : firstEntry.section_id ? String(firstEntry.section_id) : "",
      medium: routine.medium || firstEntry.medium || "",
      stream_id: routine.stream_id ? String(routine.stream_id) : firstEntry.stream_id ? String(firstEntry.stream_id) : "",
      publish_announcement_requested: Boolean(routine.publish_announcement_requested),
      entries: entries.length
        ? entries.map((entry) => ({
            exam_date: dateInputValue(entry.exam_date),
            start_time: timeInputValue(entry.start_time, "08:00"),
            end_time: timeInputValue(entry.end_time, "10:00"),
            entry_type: entry.entry_type || "subject",
            subject_id: entry.subject_id ? String(entry.subject_id) : "",
            exam_subject_id: entry.exam_subject_id ? String(entry.exam_subject_id) : "",
            invigilator_id: entry.invigilator_ids?.[0] ? String(entry.invigilator_ids[0]) : "",
            title: entry.title || "",
            room: entry.room || "",
          }))
        : [{ ...emptyExamEntry }],
    });
  }

  async function openEditExamRoutine() {
    if (!selectedExamRoutine) return;
    populateExamFormFromRoutine(selectedExamRoutine);
    setExamOpen(true);
  }

  function updateClassForm(key, value) {
    setClassForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "class_id") {
        next.section_id = "";
        next.medium = "";
        next.stream_id = "";
        next.layout_mode = "standard";
      }
      if (key === "layout_mode" && value === "packed_hs") {
        next.section_id = "";
        next.medium = "";
      }
      if (key === "section_id") {
        const section = (selectedClass?.sections || []).find((item) => String(item.id) === String(value));
        next.medium = section?.medium || "";
      }
      return next;
    });
  }

  function emptyTeacherSplitRow(index = 1, teacherId = "") {
    return { key: `teacher-${Date.now()}-${index}`, teacher_id: teacherId, weekdays: [] };
  }

  function emptySubjectSlotRow(index = 1) {
    return {
      key: `subject-${Date.now()}-${index}`,
      subject_id: "",
      display_title: "",
      teacher_id: "",
      teacherRows: [emptyTeacherSplitRow(1)],
      applies_medium: "",
      section_ids: [],
    };
  }

  function emptyCustomSlotRow(index = 1) {
    return { key: `custom-${Date.now()}-${index}`, title: "", teacher_id: "" };
  }

  function openSlotEditor(context) {
    setError("");
    const existingEntries = context.entries?.length ? context.entries : context.entry ? [context.entry] : [];
    const subjectEntries = existingEntries.filter((entry) => entry.entry_type === "subject");
    const customEntries = existingEntries.filter((entry) => entry.entry_type === "custom");
    const primaryEntry = subjectEntries[0] || existingEntries[0] || null;
    const entryType = subjectEntries.length ? "subject" : customEntries.length ? "custom" : primaryEntry?.entry_type || context.slot?.default_entry_type || "subject";
    setSlotContext(context);
    setSlotForm({
      entry_type: entryType,
      activity_id: primaryEntry?.activity_id ? String(primaryEntry.activity_id) : "",
      custom_title: entryType === "custom" ? primaryEntry?.title || "" : "",
      custom_teacher_id: entryType === "custom" && primaryEntry?.teacher_ids?.[0] ? String(primaryEntry.teacher_ids[0]) : "",
      customRows: customEntries.length
        ? customEntries.map((entry, index) => ({
            key: `custom-${entry.id || entry.entry_id || index}`,
            title: entry.title || "",
            teacher_id: entry.teacher_ids?.[0] ? String(entry.teacher_ids[0]) : "",
          }))
        : [{
            ...emptyCustomSlotRow(1),
            title: entryType === "custom" ? primaryEntry?.title || "" : "",
            teacher_id: entryType === "custom" && primaryEntry?.teacher_ids?.[0] ? String(primaryEntry.teacher_ids[0]) : "",
          }],
      save_mode: "replace",
      weekdays: [String(context.day.value)],
      subjectRows: subjectEntries.length
        ? subjectEntries.map((entry, index) => ({
            key: `subject-${entry.id || entry.entry_id || index}`,
            subject_id: entry.subject_id ? String(entry.subject_id) : "",
            display_title: entry.title || "",
            teacher_id: entry.teacher_ids?.[0] ? String(entry.teacher_ids[0]) : "",
            teacherRows: (entry.teacher_ids || []).length
              ? entry.teacher_ids.map((teacherId, teacherIndex) => emptyTeacherSplitRow(teacherIndex + 1, String(teacherId)))
              : [emptyTeacherSplitRow(1)],
            applies_medium: isPackedSelectedRoutine ? entry.applies_medium || "" : "",
            section_ids: isPackedSelectedRoutine ? (entry.applies_section_ids || []).map((sectionId) => String(sectionId)) : [],
          }))
        : [emptySubjectSlotRow(1)],
    });
    setSlotEditorOpen(true);
  }

  function toggleSlotWeekday(value) {
    const weekday = String(value);
    setSlotForm((current) => {
      const currentDays = (current.weekdays || []).map(String);
      const exists = currentDays.includes(weekday);
      const nextDays = exists
        ? currentDays.filter((day) => day !== weekday)
        : [...currentDays, weekday];
      return {
        ...current,
        weekdays: nextDays.length ? nextDays.sort((a, b) => Number(a) - Number(b)) : [weekday],
      };
    });
  }

  function updateSlotSubjectRow(key, updates) {
    setSlotForm((current) => ({
      ...current,
      subjectRows: (current.subjectRows || []).map((row) => (row.key === key ? { ...row, ...updates } : row)),
    }));
  }

  function updateSlotSubjectTeacherRow(rowKey, teacherKey, updates) {
    setSlotForm((current) => ({
      ...current,
      subjectRows: (current.subjectRows || []).map((row) => {
        if (row.key !== rowKey) return row;
        const teacherRows = (row.teacherRows || [emptyTeacherSplitRow(1, row.teacher_id)]).map((teacherRow) =>
          teacherRow.key === teacherKey ? { ...teacherRow, ...updates } : teacherRow
        );
        return { ...row, teacherRows, teacher_id: teacherRows[0]?.teacher_id || "" };
      }),
    }));
  }

  function toggleSlotSubjectTeacherWeekday(rowKey, teacherKey, weekday) {
    const value = String(weekday);
    setSlotForm((current) => ({
      ...current,
      subjectRows: (current.subjectRows || []).map((row) => {
        if (row.key !== rowKey) return row;
        const teacherRows = (row.teacherRows || [emptyTeacherSplitRow(1, row.teacher_id)]).map((teacherRow) => {
          if (teacherRow.key !== teacherKey) return teacherRow;
          const currentDays = (teacherRow.weekdays || []).map(String);
          const weekdays = currentDays.includes(value)
            ? currentDays.filter((item) => item !== value)
            : [...currentDays, value].sort((a, b) => Number(a) - Number(b));
          return { ...teacherRow, weekdays };
        });
        return { ...row, teacherRows };
      }),
    }));
  }

  function addSlotSubjectTeacherRow(rowKey) {
    setSlotForm((current) => ({
      ...current,
      subjectRows: (current.subjectRows || []).map((row) => {
        if (row.key !== rowKey) return row;
        const selectedDays = (current.weekdays || []).map(String).filter(Boolean);
        const teacherRows = (row.teacherRows || [emptyTeacherSplitRow(1, row.teacher_id)]).map((teacherRow) => {
          const days = (teacherRow.weekdays || []).map(String).filter(Boolean);
          return selectedDays.length > 1 && !days.length ? { ...teacherRow, weekdays: selectedDays } : teacherRow;
        });
        return { ...row, teacherRows: [...teacherRows, emptyTeacherSplitRow(teacherRows.length + 1)] };
      }),
    }));
  }

  function removeSlotSubjectTeacherRow(rowKey, teacherKey) {
    setSlotForm((current) => ({
      ...current,
      subjectRows: (current.subjectRows || []).map((row) => {
        if (row.key !== rowKey) return row;
        const teacherRows = (row.teacherRows || [emptyTeacherSplitRow(1, row.teacher_id)]).filter((teacherRow) => teacherRow.key !== teacherKey);
        const nextRows = teacherRows.length ? teacherRows : [emptyTeacherSplitRow(1)];
        return { ...row, teacherRows: nextRows, teacher_id: nextRows[0]?.teacher_id || "" };
      }),
    }));
  }

  function toggleSlotSubjectSection(rowKey, sectionId) {
    const value = String(sectionId);
    setSlotForm((current) => ({
      ...current,
      subjectRows: (current.subjectRows || []).map((row) => {
        if (row.key !== rowKey) return row;
        const currentSections = (row.section_ids || []).map(String);
        const section_ids = currentSections.includes(value)
          ? currentSections.filter((item) => item !== value)
          : [...currentSections, value];
        return { ...row, section_ids };
      }),
    }));
  }

  function addSlotSubjectRow() {
    setSlotForm((current) => ({
      ...current,
      subjectRows: [...(current.subjectRows || []), emptySubjectSlotRow((current.subjectRows || []).length + 1)],
    }));
  }

  function removeSlotSubjectRow(key) {
    setSlotForm((current) => {
      const nextRows = (current.subjectRows || []).filter((row) => row.key !== key);
      return { ...current, subjectRows: nextRows.length ? nextRows : [emptySubjectSlotRow(1)] };
    });
  }

  function updateSlotCustomRow(key, updates) {
    setSlotForm((current) => ({
      ...current,
      customRows: (current.customRows || []).map((row) => (row.key === key ? { ...row, ...updates } : row)),
    }));
  }

  function addSlotCustomRow() {
    setSlotForm((current) => ({
      ...current,
      customRows: [...(current.customRows || []), emptyCustomSlotRow((current.customRows || []).length + 1)],
    }));
  }

  function removeSlotCustomRow(key) {
    setSlotForm((current) => {
      const nextRows = (current.customRows || []).filter((row) => row.key !== key);
      return { ...current, customRows: nextRows.length ? nextRows : [emptyCustomSlotRow(1)] };
    });
  }

  function classRoutineEntryToSlotPayload(entry, baseSlotPayload, fallbackSortOrder = 0) {
    return {
      ...baseSlotPayload,
      entry_type: entry.entry_type || "subject",
      subject_id: entry.subject_id ? Number(entry.subject_id) : null,
      activity_id: entry.activity_id ? Number(entry.activity_id) : null,
      title: entry.title || "",
      applies_medium: isPackedSelectedRoutine ? entry.applies_medium || null : null,
      section_ids: isPackedSelectedRoutine ? (entry.applies_section_ids || entry.section_ids || []).map(Number).filter(Boolean) : [],
      room: entry.room || baseSlotPayload.room || "",
      notes: entry.notes || baseSlotPayload.notes || "",
      sort_order: Number.isFinite(Number(entry.sort_order)) ? Number(entry.sort_order) : fallbackSortOrder,
      teachers: (entry.teacher_ids || []).map((teacherId, index) => ({
        teacher_id: Number(teacherId),
        teacher_role: index === 0 ? "primary" : "co_teacher",
      })),
    };
  }

  function slotPayloadDedupeKey(entry) {
    return [
      entry.entry_type || "",
      entry.subject_id || "",
      entry.activity_id || "",
      String(entry.title || "").trim().toLowerCase(),
      isPackedSelectedRoutine ? entry.applies_medium || "" : "",
      isPackedSelectedRoutine ? (entry.section_ids || []).map(Number).filter(Boolean).sort((a, b) => a - b).join(",") : "",
      (entry.teachers || []).map((teacher) => Number(teacher.teacher_id)).filter(Boolean).sort((a, b) => a - b).join(","),
    ].join("|");
  }

  function mergeSlotPayloadEntries(existingEntries, newEntries) {
    const seen = new Set();
    const merged = [];
    [...existingEntries, ...newEntries].forEach((entry, index) => {
      const key = slotPayloadDedupeKey(entry);
      if (seen.has(key)) return;
      seen.add(key);
      merged.push({ ...entry, sort_order: Number.isFinite(Number(entry.sort_order)) ? Number(entry.sort_order) : index });
    });
    return merged.map((entry, index) => ({ ...entry, sort_order: index }));
  }

  async function handleSaveSlot(event) {
    event.preventDefault();
    if (!selectedClassRoutine || !slotContext) return;
    const subjectRows = (slotForm.subjectRows || []).filter((row) =>
      row.subject_id || row.teacher_id || (row.teacherRows || []).some((teacherRow) => teacherRow.teacher_id)
    );
    const invalidSubjectRows = subjectRows.filter((row) => {
      const teacherRows = (row.teacherRows || [emptyTeacherSplitRow(1, row.teacher_id)]).filter((teacherRow) => teacherRow.teacher_id);
      return !row.subject_id || !teacherRows.length;
    });
    if (slotForm.entry_type === "subject" && (!subjectRows.length || invalidSubjectRows.length)) {
      showError("Every subject row needs a subject and at least one assigned teacher.");
      return;
    }
    const selectedWeekdays = [...new Set((slotForm.weekdays || [slotContext.day.value]).map((value) => String(value)).filter(Boolean))];
    const missingSplitDays = subjectRows.some((row) => {
      const teacherRows = (row.teacherRows || [emptyTeacherSplitRow(1, row.teacher_id)]).filter((teacherRow) => teacherRow.teacher_id);
      return selectedWeekdays.length > 1 &&
        teacherRows.length > 1 &&
        teacherRows.some((teacherRow) => !(teacherRow.weekdays || []).map(String).filter(Boolean).length);
    });
    if (slotForm.entry_type === "subject" && missingSplitDays) {
      showError("Select days for every teacher split, or keep only one teacher for all selected days.");
      return;
    }
    if (slotForm.entry_type === "activity" && !slotForm.activity_id) {
      showError("Activity is required for activity slots.");
      return;
    }
    const customRows = (slotForm.customRows || []).filter((row) => String(row.title || "").trim() || row.teacher_id);
    if (slotForm.entry_type === "custom" && (!customRows.length || customRows.some((row) => !String(row.title || "").trim()))) {
      showError("Every custom routine row needs a title.");
      return;
    }

    const { day, period, slot, entry, entries: existingEntries = [] } = slotContext;
    if (!selectedWeekdays.length) {
      showError("Select at least one day for this slot.");
      return;
    }
    const primaryEntry = entry || existingEntries[0] || null;
    const fallbackTime = fallbackSlotTime(period);
    const buildBaseSlotPayload = (weekday) => ({
      time_slot_id: slot?.id || primaryEntry?.time_slot_id || null,
      weekday: String(weekday),
      period_number: Number(period),
      start_time: timeInputValue(primaryEntry?.start_time || slot?.start_time, fallbackTime.start_time),
      end_time: timeInputValue(primaryEntry?.end_time || slot?.end_time, fallbackTime.end_time),
      room: primaryEntry?.room || "",
      notes: primaryEntry?.notes || "",
    });
    const buildSlotPayloadEntries = (weekday) => {
      const baseSlotPayload = buildBaseSlotPayload(weekday);
      const newEntries = slotForm.entry_type === "subject"
        ? subjectRows
          .map((row, index) => {
            const teacherRows = (row.teacherRows || [emptyTeacherSplitRow(1, row.teacher_id)])
              .filter((teacherRow) => teacherRow.teacher_id)
              .filter((teacherRow) => {
                const days = (teacherRow.weekdays || []).map(String).filter(Boolean);
                const allSubjectTeachers = (row.teacherRows || [emptyTeacherSplitRow(1, row.teacher_id)]).filter((item) => item.teacher_id);
                return !days.length && allSubjectTeachers.length <= 1 ? true : days.includes(String(weekday));
              });
            if (!teacherRows.length) return null;
            return {
              ...baseSlotPayload,
              entry_type: "subject",
              subject_id: Number(row.subject_id),
              activity_id: null,
              title: String(row.display_title || "").trim(),
              applies_medium: isPackedSelectedRoutine ? row.applies_medium || null : null,
              section_ids: isPackedSelectedRoutine ? (row.section_ids || []).map(Number).filter(Boolean) : [],
              sort_order: Number(period) * 100 + index,
              teachers: teacherRows.map((teacherRow, teacherIndex) => ({
                teacher_id: Number(teacherRow.teacher_id),
                teacher_role: teacherIndex === 0 ? "primary" : "co_teacher",
              })),
            };
          })
          .filter(Boolean)
        : slotForm.entry_type === "custom"
          ? customRows.map((row, index) => ({
            ...baseSlotPayload,
            entry_type: "custom",
            subject_id: null,
            activity_id: null,
            title: String(row.title || "").trim(),
            sort_order: Number(period) * 100 + index,
            teachers: row.teacher_id
              ? [{ teacher_id: Number(row.teacher_id), teacher_role: "primary" }]
              : [],
          }))
        : [{
          ...baseSlotPayload,
          entry_type: slotForm.entry_type,
          subject_id: null,
          activity_id: slotForm.entry_type === "activity" ? Number(slotForm.activity_id) : null,
          title: slotForm.entry_type === "activity"
            ? activities.find((activity) => String(activity.id) === String(slotForm.activity_id))?.name || displayChangeType(slotForm.entry_type)
            : slot?.label || displayChangeType(slotForm.entry_type),
          sort_order: Number.isFinite(Number(primaryEntry?.sort_order)) ? Number(primaryEntry.sort_order) : Number(period) - 1,
          teachers: [],
        }];
      if (!isPackedSelectedRoutine || slotForm.save_mode !== "add") return newEntries;

      const currentEntries = Array.isArray(selectedClassRoutine?.entries) ? selectedClassRoutine.entries : [];
      const existingSlotEntries = currentEntries
        .filter((item) =>
          String(item.weekday) === String(weekday) &&
          Number(item.period_number) === Number(period)
        )
        .map((item, index) => classRoutineEntryToSlotPayload(item, baseSlotPayload, index));
      return mergeSlotPayloadEntries(existingSlotEntries, newEntries);
    };
    const buildSlotPayload = (weekday) => {
      return { entries: buildSlotPayloadEntries(weekday) };
    };

    try {
      const targetRoutineId = slotContext?.routine?.id || slotContext?.routine?.routine_version_id || selectedClassRoutine.id;
      let latestResponse = null;
      for (const weekday of selectedWeekdays) {
        latestResponse = await updateClassRoutineSlot(targetRoutineId, buildSlotPayload(weekday));
      }
      setSelectedClassRoutine(latestResponse?.data || null);
      if (latestResponse?.data?.id) setSelectedClassRoutineId(String(latestResponse.data.id));
      setSlotEditorOpen(false);
      showNotice(selectedWeekdays.length > 1 ? `Routine slot updated for ${selectedWeekdays.length} days.` : "Routine slot updated.");
      await loadRoutineData();
      if (classViewMode === "day") {
        await loadClassRoutineBoardData(filters, selectedClassDay);
      }
    } catch (err) {
      showError(err.message || "Failed to update routine slot");
    }
  }

  function updateExamEntry(index, key, value) {
    setExamForm((current) => ({
      ...current,
      entries: current.entries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [key]: value } : entry
      ),
    }));
  }

  function updateExamForm(key, value) {
    setExamForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "class_scope") {
        next.exam_id = "";
        next.class_id = "";
        next.section_id = "";
        next.medium = "";
        next.stream_id = "";
      }
      if (key === "class_id") {
        next.section_id = "";
        next.medium = "";
        next.stream_id = "";
      }
      if (key === "section_id") {
        const section = (selectedExamClass?.sections || []).find((item) => String(item.id) === String(value));
        next.medium = section?.medium || "";
      }
      if (["class_scope", "exam_id", "class_id", "section_id", "medium", "stream_id"].includes(key)) {
        next.entries = (next.entries || []).map((entry) => ({ ...entry, subject_id: "", exam_subject_id: "" }));
      }
      return next;
    });
  }

  function addExamEntry() {
    setExamForm((current) => ({
      ...current,
      entries: [...current.entries, { ...emptyExamEntry }],
    }));
  }

  function removeExamEntry(index) {
    setExamForm((current) => {
      const entries = current.entries.filter((_, entryIndex) => entryIndex !== index);
      return {
        ...current,
        entries: entries.length ? entries : [{ ...emptyExamEntry }],
      };
    });
  }

  function updateTemplateSlot(index, key, value) {
    setTemplateForm((current) => ({
      ...current,
      slots: current.slots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, [key]: value } : slot
      ),
    }));
  }

  function removeTemplateSlot(index) {
    setTemplateForm((current) => {
      const slots = current.slots.filter((_, slotIndex) => slotIndex !== index);
      return {
        ...current,
        slots: slots.length ? slots : [{ weekday: "", period_number: "1", label: "", start_time: "08:00", end_time: "08:40", default_entry_type: "subject" }],
      };
    });
  }

  function resetTemplateDialog() {
    setEditingTemplateId(null);
    setTemplateForm(createInitialTemplateForm());
  }

  async function openEditTemplate(template) {
    setError("");
    try {
      const response = await getTimeSlotTemplate(template.id);
      const details = response.data || template;
      setEditingTemplateId(details.id);
      setTemplateForm({
        name: details.name || "",
        scope_level: details.scope_level || "school",
        session_id: details.session_id ? String(details.session_id) : "",
        class_id: details.class_id ? String(details.class_id) : "",
        section_id: details.section_id ? String(details.section_id) : "",
        medium: details.medium || "",
        stream_id: details.stream_id ? String(details.stream_id) : "",
        description: details.description || "",
        is_active: Boolean(details.is_active),
        slots: (details.slots || []).map((slot) => ({
          weekday: slot.weekday ? String(slot.weekday) : "",
          period_number: slot.period_number ? String(slot.period_number) : "",
          label: slot.label || "",
          start_time: timeInputValue(slot.start_time, "08:00"),
          end_time: timeInputValue(slot.end_time, "08:40"),
          default_entry_type: slot.default_entry_type || "subject",
          sort_order: slot.sort_order,
        })),
      });
      setTemplateOpen(true);
    } catch (err) {
      showError(err.message || "Failed to load time slot template");
    }
  }

  async function handleSaveTemplate(event) {
    event.preventDefault();
    setError("");
    try {
      if (editingTemplateId) {
        await updateTimeSlotTemplate(editingTemplateId, templateForm);
      } else {
        await createTimeSlotTemplate(templateForm);
      }
      setTemplateOpen(false);
      showNotice(editingTemplateId ? "Time slot template updated." : "Time slot template created.");
      resetTemplateDialog();
      await loadRoutineData();
    } catch (err) {
      showError(err.message || "Failed to save time slot template");
    }
  }

  async function handleDeleteTemplate(template) {
    setDeleteTarget({
      type: "template",
      id: template.id,
      title: "Delete time slot template?",
      description: `Delete "${template.name}"? This is allowed only when no class routine is using it.`,
      actionLabel: "Delete Template",
    });
  }

  async function confirmDeleteTemplate(templateId) {
    setError("");
    try {
      await deleteTimeSlotTemplate(templateId);
      showNotice("Time slot template deleted.");
      await loadRoutineData();
    } catch (err) {
      showError(err.message || "Failed to delete time slot template");
    }
  }

  async function handleCreateClassRoutine(event) {
    event.preventDefault();
    setError("");
    if (!classForm.class_id) {
      showError("Select a class first.");
      return;
    }
    if (classForm.layout_mode === "packed_hs" && selectedClass?.class_scope !== "hs") {
      showError("Packed routine mode is only available for Higher Secondary classes.");
      return;
    }
    if (!isPackedClassForm && (!classForm.section_id || !classForm.medium)) {
      showError("Select a section and medium for standard class routines.");
      return;
    }
    const selectedSection = (selectedClass?.sections || []).find((section) => String(section.id) === String(classForm.section_id));
    const medium = isPackedClassForm ? "" : selectedSection?.medium || classForm.medium || "";
    try {
      const response = await createClassRoutine({
        ...classForm,
        section_id: isPackedClassForm ? null : toNumberOrNull(classForm.section_id),
        medium,
        layout_mode: isPackedClassForm ? "packed_hs" : "standard",
        stream_id: toNumberOrNull(classForm.stream_id),
        time_slot_template_id: toNumberOrNull(classForm.time_slot_template_id),
        entries: [],
      });
      setClassOpen(false);
      showNotice("Class routine draft created.");
      await loadRoutineData();
      if (response.data?.id) {
        setSelectedClassRoutineId(String(response.data.id));
        setSelectedClassRoutine(response.data);
      }
    } catch (err) {
      showError(err.message || "Failed to create class routine");
    }
  }

  async function handleImportClassRoutine() {
    if (!classImportFile) {
      showError("Choose a class routine XLSX or CSV file first.");
      return;
    }
    setError("");
    try {
      const response = await importClassRoutineSheet(classImportFile, filters);
      const result = response.data || {};
      setClassImportOpen(false);
      setClassImportFile(null);
      showNotice(`Imported ${result.imported_count || 0} class routine draft${Number(result.imported_count || 0) === 1 ? "" : "s"}.`);
      if (result.failed_count) {
        showError(`${result.failed_count} row or group${Number(result.failed_count) === 1 ? "" : "s"} failed during class routine import.`);
      }
      await loadRoutineData();
    } catch (err) {
      showError(err.message || "Failed to import class routine");
    }
  }

  async function handleDeleteClassRoutine() {
    if (!selectedClassRoutine?.id) return;
    const label = selectedClassRoutineHeader || classRoutineHeaderLabel || "selected class routine";
    setDeleteTarget({
      type: "class",
      id: selectedClassRoutine.id,
      title: "Delete class routine?",
      description: `Delete this ${selectedClassRoutine.status || "selected"} class routine "${label}"?`,
      actionLabel: "Delete Routine",
    });
  }

  async function confirmDeleteClassRoutine(routineId) {
    setError("");
    try {
      await deleteClassRoutine(routineId);
      setSelectedClassRoutine(null);
      setSelectedClassRoutineId("");
      showNotice("Class routine deleted.");
      await loadRoutineData();
    } catch (err) {
      showError(err.message || "Failed to delete class routine");
    }
  }

  function buildExamRoutinePayload() {
    return {
      class_scope: examForm.class_scope,
      exam_id: examForm.exam_id,
      class_id: Number(examForm.class_id),
      section_id: toNumberOrNull(examForm.section_id),
      medium: examForm.medium,
      stream_id: toNumberOrNull(examForm.stream_id),
      publish_announcement_requested: examForm.publish_announcement_requested,
      entries: examForm.entries.map((entry) => ({
        ...entry,
        class_id: Number(examForm.class_id),
        section_id: toNumberOrNull(examForm.section_id),
        medium: examForm.medium,
        stream_id: toNumberOrNull(examForm.stream_id),
        subject_id: toNumberOrNull(entry.subject_id),
        exam_subject_id: toNumberOrNull(entry.exam_subject_id),
        invigilators: entry.invigilator_id
          ? [{ teacher_id: Number(entry.invigilator_id), invigilation_role: "invigilator" }]
          : [],
      })),
    };
  }

  async function handleSaveExamRoutine(event) {
    event.preventDefault();
    setError("");
    try {
      const payload = buildExamRoutinePayload();
      const response = editingExamRoutineId
        ? await updateExamRoutine(editingExamRoutineId, payload)
        : await createExamRoutine(payload);
      const savedRoutine = response.data;
      setExamOpen(false);
      setEditingExamRoutineId(null);
      if (savedRoutine?.id) setSelectedExamRoutineId(String(savedRoutine.id));
      showNotice(editingExamRoutineId ? "Exam routine updated." : "Exam routine created.");
      await loadRoutineData();
    } catch (err) {
      showError(err.message || "Failed to save exam routine");
    }
  }

  async function handleDeleteExamRoutine() {
    if (!selectedExamRoutine?.id) return;
    setDeleteTarget({
      type: "exam",
      id: selectedExamRoutine.id,
      title: "Delete exam routine?",
      description: `Delete this ${selectedExamRoutine.status || "selected"} exam routine?`,
      actionLabel: "Delete Routine",
    });
  }

  async function confirmDeleteExamRoutine(routineId) {
    setError("");
    try {
      await deleteExamRoutine(routineId);
      setSelectedExamRoutine(null);
      setSelectedExamRoutineId("");
      showNotice("Exam routine deleted.");
      await loadRoutineData();
    } catch (err) {
      showError(err.message || "Failed to delete exam routine");
    }
  }

  async function handleImportExamRoutine() {
    if (!examImportFile) {
      showError("Choose an exam routine XLSX or CSV file first.");
      return;
    }
    setError("");
    try {
      const response = await importExamRoutineSheet(examImportFile, {});
      const result = response.data || {};
      setExamImportOpen(false);
      setExamImportFile(null);
      showNotice(`Imported ${result.imported_count || 0} exam routine${Number(result.imported_count || 0) === 1 ? "" : "s"}.`);
      if (result.failed_count) {
        showError(`${result.failed_count} row or group${Number(result.failed_count) === 1 ? "" : "s"} failed during exam routine import.`);
      }
      await loadRoutineData();
    } catch (err) {
      showError(err.message || "Failed to import exam routine");
    }
  }

  async function runAction(action, successMessage) {
    setError("");
    try {
      await action();
      showNotice(successMessage);
      await loadRoutineData();
    } catch (err) {
      showError(err.message || "Routine action failed");
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    if (target.type === "template") {
      await confirmDeleteTemplate(target.id);
    } else if (target.type === "class") {
      await confirmDeleteClassRoutine(target.id);
    } else if (target.type === "exam") {
      await confirmDeleteExamRoutine(target.id);
    }
  }

  async function downloadFile(downloadFn, id, fileName, fallbackMessage = "Failed to download file") {
    setError("");
    try {
      const blob = await downloadFn(id);
      saveBlob(blob, fileName);
    } catch (err) {
      showError(err.message || fallbackMessage);
    }
  }

  return (
    <div className="space-y-4">
      <div className="pointer-events-none fixed top-6 right-6 z-50 w-full max-w-sm">
        <div
          className={`transition-all duration-500 ease-out ${
            error || notice
              ? "translate-x-0 scale-100 opacity-100"
              : "translate-x-12 scale-95 opacity-0"
          }`}
        >
          {error ? (
            <Alert variant="destructive" className="pointer-events-auto overflow-hidden border shadow-xl">
              <AlertTitle>Routine Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : notice ? (
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

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTarget?.title || "Delete item?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.description || "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
              {deleteTarget?.actionLabel || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TopBar
        title={activeTab === "class" ? "Class Routine" : activeTab === "exam" ? "Exam Routine" : "Time Slots"}
        subTitle={
          activeTab === "class"
            ? "Create and manage weekly class schedules."
            : activeTab === "exam"
              ? "Create and manage exam schedules linked to exams."
              : "Manage reusable period timing templates."
        }
        action={
          <div className="flex flex-wrap items-center justify-end gap-1">
            <Button variant="outline" className="gap-1" onClick={() => loadAll()} disabled={loading}>
              <RefreshCcw className="size-4" />
              Refresh
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-1">
                  <SlidersHorizontal className="size-4" />
                  Filters
                  {activeFilterCount ? <Badge variant="secondary" className="ml-1 px-1.5">{activeFilterCount}</Badge> : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(92vw,420px)] space-y-4">
                <PopoverHeader>
                  <PopoverTitle>Routine Filters</PopoverTitle>
                  <PopoverDescription>Scope routines by academic session, class, section, medium, stream, and status.</PopoverDescription>
                </PopoverHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Session">
                    <select className={selectClassName} value={filters.session_id} onChange={(event) => updateFilter("session_id", event.target.value)}>
                      <option value="">All sessions</option>
                      {sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Class">
                    <select className={selectClassName} value={filters.class_id} onChange={(event) => updateFilter("class_id", event.target.value)}>
                      <option value="">All classes</option>
                      {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Section">
                    <select className={selectClassName} value={filters.section_id} onChange={(event) => updateFilter("section_id", event.target.value)}>
                      <option value="">All sections</option>
                      {(filterClass?.sections || []).map((section) => <option key={`${section.id}-${section.medium}`} value={section.id}>{section.name} - {section.medium}</option>)}
                    </select>
                  </Field>
                  <Field label="Medium">
                    <select className={selectClassName} value={filters.medium} onChange={(event) => updateFilter("medium", event.target.value)}>
                      <option value="">All mediums</option>
                      {(filterClass?.mediums || []).map((medium) => <option key={medium} value={medium}>{medium}</option>)}
                    </select>
                  </Field>
                  <Field label="Stream">
                    <select className={selectClassName} value={filters.stream_id} onChange={(event) => updateFilter("stream_id", event.target.value)}>
                      <option value="">All streams</option>
                      {streams.map((stream) => <option key={stream.id} value={stream.id}>{stream.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select className={selectClassName} value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                      <option value="">Current</option>
                      <option value="all">All versions</option>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </Field>
                </div>
                <div className="flex justify-end border-t border-border pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const nextFilters = { session_id: "", class_id: "", section_id: "", medium: "", stream_id: "", status: "" };
                      setFilters(nextFilters);
                      loadRoutineData(nextFilters);
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            {activeTab === "class" ? (
              <Button className="gap-1" onClick={() => setClassOpen(true)}>
                <Plus className="size-4" />
                Add Class Routine
              </Button>
            ) : null}
            {activeTab === "exam" ? (
              <Button className="gap-1" onClick={openNewExamRoutine}>
                <Plus className="size-4" />
                Add Exam Routine
              </Button>
            ) : null}
            {activeTab === "templates" ? (
              <Button className="gap-1" onClick={() => setTemplateOpen(true)}>
                <Plus className="size-4" />
                Create template
              </Button>
            ) : null}
          </div>
        }
      />

      <Dialog open={classImportOpen} onOpenChange={setClassImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Class Routine</DialogTitle>
            <DialogDescription>Headers can include Session, Class, Section, Medium, Stream, Day, Period, Start Time, End Time, Subject, Teacher, Type, Title, and Room.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <FileField file={classImportFile} onChange={setClassImportFile} />
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Current filters are used as defaults when matching columns are not present in the sheet.
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setClassImportOpen(false)}>Cancel</Button>
              <Button type="button" onClick={handleImportClassRoutine} disabled={!classImportFile}>Import Drafts</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={classOpen} onOpenChange={setClassOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Create Class Routine Draft</DialogTitle>
            <DialogDescription>Create the routine shell first. Periods can be filled from the routine board or imported later.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreateClassRoutine}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Session">
                <select required className={selectClassName} value={classForm.session_id} onChange={(event) => updateClassForm("session_id", event.target.value)}>
                  <option value="">Select session</option>
                  {sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
                </select>
              </Field>
              <Field label="Template">
                <select className={selectClassName} value={classForm.time_slot_template_id} onChange={(event) => updateClassForm("time_slot_template_id", event.target.value)}>
                  <option value="">No template</option>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              </Field>
              <Field label="Class">
                <select required className={selectClassName} value={classForm.class_id} onChange={(event) => updateClassForm("class_id", event.target.value)}>
                  <option value="">Select class</option>
                  {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              {selectedClass?.class_scope === "hs" ? (
                <Field label="Routine Mode">
                  <select className={selectClassName} value={classForm.layout_mode} onChange={(event) => updateClassForm("layout_mode", event.target.value)}>
                    <option value="standard">Standard section routine</option>
                    <option value="packed_hs">Packed Higher Secondary routine</option>
                  </select>
                </Field>
              ) : null}
              <Field label="Section">
                <select required={!isPackedClassForm} disabled={isPackedClassForm} className={selectClassName} value={isPackedClassForm ? "" : classForm.section_id} onChange={(event) => updateClassForm("section_id", event.target.value)}>
                  <option value="">{isPackedClassForm ? "All sections" : "Select section"}</option>
                  {(selectedClass?.sections || []).map((section) => <option key={`${section.id}-${section.medium}`} value={section.id}>{section.name} - {section.medium}</option>)}
                </select>
              </Field>
              <Field label="Medium">
                <select required={!isPackedClassForm} disabled={isPackedClassForm || Boolean(classForm.section_id)} className={selectClassName} value={isPackedClassForm ? "" : classForm.medium} onChange={(event) => updateClassForm("medium", event.target.value)}>
                  <option value="">{isPackedClassForm ? "All mediums" : "Select medium"}</option>
                  {(selectedClass?.mediums || []).map((medium) => <option key={medium} value={medium}>{medium}</option>)}
                </select>
              </Field>
              {selectedClass?.class_scope === "hs" ? (
                <Field label="Stream">
                  <select className={selectClassName} value={classForm.stream_id} onChange={(event) => updateClassForm("stream_id", event.target.value)}>
                    <option value="">No stream</option>
                    {streams.map((stream) => <option key={stream.id} value={stream.id}>{stream.name}</option>)}
                  </select>
                </Field>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => setClassOpen(false)}>Cancel</Button>
              <Button type="submit">Create Draft</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="class">
            <CalendarDays className="mr-2 size-4" />
            Class Routine
          </TabsTrigger>
          <TabsTrigger value="exam">
            <CalendarClock className="mr-2 size-4" />
            Exam Routine
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Clock className="mr-2 size-4" />
            Time Slots
          </TabsTrigger>
        </TabsList>

        <TabsContent value="class" className="mt-4">
          <RoutineCard>
            <CardHeader>
              <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 text-left lg:max-w-[46%]">
                  <div className="flex items-center justify-start gap-3">
                    {classViewMode === "week" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => moveSelectedClassRoutine(-1)}
                        disabled={routineNavigationItems.length <= 1}
                        aria-label="Previous class routine"
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                    ) : null}
                    <div className="min-w-0 max-w-[min(72vw,560px)]">
                      {selectedClassRoutine || classViewMode === "day" ? (
                        <p className="truncate text-lg font-semibold text-foreground">
                          {classRoutineHeaderLabel}
                        </p>
                      ) : (
                        <p className="text-lg font-semibold text-muted-foreground">No class routine selected</p>
                      )}
                    </div>
                    {classViewMode === "week" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => moveSelectedClassRoutine(1)}
                        disabled={routineNavigationItems.length <= 1}
                        aria-label="Next class routine"
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-start gap-3 overflow-hidden lg:items-end">
                  <div className="flex max-w-full flex-wrap items-center justify-start gap-3 text-sm text-muted-foreground lg:justify-end">
                    {classViewMode === "week" && selectedClassRoutine?.status ? <StatusBadge status={selectedClassRoutine.status} /> : null}
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />{visibleClassRoutineSummary.totalPeriods} periods</span>
                    <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4" />{visibleClassRoutineSummary.assignedPeriods} assigned</span>
                    <span className="inline-flex items-center gap-1.5"><Plus className="size-4" />{visibleClassRoutineSummary.freePeriods} free</span>
                  </div>
                  <div className="flex max-w-full flex-nowrap items-center justify-start gap-2 overflow-x-auto lg:justify-end [&>*]:h-9 [&>*]:shrink-0">
                    <div className="flex h-9 items-center rounded-md border border-input bg-background p-0.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={classViewMode === "week" ? "default" : "ghost"}
                        onClick={() => setClassViewMode("week")}
                      >
                        Week
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={classViewMode === "day" ? "default" : "ghost"}
                        onClick={() => setClassViewMode("day")}
                      >
                        Day
                      </Button>
                    </div>
                    {classViewMode === "week" ? (
                      <select
                        className={`${selectClassName} h-9 !w-[min(62vw,320px)] !min-w-[220px] rounded-md px-3 py-1.5 text-sm`}
                        value={selectedClassRoutineId}
                        onChange={(event) => setSelectedClassRoutineId(event.target.value)}
                      >
                        {routineNavigationItems.map((routine) => (
                          <option key={routine.id} value={routine.id}>
                            {routine.class_name || "Class"} | {routine.section_name || "Section"} | {routine.medium || "Medium"}
                            {routine.stream_name ? ` | ${routine.stream_name}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {classViewMode === "day" ? (
                      <select
                        className={`${selectClassName} h-9 !w-[min(48vw,180px)] !min-w-[140px] rounded-md px-3 py-1.5 text-sm`}
                        value={selectedClassDay}
                        onChange={(event) => setSelectedClassDay(event.target.value)}
                      >
                        {weekdayColumns.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
                      </select>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => setClassImportOpen(true)}>
                      <Upload className="mr-2 size-4" />
                      Import
                    </Button>
                    {selectedClassRoutine?.id ? (
                      <Button size="sm" variant="outline" onClick={() => downloadFile(downloadClassRoutineXlsx, selectedClassRoutine.id, `class-routine-${selectedClassRoutine.id}.xlsx`, "Failed to download class routine Excel file")}>
                        Download Excel
                      </Button>
                    ) : null}
                    {selectedClassRoutine?.id ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={handleDeleteClassRoutine}
                            aria-label="Delete class routine"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete class routine</TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {classRoutines.length ? (
                <>
                  <div className="overflow-x-auto">
                    {classViewMode === "day" ? (
                      <ClassRoutineDayBoard
                        board={classRoutineBoard}
                        weekday={selectedClassDay}
                        onSlotClick={openSlotEditor}
                        showTeachers={showRoutineTeachers}
                      />
                    ) : (
                      <ClassRoutineBoard
                        routine={selectedClassRoutine}
                        templateSlots={selectedTemplateSlots}
                        onSlotClick={openSlotEditor}
                        showTeachers={showRoutineTeachers}
                      />
                    )}
                  </div>

                  <Dialog open={slotEditorOpen} onOpenChange={setSlotEditorOpen}>
                    <DialogContent className="flex max-h-[88vh] w-[min(96vw,760px)] max-w-none flex-col overflow-hidden sm:max-w-[760px]">
                      <DialogHeader>
                        <DialogTitle>Edit Routine Slot</DialogTitle>
                        <DialogDescription>
                          {slotContext ? `${slotContext.day.label}, ${slotContext.displayPeriodLabel || `Period ${slotContext.period}`}` : "Select slot details."}
                        </DialogDescription>
                      </DialogHeader>
                      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSaveSlot}>
                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                          <Field label="Apply To Days">
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {weekdayColumns.map((day) => {
                                const selected = (slotForm.weekdays || []).map(String).includes(String(day.value));
                                return (
                                  <button
                                    key={day.value}
                                    type="button"
                                    className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                                      selected
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-background text-foreground hover:bg-muted"
                                    }`}
                                    onClick={() => toggleSlotWeekday(day.value)}
                                  >
                                    {day.label}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Save the same period and subject rows across the selected days.
                            </p>
                          </Field>
                          {isPackedSelectedRoutine ? (
                            <Field label="Save Mode">
                              <div className="grid gap-2 sm:grid-cols-2">
                                {[
                                  {
                                    value: "replace",
                                    label: "Replace slot",
                                    description: "Clear this period for selected days, then save these rows.",
                                  },
                                  {
                                    value: "add",
                                    label: "Add to slot",
                                    description: "Keep existing rows and add these subject or custom rows to selected days.",
                                  },
                                ].map((option) => {
                                  const selected = slotForm.save_mode === option.value;
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      className={`rounded-md border p-3 text-left transition ${
                                        selected
                                          ? "border-primary bg-primary/10 text-foreground"
                                          : "border-border bg-background text-foreground hover:bg-muted"
                                      }`}
                                      onClick={() => setSlotForm((current) => ({ ...current, save_mode: option.value }))}
                                    >
                                      <span className="block text-sm font-semibold">{option.label}</span>
                                      <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </Field>
                          ) : null}
                          <Field label="Type">
                            <select
                              className={selectClassName}
                              value={slotForm.entry_type}
                              onChange={(event) => setSlotForm((current) => ({
                                ...current,
                                entry_type: event.target.value,
                                save_mode: ["subject", "custom"].includes(event.target.value) ? current.save_mode : "replace",
                                subjectRows: event.target.value === "subject" ? current.subjectRows : [emptySubjectSlotRow(1)],
                                activity_id: event.target.value === "activity" ? current.activity_id : "",
                                custom_title: event.target.value === "custom" ? current.custom_title : "",
                                custom_teacher_id: event.target.value === "custom" ? current.custom_teacher_id : "",
                                customRows: event.target.value === "custom" ? current.customRows || [emptyCustomSlotRow(1)] : [emptyCustomSlotRow(1)],
                              }))}
                            >
                              <option value="subject">Subject</option>
                              <option value="custom">Custom / Routine-only</option>
                              <option value="break">Break</option>
                              <option value="activity">Activity</option>
                              <option value="free">Free</option>
                            </select>
                          </Field>
                          {slotForm.entry_type === "subject" ? (
                          <div className="space-y-3">
                            {(slotForm.subjectRows || []).map((row, index) => {
                              const teacherOptions = row.subject_id ? slotTeacherOptions[String(row.subject_id)] || [] : [];
                              const selectedSubject = slotSubjects.find((subject) => String(subject.id) === String(row.subject_id));
                              return (
                                <div key={row.key} className="rounded-md border border-border bg-muted/20 p-3">
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-medium text-foreground">Subject {index + 1}</p>
                                      {selectedSubject?.subject_group ? (
                                        <p className="text-xs capitalize text-muted-foreground">{selectedSubject.subject_group}</p>
                                      ) : null}
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                      onClick={() => removeSlotSubjectRow(row.key)}
                                      aria-label={`${(slotForm.subjectRows || []).length > 1 ? "Delete" : "Clear"} subject ${index + 1}`}
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </div>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <Field label="Subject">
                                      <select
                                        required
                                        className={selectClassName}
                                        value={row.subject_id}
                                        onChange={(event) => updateSlotSubjectRow(row.key, {
                                          subject_id: event.target.value,
                                          teacher_id: "",
                                          teacherRows: [emptyTeacherSplitRow(1)],
                                        })}
                                      >
                                        <option value="">Select subject</option>
                                        {slotSubjects.map((subject) => (
                                          <option key={subject.id} value={subject.id}>
                                            {subject.name}{subject.subject_group ? ` (${subject.subject_group})` : ""}
                                          </option>
                                        ))}
                                      </select>
                                    </Field>
                                    <Field label="Routine Display Title">
                                      <Input
                                        value={row.display_title || ""}
                                        placeholder={selectedSubject?.name ? `Shown as ${selectedSubject.name}` : "Optional alias, e.g. Botany"}
                                        onChange={(event) => updateSlotSubjectRow(row.key, { display_title: event.target.value })}
                                      />
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        Optional. Use this for Biology classes shown separately as Botany or Zoology while keeping marks under Biology.
                                      </p>
                                    </Field>
                                  </div>
                                  <div className="mt-3">
                                    <Label className="text-xs font-medium text-muted-foreground">Teachers</Label>
                                    <div className="mt-2 space-y-2">
                                      {(row.teacherRows || [emptyTeacherSplitRow(1, row.teacher_id)]).map((teacherRow, teacherIndex) => (
                                        <div key={teacherRow.key} className="rounded-md border border-border bg-background p-2">
                                          <div className="flex items-center gap-2">
                                            <select
                                              required
                                              className={selectClassName}
                                              value={teacherRow.teacher_id}
                                              onChange={(event) => updateSlotSubjectTeacherRow(row.key, teacherRow.key, { teacher_id: event.target.value })}
                                            >
                                              <option value="">Select assigned teacher</option>
                                              {teacherOptions.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                                            </select>
                                            {(row.teacherRows || []).length > 1 ? (
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                onClick={() => removeSlotSubjectTeacherRow(row.key, teacherRow.key)}
                                                aria-label={`Delete teacher split ${teacherIndex + 1}`}
                                              >
                                                <Trash2 className="size-4" />
                                              </Button>
                                            ) : null}
                                          </div>
                                          {(slotForm.weekdays || []).length > 1 ? (
                                            <div className="mt-2">
                                              <p className="mb-1 text-xs text-muted-foreground">Days for this teacher</p>
                                              <div className="flex flex-wrap gap-1.5">
                                                {(slotForm.weekdays || []).map((weekday) => {
                                                  const selected = (teacherRow.weekdays || []).map(String).includes(String(weekday));
                                                  const dayName = weekdays.find((day) => String(day.value) === String(weekday))?.label || weekday;
                                                  const dayLabel = String(dayName).slice(0, 3);
                                                  return (
                                                    <button
                                                      key={`${teacherRow.key}-${weekday}`}
                                                      type="button"
                                                      className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
                                                        selected
                                                          ? "border-primary bg-primary text-primary-foreground"
                                                          : "border-border bg-muted/30 text-foreground hover:bg-muted"
                                                      }`}
                                                      onClick={() => toggleSlotSubjectTeacherWeekday(row.key, teacherRow.key, weekday)}
                                                    >
                                                      {dayLabel}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                              <p className="mt-1 text-xs text-muted-foreground">
                                                One teacher can cover all selected days. For teacher splits, select days for each teacher.
                                              </p>
                                            </div>
                                          ) : null}
                                        </div>
                                      ))}
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => addSlotSubjectTeacherRow(row.key)}
                                        disabled={!row.subject_id}
                                      >
                                        <Plus className="mr-2 size-4" />
                                        Add Teacher Split
                                      </Button>
                                    </div>
                                  </div>
                                  {isPackedSelectedRoutine ? (
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                      <Field label="Medium Applies To">
                                        <select
                                          className={selectClassName}
                                          value={row.applies_medium || ""}
                                          onChange={(event) => updateSlotSubjectRow(row.key, { applies_medium: event.target.value, section_ids: [] })}
                                        >
                                          <option value="">All mediums</option>
                                          {(selectedRoutineClass?.mediums || []).map((medium) => (
                                            <option key={medium} value={medium}>{medium}</option>
                                          ))}
                                        </select>
                                      </Field>
                                      <Field label="Sections Applies To">
                                        <div className="rounded-md border border-border bg-background p-2">
                                          <div className="flex flex-wrap gap-2">
                                            {(selectedRoutineClass?.sections || [])
                                              .filter((section) => !row.applies_medium || section.medium === row.applies_medium)
                                              .map((section) => {
                                                const selected = (row.section_ids || []).map(String).includes(String(section.id));
                                                return (
                                                  <button
                                                    key={`${row.key}-${section.id}`}
                                                    type="button"
                                                    className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
                                                      selected
                                                        ? "border-primary bg-primary text-primary-foreground"
                                                        : "border-border bg-muted/30 text-foreground hover:bg-muted"
                                                    }`}
                                                    onClick={() => toggleSlotSubjectSection(row.key, section.id)}
                                                  >
                                                    {section.name}{section.medium ? ` - ${section.medium}` : ""}
                                                  </button>
                                                );
                                              })}
                                          </div>
                                          <p className="mt-2 text-xs text-muted-foreground">
                                            No section selected means all matching sections.
                                          </p>
                                        </div>
                                      </Field>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                            <Button type="button" variant="outline" onClick={addSlotSubjectRow}>
                              <Plus className="mr-2 size-4" />
                              Add Subject
                            </Button>
                          </div>
                          ) : null}
                          {slotForm.entry_type === "custom" ? (
                          <div className="space-y-3">
                            {(slotForm.customRows || []).map((row, index) => (
                              <div key={row.key} className="rounded-md border border-border bg-muted/20 p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium text-foreground">Custom Subject {index + 1}</p>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => removeSlotCustomRow(row.key)}
                                    aria-label={`${(slotForm.customRows || []).length > 1 ? "Delete" : "Clear"} custom subject ${index + 1}`}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <Field label="Routine Title">
                                    <Input
                                      required
                                      value={row.title}
                                      onChange={(event) => updateSlotCustomRow(row.key, { title: event.target.value })}
                                    />
                                  </Field>
                                  <Field label="Teacher">
                                    <select
                                      className={selectClassName}
                                      value={row.teacher_id}
                                      onChange={(event) => updateSlotCustomRow(row.key, { teacher_id: event.target.value })}
                                    >
                                      <option value="">No teacher</option>
                                      {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                                    </select>
                                  </Field>
                                </div>
                              </div>
                            ))}
                            <Button type="button" variant="outline" onClick={addSlotCustomRow}>
                              <Plus className="mr-2 size-4" />
                              Add Custom Subject
                            </Button>
                          </div>
                          ) : null}
                          {slotForm.entry_type === "activity" ? (
                            <Field label="Activity">
                              <select
                                required
                                className={selectClassName}
                                value={slotForm.activity_id}
                                onChange={(event) => setSlotForm((current) => ({ ...current, activity_id: event.target.value }))}
                              >
                                <option value="">Select activity</option>
                                {activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}
                              </select>
                            </Field>
                          ) : null}
                        </div>
                        <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-border bg-background pt-4">
                          <Button type="button" variant="outline" onClick={() => setSlotEditorOpen(false)}>Cancel</Button>
                          <Button type="submit">Save Slot</Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                    {selectedClassRoutine?.status === "draft" ? (
                      <Button onClick={() => runAction(() => publishClassRoutine(selectedClassRoutine.id), "Class routine published.")}>
                        <Send className="mr-2 size-4" />
                        Publish routine
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : <EmptyState title="No class routines found" description="Create a draft routine for a session, class, section, and medium." />}
            </CardContent>
          </RoutineCard>
        </TabsContent>

        <TabsContent value="exam" className="mt-4">
          <RoutineCard>
            <CardHeader>
              <div className="space-y-3">
                <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 text-left">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-foreground">
                        {selectedExamRoutineExamGroup?.exam_name || "Exam Routine"}
                      </p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {selectedExamRoutine ? selectedExamRoutineHeader || "Selected routine" : "Select an exam and class routine"}
                      </p>
                    </div>
                  </div>
                  <div className="flex max-w-full flex-wrap items-center justify-start gap-3 text-sm text-muted-foreground xl:justify-end">
                    {selectedExamRoutine?.status ? <StatusBadge status={selectedExamRoutine.status} /> : null}
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />{selectedExamRoutineSummary.rows} rows</span>
                    <span className="inline-flex items-center gap-1.5"><BookOpen className="size-4" />{selectedExamRoutineSummary.subjects} subjects</span>
                    <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4" />{selectedExamRoutineSummary.invigilators} invigilators</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {examRoutineExamGroups.length ? (
                    <div className="min-w-0 overflow-x-auto pb-1">
                      <div className="flex min-w-max gap-2">
                        {examRoutineExamGroups.map((group) => {
                          const selected = group.key === selectedExamRoutineExamGroup?.key;
                          return (
                            <button
                              key={group.key}
                              type="button"
                              className={`min-w-[180px] rounded-md border px-3 py-2 text-left text-sm transition ${
                                selected
                                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                  : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted/40"
                              }`}
                              onClick={() => {
                                setSelectedExamRoutineExamKey(group.key);
                                const preferred = group.routines.find((routine) => routine.status === "published") || group.routines[0];
                                setSelectedExamRoutineId(preferred ? String(preferred.id) : "");
                              }}
                            >
                              <span className="block truncate font-medium">{group.exam_name || "Exam"}</span>
                              <span className={`mt-0.5 block text-xs ${selected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                                {group.routines.length} class routine{group.routines.length === 1 ? "" : "s"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {selectedExamRoutineClassItems.length ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => moveSelectedExamRoutine(-1)}
                        disabled={selectedExamRoutineClassItems.length <= 1}
                        aria-label="Previous class exam routine"
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                      <div className="min-w-0 flex-1 overflow-x-auto pb-1">
                        <div className="flex min-w-max gap-2">
                          {selectedExamRoutineClassItems.map((routine) => {
                            const selected = String(routine.id) === String(selectedExamRoutineId);
                            const title = [routine.class_name || "Class", routine.section_name, routine.medium, routine.stream_name]
                              .filter(Boolean)
                              .join(" | ");
                            return (
                              <button
                                key={routine.id}
                                type="button"
                                className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                                  selected
                                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                    : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted/40"
                                }`}
                                onClick={() => setSelectedExamRoutineId(String(routine.id))}
                              >
                                <span className="block max-w-[220px] truncate font-medium">{title || "Class Routine"}</span>
                                <span className={`mt-0.5 block text-xs ${selected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                                  {routine.entry_count || 0} rows
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => moveSelectedExamRoutine(1)}
                        disabled={selectedExamRoutineClassItems.length <= 1}
                        aria-label="Next class exam routine"
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-end">
                  <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 lg:justify-end [&>*]:h-9">
                    {["draft", "published"].includes(selectedExamRoutine?.status) ? (
                      <>
                        <Button type="button" size="sm" variant="outline" onClick={openEditExamRoutine}>
                          <Pencil className="mr-2 size-4" />
                          Edit
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={handleDeleteExamRoutine}>
                          <Trash2 className="mr-2 size-4 text-destructive" />
                          Delete
                        </Button>
                      </>
                    ) : null}
                    <Dialog open={examImportOpen} onOpenChange={setExamImportOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm"><Upload className="mr-2 size-4" />Import</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Import Exam Routine</DialogTitle>
                          <DialogDescription>Headers can include Exam, Class, Section, Medium, Stream, Date, Start Time, End Time, Subject, Invigilator, Type, Title, Room, and Instructions.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                          <FileField file={examImportFile} onChange={setExamImportFile} />
                          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                            Exam can be provided as an ID or exact exam name in the sheet.
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setExamImportOpen(false)}>Cancel</Button>
                            <Button type="button" onClick={handleImportExamRoutine} disabled={!examImportFile}>Import</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    {selectedExamRoutine?.id ? (
                      <Button size="sm" variant="outline" onClick={() => downloadFile(downloadExamRoutinePdf, selectedExamRoutine.id, `exam-routine-${selectedExamRoutine.id}.pdf`, "Failed to download exam routine PDF")}>
                        Download PDF
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Dialog
                open={examOpen}
                onOpenChange={(open) => {
                  setExamOpen(open);
                  if (!open) setEditingExamRoutineId(null);
                }}
              >
                  <DialogContent className="max-h-[85vh] w-[min(96vw,1040px)] max-w-none overflow-y-auto sm:max-w-[min(96vw,1040px)]">
                  <DialogHeader>
                    <DialogTitle>{editingExamRoutineId ? "Edit Exam Routine" : "Create Exam Routine"}</DialogTitle>
                    <DialogDescription>Select an existing exam and scope, then add one or more routine rows.</DialogDescription>
                  </DialogHeader>
                  <form className="space-y-4" onSubmit={handleSaveExamRoutine}>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <Field label="Scope">
                        <select required className={selectClassName} value={examForm.class_scope} onChange={(event) => updateExamForm("class_scope", event.target.value)}>
                          <option value="school">School</option>
                          <option value="hs">Higher Secondary</option>
                        </select>
                      </Field>
                      <Field label="Exam">
                        <select required className={selectClassName} value={examForm.exam_id} onChange={(event) => updateExamForm("exam_id", event.target.value)}>
                          <option value="">Select exam</option>
                          {scopedExams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Class">
                        <select required className={selectClassName} value={examForm.class_id} onChange={(event) => updateExamForm("class_id", event.target.value)}>
                          <option value="">Select class</option>
                          {examScopeClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Section">
                        <select className={selectClassName} value={examForm.section_id} onChange={(event) => updateExamForm("section_id", event.target.value)}>
                          <option value="">All sections</option>
                          {(selectedExamClass?.sections || []).map((section) => <option key={`${section.id}-${section.medium}`} value={section.id}>{section.name} - {section.medium}</option>)}
                        </select>
                      </Field>
                      <Field label="Medium">
                        <select className={selectClassName} value={examForm.medium} onChange={(event) => updateExamForm("medium", event.target.value)}>
                          <option value="">All mediums</option>
                          {(selectedExamClass?.mediums || []).map((medium) => <option key={medium} value={medium}>{medium}</option>)}
                        </select>
                      </Field>
                      {selectedExamClass?.class_scope === "hs" ? (
                        <Field label="Stream">
                          <select className={selectClassName} value={examForm.stream_id} onChange={(event) => updateExamForm("stream_id", event.target.value)}>
                            <option value="">No stream</option>
                            {streams.map((stream) => <option key={stream.id} value={stream.id}>{stream.name}</option>)}
                          </select>
                        </Field>
                      ) : null}
                      <label className="flex items-center gap-2 text-sm md:col-span-2 lg:col-span-4">
                        <input type="checkbox" checked={examForm.publish_announcement_requested} onChange={(event) => setExamForm((current) => ({ ...current, publish_announcement_requested: event.target.checked }))} />
                        Create announcement after publish
                      </label>
                    </div>
                    <div className="space-y-3">
                      {examForm.entries.map((entry, index) => (
                        <div key={index} className="rounded-md border border-border bg-muted/20 p-3">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">Exam Row {index + 1}</p>
                            {examForm.entries.length > 1 ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => removeExamEntry(index)}
                                aria-label={`Delete exam row ${index + 1}`}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            ) : null}
                          </div>
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                            <Field label="Date"><Input required type="date" value={entry.exam_date} onChange={(event) => updateExamEntry(index, "exam_date", event.target.value)} /></Field>
                            <Field label="Start"><Input type="time" value={entry.start_time} onChange={(event) => updateExamEntry(index, "start_time", event.target.value)} /></Field>
                            <Field label="End"><Input type="time" value={entry.end_time} onChange={(event) => updateExamEntry(index, "end_time", event.target.value)} /></Field>
                            <Field label="Subject">
                              <select
                                className={selectClassName}
                                value={entry.subject_id}
                                onChange={(event) => {
                                  const option = examSubjectOptions.find((subject) => String(subject.id) === String(event.target.value));
                                  setExamForm((current) => ({
                                    ...current,
                                    entries: current.entries.map((row, rowIndex) =>
                                      rowIndex === index
                                        ? {
                                            ...row,
                                            subject_id: event.target.value,
                                            exam_subject_id: option?.exam_subject_id ? String(option.exam_subject_id) : "",
                                          }
                                        : row
                                    ),
                                  }));
                                }}
                                disabled={!examForm.exam_id || !examForm.class_id}
                              >
                                <option value="">{examForm.exam_id && examForm.class_id ? "None" : "Select exam and class"}</option>
                                {examSubjectOptions.map((subject) => (
                                  <option key={`${subject.id}-${subject.exam_subject_id || "subject"}`} value={subject.id}>
                                    {subject.name}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Invigilator">
                              <select className={selectClassName} value={entry.invigilator_id} onChange={(event) => updateExamEntry(index, "invigilator_id", event.target.value)}>
                                <option value="">None</option>
                                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                              </select>
                            </Field>
                            <Field label="Room"><Input value={entry.room} onChange={(event) => updateExamEntry(index, "room", event.target.value)} /></Field>
                          </div>
                        </div>
                      ))}
                      <Button type="button" variant="outline" onClick={addExamEntry}>Add Exam Row</Button>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setExamOpen(false)}>Cancel</Button>
                      <Button type="submit">{editingExamRoutineId ? "Save Changes" : "Create Routine"}</Button>
                    </div>
                  </form>
                  </DialogContent>
                </Dialog>

              {examRoutines.length ? (
                <>
                  <div className="overflow-x-auto">
                    <ExamRoutineBoard routine={selectedExamRoutine} />
                  </div>
                  <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                    {selectedExamRoutine?.status === "draft" ? (
                      <Button onClick={() => runAction(() => publishExamRoutine(selectedExamRoutine.id), "Exam routine published.")}>
                        <Send className="mr-2 size-4" />
                        Publish routine
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : <EmptyState title="No exam routines found" description="Create an exam routine linked to an existing exam." />}
            </CardContent>
          </RoutineCard>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <RoutineCard>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">Time Slot Templates</CardTitle>
                <CardDescription>Reusable period structures for school-wide, higher-secondary, or class-specific routines.</CardDescription>
              </div>
              <Dialog
                open={templateOpen}
                onOpenChange={(open) => {
                  setTemplateOpen(open);
                  if (!open) resetTemplateDialog();
                }}
              >
                <DialogTrigger asChild>
                  <Button onClick={resetTemplateDialog}><Plus className="mr-2 size-4" />New Template</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] w-[min(96vw,1120px)] max-w-none overflow-y-auto sm:max-w-[min(96vw,1120px)]">
                  <DialogHeader>
                    <DialogTitle>{editingTemplateId ? "Edit Time Slot Template" : "Create Time Slot Template"}</DialogTitle>
                    <DialogDescription>Define period times and break slots. Class routines can still override entries.</DialogDescription>
                  </DialogHeader>
                  <form className="space-y-4" onSubmit={handleSaveTemplate}>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Name"><Input required value={templateForm.name} onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                      <Field label="Scope">
                        <select className={selectClassName} value={templateForm.scope_level} onChange={(event) => setTemplateForm((current) => ({ ...current, scope_level: event.target.value }))}>
                          <option value="school">School wide</option>
                          <option value="higher_secondary">Higher secondary</option>
                          <option value="class_section">Class/section</option>
                        </select>
                      </Field>
                      <Field label="Status">
                        <select className={selectClassName} value={templateForm.is_active === false ? "0" : "1"} onChange={(event) => setTemplateForm((current) => ({ ...current, is_active: event.target.value === "1" }))}>
                          <option value="1">Active</option>
                          <option value="0">Inactive</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Description"><Input value={templateForm.description || ""} onChange={(event) => setTemplateForm((current) => ({ ...current, description: event.target.value }))} /></Field>
                    <div className="space-y-3">
                      {templateForm.slots.map((slot, index) => (
                        <div key={index} className="grid gap-3 rounded-md border border-border bg-muted/20 p-3 md:grid-cols-2 xl:grid-cols-[0.7fr_1.4fr_0.9fr_0.9fr_1fr_1.2fr_auto]">
                          <Field label="Period"><Input required value={slot.period_number} onChange={(event) => updateTemplateSlot(index, "period_number", event.target.value)} /></Field>
                          <Field label="Label"><Input value={slot.label} onChange={(event) => updateTemplateSlot(index, "label", event.target.value)} /></Field>
                          <Field label="Start"><Input required type="time" value={slot.start_time} onChange={(event) => updateTemplateSlot(index, "start_time", event.target.value)} /></Field>
                          <Field label="End"><Input required type="time" value={slot.end_time} onChange={(event) => updateTemplateSlot(index, "end_time", event.target.value)} /></Field>
                          <Field label="Type"><select className={selectClassName} value={slot.default_entry_type} onChange={(event) => updateTemplateSlot(index, "default_entry_type", event.target.value)}><option value="subject">Subject</option><option value="break">Break</option><option value="activity">Activity</option><option value="free">Free</option></select></Field>
                          <Field label="Day"><select className={selectClassName} value={slot.weekday} onChange={(event) => updateTemplateSlot(index, "weekday", event.target.value)}><option value="">All days</option>{weekdays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></Field>
                          <div className="flex items-end justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => removeTemplateSlot(index)}
                              aria-label={`Delete slot ${index + 1}`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button type="button" variant="outline" onClick={() => setTemplateForm((current) => ({ ...current, slots: [...current.slots, { weekday: "", period_number: String(current.slots.length + 1), label: "", start_time: "08:00", end_time: "08:40", default_entry_type: "subject" }] }))}>Add Slot</Button>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setTemplateOpen(false)}>Cancel</Button>
                      <Button type="submit">{editingTemplateId ? "Save Template" : "Create Template"}</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
              {templates.length ? templates.map((template) => (
                <div key={template.id} className="flex flex-col gap-3 rounded-md border border-border bg-background p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">{template.name}</p>
                    <p className="text-xs text-muted-foreground">{template.scope_level} / {template.class_name || "All classes"} / {template.medium || "All mediums"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={template.is_active ? statusClass.published : statusClass.archived}>{template.is_active ? "active" : "inactive"}</Badge>
                    <Button size="sm" variant="outline" onClick={() => openEditTemplate(template)}>
                      <Pencil className="mr-2 size-4" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDeleteTemplate(template)}>
                      <Trash2 className="mr-2 size-4 text-destructive" />
                      Delete
                    </Button>
                  </div>
                </div>
              )) : <EmptyState title="No time slot templates found" description="Create reusable period timing templates before building detailed routines." />}
            </CardContent>
          </RoutineCard>
        </TabsContent>
      </Tabs>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4 animate-pulse" />
          Loading routine data...
        </div>
      ) : null}
    </div>
  );
}

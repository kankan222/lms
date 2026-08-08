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
import { getClassStructure, getSessions, getStreams } from "../api/academic.api";
import { getClassSubjects, getSubjectOfferings, getSubjects } from "../api/subjects.api";
import { getAssignedTeachers, getTeachers } from "../api/teachers.api";
import { getExams } from "../api/exam.api";
import { getActivities } from "../api/marksheet.api";
import { useAuth } from "../hooks/useAuth";
import {
  cancelSubstitution,
  createClassRoutine,
  createClassRoutineDraft,
  createExamRoutine,
  createExamRoutineDraft,
  createSubstitution,
  createTimeSlotTemplate,
  deleteExamRoutine,
  downloadClassRoutinePdf,
  downloadExamRoutinePdf,
  getClassRoutine,
  getClassRoutineBoard,
  getClassRoutines,
  getExamRoutine,
  getExamRoutines,
  getSubstitutions,
  getTimeSlotTemplate,
  getTimeSlotTemplates,
  importClassRoutineSheet,
  importExamRoutineSheet,
  publishClassRoutine,
  publishExamRoutine,
  publishSubstitution,
  updateClassRoutine,
  updateClassRoutineSlot,
  updateExamRoutine,
  updateSubstitution,
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

const emptyExamEntry = {
  exam_date: "",
  start_time: "08:00",
  end_time: "10:00",
  entry_type: "subject",
  subject_id: "",
  invigilator_id: "",
  title: "",
  room: "",
};

function createInitialExamForm() {
  return {
    exam_id: "",
    class_id: "",
    section_id: "",
    medium: "",
    stream_id: "",
    publish_announcement_requested: false,
    entries: [{ ...emptyExamEntry }],
  };
}

const emptySubstitutionForm = {
  session_id: "",
  class_id: "",
  section_id: "",
  medium: "",
  stream_id: "",
  weekday: "",
  period_number: "",
  starts_on: "",
  ends_on: "",
  start_time: "08:00",
  end_time: "08:40",
  change_type: "teacher_substitution",
  original_subject_id: "",
  replacement_subject_id: "",
  teacher_id: "",
  teacher_assignment_role: "replacement",
  title: "",
  original_room: "",
  replacement_room: "",
  reason: "",
  notes: "",
};

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

function displayDateTime(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
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
  return entry.subject_name || entry.activity_name || entry.title || displayChangeType(entry.entry_type);
}

function entrySubtitle(entry, showTeachers = true) {
  if (entry.entry_type === "break") return "Break";
  if (!showTeachers) return "";
  return entry.teacher_names || "Teacher not assigned";
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
  const isBreak = entry?.entry_type === "break";
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

function RoutineSlotBlock({ entries = [], fallbackEntry = null, showTeachers = true }) {
  const visibleEntries = entries.length ? entries : fallbackEntry ? [fallbackEntry] : [];
  if (!visibleEntries.length) return <RoutineEntryBlock entry={null} />;

  return (
    <div className="space-y-1.5">
      {visibleEntries.map((entry, index) => (
        <RoutineEntryBlock
          key={entry.id || entry.entry_id || `${entry.entry_type}-${entry.subject_id || entry.title || index}`}
          entry={entry}
          showTeachers={showTeachers}
        />
      ))}
    </div>
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
    const isBreak = firstEntry?.entry_type === "break" || firstSlot?.default_entry_type === "break";
    const timeSource = firstEntry || firstSlot;
    return {
      label: isBreak ? "Break" : `Period ${period}`,
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
                return (
                  <button
                    key={`${day.value}-${period}`}
                    type="button"
                    className="min-w-0 border-l border-border p-1.5 text-left outline-none transition-colors hover:bg-muted/20 focus-visible:bg-muted/30"
                    onClick={() => onSlotClick?.({ day, period, entries: slotEntries, entry: slotEntries[0] || null, slot })}
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
  const periodMeta = (period) => {
    const firstEntry = routines
      .flatMap((routine) => routine.entries || [])
      .find((entry) => Number(entry.period_number) === Number(period));
    const isBreak = firstEntry?.entry_type === "break";
    return {
      label: isBreak ? "Break" : `Period ${period}`,
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
                return (
                  <button
                    key={`${routine.routine_version_id}-${period}`}
                    type="button"
                    className="min-w-0 border-l border-border p-1.5 text-left outline-none transition-colors hover:bg-muted/20 focus-visible:bg-muted/30"
                    onClick={() => onSlotClick?.({
                      day: { value: String(selectedWeekday), label: dayMeta.label },
                      period,
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
  return entry.subject_name || entry.title || displayChangeType(entry.entry_type || "subject");
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
    return <EmptyState title="No exam rows added" description="Create or import exam routine rows for this draft." />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid border-b border-border bg-muted/20 md:grid-cols-[140px_minmax(0,1fr)_160px]">
        <div className="px-3 py-3 text-xs font-semibold text-foreground">Date</div>
        <div className="border-t border-border px-3 py-3 text-xs font-semibold text-foreground md:border-t-0 md:border-l">Subject</div>
        <div className="border-t border-border px-3 py-3 text-xs font-semibold text-foreground md:border-t-0 md:border-l md:text-right">Time</div>
      </div>
      <div>
        {rows.map((row) => (
          <div key={row.date} className="grid border-b border-border last:border-b-0 md:grid-cols-[140px_minmax(0,1fr)_160px]">
            <div className="flex flex-col justify-center px-3 py-3">
              <span className="text-sm font-semibold text-foreground">{row.date}</span>
              {weekdayFromDate(row.date) ? <span className="mt-1 text-xs text-muted-foreground">{weekdayFromDate(row.date)}</span> : null}
            </div>
            <div className="grid border-t border-border md:col-span-2 md:border-t-0 md:border-l">
              {row.entries.map((entry) => (
                <div key={entry.id || `${row.date}-${entry.subject_id}-${entry.start_time}`} className="grid border-b border-border last:border-b-0 md:grid-cols-[minmax(0,1fr)_160px]">
                  <div className="min-w-0 px-3 py-3">
                    <p className="truncate text-sm font-semibold text-foreground">{examEntryTitle(entry)}</p>
                    <p className="mt-1 truncate text-muted-foreground">{entry.invigilator_names || "No invigilator"}{entry.room ? ` / ${entry.room}` : ""}</p>
                  </div>
                  <div className="border-t border-border px-3 py-3 text-sm font-semibold text-foreground md:border-t-0 md:border-l md:text-right">
                    {timeInputValue(entry.start_time, "--:--")} - {timeInputValue(entry.end_time, "--:--")}
                  </div>
                </div>
              ))}
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
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [exams, setExams] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [classRoutines, setClassRoutines] = useState([]);
  const [classRoutineBoard, setClassRoutineBoard] = useState(null);
  const [examRoutines, setExamRoutines] = useState([]);
  const [substitutions, setSubstitutions] = useState([]);
  const [selectedClassRoutineId, setSelectedClassRoutineId] = useState("");
  const [selectedClassRoutine, setSelectedClassRoutine] = useState(null);
  const [selectedExamRoutineId, setSelectedExamRoutineId] = useState("");
  const [selectedExamRoutine, setSelectedExamRoutine] = useState(null);
  const [classViewMode, setClassViewMode] = useState("week");
  const [selectedClassDay, setSelectedClassDay] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);

  const [templateOpen, setTemplateOpen] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const [examOpen, setExamOpen] = useState(false);
  const [editingExamRoutineId, setEditingExamRoutineId] = useState(null);
  const [substitutionOpen, setSubstitutionOpen] = useState(false);
  const [editingSubstitutionId, setEditingSubstitutionId] = useState(null);
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

  const [templateForm, setTemplateForm] = useState({
    name: "",
    scope_level: "school",
    slots: [
      { weekday: "", period_number: "1", label: "Period 1", start_time: "08:00", end_time: "08:40", default_entry_type: "subject" },
      { weekday: "", period_number: "2", label: "Break", start_time: "10:25", end_time: "10:45", default_entry_type: "break" },
    ],
  });

  const [classForm, setClassForm] = useState({
    session_id: "",
    class_id: "",
    section_id: "",
    medium: "",
    stream_id: "",
    time_slot_template_id: "",
  });

  const [examForm, setExamForm] = useState(createInitialExamForm);

  const [substitutionForm, setSubstitutionForm] = useState(emptySubstitutionForm);

  const selectedClass = useMemo(
    () => classes.find((item) => String(item.id) === String(classForm.class_id)),
    [classes, classForm.class_id]
  );

  const selectedExamClass = useMemo(
    () => classes.find((item) => String(item.id) === String(examForm.class_id)),
    [classes, examForm.class_id]
  );

  const filterClass = useMemo(
    () => classes.find((item) => String(item.id) === String(filters.class_id)),
    [classes, filters.class_id]
  );

  const substitutionClass = useMemo(
    () => classes.find((item) => String(item.id) === String(substitutionForm.class_id)),
    [classes, substitutionForm.class_id]
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

  const showRoutineTeachers = useMemo(() => {
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    return !roles.some((role) => ["student", "parent"].includes(String(role).toLowerCase()));
  }, [user?.roles]);

  const routineNavigationItems = useMemo(
    () => [...classRoutines].sort((a, b) =>
      Number(a.class_id || 0) - Number(b.class_id || 0) ||
      String(a.section_name || "").localeCompare(String(b.section_name || ""), undefined, { numeric: true, sensitivity: "base" }) ||
      String(a.medium || "").localeCompare(String(b.medium || ""), undefined, { sensitivity: "base" }) ||
      Number(a.stream_id || 0) - Number(b.stream_id || 0) ||
      Number(a.version_number || 0) - Number(b.version_number || 0)
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

  const examRoutineNavigationItems = useMemo(
    () => [...examRoutines].sort((a, b) =>
      String(a.exam_name || "").localeCompare(String(b.exam_name || ""), undefined, { numeric: true, sensitivity: "base" }) ||
      Number(a.version_number || 0) - Number(b.version_number || 0)
    ),
    [examRoutines]
  );

  const selectedExamRoutineNavigationIndex = useMemo(
    () => examRoutineNavigationItems.findIndex((routine) => String(routine.id) === String(selectedExamRoutineId)),
    [examRoutineNavigationItems, selectedExamRoutineId]
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
      selectedExamRoutine.exam_name || "Exam Routine",
      firstEntry?.class_name,
      firstEntry?.section_name,
      firstEntry?.stream_name,
    ].filter(Boolean).join(" | ");
  }, [selectedExamRoutine]);

  async function loadReferenceData() {
    const [sessionRes, classRes, streamRes, subjectRes, teacherRes, activityRes, examRes] = await Promise.all([
      getSessions(),
      getClassStructure(),
      getStreams(),
      getSubjects(),
      getTeachers(),
      getActivities(),
      getExams(),
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
    setSubjects(unwrap(subjectRes));
    setTeachers(unwrap(teacherRes));
    setActivities(unwrap(activityRes));
    setExams(unwrap(examRes));
  }

  async function loadRoutineData(nextFilters = filters) {
    const cleanFilters = Object.fromEntries(
      Object.entries(nextFilters).filter(([, value]) => value !== "")
    );
    const [templateRes, classRes, examRoutineRes, substitutionRes] = await Promise.all([
      getTimeSlotTemplates(),
      getClassRoutines(cleanFilters),
      getExamRoutines(cleanFilters),
      getSubstitutions(cleanFilters),
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
    setSelectedExamRoutineId((current) => {
      if (!nextExamRoutines.length) return "";
      if (current && nextExamRoutines.some((routine) => String(routine.id) === String(current))) return current;
      const preferred = nextExamRoutines.find((routine) => routine.status === "published") || nextExamRoutines[0];
      return preferred ? String(preferred.id) : "";
    });
    setSubstitutions(unwrap(substitutionRes));
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
    if (!selectedExamRoutineId) return;
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
            if (!row.teacher_id || !row.subject_id) return row;
            const options = optionsBySubject[String(row.subject_id)] || [];
            const teacherExists = options.some((teacher) => String(teacher.id) === String(row.teacher_id));
            return teacherExists ? row : { ...row, teacher_id: "" };
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
    if (!examRoutineNavigationItems.length) return;
    const currentIndex = selectedExamRoutineNavigationIndex >= 0 ? selectedExamRoutineNavigationIndex : 0;
    const nextIndex = (currentIndex + direction + examRoutineNavigationItems.length) % examRoutineNavigationItems.length;
    setSelectedExamRoutineId(String(examRoutineNavigationItems[nextIndex].id));
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
      exam_id: routine.exam_id ? String(routine.exam_id) : "",
      class_id: firstEntry.class_id ? String(firstEntry.class_id) : "",
      section_id: firstEntry.section_id ? String(firstEntry.section_id) : "",
      medium: firstEntry.medium || "",
      stream_id: firstEntry.stream_id ? String(firstEntry.stream_id) : "",
      publish_announcement_requested: Boolean(routine.publish_announcement_requested),
      entries: entries.length
        ? entries.map((entry) => ({
            exam_date: dateInputValue(entry.exam_date),
            start_time: timeInputValue(entry.start_time, "08:00"),
            end_time: timeInputValue(entry.end_time, "10:00"),
            entry_type: entry.entry_type || "subject",
            subject_id: entry.subject_id ? String(entry.subject_id) : "",
            invigilator_id: entry.invigilator_ids?.[0] ? String(entry.invigilator_ids[0]) : "",
            title: entry.title || "",
            room: entry.room || "",
          }))
        : [{ ...emptyExamEntry }],
    });
  }

  async function openEditExamRoutine() {
    if (!selectedExamRoutine) return;
    if (selectedExamRoutine.status === "published") {
      setError("");
      try {
        const response = await createExamRoutineDraft(selectedExamRoutine.id);
        const draft = response.data;
        if (draft?.id) setSelectedExamRoutineId(String(draft.id));
        populateExamFormFromRoutine(draft);
        setExamOpen(true);
        showNotice("Draft created from published exam routine.");
        await loadRoutineData();
      } catch (err) {
        showError(err.message || "Failed to create exam routine draft");
      }
      return;
    }
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
      }
      if (key === "section_id") {
        const section = (selectedClass?.sections || []).find((item) => String(item.id) === String(value));
        next.medium = section?.medium || "";
      }
      return next;
    });
  }

  function emptySubjectSlotRow(index = 1) {
    return { key: `subject-${Date.now()}-${index}`, subject_id: "", teacher_id: "" };
  }

  function openSlotEditor(context) {
    setError("");
    const existingEntries = context.entries?.length ? context.entries : context.entry ? [context.entry] : [];
    const subjectEntries = existingEntries.filter((entry) => entry.entry_type === "subject");
    const primaryEntry = subjectEntries[0] || existingEntries[0] || null;
    const entryType = subjectEntries.length ? "subject" : primaryEntry?.entry_type || context.slot?.default_entry_type || "subject";
    setSlotContext(context);
    setSlotForm({
      entry_type: entryType,
      activity_id: primaryEntry?.activity_id ? String(primaryEntry.activity_id) : "",
      subjectRows: subjectEntries.length
        ? subjectEntries.map((entry, index) => ({
            key: `subject-${entry.id || entry.entry_id || index}`,
            subject_id: entry.subject_id ? String(entry.subject_id) : "",
            teacher_id: entry.teacher_ids?.[0] ? String(entry.teacher_ids[0]) : "",
          }))
        : [emptySubjectSlotRow(1)],
    });
    setSlotEditorOpen(true);
  }

  function updateSlotSubjectRow(key, updates) {
    setSlotForm((current) => ({
      ...current,
      subjectRows: (current.subjectRows || []).map((row) => (row.key === key ? { ...row, ...updates } : row)),
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

  function serializeRoutineEntry(entry, index) {
    return {
      time_slot_id: toNumberOrNull(entry.time_slot_id),
      weekday: String(entry.weekday),
      period_number: Number(entry.period_number),
      start_time: timeInputValue(entry.start_time, fallbackSlotTime(entry.period_number).start_time),
      end_time: timeInputValue(entry.end_time, fallbackSlotTime(entry.period_number).end_time),
      entry_type: entry.entry_type || "subject",
      subject_id: toNumberOrNull(entry.subject_id),
      activity_id: toNumberOrNull(entry.activity_id),
      title: entry.title || "",
      room: entry.room || "",
      notes: entry.notes || "",
      sort_order: Number.isFinite(Number(entry.sort_order)) ? Number(entry.sort_order) : index,
      teachers: (entry.teachers || entry.teacher_ids || []).map((teacher) => ({
        teacher_id: typeof teacher === "object" ? teacher.teacher_id || teacher.id : teacher,
        teacher_role: typeof teacher === "object" ? teacher.teacher_role || "primary" : "primary",
      })),
    };
  }

  async function updateSlotThroughRoutineDraft(slotPayload) {
    const slotEntries = Array.isArray(slotPayload.entries) ? slotPayload.entries : [slotPayload];
    const firstEntry = slotEntries[0];
    const sourceRoutine = slotContext?.routine || selectedClassRoutine;
    const sourceRoutineId = sourceRoutine?.id || sourceRoutine?.routine_version_id;
    const draftRoutine = sourceRoutine?.status === "draft"
      ? (await getClassRoutine(sourceRoutineId)).data
      : (await createClassRoutineDraft(sourceRoutineId)).data;
    const nextEntries = (draftRoutine.entries || [])
      .filter((item) => !(String(item.weekday) === String(firstEntry.weekday) && Number(item.period_number) === Number(firstEntry.period_number)))
      .concat(slotEntries)
      .sort((a, b) => Number(a.weekday) - Number(b.weekday) || Number(a.period_number) - Number(b.period_number))
      .map(serializeRoutineEntry);
    return updateClassRoutine(draftRoutine.id, {
      title: draftRoutine.title,
      time_slot_template_id: draftRoutine.time_slot_template_id,
      entries: nextEntries,
    });
  }

  async function handleSaveSlot(event) {
    event.preventDefault();
    if (!selectedClassRoutine || !slotContext) return;
    const subjectRows = (slotForm.subjectRows || []).filter((row) => row.subject_id || row.teacher_id);
    if (slotForm.entry_type === "subject" && (!subjectRows.length || subjectRows.some((row) => !row.subject_id || !row.teacher_id))) {
      showError("Every subject row needs a subject and assigned teacher.");
      return;
    }
    if (slotForm.entry_type === "activity" && !slotForm.activity_id) {
      showError("Activity is required for activity slots.");
      return;
    }

    const { day, period, slot, entry, entries: existingEntries = [] } = slotContext;
    const primaryEntry = entry || existingEntries[0] || null;
    const fallbackTime = fallbackSlotTime(period);
    const baseSlotPayload = {
      time_slot_id: slot?.id || primaryEntry?.time_slot_id || null,
      weekday: String(day.value),
      period_number: Number(period),
      start_time: timeInputValue(primaryEntry?.start_time || slot?.start_time, fallbackTime.start_time),
      end_time: timeInputValue(primaryEntry?.end_time || slot?.end_time, fallbackTime.end_time),
      room: primaryEntry?.room || "",
      notes: primaryEntry?.notes || "",
    };
    const slotPayloadEntries = slotForm.entry_type === "subject"
      ? subjectRows.map((row, index) => ({
          ...baseSlotPayload,
          entry_type: "subject",
          subject_id: Number(row.subject_id),
          activity_id: null,
          title: "",
          sort_order: Number(period) * 100 + index,
          teachers: [{ teacher_id: Number(row.teacher_id), teacher_role: "primary" }],
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
    const slotPayload = {
      entries: slotPayloadEntries,
    };

    try {
      let response;
      const targetRoutineId = slotContext?.routine?.id || slotContext?.routine?.routine_version_id || selectedClassRoutine.id;
      try {
        response = await updateClassRoutineSlot(targetRoutineId, slotPayload);
      } catch (err) {
        if (err.status !== 404) throw err;
        response = await updateSlotThroughRoutineDraft(slotPayload);
      }
      setSelectedClassRoutine(response.data || null);
      if (response.data?.id) setSelectedClassRoutineId(String(response.data.id));
      setSlotEditorOpen(false);
      showNotice("Routine slot updated.");
      await loadRoutineData();
      if (classViewMode === "day") {
        await loadClassRoutineBoardData(filters, selectedClassDay);
      }
    } catch (err) {
      showError(err.message || "Failed to update routine slot");
    }
  }

  function updateSubstitutionForm(key, value) {
    setSubstitutionForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "class_id") {
        next.section_id = "";
        next.medium = "";
      }
      return next;
    });
  }

  function openNewSubstitution() {
    setEditingSubstitutionId(null);
    setSubstitutionForm(emptySubstitutionForm);
    setSubstitutionOpen(true);
  }

  function openEditSubstitution(item) {
    const teacherIds = String(item.teacher_ids || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const teacherRoles = String(item.teacher_roles || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const replacementIndex = teacherRoles.findIndex((role) => role === "replacement" || role === "additional");
    setEditingSubstitutionId(item.id);
    setSubstitutionForm({
      session_id: item.session_id ? String(item.session_id) : "",
      class_id: item.class_id ? String(item.class_id) : "",
      section_id: item.section_id ? String(item.section_id) : "",
      medium: item.medium || "",
      stream_id: item.stream_id ? String(item.stream_id) : "",
      weekday: item.weekday ? String(item.weekday) : "",
      period_number: item.period_number ? String(item.period_number) : "",
      starts_on: dateInputValue(item.starts_on),
      ends_on: dateInputValue(item.ends_on),
      start_time: timeInputValue(item.start_time, "08:00"),
      end_time: timeInputValue(item.end_time, "08:40"),
      change_type: item.change_type || "teacher_substitution",
      original_subject_id: item.original_subject_id ? String(item.original_subject_id) : "",
      replacement_subject_id: item.replacement_subject_id ? String(item.replacement_subject_id) : "",
      teacher_id: teacherIds[replacementIndex >= 0 ? replacementIndex : 0] || "",
      teacher_assignment_role: teacherRoles[replacementIndex >= 0 ? replacementIndex : 0] || "replacement",
      title: item.title || "",
      original_room: item.original_room || "",
      replacement_room: item.replacement_room || "",
      reason: item.reason || "",
      notes: item.notes || "",
    });
    setSubstitutionOpen(true);
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
      if (key === "class_id") {
        next.section_id = "";
        next.medium = "";
        next.stream_id = "";
      }
      if (key === "section_id") {
        const section = (selectedExamClass?.sections || []).find((item) => String(item.id) === String(value));
        next.medium = section?.medium || "";
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

  function updateTemplateSlot(index, key, value) {
    setTemplateForm((current) => ({
      ...current,
      slots: current.slots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, [key]: value } : slot
      ),
    }));
  }

  async function handleCreateTemplate(event) {
    event.preventDefault();
    setError("");
    try {
      await createTimeSlotTemplate(templateForm);
      setTemplateOpen(false);
      showNotice("Time slot template created.");
      await loadRoutineData();
    } catch (err) {
      showError(err.message || "Failed to create time slot template");
    }
  }

  async function handleCreateClassRoutine(event) {
    event.preventDefault();
    setError("");
    const selectedSection = (selectedClass?.sections || []).find((section) => String(section.id) === String(classForm.section_id));
    const medium = selectedSection?.medium || classForm.medium;
    if (!medium) {
      showError("Selected section does not have a medium.");
      return;
    }
    try {
      const response = await createClassRoutine({
        ...classForm,
        medium,
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

  function buildExamRoutinePayload() {
    return {
      exam_id: examForm.exam_id,
      publish_announcement_requested: examForm.publish_announcement_requested,
      entries: examForm.entries.map((entry) => ({
        ...entry,
        class_id: Number(examForm.class_id),
        section_id: toNumberOrNull(examForm.section_id),
        medium: examForm.medium,
        stream_id: toNumberOrNull(examForm.stream_id),
        subject_id: toNumberOrNull(entry.subject_id),
        invigilators: entry.invigilator_id
          ? [{ teacher_id: Number(entry.invigilator_id), invigilation_role: "invigilator" }]
          : [],
      })),
    };
  }

  async function handleSaveExamRoutine(event) {
    event.preventDefault();
    setError("");
    if (!examForm.medium) {
      showError("Selected section does not have a medium.");
      return;
    }
    try {
      const payload = buildExamRoutinePayload();
      const response = editingExamRoutineId
        ? await updateExamRoutine(editingExamRoutineId, payload)
        : await createExamRoutine(payload);
      const savedRoutine = response.data;
      setExamOpen(false);
      setEditingExamRoutineId(null);
      if (savedRoutine?.id) setSelectedExamRoutineId(String(savedRoutine.id));
      showNotice(editingExamRoutineId ? "Exam routine draft updated." : "Exam routine draft created.");
      await loadRoutineData();
    } catch (err) {
      showError(err.message || "Failed to save exam routine");
    }
  }

  async function handleDeleteExamRoutine() {
    if (!selectedExamRoutine?.id) return;
    if (!window.confirm(`Delete this ${selectedExamRoutine.status || "selected"} exam routine?`)) return;
    setError("");
    try {
      await deleteExamRoutine(selectedExamRoutine.id);
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
      showNotice(`Imported ${result.imported_count || 0} exam routine draft${Number(result.imported_count || 0) === 1 ? "" : "s"}.`);
      if (result.failed_count) {
        showError(`${result.failed_count} row or group${Number(result.failed_count) === 1 ? "" : "s"} failed during exam routine import.`);
      }
      await loadRoutineData();
    } catch (err) {
      showError(err.message || "Failed to import exam routine");
    }
  }

  async function handleSaveSubstitution(event) {
    event.preventDefault();
    setError("");
    try {
      const payload = {
        ...substitutionForm,
        stream_id: toNumberOrNull(substitutionForm.stream_id),
        original_subject_id: toNumberOrNull(substitutionForm.original_subject_id),
        replacement_subject_id: toNumberOrNull(substitutionForm.replacement_subject_id),
        teachers: substitutionForm.teacher_id
          ? [{ teacher_id: Number(substitutionForm.teacher_id), assignment_role: substitutionForm.teacher_assignment_role || "replacement" }]
          : [],
      };
      if (editingSubstitutionId) {
        await updateSubstitution(editingSubstitutionId, payload);
      } else {
        await createSubstitution(payload);
      }
      setSubstitutionOpen(false);
      setEditingSubstitutionId(null);
      setSubstitutionForm(emptySubstitutionForm);
      showNotice(editingSubstitutionId ? "Substitution draft updated." : "Substitution draft created.");
      await loadRoutineData();
    } catch (err) {
      showError(err.message || "Failed to save substitution");
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

  async function downloadPdf(downloadFn, id, fileName) {
    setError("");
    try {
      const blob = await downloadFn(id);
      saveBlob(blob, fileName);
    } catch (err) {
      showError(err.message || "Failed to download PDF");
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

      <TopBar
        title={activeTab === "class" ? "Class Routine" : activeTab === "exam" ? "Exam Routine" : activeTab === "substitutions" ? "Substitutions" : "Time Slots"}
        subTitle={
          activeTab === "class"
            ? "Create and manage weekly class schedules."
            : activeTab === "exam"
              ? "Create and manage exam schedules linked to exams."
              : activeTab === "substitutions"
                ? "Manage temporary period switches, extra classes, and teacher substitutions."
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
                      <option value="">All</option>
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
            {activeTab === "substitutions" ? (
              <Button className="gap-1" onClick={openNewSubstitution}>
                <Plus className="size-4" />
                Create substitution
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
              <Field label="Section">
                <select required className={selectClassName} value={classForm.section_id} onChange={(event) => updateClassForm("section_id", event.target.value)}>
                  <option value="">Select section</option>
                  {(selectedClass?.sections || []).map((section) => <option key={`${section.id}-${section.medium}`} value={section.id}>{section.name} - {section.medium}</option>)}
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
          <TabsTrigger value="substitutions">
            <RefreshCcw className="mr-2 size-4" />
            Substitutions
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
                    <div className="min-w-0 max-w-[min(72vw,560px)]">
                      {selectedClassRoutine ? (
                        <p className="truncate text-lg font-semibold text-foreground">
                          {selectedClassRoutineHeader || "Class Routine"}
                        </p>
                      ) : (
                        <p className="text-lg font-semibold text-muted-foreground">No class routine selected</p>
                      )}
                    </div>
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
                  </div>
                  {selectedClassRoutine ? (
                    <div className="mt-2 flex items-center justify-start gap-2">
                      {selectedClassRoutine.version_number ? (
                        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                          v{selectedClassRoutine.version_number}
                        </Badge>
                      ) : null}
                      {selectedClassRoutine.status ? <StatusBadge status={selectedClassRoutine.status} /> : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-start gap-3 overflow-hidden lg:items-end">
                  <div className="flex max-w-full flex-wrap items-center justify-start gap-3 text-sm text-muted-foreground lg:justify-end">
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />{selectedRoutineSummary.totalPeriods} periods</span>
                    <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4" />{selectedRoutineSummary.assignedPeriods} assigned</span>
                    <span className="inline-flex items-center gap-1.5"><Plus className="size-4" />{selectedRoutineSummary.freePeriods} free</span>
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
                    <select
                      className={`${selectClassName} h-9 !w-[min(62vw,320px)] !min-w-[220px] rounded-md px-3 py-1.5 text-sm`}
                      value={selectedClassRoutineId}
                      onChange={(event) => setSelectedClassRoutineId(event.target.value)}
                    >
                      {routineNavigationItems.map((routine) => (
                        <option key={routine.id} value={routine.id}>
                          {routine.class_name || "Class"} | {routine.section_name || "Section"} | {routine.medium || "Medium"}
                          {routine.stream_name ? ` | ${routine.stream_name}` : ""} {routine.version_number ? `| v${routine.version_number}` : ""}
                        </option>
                      ))}
                    </select>
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
                      <Button size="sm" variant="outline" onClick={() => downloadPdf(downloadClassRoutinePdf, selectedClassRoutine.id, `class-routine-${selectedClassRoutine.id}.pdf`)}>
                        Download PDF
                      </Button>
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
                    <DialogContent className="sm:max-w-[520px]">
                      <DialogHeader>
                        <DialogTitle>Edit Routine Slot</DialogTitle>
                        <DialogDescription>
                          {slotContext ? `${slotContext.day.label}, Period ${slotContext.period}` : "Select slot details."}
                        </DialogDescription>
                      </DialogHeader>
                      <form className="space-y-4" onSubmit={handleSaveSlot}>
                        <Field label="Type">
                          <select
                            className={selectClassName}
                            value={slotForm.entry_type}
                            onChange={(event) => setSlotForm((current) => ({
                              ...current,
                              entry_type: event.target.value,
                              subjectRows: event.target.value === "subject" ? current.subjectRows : [emptySubjectSlotRow(1)],
                              activity_id: event.target.value === "activity" ? current.activity_id : "",
                            }))}
                          >
                            <option value="subject">Subject</option>
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
                                    {(slotForm.subjectRows || []).length > 1 ? (
                                      <Button type="button" variant="ghost" size="sm" onClick={() => removeSlotSubjectRow(row.key)}>
                                        Remove
                                      </Button>
                                    ) : null}
                                  </div>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <Field label="Subject">
                                      <select
                                        required
                                        className={selectClassName}
                                        value={row.subject_id}
                                        onChange={(event) => updateSlotSubjectRow(row.key, { subject_id: event.target.value, teacher_id: "" })}
                                      >
                                        <option value="">Select subject</option>
                                        {slotSubjects.map((subject) => (
                                          <option key={subject.id} value={subject.id}>
                                            {subject.name}{subject.subject_group ? ` (${subject.subject_group})` : ""}
                                          </option>
                                        ))}
                                      </select>
                                    </Field>
                                    <Field label="Teacher">
                                      <select
                                        required
                                        className={selectClassName}
                                        value={row.teacher_id}
                                        onChange={(event) => updateSlotSubjectRow(row.key, { teacher_id: event.target.value })}
                                      >
                                        <option value="">Select assigned teacher</option>
                                        {teacherOptions.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                                      </select>
                                    </Field>
                                  </div>
                                </div>
                              );
                            })}
                            <Button type="button" variant="outline" onClick={addSlotSubjectRow}>
                              <Plus className="mr-2 size-4" />
                              Add Subject
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
                        <div className="flex justify-end gap-2">
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
              <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 text-left lg:max-w-[46%]">
                  <div className="flex items-center justify-start gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => moveSelectedExamRoutine(-1)}
                      disabled={examRoutineNavigationItems.length <= 1}
                      aria-label="Previous exam routine"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <div className="min-w-0 max-w-[min(72vw,560px)]">
                      {selectedExamRoutine ? (
                        <p className="truncate text-lg font-semibold text-foreground">
                          {selectedExamRoutineHeader || "Exam Routine"}
                        </p>
                      ) : (
                        <p className="text-lg font-semibold text-muted-foreground">No exam routine selected</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => moveSelectedExamRoutine(1)}
                      disabled={examRoutineNavigationItems.length <= 1}
                      aria-label="Next exam routine"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                  {selectedExamRoutine ? (
                    <div className="mt-2 flex items-center justify-start gap-2">
                      {selectedExamRoutine.version_number ? (
                        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                          v{selectedExamRoutine.version_number}
                        </Badge>
                      ) : null}
                      {selectedExamRoutine.status ? <StatusBadge status={selectedExamRoutine.status} /> : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-start gap-3 lg:items-end">
                  <div className="flex max-w-full flex-wrap items-center justify-start gap-3 text-sm text-muted-foreground lg:justify-end">
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />{selectedExamRoutineSummary.rows} rows</span>
                    <span className="inline-flex items-center gap-1.5"><BookOpen className="size-4" />{selectedExamRoutineSummary.subjects} subjects</span>
                    <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4" />{selectedExamRoutineSummary.invigilators} invigilators</span>
                  </div>
                  <div className="flex w-full max-w-full flex-nowrap items-center justify-start gap-2 overflow-x-auto lg:justify-end [&>*]:h-9 [&>*]:shrink-0">
                    {["draft", "published"].includes(selectedExamRoutine?.status) ? (
                      <>
                        <Button type="button" size="sm" variant="outline" onClick={openEditExamRoutine}>
                          <Pencil className="mr-2 size-4" />
                          Edit
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={handleDeleteExamRoutine}>
                          <Trash2 className="mr-2 size-4" />
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
                            <Button type="button" onClick={handleImportExamRoutine} disabled={!examImportFile}>Import Drafts</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    {selectedExamRoutine?.id ? (
                      <Button size="sm" variant="outline" onClick={() => downloadPdf(downloadExamRoutinePdf, selectedExamRoutine.id, `exam-routine-${selectedExamRoutine.id}.pdf`)}>
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
                    <DialogTitle>{editingExamRoutineId ? "Edit Exam Routine Draft" : "Create Exam Routine Draft"}</DialogTitle>
                    <DialogDescription>Select an existing exam and scope, then add one or more routine rows.</DialogDescription>
                  </DialogHeader>
                  <form className="space-y-4" onSubmit={handleSaveExamRoutine}>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <Field label="Exam">
                        <select required className={selectClassName} value={examForm.exam_id} onChange={(event) => updateExamForm("exam_id", event.target.value)}>
                          <option value="">Select exam</option>
                          {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Class">
                        <select required className={selectClassName} value={examForm.class_id} onChange={(event) => updateExamForm("class_id", event.target.value)}>
                          <option value="">Select class</option>
                          {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Section">
                        <select required className={selectClassName} value={examForm.section_id} onChange={(event) => updateExamForm("section_id", event.target.value)}>
                          <option value="">Select section</option>
                          {(selectedExamClass?.sections || []).map((section) => <option key={`${section.id}-${section.medium}`} value={section.id}>{section.name} - {section.medium}</option>)}
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
                        <div key={index} className="grid gap-3 rounded-md border border-border bg-muted/20 p-3 md:grid-cols-2 xl:grid-cols-6">
                          <Field label="Date"><Input required type="date" value={entry.exam_date} onChange={(event) => updateExamEntry(index, "exam_date", event.target.value)} /></Field>
                          <Field label="Start"><Input type="time" value={entry.start_time} onChange={(event) => updateExamEntry(index, "start_time", event.target.value)} /></Field>
                          <Field label="End"><Input type="time" value={entry.end_time} onChange={(event) => updateExamEntry(index, "end_time", event.target.value)} /></Field>
                          <Field label="Subject">
                            <select className={selectClassName} value={entry.subject_id} onChange={(event) => updateExamEntry(index, "subject_id", event.target.value)}>
                              <option value="">None</option>
                              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
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
                      ))}
                      <Button type="button" variant="outline" onClick={addExamEntry}>Add Exam Row</Button>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setExamOpen(false)}>Cancel</Button>
                      <Button type="submit">{editingExamRoutineId ? "Save Changes" : "Create Draft"}</Button>
                    </div>
                  </form>
                  </DialogContent>
                </Dialog>

              {examRoutines.length ? (
                <>
                  <ExamRoutineBoard routine={selectedExamRoutine} />
                  <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                    {selectedExamRoutine?.status === "draft" ? (
                      <Button onClick={() => runAction(() => publishExamRoutine(selectedExamRoutine.id), "Exam routine published.")}>
                        <Send className="mr-2 size-4" />
                        Publish routine
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : <EmptyState title="No exam routines found" description="Create an exam routine draft linked to an existing exam." />}
            </CardContent>
          </RoutineCard>
        </TabsContent>

        <TabsContent value="substitutions" className="mt-4">
          <RoutineCard>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">Temporary Substitutions</CardTitle>
                <CardDescription>Create date or date-range changes for absent teachers, extra classes, cancellations, and room changes.</CardDescription>
              </div>
              <Dialog
                open={substitutionOpen}
                onOpenChange={(open) => {
                  setSubstitutionOpen(open);
                  if (!open) {
                    setEditingSubstitutionId(null);
                    setSubstitutionForm(emptySubstitutionForm);
                  }
                }}
              >
                <Button onClick={openNewSubstitution}><Plus className="mr-2 size-4" />New Substitution</Button>
                <DialogContent className="max-h-[85vh] w-[min(96vw,1200px)] max-w-none overflow-y-auto sm:max-w-[min(96vw,1200px)]">
                  <DialogHeader>
                    <DialogTitle>{editingSubstitutionId ? "Edit Substitution Draft" : "Create Substitution Draft"}</DialogTitle>
                    <DialogDescription>Publishing applies this temporary change to effective routine views.</DialogDescription>
                  </DialogHeader>
                  <form className="space-y-4" onSubmit={handleSaveSubstitution}>
                    <div className="grid gap-3 md:grid-cols-4">
                      <Field label="Session"><select required className={selectClassName} value={substitutionForm.session_id} onChange={(event) => updateSubstitutionForm("session_id", event.target.value)}><option value="">Select</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></Field>
                      <Field label="Class"><select required className={selectClassName} value={substitutionForm.class_id} onChange={(event) => updateSubstitutionForm("class_id", event.target.value)}><option value="">Select</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
                      <Field label="Section"><select required className={selectClassName} value={substitutionForm.section_id} onChange={(event) => updateSubstitutionForm("section_id", event.target.value)}><option value="">Select</option>{(substitutionClass?.sections || []).map((section) => <option key={`${section.id}-${section.medium}`} value={section.id}>{section.name} - {section.medium}</option>)}</select></Field>
                      <Field label="Medium"><select required className={selectClassName} value={substitutionForm.medium} onChange={(event) => updateSubstitutionForm("medium", event.target.value)}><option value="">Select</option>{(substitutionClass?.mediums || []).map((medium) => <option key={medium} value={medium}>{medium}</option>)}</select></Field>
                      <Field label="Stream"><select className={selectClassName} value={substitutionForm.stream_id} onChange={(event) => updateSubstitutionForm("stream_id", event.target.value)}><option value="">None</option>{streams.map((stream) => <option key={stream.id} value={stream.id}>{stream.name}</option>)}</select></Field>
                      <Field label="Day"><select className={selectClassName} value={substitutionForm.weekday} onChange={(event) => updateSubstitutionForm("weekday", event.target.value)}><option value="">Any day</option>{weekdays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></Field>
                      <Field label="Period"><Input value={substitutionForm.period_number} onChange={(event) => updateSubstitutionForm("period_number", event.target.value)} /></Field>
                      <Field label="Title"><Input value={substitutionForm.title} onChange={(event) => updateSubstitutionForm("title", event.target.value)} /></Field>
                      <Field label="From"><Input required type="date" value={substitutionForm.starts_on} onChange={(event) => updateSubstitutionForm("starts_on", event.target.value)} /></Field>
                      <Field label="To"><Input type="date" value={substitutionForm.ends_on} onChange={(event) => updateSubstitutionForm("ends_on", event.target.value)} /></Field>
                      <Field label="Start"><Input type="time" value={substitutionForm.start_time} onChange={(event) => updateSubstitutionForm("start_time", event.target.value)} /></Field>
                      <Field label="End"><Input type="time" value={substitutionForm.end_time} onChange={(event) => updateSubstitutionForm("end_time", event.target.value)} /></Field>
                      <Field label="Change Type">
                        <select className={selectClassName} value={substitutionForm.change_type} onChange={(event) => updateSubstitutionForm("change_type", event.target.value)}>
                          <option value="teacher_substitution">Teacher substitution</option>
                          <option value="subject_change">Subject change</option>
                          <option value="extra_class">Extra class</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="free_period">Free period</option>
                          <option value="room_change">Room change</option>
                        </select>
                      </Field>
                      <Field label="Original Subject"><select className={selectClassName} value={substitutionForm.original_subject_id} onChange={(event) => updateSubstitutionForm("original_subject_id", event.target.value)}><option value="">None</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></Field>
                      <Field label="Replacement Subject"><select className={selectClassName} value={substitutionForm.replacement_subject_id} onChange={(event) => updateSubstitutionForm("replacement_subject_id", event.target.value)}><option value="">None</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></Field>
                      <Field label="Teacher"><select className={selectClassName} value={substitutionForm.teacher_id} onChange={(event) => updateSubstitutionForm("teacher_id", event.target.value)}><option value="">None</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></Field>
                      <Field label="Teacher Role">
                        <select className={selectClassName} value={substitutionForm.teacher_assignment_role} onChange={(event) => updateSubstitutionForm("teacher_assignment_role", event.target.value)}>
                          <option value="replacement">Replacement</option>
                          <option value="additional">Additional</option>
                          <option value="original">Original</option>
                        </select>
                      </Field>
                      <Field label="Original Room"><Input value={substitutionForm.original_room} onChange={(event) => updateSubstitutionForm("original_room", event.target.value)} /></Field>
                      <Field label="Replacement Room"><Input value={substitutionForm.replacement_room} onChange={(event) => updateSubstitutionForm("replacement_room", event.target.value)} /></Field>
                    </div>
                    <Field label="Reason"><Input value={substitutionForm.reason} onChange={(event) => updateSubstitutionForm("reason", event.target.value)} /></Field>
                    <Field label="Notes"><Input value={substitutionForm.notes} onChange={(event) => updateSubstitutionForm("notes", event.target.value)} /></Field>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setSubstitutionOpen(false)}>Cancel</Button>
                      <Button type="submit">{editingSubstitutionId ? "Save Draft" : "Create Draft"}</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
              {substitutions.length ? substitutions.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-md border border-border bg-background p-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{item.title || item.reason || item.change_type}</p>
                      <StatusBadge status={item.status} />
                      <Badge variant="outline">{displayChangeType(item.change_type)}</Badge>
                      {item.period_number ? <Badge variant="outline">Period {item.period_number}</Badge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">{item.class_name} / {item.section_name} / {item.medium}{item.stream_name ? ` / ${item.stream_name}` : ""} / {dateInputValue(item.starts_on)} to {dateInputValue(item.ends_on)} / {timeInputValue(item.start_time)}-{timeInputValue(item.end_time)} / {item.teacher_names || "No teacher"}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.original_subject_name || "No original subject"} to {item.replacement_subject_name || "No replacement subject"}
                      {item.replacement_room ? ` / Room ${item.replacement_room}` : ""}
                      {item.reason ? ` / ${item.reason}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created by {item.created_by_name || "Unknown"} on {displayDateTime(item.created_at)}
                      {item.published_at ? ` / Published by ${item.updated_by_name || "Unknown"} on ${displayDateTime(item.published_at)}` : ""}
                      {item.cancelled_at ? ` / Cancelled by ${item.updated_by_name || "Unknown"} on ${displayDateTime(item.cancelled_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.status === "draft" ? <Button size="sm" variant="outline" onClick={() => openEditSubstitution(item)}><Pencil className="mr-2 size-4" />Edit</Button> : null}
                    {item.status === "draft" ? <Button size="sm" onClick={() => runAction(() => publishSubstitution(item.id), "Substitution published.")}>Publish</Button> : null}
                    {item.status !== "cancelled" ? <Button size="sm" variant="outline" onClick={() => runAction(() => cancelSubstitution(item.id), "Substitution cancelled.")}>Cancel</Button> : null}
                  </div>
                </div>
              )) : <EmptyState title="No substitutions found" description="Create substitutions for teacher absences, extra classes, or temporary room changes." />}
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
              <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
                <DialogTrigger asChild><Button><Plus className="mr-2 size-4" />New Template</Button></DialogTrigger>
                <DialogContent className="max-h-[85vh] w-[min(96vw,1120px)] max-w-none overflow-y-auto sm:max-w-[min(96vw,1120px)]">
                  <DialogHeader>
                    <DialogTitle>Create Time Slot Template</DialogTitle>
                    <DialogDescription>Define period times and break slots. Class routines can still override entries.</DialogDescription>
                  </DialogHeader>
                  <form className="space-y-4" onSubmit={handleCreateTemplate}>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Name"><Input required value={templateForm.name} onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                      <Field label="Scope">
                        <select className={selectClassName} value={templateForm.scope_level} onChange={(event) => setTemplateForm((current) => ({ ...current, scope_level: event.target.value }))}>
                          <option value="school">School wide</option>
                          <option value="higher_secondary">Higher secondary</option>
                          <option value="class_section">Class/section</option>
                        </select>
                      </Field>
                    </div>
                    <div className="space-y-3">
                      {templateForm.slots.map((slot, index) => (
                        <div key={index} className="grid gap-3 rounded-md border border-border bg-muted/20 p-3 md:grid-cols-2 xl:grid-cols-[0.7fr_1.4fr_0.9fr_0.9fr_1fr_1.2fr]">
                          <Field label="Period"><Input value={slot.period_number} onChange={(event) => updateTemplateSlot(index, "period_number", event.target.value)} /></Field>
                          <Field label="Label"><Input value={slot.label} onChange={(event) => updateTemplateSlot(index, "label", event.target.value)} /></Field>
                          <Field label="Start"><Input type="time" value={slot.start_time} onChange={(event) => updateTemplateSlot(index, "start_time", event.target.value)} /></Field>
                          <Field label="End"><Input type="time" value={slot.end_time} onChange={(event) => updateTemplateSlot(index, "end_time", event.target.value)} /></Field>
                          <Field label="Type"><select className={selectClassName} value={slot.default_entry_type} onChange={(event) => updateTemplateSlot(index, "default_entry_type", event.target.value)}><option value="subject">Subject</option><option value="break">Break</option><option value="activity">Activity</option><option value="free">Free</option></select></Field>
                          <Field label="Day"><select className={selectClassName} value={slot.weekday} onChange={(event) => updateTemplateSlot(index, "weekday", event.target.value)}><option value="">All days</option>{weekdays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></Field>
                        </div>
                      ))}
                      <Button type="button" variant="outline" onClick={() => setTemplateForm((current) => ({ ...current, slots: [...current.slots, { weekday: "", period_number: String(current.slots.length + 1), label: "", start_time: "08:00", end_time: "08:40", default_entry_type: "subject" }] }))}>Add Slot</Button>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setTemplateOpen(false)}>Cancel</Button>
                      <Button type="submit">Create Template</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
              {templates.length ? templates.map((template) => (
                <div key={template.id} className="flex items-center justify-between rounded-md border border-border bg-background p-4">
                  <div>
                    <p className="font-semibold">{template.name}</p>
                    <p className="text-xs text-muted-foreground">{template.scope_level} / {template.class_name || "All classes"} / {template.medium || "All mediums"}</p>
                  </div>
                  <Badge variant="outline" className={template.is_active ? statusClass.published : statusClass.archived}>{template.is_active ? "active" : "inactive"}</Badge>
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

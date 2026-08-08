import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  Pencil,
  Plus,
  RefreshCcw,
  Send,
  Smartphone,
  Upload,
} from "lucide-react";
import TopBar from "../components/TopBar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getClassStructure, getSessions } from "../api/academic.api";
import {
  createAnnouncement,
  createAnnouncementCategory,
  createAnnouncementSmsTemplate,
  dispatchAnnouncementSmsJob,
  dispatchAnnouncementSmsJobs,
  getAnnouncement,
  getAnnouncementCategories,
  getAnnouncementSmsJobs,
  getAnnouncementSmsTemplates,
  getAnnouncements,
  getHolidays,
  importAnnouncementSmsTemplates,
  publishAnnouncement,
  refreshAnnouncementSmsJobStatus,
  updateAnnouncement,
} from "../api/announcements.api";

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30";

const statusClass = {
  draft: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200",
  scheduled: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200",
  queued: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200",
  sending: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-200",
  published: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200",
  sent: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200",
  partial_failed: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-200",
  failed: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200",
  cancelled: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-200",
};

const deliveryLabels = {
  online: "Online",
  offline_sms: "Offline SMS",
  both: "Online + SMS",
};

const emptyAnnouncementForm = {
  title: "",
  body: "",
  category_id: "",
  delivery_mode: "online",
  status: "draft",
  priority: "normal",
  publish_at: "",
  expires_at: "",
  event_start_date: "",
  event_end_date: "",
  reopen_date: "",
  show_in_software: true,
  show_in_mobile: true,
  show_on_website: false,
  create_notification: true,
  send_push: true,
  sms_template_id: "",
  sms_send_at: "",
  target_type: "all",
  role_name: "",
  session_id: "",
  class_id: "",
  section_id: "",
  medium: "",
  stream_id: "",
};

const emptyTemplateForm = {
  template_name: "",
  dlt_template_id: "",
  header: "",
  communication_type: "",
  template_content: "",
  brand_dlt_id: "",
  placeholder_style: "alp",
  placeholder_count: "0",
  status: "registered",
  provider: "fast2sms",
  creator: "",
  registered_on: "",
};

function unwrap(payload) {
  return payload?.data || [];
}

function toNumberOrNull(value) {
  return value === "" || value === undefined || value === null ? null : Number(value);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function toDateInput(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function toDateTimeInput(value) {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) return text.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text)) return text.replace(" ", "T").slice(0, 16);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function isoDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function localDateFromIso(value) {
  const text = isoDate(value);
  if (!text) return null;
  const [year, month, day] = text.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toIsoDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sameMonth(date, monthDate) {
  return date.getFullYear() === monthDate.getFullYear() && date.getMonth() === monthDate.getMonth();
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function buildCalendarDays(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function holidayOverlapsDate(holiday, date) {
  const day = toIsoDay(date);
  const start = isoDate(holiday.starts_on);
  const end = isoDate(holiday.ends_on || holiday.starts_on);
  return start <= day && day <= end;
}

function holidayOverlapsMonth(holiday, monthDate) {
  const monthStart = toIsoDay(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
  const monthEnd = toIsoDay(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
  const start = isoDate(holiday.starts_on);
  const end = isoDate(holiday.ends_on || holiday.starts_on);
  return start <= monthEnd && end >= monthStart;
}

function formatMonthTitle(date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function announcementToForm(item = {}) {
  const target = Array.isArray(item.targets) && item.targets.length ? item.targets[0] : {};
  return {
    ...emptyAnnouncementForm,
    title: item.title || "",
    body: item.body || "",
    category_id: item.category_id ? String(item.category_id) : "",
    delivery_mode: item.delivery_mode || "online",
    status: ["draft", "scheduled"].includes(item.status) ? item.status : "draft",
    priority: item.priority || "normal",
    publish_at: toDateTimeInput(item.publish_at),
    expires_at: toDateTimeInput(item.expires_at),
    event_start_date: toDateInput(item.event_start_date),
    event_end_date: toDateInput(item.event_end_date),
    reopen_date: toDateInput(item.reopen_date),
    show_in_software: Boolean(item.show_in_software),
    show_in_mobile: Boolean(item.show_in_mobile),
    show_on_website: Boolean(item.show_on_website),
    create_notification: Boolean(item.create_notification),
    send_push: Boolean(item.send_push),
    sms_template_id: item.sms_template_id ? String(item.sms_template_id) : "",
    sms_send_at: toDateTimeInput(item.sms_send_at),
    target_type: target.target_type || "all",
    role_name: target.role_name || "",
    session_id: target.session_id ? String(target.session_id) : "",
    class_id: target.class_id ? String(target.class_id) : "",
    section_id: target.section_id ? String(target.section_id) : "",
    medium: target.medium || "",
    stream_id: target.stream_id ? String(target.stream_id) : "",
  };
}

function StatusBadge({ status }) {
  return (
    <Badge variant="outline" className={statusClass[status] || statusClass.cancelled}>
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

function ToggleField({ label, checked, onChange }) {
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function FormSection({ title, description, children }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid gap-3 p-4">{children}</div>
    </div>
  );
}

function MetricCard({ icon, label, value }) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-3xl">{value}</CardTitle>
        </div>
        <div className="rounded-md border border-border bg-muted/30 p-2">
          {createElement(icon, { className: "size-5 text-muted-foreground" })}
        </div>
      </CardHeader>
    </Card>
  );
}

function FilePicker({ file, onChange, accept = ".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" }) {
  const inputRef = useRef(null);
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{file?.name || "No file selected"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Upload the DLT portal template sheet as XLSX or CSV.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          <Upload className="mr-2 size-4" /> Choose File
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
      <Megaphone className="mb-3 size-8 text-muted-foreground" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function normalizeTarget(form) {
  return {
    target_type: form.target_type,
    role_name: form.target_type === "role" ? form.role_name : null,
    session_id: toNumberOrNull(form.session_id),
    class_id: toNumberOrNull(form.class_id),
    section_id: toNumberOrNull(form.section_id),
    medium: form.medium || null,
    stream_id: toNumberOrNull(form.stream_id),
  };
}

function buildAnnouncementPayload(form) {
  return {
    title: form.title.trim(),
    body: form.body.trim(),
    category_id: toNumberOrNull(form.category_id),
    delivery_mode: form.delivery_mode,
    status: form.status,
    priority: form.priority,
    publish_at: form.publish_at || null,
    expires_at: form.expires_at || null,
    event_start_date: form.event_start_date || null,
    event_end_date: form.event_end_date || form.event_start_date || null,
    reopen_date: form.reopen_date || null,
    show_in_software: form.show_in_software,
    show_in_mobile: form.show_in_mobile,
    show_on_website: form.show_on_website,
    create_notification: form.create_notification,
    send_push: form.send_push,
    sms_template_id: toNumberOrNull(form.sms_template_id),
    sms_send_at: form.sms_send_at || null,
    sms_variables: {},
    targets: [normalizeTarget(form)],
  };
}

export default function Announcements() {
  const [activeTab, setActiveTab] = useState("announcements");
  const [categories, setCategories] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [smsJobs, setSmsJobs] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [filters, setFilters] = useState({ status: "", delivery_mode: "" });
  const [holidayMonth, setHolidayMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [announcementForm, setAnnouncementForm] = useState(emptyAnnouncementForm);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [categoryForm, setCategoryForm] = useState({ name: "", slug: "", description: "" });

  const selectedClass = useMemo(
    () => classes.find((item) => String(item.id) === String(announcementForm.class_id)),
    [announcementForm.class_id, classes]
  );
  const holidayCategoryIds = useMemo(
    () => new Set(categories.filter((item) => ["holiday", "festival", "vacation"].includes(item.slug)).map((item) => Number(item.id))),
    [categories]
  );
  const stats = useMemo(() => {
    const drafts = announcements.filter((item) => item.status === "draft" || item.status === "scheduled").length;
    const published = announcements.filter((item) => ["published", "sent"].includes(item.status)).length;
    const offline = announcements.filter((item) => ["offline_sms", "both"].includes(item.delivery_mode)).length;
    return { drafts, published, offline };
  }, [announcements]);
  const calendarDays = useMemo(() => buildCalendarDays(holidayMonth), [holidayMonth]);
  const monthHolidays = useMemo(
    () => holidays.filter((item) => holidayOverlapsMonth(item, holidayMonth)),
    [holidayMonth, holidays]
  );
  const holidayDatesInMonth = useMemo(() => {
    const dates = new Set();
    monthHolidays.forEach((item) => {
      const start = localDateFromIso(item.starts_on);
      const end = localDateFromIso(item.ends_on || item.starts_on);
      if (!start || !end) return;
      const cursor = new Date(start);
      while (cursor <= end) {
        if (sameMonth(cursor, holidayMonth)) dates.add(toIsoDay(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return dates;
  }, [holidayMonth, monthHolidays]);

  const loadAnnouncements = useCallback(async () => {
    try {
      const response = await getAnnouncements(filters);
      setAnnouncements(unwrap(response));
    } catch (err) {
      setError(err?.message || "Could not load announcements.");
    }
  }, [filters]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [categoryRes, templateRes, announcementRes, sessionsRes, classesRes, jobsRes, holidayRes] = await Promise.all([
        getAnnouncementCategories(),
        getAnnouncementSmsTemplates(),
        getAnnouncements(),
        getSessions(),
        getClassStructure(),
        getAnnouncementSmsJobs().catch(() => ({ data: [] })),
        getHolidays().catch(() => ({ data: [] })),
      ]);
      setCategories(unwrap(categoryRes));
      setTemplates(unwrap(templateRes));
      setAnnouncements(unwrap(announcementRes));
      setSessions(unwrap(sessionsRes));
      setClasses(unwrap(classesRes));
      setSmsJobs(unwrap(jobsRes));
      setHolidays(unwrap(holidayRes));
    } catch (err) {
      setError(err?.message || "Could not load announcements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadInitial);
  }, [loadInitial]);

  useEffect(() => {
    void Promise.resolve().then(loadAnnouncements);
  }, [loadAnnouncements]);

  async function refreshAll() {
    await loadInitial();
    setNotice("Announcements refreshed.");
  }

  async function saveAnnouncement() {
    setSaving(true);
    setError("");
    try {
      const payload = buildAnnouncementPayload(announcementForm);
      if (editingAnnouncement) {
        const response = await updateAnnouncement(editingAnnouncement.id, payload);
        await loadInitial();
        setNotice(["published", "sent"].includes(editingAnnouncement.status)
          ? `Draft version #${response.data?.version_number || ""} created.`
          : "Announcement updated.");
      } else {
        const response = await createAnnouncement(payload);
        setAnnouncements((prev) => [response.data, ...prev]);
        setNotice("Announcement saved as draft.");
      }
      setAnnouncementOpen(false);
      setAnnouncementForm(emptyAnnouncementForm);
      setEditingAnnouncement(null);
    } catch (err) {
      setError(err?.message || "Could not save announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function openAnnouncementEditor(item) {
    setSaving(true);
    setError("");
    try {
      const response = await getAnnouncement(item.id);
      const detail = response.data || item;
      setEditingAnnouncement(detail);
      setAnnouncementForm(announcementToForm(detail));
      setAnnouncementOpen(true);
    } catch (err) {
      setError(err?.message || "Could not load announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(item) {
    setSaving(true);
    setError("");
    try {
      await publishAnnouncement(item.id);
      await loadInitial();
      setNotice("Announcement published.");
    } catch (err) {
      setError(err?.message || "Could not publish announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTemplate() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...templateForm,
        placeholder_count: Number(templateForm.placeholder_count || 0),
      };
      const response = await createAnnouncementSmsTemplate(payload);
      setTemplates((prev) => [response.data, ...prev]);
      setNotice("DLT template saved.");
      setTemplateOpen(false);
      setTemplateForm(emptyTemplateForm);
    } catch (err) {
      setError(err?.message || "Could not save DLT template.");
    } finally {
      setSaving(false);
    }
  }

  async function importTemplates() {
    if (!importFile) {
      setError("Choose an XLSX or CSV file first.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await importAnnouncementSmsTemplates(importFile);
      const result = response.data || {};
      const templateRes = await getAnnouncementSmsTemplates();
      setTemplates(unwrap(templateRes));
      setNotice(`Imported ${result.imported_count || 0} template${Number(result.imported_count || 0) === 1 ? "" : "s"}.`);
      if (result.failed_count) {
        setError(`${result.failed_count} row${Number(result.failed_count) === 1 ? "" : "s"} failed during import.`);
      }
      setImportFile(null);
      setImportOpen(false);
      setActiveTab("templates");
    } catch (err) {
      setError(err?.message || "Could not import DLT templates.");
    } finally {
      setSaving(false);
    }
  }

  async function dispatchDueSms() {
    setSaving(true);
    setError("");
    try {
      const response = await dispatchAnnouncementSmsJobs();
      const result = response.data || {};
      const jobsRes = await getAnnouncementSmsJobs();
      setSmsJobs(unwrap(jobsRes));
      setNotice(`Dispatched ${result.attempted || 0} recipient${Number(result.attempted || 0) === 1 ? "" : "s"}.`);
      if (result.failed) {
        setError(`${result.failed} SMS recipient${Number(result.failed) === 1 ? "" : "s"} failed during dispatch.`);
      }
    } catch (err) {
      setError(err?.message || "Could not dispatch SMS jobs.");
    } finally {
      setSaving(false);
    }
  }

  async function dispatchSingleSmsJob(job) {
    setSaving(true);
    setError("");
    try {
      const response = await dispatchAnnouncementSmsJob(job.id);
      const result = response.data || {};
      const jobsRes = await getAnnouncementSmsJobs();
      setSmsJobs(unwrap(jobsRes));
      setNotice(`Job #${job.id} dispatched ${result.attempted || 0} recipient${Number(result.attempted || 0) === 1 ? "" : "s"}.`);
      if (result.failed) {
        setError(`${result.failed} SMS recipient${Number(result.failed) === 1 ? "" : "s"} failed for job #${job.id}.`);
      }
    } catch (err) {
      setError(err?.message || "Could not dispatch SMS job.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshSmsJobStatus(job) {
    setSaving(true);
    setError("");
    try {
      const response = await refreshAnnouncementSmsJobStatus(job.id);
      const result = response.data || {};
      const jobsRes = await getAnnouncementSmsJobs();
      setSmsJobs(unwrap(jobsRes));
      setNotice(`Job #${job.id} checked ${result.checked || 0} recipient${Number(result.checked || 0) === 1 ? "" : "s"}.`);
      if (result.failed) {
        setError(`${result.failed} SMS status check${Number(result.failed) === 1 ? "" : "s"} failed for job #${job.id}.`);
      }
    } catch (err) {
      setError(err?.message || "Could not refresh SMS delivery status.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory() {
    setSaving(true);
    setError("");
    try {
      const response = await createAnnouncementCategory(categoryForm);
      setCategories((prev) => [response.data, ...prev]);
      setNotice("Category saved.");
      setCategoryOpen(false);
      setCategoryForm({ name: "", slug: "", description: "" });
    } catch (err) {
      setError(err?.message || "Could not save category.");
    } finally {
      setSaving(false);
    }
  }

  function updateAnnouncementField(field, value) {
    setAnnouncementForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "delivery_mode" && value === "online" ? { sms_template_id: "", sms_send_at: "" } : {}),
      ...(field === "class_id" ? { section_id: "", medium: "" } : {}),
    }));
  }

  return (
    <div className="space-y-4">
      <TopBar title="Announcements" subTitle="Draft, publish, and track online announcements, DLT SMS queues, and holidays" />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert>
          <AlertTitle>Updated</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={Megaphone} label="Total Announcements" value={announcements.length} />
        <MetricCard icon={BellRing} label="Draft / Scheduled" value={stats.drafts} />
        <MetricCard icon={Send} label="Published" value={stats.published} />
        <MetricCard icon={Smartphone} label="Offline SMS" value={stats.offline} />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <select className={selectClassName} value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="sent">Sent</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select className={selectClassName} value={filters.delivery_mode} onChange={(event) => setFilters((prev) => ({ ...prev, delivery_mode: event.target.value }))}>
            <option value="">All delivery modes</option>
            <option value="online">Online</option>
            <option value="offline_sms">Offline SMS</option>
            <option value="both">Online + SMS</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={refreshAll} disabled={loading}>
            <RefreshCcw className="mr-2 size-4" /> Refresh
          </Button>
          <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="mr-2 size-4" /> Category</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Category</DialogTitle>
                <DialogDescription>Use categories to drive holiday and announcement behavior.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <FormSection title="Category Details">
                  <Field label="Name"><Input value={categoryForm.name} onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))} /></Field>
                  <Field label="Slug"><Input value={categoryForm.slug} onChange={(event) => setCategoryForm((prev) => ({ ...prev, slug: event.target.value }))} placeholder="optional" /></Field>
                  <Field label="Description"><Textarea value={categoryForm.description} onChange={(event) => setCategoryForm((prev) => ({ ...prev, description: event.target.value }))} /></Field>
                </FormSection>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCategoryOpen(false)}>Cancel</Button>
                  <Button onClick={saveCategory} disabled={saving}>Save Category</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Smartphone className="mr-2 size-4" /> DLT Template</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>New DLT SMS Template</DialogTitle>
                <DialogDescription>Registered templates are used when offline announcements are published.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <FormSection title="Template Registration">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Template Name"><Input value={templateForm.template_name} onChange={(event) => setTemplateForm((prev) => ({ ...prev, template_name: event.target.value }))} /></Field>
                    <Field label="DLT Template ID"><Input value={templateForm.dlt_template_id} onChange={(event) => setTemplateForm((prev) => ({ ...prev, dlt_template_id: event.target.value }))} /></Field>
                    <Field label="Header"><Input value={templateForm.header} onChange={(event) => setTemplateForm((prev) => ({ ...prev, header: event.target.value }))} /></Field>
                    <Field label="Communication Type"><Input value={templateForm.communication_type} onChange={(event) => setTemplateForm((prev) => ({ ...prev, communication_type: event.target.value }))} /></Field>
                    <Field label="Brand DLT ID"><Input value={templateForm.brand_dlt_id} onChange={(event) => setTemplateForm((prev) => ({ ...prev, brand_dlt_id: event.target.value }))} /></Field>
                    <Field label="Placeholder Count"><Input type="number" value={templateForm.placeholder_count} onChange={(event) => setTemplateForm((prev) => ({ ...prev, placeholder_count: event.target.value }))} /></Field>
                  </div>
                  <Field label="Template Content"><Textarea className="min-h-28" value={templateForm.template_content} onChange={(event) => setTemplateForm((prev) => ({ ...prev, template_content: event.target.value }))} /></Field>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Status">
                      <select className={selectClassName} value={templateForm.status} onChange={(event) => setTemplateForm((prev) => ({ ...prev, status: event.target.value }))}>
                        <option value="registered">Registered</option>
                        <option value="pending">Pending</option>
                        <option value="inactive">Inactive</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </Field>
                    <Field label="Registered On"><Input type="date" value={templateForm.registered_on} onChange={(event) => setTemplateForm((prev) => ({ ...prev, registered_on: event.target.value }))} /></Field>
                  </div>
                </FormSection>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setTemplateOpen(false)}>Cancel</Button>
                  <Button onClick={saveTemplate} disabled={saving}>Save Template</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Smartphone className="mr-2 size-4" /> Import DLT Sheet</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import DLT Templates</DialogTitle>
                <DialogDescription>
                  Upload the DLT Excel sheet directly. Existing rows are updated by DLT Template ID.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <FilePicker file={importFile} onChange={setImportFile} />
                <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Supported headers: Template Name, DLT Template ID, Header, Template Content, Communication Type, Status.
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
                  <Button onClick={importTemplates} disabled={saving || !importFile}>
                    Import Templates
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog
            open={announcementOpen}
            onOpenChange={(open) => {
              setAnnouncementOpen(open);
              if (!open) {
                setEditingAnnouncement(null);
                setAnnouncementForm(emptyAnnouncementForm);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingAnnouncement(null);
                setAnnouncementForm(emptyAnnouncementForm);
              }}>
                <Plus className="mr-2 size-4" /> Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl">
              <DialogHeader>
                <DialogTitle>{editingAnnouncement ? "Edit Announcement" : "New Announcement"}</DialogTitle>
                <DialogDescription>
                  {editingAnnouncement && ["published", "sent"].includes(editingAnnouncement.status)
                    ? "Saving changes creates a new draft version. The published version stays live until the draft is published."
                    : "Save as draft or scheduled. Offline SMS is queued only when published."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid max-h-[76vh] gap-4 overflow-y-auto pr-2 xl:grid-cols-[minmax(0,1.3fr)_360px]">
                <div className="space-y-3">
                  <FormSection title="Details" description="Content and category for the announcement feed.">
                    <Field label="Title"><Input value={announcementForm.title} onChange={(event) => updateAnnouncementField("title", event.target.value)} /></Field>
                    <Field label="Body"><Textarea className="min-h-32" value={announcementForm.body} onChange={(event) => updateAnnouncementField("body", event.target.value)} /></Field>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Category">
                        <select className={selectClassName} value={announcementForm.category_id} onChange={(event) => updateAnnouncementField("category_id", event.target.value)}>
                          <option value="">General</option>
                          {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Status">
                        <select className={selectClassName} value={announcementForm.status} onChange={(event) => updateAnnouncementField("status", event.target.value)}>
                          <option value="draft">Draft</option>
                          <option value="scheduled">Scheduled</option>
                        </select>
                      </Field>
                      <Field label="Priority">
                        <select className={selectClassName} value={announcementForm.priority} onChange={(event) => updateAnnouncementField("priority", event.target.value)}>
                          <option value="normal">Normal</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </Field>
                    </div>
                  </FormSection>
                  <FormSection title="Delivery" description="Online announcements create notifications. Offline announcements create SMS jobs after publish.">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Delivery">
                        <select className={selectClassName} value={announcementForm.delivery_mode} onChange={(event) => updateAnnouncementField("delivery_mode", event.target.value)}>
                          <option value="online">Online</option>
                          <option value="offline_sms">Offline SMS</option>
                          <option value="both">Online + SMS</option>
                        </select>
                      </Field>
                      <Field label="Publish At"><Input type="datetime-local" value={announcementForm.publish_at} onChange={(event) => updateAnnouncementField("publish_at", event.target.value)} /></Field>
                      <Field label="Expires At"><Input type="datetime-local" value={announcementForm.expires_at} onChange={(event) => updateAnnouncementField("expires_at", event.target.value)} /></Field>
                    </div>
                    {["offline_sms", "both"].includes(announcementForm.delivery_mode) ? (
                      <div className="grid gap-3 rounded-md border border-border bg-muted/20 p-3 md:grid-cols-2">
                        <Field label="DLT Template">
                          <select className={selectClassName} value={announcementForm.sms_template_id} onChange={(event) => updateAnnouncementField("sms_template_id", event.target.value)}>
                            <option value="">Select template</option>
                            {templates.map((item) => <option key={item.id} value={item.id}>{item.template_name}</option>)}
                          </select>
                        </Field>
                        <Field label="SMS Send At"><Input type="datetime-local" value={announcementForm.sms_send_at} onChange={(event) => updateAnnouncementField("sms_send_at", event.target.value)} /></Field>
                      </div>
                    ) : null}
                  </FormSection>
                  <FormSection title="Event / Holiday Dates" description="Holiday categories create calendar records when published.">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Event Starts"><Input type="date" value={announcementForm.event_start_date} onChange={(event) => updateAnnouncementField("event_start_date", event.target.value)} /></Field>
                      <Field label="Event Ends"><Input type="date" value={announcementForm.event_end_date} onChange={(event) => updateAnnouncementField("event_end_date", event.target.value)} /></Field>
                      <Field label="Reopen Date"><Input type="date" value={announcementForm.reopen_date} onChange={(event) => updateAnnouncementField("reopen_date", event.target.value)} /></Field>
                    </div>
                  </FormSection>
                </div>
                <div className="space-y-3">
                  <FormSection title="Target" description="Choose who should receive this announcement.">
                      <Field label="Target Type">
                        <select className={selectClassName} value={announcementForm.target_type} onChange={(event) => updateAnnouncementField("target_type", event.target.value)}>
                          <option value="all">Schoolwide</option>
                          <option value="parents">Parents</option>
                          <option value="teachers">Teachers</option>
                          <option value="staff">Staff</option>
                          <option value="accounts">Accounts</option>
                          <option value="role">Role</option>
                          <option value="class">Class</option>
                          <option value="section">Section</option>
                        </select>
                      </Field>
                      {announcementForm.target_type === "role" ? (
                        <Field label="Role Name"><Input value={announcementForm.role_name} onChange={(event) => updateAnnouncementField("role_name", event.target.value)} placeholder="parent, teacher, staff" /></Field>
                      ) : null}
                      <Field label="Session">
                        <select className={selectClassName} value={announcementForm.session_id} onChange={(event) => updateAnnouncementField("session_id", event.target.value)}>
                          <option value="">Any session</option>
                          {sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Class">
                        <select className={selectClassName} value={announcementForm.class_id} onChange={(event) => updateAnnouncementField("class_id", event.target.value)}>
                          <option value="">Any class</option>
                          {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </Field>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Section">
                          <select className={selectClassName} value={announcementForm.section_id} onChange={(event) => updateAnnouncementField("section_id", event.target.value)}>
                            <option value="">Any</option>
                            {(selectedClass?.sections || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </select>
                        </Field>
                        <Field label="Medium">
                          <select className={selectClassName} value={announcementForm.medium} onChange={(event) => updateAnnouncementField("medium", event.target.value)}>
                            <option value="">Any</option>
                            <option value="English">English</option>
                            <option value="Assamese">Assamese</option>
                          </select>
                        </Field>
                      </div>
                      <div className="grid gap-2">
                        <ToggleField label="Show in software" checked={announcementForm.show_in_software} onChange={(value) => updateAnnouncementField("show_in_software", value)} />
                        <ToggleField label="Show in mobile" checked={announcementForm.show_in_mobile} onChange={(value) => updateAnnouncementField("show_in_mobile", value)} />
                        <ToggleField label="Create online notification" checked={announcementForm.create_notification} onChange={(value) => updateAnnouncementField("create_notification", value)} />
                        <ToggleField label="Send push notification" checked={announcementForm.send_push} onChange={(value) => updateAnnouncementField("send_push", value)} />
                      </div>
                  </FormSection>
                  {holidayCategoryIds.has(Number(announcementForm.category_id)) ? (
                    <Alert>
                      <CalendarDays className="size-4" />
                      <AlertTitle>Holiday calendar</AlertTitle>
                      <AlertDescription>Publishing this category will create calendar holiday records for the selected target.</AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="flex justify-end gap-2 rounded-lg border border-border bg-card p-3">
                    <Button variant="outline" onClick={() => setAnnouncementOpen(false)}>Cancel</Button>
                    <Button onClick={saveAnnouncement} disabled={saving}>
                      {editingAnnouncement ? "Save Changes" : "Save Announcement"}
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="announcements"><Megaphone className="mr-2 size-4" /> Announcements</TabsTrigger>
          <TabsTrigger value="templates"><Smartphone className="mr-2 size-4" /> DLT Templates</TabsTrigger>
          <TabsTrigger value="sms"><Send className="mr-2 size-4" /> SMS Jobs</TabsTrigger>
          <TabsTrigger value="holidays"><CalendarDays className="mr-2 size-4" /> Holidays</TabsTrigger>
        </TabsList>

        <TabsContent value="announcements" className="mt-4">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Announcement Queue</CardTitle>
              <CardDescription>Drafts can be edited later from the API. Publish sends online notifications and queues offline SMS.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading announcements...</p>
              ) : announcements.length === 0 ? (
                <EmptyState title="No announcements" description="Create a draft announcement to begin." />
              ) : (
                announcements.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">{item.title}</p>
                          <StatusBadge status={item.status} />
                          {item.version_number ? <Badge variant="outline">v{item.version_number}</Badge> : null}
                          <Badge variant="secondary">{deliveryLabels[item.delivery_mode] || item.delivery_mode}</Badge>
                          {item.category_name ? <Badge variant="outline">{item.category_name}</Badge> : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Publish: {formatDateTime(item.publish_at || item.published_at)} | Event: {formatDate(item.event_start_date)} - {formatDate(item.event_end_date)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {["draft", "scheduled", "published", "sent"].includes(item.status) ? (
                          <Button size="sm" variant="outline" onClick={() => openAnnouncementEditor(item)} disabled={saving}>
                            <Pencil className="mr-2 size-4" />
                            {["published", "sent"].includes(item.status) ? "Create Draft" : "Edit"}
                          </Button>
                        ) : null}
                        {["draft", "scheduled"].includes(item.status) ? (
                          <Button size="sm" onClick={() => handlePublish(item)} disabled={saving}>
                            <Send className="mr-2 size-4" /> Publish
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <Card className="rounded-lg">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Registered DLT Templates</CardTitle>
                  <CardDescription>Only registered templates should be selected for offline announcements.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={() => setImportOpen(true)}>
                    <Upload className="mr-2 size-4" /> Import DLT Sheet
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {templates.length === 0 ? (
                <EmptyState title="No templates" description="Add the templates from your DLT portal export." />
              ) : (
                templates.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{item.template_name}</p>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">DLT: {item.dlt_template_id}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Header: {item.header}</p>
                    <p className="mt-3 line-clamp-4 text-sm text-muted-foreground">{item.template_content}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sms" className="mt-4">
          <Card className="rounded-lg">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Offline SMS Jobs</CardTitle>
                  <CardDescription>Jobs are queued or scheduled after an offline announcement is published.</CardDescription>
                </div>
                <Button variant="outline" onClick={dispatchDueSms} disabled={saving}>
                  <Send className="mr-2 size-4" /> Dispatch Due Jobs
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {smsJobs.length === 0 ? (
                <EmptyState title="No SMS jobs" description="Publish an offline or online + SMS announcement to create a job." />
              ) : (
                smsJobs.map((job) => (
                  <div key={job.id} className="grid gap-2 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_auto]">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">Job #{job.id}</p>
                        <StatusBadge status={job.status} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Announcement #{job.announcement_id} | Scheduled: {formatDateTime(job.scheduled_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-start gap-3 text-sm text-muted-foreground md:justify-end">
                      <span>Total {job.total_recipients}</span>
                      <span>Sent {job.sent_count}</span>
                      <span>Failed {job.failed_count}</span>
                      {["queued", "scheduled", "sending"].includes(job.status) ? (
                        <Button size="sm" variant="outline" onClick={() => dispatchSingleSmsJob(job)} disabled={saving}>
                          <Send className="mr-2 size-4" /> Dispatch
                        </Button>
                      ) : null}
                      {["sent", "partial_failed"].includes(job.status) ? (
                        <Button size="sm" variant="outline" onClick={() => refreshSmsJobStatus(job)} disabled={saving}>
                          <RefreshCcw className="mr-2 size-4" /> Refresh Status
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holidays" className="mt-4">
          <Card className="rounded-lg">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>Holiday Calendar</CardTitle>
                  <CardDescription>Holiday records are created automatically when holiday announcements are published.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setHolidayMonth((current) => addMonths(current, -1))}>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <div className="min-w-40 rounded-md border border-border bg-muted/20 px-3 py-2 text-center text-sm font-semibold text-foreground">
                    {formatMonthTitle(holidayMonth)}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setHolidayMonth((current) => addMonths(current, 1))}>
                    <ChevronRight className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      setHolidayMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                    }}
                  >
                    Today
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {holidays.length === 0 ? (
                <EmptyState title="No holidays" description="Publish a holiday, festival, or vacation announcement to populate this list." />
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-border bg-muted/20 p-4">
                      <p className="text-xs font-medium text-muted-foreground">This Month</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{monthHolidays.length}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-4">
                      <p className="text-xs font-medium text-muted-foreground">Holiday Dates</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{holidayDatesInMonth.size}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-4">
                      <p className="text-xs font-medium text-muted-foreground">Schoolwide</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{monthHolidays.filter((item) => item.scope_type === "school_wide").length}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="grid grid-cols-7 border-b border-border pb-2 text-center text-xs font-semibold text-muted-foreground">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day}>{day}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-px pt-2">
                      {calendarDays.map((day) => {
                        const dayHolidays = monthHolidays.filter((item) => holidayOverlapsDate(item, day));
                        const inMonth = sameMonth(day, holidayMonth);
                        const isToday = toIsoDay(day) === toIsoDay(new Date());
                        return (
                          <div
                            key={toIsoDay(day)}
                            className={[
                              "min-h-28 rounded-md border p-2",
                              inMonth ? "border-border bg-background" : "border-transparent bg-muted/20 text-muted-foreground",
                              isToday ? "ring-2 ring-ring ring-offset-1 ring-offset-background" : "",
                              dayHolidays.length ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10" : "",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={["text-sm font-semibold", inMonth ? "text-foreground" : "text-muted-foreground"].join(" ")}>
                                {day.getDate()}
                              </span>
                              {dayHolidays.length ? (
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{dayHolidays.length}</Badge>
                              ) : null}
                            </div>
                            <div className="mt-2 space-y-1">
                              {dayHolidays.slice(0, 2).map((item) => (
                                <div key={`${item.id}-${toIsoDay(day)}`} className="truncate rounded-sm border border-emerald-200 bg-background px-1.5 py-1 text-[11px] font-medium text-foreground dark:border-emerald-500/30">
                                  {item.title}
                                </div>
                              ))}
                              {dayHolidays.length > 2 ? (
                                <p className="text-[11px] font-medium text-muted-foreground">+{dayHolidays.length - 2} more</p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-2">
                    {monthHolidays.length ? monthHolidays.map((item) => (
                      <div key={item.id} className="rounded-lg border border-border bg-card p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">{item.title}</p>
                          <Badge variant="outline">{String(item.scope_type || "school_wide").replace(/_/g, " ")}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatDate(item.starts_on)} - {formatDate(item.ends_on)}
                          {item.reopen_date ? ` | Reopen: ${formatDate(item.reopen_date)}` : ""}
                        </p>
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    )) : (
                      <EmptyState title="No holidays this month" description="Use the month controls to view other published holiday records." />
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

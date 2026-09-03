import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  Pencil,
  Plus,
  RefreshCcw,
  Send,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import TopBar from "../components/TopBar";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getClassStructure, getSessions } from "../api/academic.api";
import {
  createAnnouncement,
  createAnnouncementCategory,
  createAnnouncementHolidayName,
  createAnnouncementSmsTemplate,
  deleteAnnouncementSmsTemplate,
  dispatchAnnouncementSmsJob,
  dispatchAnnouncementSmsJobs,
  getAnnouncement,
  getAnnouncementCategories,
  getAnnouncementHolidayNames,
  getAnnouncementSmsJobRecipients,
  getAnnouncementSmsJobs,
  getAnnouncementSmsTemplates,
  getAnnouncements,
  getHolidays,
  importAnnouncementSmsTemplates,
  publishAnnouncement,
  refreshAnnouncementSmsJobStatus,
  updateAnnouncement,
  updateAnnouncementSmsTemplate,
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
  retrying: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-200",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200",
  undelivered: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200",
  cancelled: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-200",
};

const deliveryLabels = {
  online: "Online",
  offline_sms: "Offline SMS",
  both: "Online + SMS",
};

const announcementTargetOptions = [
  { value: "parents", label: "Parents", description: "All parents or filtered parent groups" },
  { value: "teachers", label: "Staff", description: "All staff, teaching staff, or non-teaching staff" },
  { value: "section", label: "Section", description: "Parents in one selected section" },
  { value: "class", label: "Class", description: "Parents in one selected class" },
  { value: "scope", label: "School / HS", description: "School or Higher Secondary scope" },
  { value: "all", label: "All Users", description: "Everyone with an active account" },
  { value: "accounts", label: "Accounts", description: "Accounts role users" },
  { value: "role", label: "Custom Role", description: "Type a specific role name" },
];

function announcementTargetLabel(value) {
  return announcementTargetOptions.find((item) => item.value === value)?.label || "Target";
}

function formatQueueAudience(item) {
  const types = String(item?.target_types || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const scopes = String(item?.scope_codes || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const staffTypes = String(item?.staff_types || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!types.length) {
    const count = Number(item?.target_count || 0);
    return count ? `${count} target rule${count === 1 ? "" : "s"}` : "Audience not set";
  }
  const labels = types.map((type) => {
    if (type === "teachers" && scopes.length) {
      const scopeLabel = scopes.includes("school") && scopes.includes("hs")
        ? "School + HS"
        : scopes.includes("hs")
          ? "HS"
          : "School";
      const staffLabel = staffTypes.includes("teaching") && staffTypes.includes("non_teaching")
        ? "staff"
        : staffTypes.includes("non_teaching")
          ? "non-teaching staff"
          : staffTypes.includes("teaching")
            ? "teaching staff"
            : "staff";
      return `${scopeLabel} ${staffLabel}`;
    }
    if (type === "teachers" && staffTypes.length) {
      if (staffTypes.includes("teaching") && staffTypes.includes("non_teaching")) return "All staff";
      if (staffTypes.includes("non_teaching")) return "Non-teaching staff";
      if (staffTypes.includes("teaching")) return "Teaching staff";
    }
    if (type === "scope" && scopes.length) {
      const scopeLabel = scopes.includes("school") && scopes.includes("hs")
        ? "School + HS"
        : scopes.includes("hs")
          ? "HS"
          : "School";
      return `${scopeLabel} parents`;
    }
    return announcementTargetLabel(type);
  });
  return labels.join(", ");
}

function visibilitySummary(item) {
  const channels = [];
  if (item?.show_in_software) channels.push("Software");
  if (item?.show_in_mobile) channels.push("Mobile");
  if (item?.show_on_website) channels.push("Website");
  return channels.length ? channels.join(" + ") : "Hidden";
}

const emptyAnnouncementForm = {
  message_type: "custom",
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
  sms_variables: {},
  sms_send_at: "",
  target_type: "all",
  role_name: "",
  session_id: "",
  scope_code: "",
  staff_type: "",
  class_id: "",
  section_id: "",
  medium: "",
  stream_id: "",
};

const emptyTemplateForm = {
  template_name: "",
  dlt_template_id: "",
  provider_template_id: "",
  header: "",
  communication_type: "",
  template_content: "",
  brand_dlt_id: "",
  placeholder_style: "alp",
  placeholder_count: "0",
  placeholder_schema: [],
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
  const text = String(value).trim();
  const localDate = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (localDate) {
    const [, year, month, day] = localDate;
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "-";
  const text = String(value).trim();
  const localDateTime = text.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (localDateTime) {
    const [, year, month, day, hourText, minute] = localDateTime;
    const hour24 = Number(hourText);
    const hour12 = hour24 % 12 || 12;
    const period = hour24 >= 12 ? "PM" : "AM";
    return `${day}/${month}/${year}, ${hour12}:${minute} ${period}`;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function parseJsonValue(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parsePlaceholderSchema(template) {
  const schema = parseJsonValue(template?.placeholder_schema_json || template?.placeholder_schema, []);
  if (Array.isArray(schema) && schema.length) return schema;
  const count = Number(template?.placeholder_count || String(template?.template_content || "").match(/\{#(?:var|alp)#\}/gi)?.length || 0);
  return Array.from({ length: count }, (_, index) => ({
    key: `value_${index + 1}`,
    label: `Value ${index + 1}`,
    type: "text",
    required: true,
  }));
}

function renderTemplateContent(content = "", schema = [], variables = {}) {
  let index = 0;
  return String(content || "").replace(/\{#(?:var|alp)#\}/gi, () => {
    const item = schema[index++];
    return item ? String(variables[item.key] || "") : "";
  });
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
    message_type: item.message_type || (item.sms_template_id ? "registered_dlt" : "custom"),
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
    sms_variables: parseJsonValue(item.sms_variables_json, {}) || {},
    sms_send_at: toDateTimeInput(item.sms_send_at),
    target_type: target.target_type || "all",
    role_name: target.role_name || "",
    session_id: target.session_id ? String(target.session_id) : "",
    scope_code: target.scope_code || "",
    staff_type: target.staff_type || "",
    class_id: target.class_id ? String(target.class_id) : "",
    section_id: target.section_id ? String(target.section_id) : "",
    medium: target.medium || "",
    stream_id: target.stream_id ? String(target.stream_id) : "",
  };
}

function templateToForm(item = {}) {
  return {
    ...emptyTemplateForm,
    template_name: item.template_name || "",
    dlt_template_id: item.dlt_template_id || "",
    provider_template_id: item.provider_template_id || "",
    header: item.header || "",
    communication_type: item.communication_type || "",
    template_content: item.template_content || "",
    brand_dlt_id: item.brand_dlt_id || "",
    placeholder_style: item.placeholder_style || "alp",
    placeholder_count: String(item.placeholder_count || 0),
    placeholder_schema: parseJsonValue(item.placeholder_schema_json || item.placeholder_schema, []) || [],
    status: item.status || "registered",
    provider: item.provider || "fast2sms",
    creator: item.creator || "",
    registered_on: toDateInput(item.registered_on),
  };
}

function StatusBadge({ status }) {
  return (
    <Badge variant="outline" className={statusClass[status] || statusClass.cancelled}>
      {String(status || "unknown").replace(/_/g, " ")}
    </Badge>
  );
}

function SmsCountBadge({ label, count, status }) {
  return (
    <Badge variant="outline" className={statusClass[status] || statusClass.cancelled}>
      {label} {Number(count || 0)}
    </Badge>
  );
}

function paginationText(meta) {
  const total = Number(meta.total || 0);
  if (!total) return "No recipients";
  const page = Number(meta.page || 1);
  const limit = Number(meta.limit || 50);
  const start = (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);
  return `${start}-${end} of ${total}`;
}

function storedRecipientCount(job) {
  const stored = Number(job?.stored_recipient_count || 0);
  return stored || Number(job?.queued_count || 0) + Number(job?.retrying_count || 0) + Number(job?.sent_recipient_count || 0) + Number(job?.delivered_count || 0) + Number(job?.failed_recipient_count || 0) + Number(job?.undelivered_count || 0);
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
    <label className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm dark:bg-input/30">
      <input
        type="checkbox"
        className="size-4 rounded border-border accent-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:accent-stone-300 dark:focus-visible:ring-offset-background"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="text-foreground">{label}</span>
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

function CompactPanel({ title, description, children, defaultOpen = false }) {
  return (
    <details className="rounded-lg border border-border bg-card" open={defaultOpen}>
      <summary className="cursor-pointer list-none px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </summary>
      <div className="grid gap-3 border-t border-border p-4">{children}</div>
    </details>
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
    scope_code: ["scope", "teachers"].includes(form.target_type) ? form.scope_code || null : null,
    staff_type: form.target_type === "teachers" ? form.staff_type || null : null,
    class_id: toNumberOrNull(form.class_id),
    section_id: toNumberOrNull(form.section_id),
    medium: form.medium || null,
    stream_id: toNumberOrNull(form.stream_id),
  };
}

function buildAnnouncementPayload(form, selectedTemplate = null) {
  const schema = selectedTemplate ? parsePlaceholderSchema(selectedTemplate) : [];
  const renderedBody = form.message_type === "registered_dlt"
    ? renderTemplateContent(selectedTemplate?.template_content || "", schema, form.sms_variables)
    : form.body.trim();
  return {
    message_type: form.message_type,
    title: form.title.trim(),
    body: renderedBody,
    category_id: toNumberOrNull(form.category_id),
    delivery_mode: form.message_type === "custom" ? "online" : form.delivery_mode,
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
    sms_template_id: form.message_type === "registered_dlt" ? toNumberOrNull(form.sms_template_id) : null,
    sms_send_at: form.sms_send_at || null,
    sms_variables: form.message_type === "registered_dlt" ? form.sms_variables || {} : {},
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
  const [holidayNames, setHolidayNames] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errorTitle, setErrorTitle] = useState("Action failed");
  const [notice, setNotice] = useState(null);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementStep, setAnnouncementStep] = useState("targeting-audience");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [recipientDialogJob, setRecipientDialogJob] = useState(null);
  const [recipientRows, setRecipientRows] = useState([]);
  const [recipientMeta, setRecipientMeta] = useState({ page: 1, limit: 50, total: 0, total_pages: 1 });
  const [recipientFilters, setRecipientFilters] = useState({ status: "", q: "", page: 1, limit: 50 });
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [filters, setFilters] = useState({ status: "", delivery_mode: "" });
  const [holidayMonth, setHolidayMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [announcementForm, setAnnouncementForm] = useState(emptyAnnouncementForm);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [categoryForm, setCategoryForm] = useState({ name: "", slug: "", description: "" });

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters]
  );

  const selectedClass = useMemo(
    () => classes.find((item) => String(item.id) === String(announcementForm.class_id)),
    [announcementForm.class_id, classes]
  );
  const selectedTemplate = useMemo(
    () => templates.find((item) => String(item.id) === String(announcementForm.sms_template_id)) || null,
    [announcementForm.sms_template_id, templates]
  );
  const selectedTemplateSchema = useMemo(() => parsePlaceholderSchema(selectedTemplate), [selectedTemplate]);
  const renderedDltBody = useMemo(
    () => renderTemplateContent(selectedTemplate?.template_content || "", selectedTemplateSchema, announcementForm.sms_variables),
    [announcementForm.sms_variables, selectedTemplate, selectedTemplateSchema]
  );
  const targetSummary = useMemo(() => {
    if (announcementForm.target_type === "all") return "All active users";
    if (announcementForm.target_type === "parents") return "All parents";
    if (announcementForm.target_type === "teachers") {
      const scopeLabel = announcementForm.scope_code === "school"
        ? "School"
        : announcementForm.scope_code === "hs"
          ? "Higher Secondary"
          : "All";
      const staffLabel = announcementForm.staff_type === "teaching"
        ? "Teaching Staff"
        : announcementForm.staff_type === "non_teaching"
          ? "Non Teaching Staff"
          : "Staff";
      return `${scopeLabel} ${staffLabel}`;
    }
    if (announcementForm.target_type === "staff") return "Staff";
    if (announcementForm.target_type === "accounts") return "Accounts";
    if (announcementForm.target_type === "role") return announcementForm.role_name ? `Role: ${announcementForm.role_name}` : "Select a role";
    const className = selectedClass?.name || "selected class";
    if (announcementForm.target_type === "class") return announcementForm.class_id ? `Parents in ${className}` : "Select class";
    if (announcementForm.target_type === "section") {
      const section = (selectedClass?.sections || []).find((item) => String(item.id) === String(announcementForm.section_id));
      return announcementForm.section_id ? `Parents in ${className} / ${section?.name || "section"}` : "Select class and section";
    }
    if (announcementForm.target_type === "scope") return announcementForm.scope_code === "hs" ? "Higher Secondary scope" : "School scope";
    return "Select target";
  }, [announcementForm, selectedClass]);
  const canContinueAnnouncementTargeting = useMemo(() => {
    if (announcementForm.target_type === "role") return Boolean(String(announcementForm.role_name || "").trim());
    if (announcementForm.target_type === "class") return Boolean(announcementForm.class_id);
    if (announcementForm.target_type === "section") return Boolean(announcementForm.class_id && announcementForm.section_id);
    if (announcementForm.target_type === "scope") return Boolean(announcementForm.scope_code);
    return Boolean(announcementForm.target_type);
  }, [announcementForm]);
  const holidayCategoryIds = useMemo(
    () => new Set(categories.filter((item) => ["holiday", "festival", "vacation"].includes(item.slug)).map((item) => Number(item.id))),
    [categories]
  );
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
      const [categoryRes, templateRes, announcementRes, sessionsRes, classesRes, jobsRes, holidayRes, holidayNameRes] = await Promise.all([
        getAnnouncementCategories(),
        getAnnouncementSmsTemplates(),
        getAnnouncements(),
        getSessions(),
        getClassStructure(),
        getAnnouncementSmsJobs().catch(() => ({ data: [] })),
        getHolidays().catch(() => ({ data: [] })),
        getAnnouncementHolidayNames().catch(() => ({ data: [] })),
      ]);
      setCategories(unwrap(categoryRes));
      setTemplates(unwrap(templateRes));
      setAnnouncements(unwrap(announcementRes));
      setSessions(unwrap(sessionsRes));
      setClasses(unwrap(classesRes));
      setSmsJobs(unwrap(jobsRes));
      setHolidays(unwrap(holidayRes));
      setHolidayNames(unwrap(holidayNameRes));
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

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  function clearFeedback() {
    setError("");
    setErrorTitle("Action failed");
    setNotice(null);
  }

  function showSuccess(title, message) {
    setError("");
    setErrorTitle("Action failed");
    setNotice({ title, message, variant: "success" });
  }

  function showInfo(title, message) {
    setError("");
    setErrorTitle("Action failed");
    setNotice({ title, message, variant: "default" });
  }

  function showError(title, message) {
    setNotice(null);
    setErrorTitle(title || "Action failed");
    setError(message || "Something went wrong.");
  }

  async function refreshAll() {
    await loadInitial();
    showInfo("Announcements Refreshed", "The announcement lists, SMS jobs, templates, and holidays were reloaded.");
  }

  async function saveAnnouncement() {
    setSaving(true);
    clearFeedback();
    try {
      const payload = buildAnnouncementPayload(announcementForm, selectedTemplate);
      if (editingAnnouncement) {
        const response = await updateAnnouncement(editingAnnouncement.id, payload);
        await loadInitial();
        if (["published", "sent"].includes(editingAnnouncement.status)) {
          showSuccess(
            "Draft Version Created",
            `Draft version #${response.data?.version_number || ""} was created from the published announcement.`
          );
        } else if (payload.status === "scheduled") {
          showSuccess("Announcement Scheduled", "The announcement was saved and will publish at the selected time.");
        } else {
          showSuccess("Draft Updated", "The announcement draft was updated.");
        }
      } else {
        const response = await createAnnouncement(payload);
        setAnnouncements((prev) => [response.data, ...prev]);
        if (payload.status === "scheduled") {
          showSuccess("Announcement Scheduled", "The announcement was saved and will publish at the selected time.");
        } else {
          showSuccess("Draft Saved", "The announcement was saved as a draft.");
        }
      }
      setAnnouncementOpen(false);
      setAnnouncementForm(emptyAnnouncementForm);
      setEditingAnnouncement(null);
      setAnnouncementStep("targeting-audience");
    } catch (err) {
      showError("Save Failed", err?.message || "Could not save announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function openAnnouncementEditor(item) {
    setSaving(true);
    clearFeedback();
    try {
      const response = await getAnnouncement(item.id);
      const detail = response.data || item;
      setEditingAnnouncement(detail);
      setAnnouncementForm(announcementToForm(detail));
      setAnnouncementStep("targeting-details");
      setAnnouncementOpen(true);
    } catch (err) {
      showError("Load Failed", err?.message || "Could not load announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(item) {
    setSaving(true);
    clearFeedback();
    try {
      const response = await publishAnnouncement(item.id);
      await loadInitial();
      const smsJob = response.data?.sms_job;
      const hasOnline = ["online", "both"].includes(item.delivery_mode);
      const deliveryText = smsJob
        ? ` SMS job #${smsJob.id} was ${smsJob.status === "scheduled" ? "scheduled" : "queued"} for ${smsJob.total_recipients || 0} recipient${Number(smsJob.total_recipients || 0) === 1 ? "" : "s"}.`
        : hasOnline
          ? " Online notifications were processed for the selected target."
          : "";
      showSuccess("Announcement Published", `${item.title || "Announcement"} is now published.${deliveryText}`);
    } catch (err) {
      showError("Publish Failed", err?.message || "Could not publish announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTemplate() {
    setSaving(true);
    clearFeedback();
    try {
      const payload = {
        ...templateForm,
        placeholder_count: Number(templateForm.placeholder_count || 0),
        placeholder_schema: templateForm.placeholder_schema || [],
      };
      const response = editingTemplate
        ? await updateAnnouncementSmsTemplate(editingTemplate.id, payload)
        : await createAnnouncementSmsTemplate(payload);
      setTemplates((prev) => {
        if (!editingTemplate) return [response.data, ...prev];
        return prev.map((item) => (String(item.id) === String(editingTemplate.id) ? response.data : item));
      });
      showSuccess("DLT Template Saved", "The SMS template is available for offline announcements.");
      closeTemplateDialog();
    } catch (err) {
      showError("Template Save Failed", err?.message || "Could not save DLT template.");
    } finally {
      setSaving(false);
    }
  }

  function openTemplateDialog(item = null) {
    setEditingTemplate(item);
    setTemplateForm(item ? templateToForm(item) : emptyTemplateForm);
    setTemplateOpen(true);
  }

  function closeTemplateDialog() {
    setTemplateOpen(false);
    setEditingTemplate(null);
    setTemplateForm(emptyTemplateForm);
  }

  async function handleDeleteTemplate() {
    if (!templateToDelete) return;
    setSaving(true);
    clearFeedback();
    try {
      await deleteAnnouncementSmsTemplate(templateToDelete.id);
      setTemplates((prev) => prev.filter((item) => String(item.id) !== String(templateToDelete.id)));
      showSuccess("DLT Template Deleted", `${templateToDelete.template_name || "Template"} was removed.`);
      setTemplateToDelete(null);
    } catch (err) {
      showError("Template Delete Failed", err?.message || "Could not delete DLT template.");
    } finally {
      setSaving(false);
    }
  }

  async function loadSmsJobRecipients(job = recipientDialogJob, filters = recipientFilters) {
    if (!job?.id) return;
    setRecipientLoading(true);
    try {
      const response = await getAnnouncementSmsJobRecipients(job.id, filters);
      const payload = response.data || {};
      setRecipientRows(Array.isArray(payload.rows) ? payload.rows : []);
      setRecipientMeta({
        page: Number(payload.page || filters.page || 1),
        limit: Number(payload.limit || filters.limit || 50),
        total: Number(payload.total || 0),
        total_pages: Number(payload.total_pages || 1),
      });
      setRecipientDialogJob((prev) => (
        prev?.id && String(prev.id) === String(job.id)
          ? { ...prev, stored_recipient_count: Number(payload.total || 0) || storedRecipientCount(prev) }
          : prev
      ));
    } catch (err) {
      showError("Recipients Load Failed", err?.message || "Could not load SMS recipients.");
    } finally {
      setRecipientLoading(false);
    }
  }

  function openSmsRecipientsDialog(job) {
    const nextFilters = { status: "", q: "", page: 1, limit: 50 };
    setRecipientDialogJob(job);
    setRecipientFilters(nextFilters);
    setRecipientRows([]);
    setRecipientMeta({ page: 1, limit: 50, total: 0, total_pages: 1 });
    loadSmsJobRecipients(job, nextFilters);
  }

  function closeSmsRecipientsDialog() {
    setRecipientDialogJob(null);
    setRecipientRows([]);
    setRecipientMeta({ page: 1, limit: 50, total: 0, total_pages: 1 });
    setRecipientFilters({ status: "", q: "", page: 1, limit: 50 });
  }

  function updateRecipientFilters(patch) {
    const nextFilters = { ...recipientFilters, ...patch };
    setRecipientFilters(nextFilters);
    loadSmsJobRecipients(recipientDialogJob, nextFilters);
  }

  const recipientEmptyMessage = useMemo(() => {
    const filtered = Boolean(recipientFilters.status || String(recipientFilters.q || "").trim());
    if (filtered) return "No recipients match the current filters.";
    const jobTotal = Number(recipientDialogJob?.total_recipients || 0);
    if (jobTotal > 0) return `No stored recipient rows for this SMS job. Job total: ${jobTotal}.`;
    return "No recipients were generated for this SMS job.";
  }, [recipientDialogJob, recipientFilters]);

  const recipientStoredTotal = storedRecipientCount(recipientDialogJob);

  async function importTemplates() {
    if (!importFile) {
      showError("Import Failed", "Choose an XLSX or CSV file first.");
      return;
    }
    setSaving(true);
    clearFeedback();
    try {
      const response = await importAnnouncementSmsTemplates(importFile);
      const result = response.data || {};
      const templateRes = await getAnnouncementSmsTemplates();
      setTemplates(unwrap(templateRes));
      if (result.failed_count) {
        showError(
          "Import Partially Completed",
          `Imported ${result.imported_count || 0} template${Number(result.imported_count || 0) === 1 ? "" : "s"}; ${result.failed_count} row${Number(result.failed_count) === 1 ? "" : "s"} failed.`
        );
      } else {
        showSuccess("DLT Templates Imported", `Imported ${result.imported_count || 0} template${Number(result.imported_count || 0) === 1 ? "" : "s"}.`);
      }
      setImportFile(null);
      setImportOpen(false);
      setActiveTab("templates");
    } catch (err) {
      showError("Import Failed", err?.message || "Could not import DLT templates.");
    } finally {
      setSaving(false);
    }
  }

  async function dispatchDueSms() {
    setSaving(true);
    clearFeedback();
    try {
      const response = await dispatchAnnouncementSmsJobs();
      const result = response.data || {};
      const jobsRes = await getAnnouncementSmsJobs();
      setSmsJobs(unwrap(jobsRes));
      if (result.failed) {
        showError(
          "SMS Dispatch Partially Completed",
          `Dispatched ${result.sent || 0} recipient${Number(result.sent || 0) === 1 ? "" : "s"}; ${result.failed} failed.`
        );
      } else {
        showSuccess("SMS Dispatch Completed", `Dispatched ${result.attempted || 0} recipient${Number(result.attempted || 0) === 1 ? "" : "s"}.`);
      }
    } catch (err) {
      showError("SMS Dispatch Failed", err?.message || "Could not dispatch SMS jobs.");
    } finally {
      setSaving(false);
    }
  }

  async function dispatchSingleSmsJob(job) {
    setSaving(true);
    clearFeedback();
    try {
      const response = await dispatchAnnouncementSmsJob(job.id);
      const result = response.data || {};
      const jobsRes = await getAnnouncementSmsJobs();
      setSmsJobs(unwrap(jobsRes));
      if (recipientDialogJob?.id && String(recipientDialogJob.id) === String(job.id)) {
        await loadSmsJobRecipients(job);
      }
      if (result.failed) {
        showError(
          "SMS Job Partially Completed",
          `Job #${job.id} sent ${result.sent || 0} recipient${Number(result.sent || 0) === 1 ? "" : "s"}; ${result.failed} failed.`
        );
      } else {
        showSuccess("SMS Job Dispatched", `Job #${job.id} dispatched ${result.attempted || 0} recipient${Number(result.attempted || 0) === 1 ? "" : "s"}.`);
      }
    } catch (err) {
      showError("SMS Job Failed", err?.message || "Could not dispatch SMS job.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshSmsJobStatus(job) {
    setSaving(true);
    clearFeedback();
    try {
      const response = await refreshAnnouncementSmsJobStatus(job.id);
      const result = response.data || {};
      const jobsRes = await getAnnouncementSmsJobs();
      setSmsJobs(unwrap(jobsRes));
      if (recipientDialogJob?.id && String(recipientDialogJob.id) === String(job.id)) {
        await loadSmsJobRecipients(job);
      }
      if (result.failed) {
        showError(
          "Status Refresh Partially Completed",
          `Job #${job.id} checked ${result.checked || 0} recipient${Number(result.checked || 0) === 1 ? "" : "s"}; ${result.failed} status check${Number(result.failed) === 1 ? "" : "s"} failed.`
        );
      } else {
        showSuccess("SMS Status Refreshed", `Job #${job.id} checked ${result.checked || 0} recipient${Number(result.checked || 0) === 1 ? "" : "s"}.`);
      }
    } catch (err) {
      showError("Status Refresh Failed", err?.message || "Could not refresh SMS delivery status.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory() {
    setSaving(true);
    clearFeedback();
    try {
      const response = await createAnnouncementCategory(categoryForm);
      setCategories((prev) => [response.data, ...prev]);
      showSuccess("Category Saved", "The category is available for new announcements.");
      setCategoryOpen(false);
      setCategoryForm({ name: "", slug: "", description: "" });
    } catch (err) {
      showError("Category Save Failed", err?.message || "Could not save category.");
    } finally {
      setSaving(false);
    }
  }

  async function saveHolidayName(name) {
    const value = String(name || "").trim();
    if (!value) {
      showError("Holiday Save Failed", "Enter a holiday name first.");
      return;
    }
    setSaving(true);
    clearFeedback();
    try {
      const response = await createAnnouncementHolidayName({ name: value, category: "holiday" });
      setHolidayNames((prev) => {
        const next = response.data;
        if (!next) return prev;
        const exists = prev.some((item) => String(item.id) === String(next.id) || String(item.name).toLowerCase() === String(next.name).toLowerCase());
        return exists ? prev.map((item) => (String(item.id) === String(next.id) ? next : item)) : [...prev, next].sort((a, b) => String(a.name).localeCompare(String(b.name)));
      });
      showSuccess("Holiday Saved", `${value} is available for future DLT announcements.`);
    } catch (err) {
      showError("Holiday Save Failed", err?.message || "Could not save holiday name.");
    } finally {
      setSaving(false);
    }
  }

  function updateAnnouncementField(field, value) {
    setAnnouncementForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "target_type" ? { role_name: "", class_id: "", section_id: "", medium: "", scope_code: "", staff_type: "" } : {}),
      ...(field === "message_type" && value === "custom" ? { delivery_mode: "online", sms_template_id: "", sms_send_at: "", sms_variables: {} } : {}),
      ...(field === "message_type" && value === "registered_dlt" ? { delivery_mode: "both" } : {}),
      ...(field === "delivery_mode" && value === "online" && prev.message_type === "custom" ? { sms_template_id: "", sms_send_at: "" } : {}),
      ...(field === "sms_template_id" ? { sms_variables: {} } : {}),
      ...(field === "class_id" ? { section_id: "", medium: "" } : {}),
    }));
  }

  function selectAnnouncementAudience(targetType) {
    updateAnnouncementField("target_type", targetType);
    setAnnouncementStep("targeting-details");
  }

  function updateSmsVariable(key, value) {
    setAnnouncementForm((prev) => ({
      ...prev,
      sms_variables: {
        ...(prev.sms_variables || {}),
        [key]: value,
      },
    }));
  }

  function updateTemplateSchema(index, key, value) {
    setTemplateForm((prev) => ({
      ...prev,
      placeholder_schema: (prev.placeholder_schema || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  }

  function syncTemplateSchemaFromContent(content) {
    const count = String(content || "").match(/\{#(?:var|alp)#\}/gi)?.length || 0;
    setTemplateForm((prev) => {
      const current = prev.placeholder_schema || [];
      return {
        ...prev,
        template_content: content,
        placeholder_count: String(count),
        placeholder_schema: Array.from({ length: count }, (_, index) => current[index] || {
          key: `value_${index + 1}`,
          label: `Value ${index + 1}`,
          type: "text",
          required: true,
        }),
      };
    });
  }

  return (
    <div className="space-y-4">
      <TopBar
        title="Announcements"
        subTitle="Draft, publish, and track online announcements, DLT SMS queues, and holidays"
        action={
          <div className="flex flex-wrap items-center justify-end gap-1">
            <Button variant="outline" className="gap-1" onClick={refreshAll} disabled={loading}>
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
              <PopoverContent align="end" className="w-[min(92vw,360px)] space-y-4">
                <PopoverHeader>
                  <PopoverTitle>Announcement Filters</PopoverTitle>
                  <PopoverDescription>Filter by publication status and delivery mode.</PopoverDescription>
                </PopoverHeader>
                <div className="grid gap-3">
                  <Field label="Status">
                    <select className={selectClassName} value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                      <option value="">All statuses</option>
                      <option value="draft">Draft</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="published">Published</option>
                      <option value="sent">Sent</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </Field>
                  <Field label="Delivery">
                    <select className={selectClassName} value={filters.delivery_mode} onChange={(event) => setFilters((prev) => ({ ...prev, delivery_mode: event.target.value }))}>
                      <option value="">All delivery modes</option>
                      <option value="online">Online</option>
                      <option value="offline_sms">Offline SMS</option>
                      <option value="both">Online + SMS</option>
                    </select>
                  </Field>
                </div>
                <div className="flex justify-end border-t border-border pt-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => setFilters({ status: "", delivery_mode: "" })}>
                    Clear filters
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-1"><Plus className="size-4" /> Category</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
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
          <Dialog open={templateOpen} onOpenChange={(open) => (open ? setTemplateOpen(true) : closeTemplateDialog())}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>{editingTemplate ? "Edit DLT SMS Template" : "New DLT SMS Template"}</DialogTitle>
                <DialogDescription>Registered templates are used when offline announcements are published.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <FormSection title="Template Registration">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Template Name"><Input value={templateForm.template_name} onChange={(event) => setTemplateForm((prev) => ({ ...prev, template_name: event.target.value }))} /></Field>
                    <Field label="DLT Template ID"><Input value={templateForm.dlt_template_id} onChange={(event) => setTemplateForm((prev) => ({ ...prev, dlt_template_id: event.target.value }))} /></Field>
                    <Field label="Fast2SMS Message ID"><Input value={templateForm.provider_template_id} onChange={(event) => setTemplateForm((prev) => ({ ...prev, provider_template_id: event.target.value }))} /></Field>
                    <Field label="Header"><Input value={templateForm.header} onChange={(event) => setTemplateForm((prev) => ({ ...prev, header: event.target.value }))} /></Field>
                    <Field label="Communication Type"><Input value={templateForm.communication_type} onChange={(event) => setTemplateForm((prev) => ({ ...prev, communication_type: event.target.value }))} /></Field>
                    <Field label="Brand DLT ID"><Input value={templateForm.brand_dlt_id} onChange={(event) => setTemplateForm((prev) => ({ ...prev, brand_dlt_id: event.target.value }))} /></Field>
                    <Field label="Placeholder Count"><Input type="number" value={templateForm.placeholder_count} onChange={(event) => setTemplateForm((prev) => ({ ...prev, placeholder_count: event.target.value }))} /></Field>
                  </div>
                  <Field label="Template Content"><Textarea className="min-h-28" value={templateForm.template_content} onChange={(event) => syncTemplateSchemaFromContent(event.target.value)} /></Field>
                  {templateForm.placeholder_schema?.length ? (
                    <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Template Variables</p>
                      {templateForm.placeholder_schema.map((item, index) => (
                        <div key={index} className="grid gap-2 md:grid-cols-[1fr_1.4fr_0.9fr_auto]">
                          <Field label={`Key ${index + 1}`}>
                            <Input value={item.key} onChange={(event) => updateTemplateSchema(index, "key", event.target.value)} />
                          </Field>
                          <Field label="Label">
                            <Input value={item.label} onChange={(event) => updateTemplateSchema(index, "label", event.target.value)} />
                          </Field>
                          <Field label="Type">
                            <select className={selectClassName} value={item.type || "text"} onChange={(event) => updateTemplateSchema(index, "type", event.target.value)}>
                              <option value="text">Text</option>
                              <option value="date">Date</option>
                              <option value="holiday">Holiday</option>
                              <option value="number">Number</option>
                            </select>
                          </Field>
                          <div className="flex items-end">
                            <ToggleField label="Required" checked={item.required !== false} onChange={(value) => updateTemplateSchema(index, "required", value)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
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
                  <Button variant="outline" onClick={closeTemplateDialog}>Cancel</Button>
                  <Button onClick={saveTemplate} disabled={saving}>Save Template</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-1"><Upload className="size-4" /> Import DLT Sheet</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Import DLT Templates</DialogTitle>
                <DialogDescription>
                  Upload the DLT Excel sheet directly. Existing rows are updated by DLT Template ID.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <FilePicker file={importFile} onChange={setImportFile} />
                <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Supported headers: Template Name, DLT Template ID, Fast2SMS Message ID, Header, Template Content, Communication Type, Status.
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
          <AlertDialog open={Boolean(templateToDelete)} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete DLT template?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes {templateToDelete?.template_name || "the selected template"} only if it has not been used by an announcement or SMS job. Used templates should be marked inactive instead.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDeleteTemplate}
                  disabled={saving}
                >
                  Delete Template
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Dialog
            open={announcementOpen}
            onOpenChange={(open) => {
              setAnnouncementOpen(open);
              if (!open) {
                setEditingAnnouncement(null);
                setAnnouncementForm(emptyAnnouncementForm);
                setAnnouncementStep("targeting-audience");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-1" onClick={() => {
                setEditingAnnouncement(null);
                setAnnouncementForm(emptyAnnouncementForm);
                setAnnouncementStep("targeting-audience");
              }}>
                <Plus className="size-4" /> Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-4xl">
              <DialogHeader className="border-b bg-card px-6 py-5">
                <DialogTitle>{editingAnnouncement ? "Edit Announcement" : "New Announcement"}</DialogTitle>
                <DialogDescription>
                  Step {announcementStep === "message" ? "2" : "1"} of 2
                </DialogDescription>
              </DialogHeader>
              <div className="flex h-[calc(88vh-96px)] min-h-0 flex-col">
                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-4 px-6 py-5">
                    {editingAnnouncement && ["published", "sent"].includes(editingAnnouncement.status) ? (
                      <Alert>
                        <AlertTitle>Published version stays live</AlertTitle>
                        <AlertDescription>Saving changes creates a new draft version. Publish the draft when it is ready.</AlertDescription>
                      </Alert>
                    ) : null}
                    {announcementStep === "targeting-audience" ? (
                      <>
                        <div className="space-y-5">
                          {[
                            { title: "Class Or Section", values: ["section", "class", "scope"] },
                            { title: "Whole Group", values: ["parents", "teachers", "all"] },
                            { title: "Role", values: ["accounts", "role"] },
                          ].map((group) => (
                            <section key={group.title} className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
                              <div className="grid gap-2">
                                {group.values.map((value) => {
                                  const option = announcementTargetOptions.find((item) => item.value === value);
                                  if (!option) return null;
                                  return (
                                    <button
                                      key={value}
                                      type="button"
                                      className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-left transition hover:bg-muted/50"
                                      onClick={() => selectAnnouncementAudience(value)}
                                    >
                                      <span>
                                        <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                                        <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
                                      </span>
                                      <span className="text-lg text-muted-foreground">&gt;</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </section>
                          ))}
                        </div>
                      </>
                    ) : announcementStep === "targeting-details" ? (
                      <>
                        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Sending To</p>
                          <p className="mt-1 font-semibold text-foreground">{announcementTargetLabel(announcementForm.target_type)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{targetSummary}</p>
                        </div>
                        <div className="space-y-4">
                          {announcementForm.target_type === "role" ? (
                            <Field label="Role Name"><Input value={announcementForm.role_name} onChange={(event) => updateAnnouncementField("role_name", event.target.value)} placeholder="parent, teacher, staff" /></Field>
                          ) : null}
                          {announcementForm.target_type === "teachers" ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              <Field label="Scope">
                                <select className={selectClassName} value={announcementForm.scope_code} onChange={(event) => updateAnnouncementField("scope_code", event.target.value)}>
                                  <option value="">All scopes</option>
                                  <option value="school">School</option>
                                  <option value="hs">Higher Secondary</option>
                                </select>
                              </Field>
                              <Field label="Staff Type">
                                <select className={selectClassName} value={announcementForm.staff_type} onChange={(event) => updateAnnouncementField("staff_type", event.target.value)}>
                                  <option value="">All staff types</option>
                                  <option value="teaching">Teaching</option>
                                  <option value="non_teaching">Non Teaching</option>
                                </select>
                              </Field>
                            </div>
                          ) : null}
                          {["class", "section", "parents", "scope"].includes(announcementForm.target_type) ? (
                            <Field label="Session">
                              <select className={selectClassName} value={announcementForm.session_id} onChange={(event) => updateAnnouncementField("session_id", event.target.value)}>
                                <option value="">Any session</option>
                                {sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                              </select>
                            </Field>
                          ) : null}
                          {announcementForm.target_type === "scope" ? (
                            <Field label="Scope">
                              <select className={selectClassName} value={announcementForm.scope_code} onChange={(event) => updateAnnouncementField("scope_code", event.target.value)}>
                                <option value="">Select scope</option>
                                <option value="school">School</option>
                                <option value="hs">Higher Secondary</option>
                              </select>
                            </Field>
                          ) : null}
                          {["class", "section"].includes(announcementForm.target_type) ? (
                            <Field label="Class">
                              <select className={selectClassName} value={announcementForm.class_id} onChange={(event) => updateAnnouncementField("class_id", event.target.value)}>
                                <option value="">Select class</option>
                                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                              </select>
                            </Field>
                          ) : null}
                          {announcementForm.target_type === "section" ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              <Field label="Section">
                                <select className={selectClassName} value={announcementForm.section_id} onChange={(event) => updateAnnouncementField("section_id", event.target.value)}>
                                  <option value="">Select section</option>
                                  {(selectedClass?.sections || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                                </select>
                              </Field>
                              <Field label="Medium">
                                <select className={selectClassName} value={announcementForm.medium} onChange={(event) => updateAnnouncementField("medium", event.target.value)}>
                                  <option value="">Any</option>
                                  {(selectedClass?.mediums || ["English", "Assamese"]).map((medium) => <option key={medium} value={medium}>{medium}</option>)}
                                </select>
                              </Field>
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Sending To</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{targetSummary}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-card p-4">
                          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                            <Field label="Title"><Input value={announcementForm.title} onChange={(event) => updateAnnouncementField("title", event.target.value)} /></Field>
                            <ToggleField label="Urgent" checked={announcementForm.priority === "urgent"} onChange={(value) => updateAnnouncementField("priority", value ? "urgent" : "normal")} />
                          </div>
                          <div className="mt-4 grid gap-2 md:grid-cols-2">
                            {[
                              { value: "custom", title: "Custom Message", description: "Visible in app and software." },
                              { value: "registered_dlt", title: "Registered DLT", description: "Uses approved SMS template variables." },
                            ].map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className={`rounded-lg border px-4 py-3 text-left transition ${
                                  announcementForm.message_type === option.value ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/50"
                                }`}
                                onClick={() => updateAnnouncementField("message_type", option.value)}
                              >
                                <span className="block text-sm font-semibold text-foreground">{option.title}</span>
                                <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
                              </button>
                            ))}
                          </div>
                          <div className="mt-4">
                            {announcementForm.message_type === "custom" ? (
                              <Field label="Body"><Textarea className="min-h-32" value={announcementForm.body} onChange={(event) => updateAnnouncementField("body", event.target.value)} /></Field>
                            ) : (
                              <div className="space-y-3">
                                <Field label="DLT Template">
                                  <select className={selectClassName} value={announcementForm.sms_template_id} onChange={(event) => updateAnnouncementField("sms_template_id", event.target.value)}>
                                    <option value="">Select registered template</option>
                                    {templates.filter((item) => item.status === "registered").map((item) => <option key={item.id} value={item.id}>{item.template_name}</option>)}
                                  </select>
                                </Field>
                                {selectedTemplate ? (
                                  <>
                                    <div className="rounded-md border border-border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                                      {selectedTemplate.template_content}
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                      {selectedTemplateSchema.map((item) => (
                                        <Field key={item.key} label={item.label}>
                                          {item.type === "date" ? (
                                            <Input required={item.required !== false} type="date" value={announcementForm.sms_variables?.[item.key] || ""} onChange={(event) => updateSmsVariable(item.key, event.target.value)} />
                                          ) : item.type === "holiday" ? (
                                            <div className="flex gap-2">
                                              <Input required={item.required !== false} list="announcement-holiday-options" value={announcementForm.sms_variables?.[item.key] || ""} onChange={(event) => updateSmsVariable(item.key, event.target.value)} placeholder="Select or type holiday" />
                                              <Button type="button" variant="outline" size="sm" onClick={() => saveHolidayName(announcementForm.sms_variables?.[item.key])} disabled={saving || !String(announcementForm.sms_variables?.[item.key] || "").trim()}>
                                                Add
                                              </Button>
                                            </div>
                                          ) : (
                                            <Input required={item.required !== false} type={item.type === "number" ? "number" : "text"} value={announcementForm.sms_variables?.[item.key] || ""} onChange={(event) => updateSmsVariable(item.key, event.target.value)} />
                                          )}
                                        </Field>
                                      ))}
                                    </div>
                                    <datalist id="announcement-holiday-options">
                                      {holidayNames.map((item) => <option key={`name-${item.id}`} value={item.name} />)}
                                      {holidays.map((item) => <option key={item.id} value={item.title} />)}
                                      {categories.filter((item) => ["holiday", "festival", "vacation"].includes(item.slug)).map((item) => <option key={item.slug} value={item.name} />)}
                                    </datalist>
                                    <Field label="Preview"><Textarea readOnly className="min-h-24 bg-background" value={renderedDltBody} /></Field>
                                  </>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>

                        <CompactPanel title="Publish Options" description="Defaults save a normal online announcement. Change only when required.">
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
                            {announcementForm.status === "scheduled" ? (
                              <Field label="Publish At"><Input type="datetime-local" value={announcementForm.publish_at} onChange={(event) => updateAnnouncementField("publish_at", event.target.value)} /></Field>
                            ) : null}
                            {announcementForm.message_type === "registered_dlt" ? (
                              <>
                                <Field label="Delivery">
                                  <select className={selectClassName} value={announcementForm.delivery_mode} onChange={(event) => updateAnnouncementField("delivery_mode", event.target.value)}>
                                    <option value="online">Online</option>
                                    <option value="offline_sms">Offline SMS</option>
                                    <option value="both">Online + SMS</option>
                                  </select>
                                </Field>
                                <Field label="SMS Send At"><Input type="datetime-local" value={announcementForm.sms_send_at} onChange={(event) => updateAnnouncementField("sms_send_at", event.target.value)} /></Field>
                              </>
                            ) : (
                              <p className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground md:col-span-2">
                                Custom messages stay online because DLT SMS requires registered template content.
                              </p>
                            )}
                          </div>
                        </CompactPanel>

                        <CompactPanel title="Advanced" description="Visibility, notifications, expiry, and holiday-calendar dates.">
                          <div className="grid gap-2 md:grid-cols-2">
                            <ToggleField label="Show in software" checked={announcementForm.show_in_software} onChange={(value) => updateAnnouncementField("show_in_software", value)} />
                            <ToggleField label="Show in mobile" checked={announcementForm.show_in_mobile} onChange={(value) => updateAnnouncementField("show_in_mobile", value)} />
                            <ToggleField label="Create online notification" checked={announcementForm.create_notification} onChange={(value) => updateAnnouncementField("create_notification", value)} />
                            <ToggleField label="Send push notification" checked={announcementForm.send_push} onChange={(value) => updateAnnouncementField("send_push", value)} />
                          </div>
                          <div className="grid gap-3 md:grid-cols-4">
                            <Field label="Expires At"><Input type="datetime-local" value={announcementForm.expires_at} onChange={(event) => updateAnnouncementField("expires_at", event.target.value)} /></Field>
                            <Field label="Event Starts"><Input type="date" value={announcementForm.event_start_date} onChange={(event) => updateAnnouncementField("event_start_date", event.target.value)} /></Field>
                            <Field label="Event Ends"><Input type="date" value={announcementForm.event_end_date} onChange={(event) => updateAnnouncementField("event_end_date", event.target.value)} /></Field>
                            <Field label="Reopen Date"><Input type="date" value={announcementForm.reopen_date} onChange={(event) => updateAnnouncementField("reopen_date", event.target.value)} /></Field>
                          </div>
                          {holidayCategoryIds.has(Number(announcementForm.category_id)) ? (
                            <Alert>
                              <CalendarDays className="size-4" />
                              <AlertTitle>Holiday calendar</AlertTitle>
                              <AlertDescription>Publishing this category will create calendar holiday records for the selected target.</AlertDescription>
                            </Alert>
                          ) : null}
                        </CompactPanel>
                      </>
                    )}
                  </div>
                </ScrollArea>
                {announcementStep !== "targeting-audience" ? (
                  <div className="flex items-center justify-between gap-3 border-t bg-card px-6 py-4">
                    <Button variant="outline" onClick={() => setAnnouncementOpen(false)}>Cancel</Button>
                    <div className="flex gap-2">
                      {announcementStep === "targeting-details" ? (
                        <Button type="button" variant="outline" onClick={() => setAnnouncementStep("targeting-audience")}>Change Audience</Button>
                      ) : null}
                      {announcementStep === "message" ? (
                        <Button type="button" variant="outline" onClick={() => setAnnouncementStep("targeting-details")}>Back</Button>
                      ) : null}
                      {announcementStep === "targeting-details" ? (
                        <Button type="button" onClick={() => setAnnouncementStep("message")} disabled={!canContinueAnnouncementTargeting}>Continue to Message</Button>
                      ) : (
                        <Button onClick={saveAnnouncement} disabled={saving}>
                          {editingAnnouncement ? "Save Changes" : "Save Announcement"}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>
          </div>
      }
    />

      <Dialog open={Boolean(recipientDialogJob)} onOpenChange={(open) => !open && closeSmsRecipientsDialog()}>
        <DialogContent className="flex h-[88vh] max-h-[88vh] flex-col overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="shrink-0 border-b bg-card px-6 py-5">
            <DialogTitle>SMS Recipients</DialogTitle>
            <DialogDescription>
              {recipientDialogJob?.announcement_title || `Job #${recipientDialogJob?.id || ""}`} recipient delivery details.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-5">
            <div className="shrink-0 grid gap-3 rounded-md border border-border bg-muted/20 p-3 md:grid-cols-[1fr_auto] md:items-end">
              <div className="grid gap-3 md:grid-cols-[180px_1fr_140px]">
                <Field label="Status">
                  <select
                    className={selectClassName}
                    value={recipientFilters.status}
                    onChange={(event) => updateRecipientFilters({ status: event.target.value, page: 1 })}
                  >
                    <option value="">All statuses</option>
                    <option value="queued">Queued</option>
                    <option value="retrying">Retrying</option>
                    <option value="sent">Sent</option>
                    <option value="delivered">Delivered</option>
                    <option value="failed">Failed</option>
                    <option value="undelivered">Undelivered</option>
                  </select>
                </Field>
                <Field label="Search">
                  <Input
                    value={recipientFilters.q}
                    onChange={(event) => setRecipientFilters((prev) => ({ ...prev, q: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") updateRecipientFilters({ page: 1 });
                    }}
                    placeholder="Name, phone, provider status, or error"
                  />
                </Field>
                <Field label="Page Size">
                  <select
                    className={selectClassName}
                    value={recipientFilters.limit}
                    onChange={(event) => updateRecipientFilters({ limit: Number(event.target.value), page: 1 })}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </Field>
              </div>
              <Button type="button" variant="outline" onClick={() => updateRecipientFilters({ page: 1 })} disabled={recipientLoading}>
                Search
              </Button>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <StatusBadge status={recipientDialogJob?.status} />
              <SmsCountBadge label="Total" count={recipientDialogJob?.total_recipients} status="queued" />
              <SmsCountBadge label="Rows" count={recipientStoredTotal} status="queued" />
              <SmsCountBadge label="Sent" count={recipientDialogJob?.sent_recipient_count ?? recipientDialogJob?.sent_count} status="sent" />
              <SmsCountBadge label="Delivered" count={recipientDialogJob?.delivered_count} status="delivered" />
              <SmsCountBadge label="Failed" count={(Number(recipientDialogJob?.failed_recipient_count || 0) + Number(recipientDialogJob?.undelivered_count || 0)) || recipientDialogJob?.failed_count} status="failed" />
            </div>
            <div className="min-h-[180px] flex-1 overflow-hidden rounded-md border border-border">
              {recipientLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading recipients...</p>
              ) : recipientRows.length ? (
                <div className="h-full overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Recipient</th>
                        <th className="px-3 py-2 text-left font-medium">Student</th>
                        <th className="px-3 py-2 text-left font-medium">Phone</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                        <th className="px-3 py-2 text-left font-medium">Provider</th>
                        <th className="px-3 py-2 text-left font-medium">Attempts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipientRows.map((recipient) => (
                        <tr key={recipient.id} className="border-t border-border">
                          <td className="px-3 py-2">
                            <p className="font-medium text-foreground">{recipient.recipient_name || "-"}</p>
                            <p className="text-xs text-muted-foreground">{recipient.recipient_role || "recipient"}</p>
                          </td>
                          <td className="px-3 py-2">
                            {recipient.student_name ? (
                              <div className="min-w-48">
                                <p className="font-medium text-foreground">{recipient.student_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {[recipient.student_class_name, recipient.student_section_name].filter(Boolean).join(" / ") || "Class not set"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {[
                                    recipient.student_roll_number ? `Roll ${recipient.student_roll_number}` : null,
                                    recipient.student_medium,
                                    recipient.student_stream_name,
                                  ].filter(Boolean).join(" | ") || "-"}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{recipient.phone || "-"}</td>
                          <td className="px-3 py-2"><StatusBadge status={recipient.status} /></td>
                          <td className="px-3 py-2">
                            <p className="text-muted-foreground">{recipient.provider_status || "-"}</p>
                            {recipient.error_message ? <p className="mt-1 text-xs text-destructive">{recipient.error_message}</p> : null}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{recipient.attempt_count || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-4 text-sm text-muted-foreground">{recipientEmptyMessage}</p>
              )}
            </div>
            <DialogFooter className="shrink-0 items-center justify-between gap-3 border-t border-border pt-4 sm:justify-between">
              <p className="text-sm text-muted-foreground">{paginationText(recipientMeta)}</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateRecipientFilters({ page: Math.max(1, Number(recipientMeta.page || 1) - 1) })}
                  disabled={recipientLoading || Number(recipientMeta.page || 1) <= 1}
                >
                  <ChevronLeft className="mr-1 size-4" /> Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateRecipientFilters({ page: Math.min(Number(recipientMeta.total_pages || 1), Number(recipientMeta.page || 1) + 1) })}
                  disabled={recipientLoading || Number(recipientMeta.page || 1) >= Number(recipientMeta.total_pages || 1)}
                >
                  Next <ChevronRight className="ml-1 size-4" />
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <div className="pointer-events-none fixed top-6 right-6 z-50 w-full max-w-sm">
        <div
          className={`transition-all duration-500 ease-out ${
            error || notice ? "translate-x-0 scale-100 opacity-100" : "translate-x-12 scale-95 opacity-0"
          }`}
        >
          {error ? (
            <Alert variant="destructive" className="pointer-events-auto overflow-hidden border shadow-xl">
              <AlertTitle>{errorTitle}</AlertTitle>
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="announcements"><Megaphone className="mr-2 size-4" /> Announcements</TabsTrigger>
          <TabsTrigger value="templates"><Smartphone className="mr-2 size-4" /> DLT Templates</TabsTrigger>
          <TabsTrigger value="sms"><Send className="mr-2 size-4" /> SMS Jobs</TabsTrigger>
          <TabsTrigger value="holidays"><CalendarDays className="mr-2 size-4" /> Holidays</TabsTrigger>
        </TabsList>

        <TabsContent value="announcements" className="mt-4">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Announcement Queue</CardTitle>
              <CardDescription>Review drafts, scheduled posts, published notices, and SMS-enabled announcements.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground dark:bg-input/20">
                  Loading announcements...
                </div>
              ) : announcements.length === 0 ? (
                <EmptyState title="No announcements" description="Create a draft announcement to begin." />
              ) : (
                announcements.map((item) => (
                  <div key={item.id} className="rounded-md border border-border bg-background p-4 dark:bg-input/20">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">{item.title || `Announcement #${item.id}`}</p>
                          <StatusBadge status={item.status} />
                          {item.version_number ? <Badge variant="outline">v{item.version_number}</Badge> : null}
                          {item.priority === "urgent" ? <Badge variant="destructive">Urgent</Badge> : null}
                          <Badge variant="secondary">{deliveryLabels[item.delivery_mode] || item.delivery_mode}</Badge>
                          {item.category_name ? <Badge variant="outline">{item.category_name}</Badge> : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
                        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-md bg-muted/30 px-3 py-2">
                            <p className="font-medium text-foreground">Audience</p>
                            <p className="mt-0.5">{formatQueueAudience(item)}</p>
                          </div>
                          <div className="rounded-md bg-muted/30 px-3 py-2">
                            <p className="font-medium text-foreground">Publish</p>
                            <p className="mt-0.5">{formatDateTime(item.published_at || item.publish_at)}</p>
                          </div>
                          <div className="rounded-md bg-muted/30 px-3 py-2">
                            <p className="font-medium text-foreground">Visible</p>
                            <p className="mt-0.5">{visibilitySummary(item)}</p>
                          </div>
                          <div className="rounded-md bg-muted/30 px-3 py-2">
                            <p className="font-medium text-foreground">Event</p>
                            <p className="mt-0.5">{formatDate(item.event_start_date)} - {formatDate(item.event_end_date)}</p>
                          </div>
                        </div>
                        {item.sms_template_name ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            SMS template: <span className="font-medium text-foreground">{item.sms_template_name}</span>
                            {item.sms_send_at ? ` | SMS send: ${formatDateTime(item.sms_send_at)}` : ""}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-start justify-start gap-2 lg:justify-end">
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
                  <Button variant="outline" onClick={() => openTemplateDialog()}>
                    <Plus className="mr-2 size-4" /> New Template
                  </Button>
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
                  <div key={item.id} className="rounded-md border border-border bg-background p-4 dark:bg-input/20">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{item.template_name}</p>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={item.status} />
                        <Button type="button" size="icon" variant="outline" onClick={() => openTemplateDialog(item)} aria-label="Edit template">
                          <Pencil className="size-4" />
                        </Button>
                        <Button type="button" size="icon" variant="destructive" onClick={() => setTemplateToDelete(item)} aria-label="Delete template">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">DLT: {item.dlt_template_id}</p>
                    {item.provider_template_id ? <p className="mt-1 text-xs text-muted-foreground">Fast2SMS: {item.provider_template_id}</p> : null}
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
                    <div key={job.id} className="rounded-md border border-border bg-background p-4 dark:bg-input/20">
                      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">Job #{job.id}</p>
                            <StatusBadge status={job.status} />
                            {job.template_name ? <Badge variant="secondary">{job.template_name}</Badge> : null}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {job.announcement_title || `Announcement #${job.announcement_id}`}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Scheduled: {formatDateTime(job.scheduled_at)} | Started: {formatDateTime(job.started_at)} | Completed: {formatDateTime(job.completed_at)}
                          </p>
                          {job.error_message ? <p className="mt-1 text-xs text-destructive">{job.error_message}</p> : null}
                        </div>
                        <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                          <SmsCountBadge label="Total" count={job.total_recipients} status="queued" />
                          <SmsCountBadge label="Queued" count={job.queued_count} status="queued" />
                          <SmsCountBadge label="Retrying" count={job.retrying_count} status="retrying" />
                          <SmsCountBadge label="Sent" count={job.sent_recipient_count ?? job.sent_count} status="sent" />
                          <SmsCountBadge label="Delivered" count={job.delivered_count} status="delivered" />
                          <SmsCountBadge label="Failed" count={(Number(job.failed_recipient_count || 0) + Number(job.undelivered_count || 0)) || job.failed_count} status="failed" />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                        <Button size="sm" variant="outline" onClick={() => openSmsRecipientsDialog(job)}>
                          View Recipients ({storedRecipientCount(job)})
                        </Button>
                        <div className="flex flex-wrap items-center gap-2">
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

                  <div className="rounded-md border border-border bg-background p-3 dark:bg-input/20">
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
                                <div key={`${item.id}-${toIsoDay(day)}`} className="truncate rounded-sm border border-emerald-200 bg-background px-1.5 py-1 text-[11px] font-medium text-foreground dark:border-emerald-500/30 dark:bg-input/30">
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

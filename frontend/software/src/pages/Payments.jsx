import { useEffect, useEffectEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import DataTable from "../components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getClassStructure, getStreams } from "../api/academic.api";
import {
  bulkUploadPayments,
  createPayment,
  deletePayment,
  exportPaymentsCsv,
  getPayments,
  getStudentsForPayment,
  getStudentFeeOptions,
  updatePayment,
} from "../api/fee.api";
import { formatReadableDate } from "../lib/dateTime";

const columns = [
  {
    header: "Sl. No.",
    accessor: "receipt_serial",
    className: "min-w-[120px]",
  },
  {
    header: "Date",
    accessor: "payment_date",
    cell: (row) => formatReadableDate(row.payment_date),
  },
  {
    header: "Student",
    accessor: "student_summary",
    className: "min-w-[220px]",
    cell: (row) => (
      <div className="min-w-0 space-y-1">
        <p className="truncate font-medium text-foreground">{row.student_name || "-"}</p>
        {row.admission_no ? (
          <p className="truncate text-xs text-muted-foreground">Adm: {row.admission_no}</p>
        ) : null}
        <p className="truncate text-xs text-muted-foreground">Sl. No. {row.receipt_serial || "-"}</p>
      </div>
    ),
  },
  {
    header: "Class",
    accessor: "class_summary",
    className: "min-w-[180px]",
    cell: (row) => (
      <div className="space-y-1">
        <p className="font-medium text-foreground">{row.class_name || "-"}</p>
        <p className="text-xs text-muted-foreground">{row.scope_label || "-"}</p>
        {row.stream_name && row.stream_name !== "-" ? (
          <p className="text-xs text-muted-foreground">{row.stream_name}</p>
        ) : null}
      </div>
    ),
  },
  {
    header: "Section",
    accessor: "section_summary",
    className: "min-w-[150px]",
    cell: (row) => (
      <div className="space-y-1">
        <p className="font-medium text-foreground">{formatSectionMedium(row.section_name, row.medium)}</p>
        <p className="text-xs text-muted-foreground">
          {row.roll_number ? `Roll ${row.roll_number}` : "Roll -"}
        </p>
      </div>
    ),
  },
  {
    header: "Fee Name",
    accessor: "fee_name",
    className: "min-w-[170px]",
    cell: (row) => (
      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${feeNameBadgeClass(row.fee_name)}`}>
        {row.fee_name || "-"}
      </span>
    ),
  },
  {
    header: "Amount Paid",
    accessor: "amount_paid",
    className: "min-w-[130px] text-right",
    headerClassName: "text-right",
    cell: (row) => (
      <span className="font-medium tabular-nums">
        {formatCurrency(row.amount_paid)}
      </span>
    ),
  },
  { header: "Status", accessor: "display_status", className: "min-w-[120px]" },
];
const PAYMENTS_ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100];
const PAYMENTS_TABLE_PAGE_KEY = "payments.table.page";
const PAYMENTS_TABLE_ROWS_KEY = "payments.table.rows";
const PAYMENTS_FILTER_SCOPE_KEY = "payments.filter.scope";
const PAYMENTS_FILTER_CLASS_KEY = "payments.filter.classId";
const PAYMENTS_FILTER_SECTION_KEY = "payments.filter.sectionId";
const PAYMENTS_FILTER_STREAM_KEY = "payments.filter.streamId";
const PAYMENTS_FILTER_DATE_KEY = "payments.filter.paymentDate";

function formatStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (!value) return "-";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatScope(scope) {
  const value = String(scope || "").trim().toLowerCase();
  if (value === "hs") return "Higher Secondary";
  if (value === "school") return "School";
  return scope || "-";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getFeeName(row) {
  const directFeeName = String(row?.fee_name || "").trim();
  if (directFeeName) return directFeeName;
  const feeName = String(row?.installment_name || "").trim();
  if (feeName) return feeName;
  return String(row?.fee_type || "").toLowerCase() === "admission" ? "Admission Fee" : "-";
}

function formatSectionMedium(section, medium) {
  const sectionName = String(section || "").trim();
  const mediumName = String(medium || "").trim();
  if (sectionName && mediumName && mediumName !== "-") return `${sectionName} (${mediumName})`;
  return sectionName || "-";
}

function feeNameBadgeClass(name) {
  const value = String(name || "").trim().toLowerCase();

  if (value.includes("admission")) {
    return "border-punch-200 bg-punch-50 text-punch-700 dark:border-punch-900/60 dark:bg-punch-950/30 dark:text-punch-200";
  }
  if (value.includes("transport") || value.includes("bus") || value.includes("van")) {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300";
  }
  if (value.includes("exam") || value.includes("test")) {
    return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300";
  }
  if (value.includes("monthly") || value.includes("tuition")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300";
  }
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300";
}

function resolveClassScope(value) {
  return String(value || "school").trim().toLowerCase() === "hs" ? "hs" : "school";
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

function preventWheelNumberChange(event) {
  event.currentTarget.blur();
}

function readStoredNumber(key, fallback, allowed = null) {
  if (typeof window === "undefined") return fallback;

  const parsed = Number(window.sessionStorage.getItem(key));
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;

  if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(parsed)) {
    return fallback;
  }

  return parsed;
}

function readStoredString(key, fallback = "") {
  if (typeof window === "undefined") return fallback;
  const value = String(window.sessionStorage.getItem(key) || "").trim();
  return value || fallback;
}

function enrichPaymentRows(rows = []) {
  return rows.map((row) => ({
    ...row,
    fee_name: getFeeName(row),
    medium: row.medium || "-",
    payment_date: row.payment_date || row.created_at || "-",
    scope_label: formatScope(row.class_scope),
    stream_name: row.stream_name || "-",
    display_status: formatStatus(row.fee_status || row.status),
  }));
}

async function fetchPaymentsData({
  classId,
  sectionId,
  streamId,
  scope,
  paymentDate,
  classes,
  page,
  limit,
}) {
  const selectedFilterClass = classes.find((c) => String(c.id) === String(classId));
  const effectiveFilterStreamId =
    resolveClassScope(selectedFilterClass?.class_scope) === "hs" ? streamId : "";
  const res = await getPayments({
    class_id: classId || undefined,
    section_id: sectionId || undefined,
    stream_id: effectiveFilterStreamId || undefined,
    scope: scope || undefined,
    payment_date: paymentDate || undefined,
    page,
    limit,
  });
  const rows = Array.isArray(res) ? res : (res?.data || []);
  const pagination = res?.pagination || {
    page,
    limit,
    total: rows.length,
    totalPages: 1,
  };

  return {
    rows: enrichPaymentRows(rows),
    pagination,
  };
}

export default function Payments() {
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [streams, setStreams] = useState([]);
  const [students, setStudents] = useState([]);
  const [feeOptions, setFeeOptions] = useState([]);
  const [payments, setPayments] = useState([]);

  const [classId, setClassId] = useState(() => readStoredString(PAYMENTS_FILTER_CLASS_KEY));
  const [sectionId, setSectionId] = useState(() => readStoredString(PAYMENTS_FILTER_SECTION_KEY));
  const [streamId, setStreamId] = useState(() => readStoredString(PAYMENTS_FILTER_STREAM_KEY));
  const [scope, setScope] = useState(() => readStoredString(PAYMENTS_FILTER_SCOPE_KEY));
  const [paymentDate, setPaymentDate] = useState(() => readStoredString(PAYMENTS_FILTER_DATE_KEY));
  const [tablePage, setTablePage] = useState(() =>
    readStoredNumber(PAYMENTS_TABLE_PAGE_KEY, 1)
  );
  const [tableRowsPerPage, setTableRowsPerPage] = useState(() =>
    readStoredNumber(
      PAYMENTS_TABLE_ROWS_KEY,
      PAYMENTS_ROWS_PER_PAGE_OPTIONS[0],
      PAYMENTS_ROWS_PER_PAGE_OPTIONS
    )
  );
  const [paymentPagination, setPaymentPagination] = useState({
    page: tablePage,
    limit: tableRowsPerPage,
    total: 0,
    totalPages: 1,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [hasLoadedPayments, setHasLoadedPayments] = useState(false);

  const [openCreate, setOpenCreate] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [deletingPayment, setDeletingPayment] = useState(null);
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");
  const [notice, setNotice] = useState(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkFailures, setBulkFailures] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);

  const [createForm, setCreateForm] = useState({
    class_id: "",
    section_id: "",
    stream_id: "",
    student_id: "",
    student_fee_id: "",
    amount_paid: "",
    remarks: "",
  });

  function showNotice(title, message, variant = "success") {
    setNotice({ title, message, variant });
  }

  async function loadClasses() {
    const res = await getClassStructure();
    setClasses(
      (res?.data || []).map((row) => ({
        ...row,
        class_scope: resolveClassScope(row.class_scope),
      }))
    );
  }

  async function loadStreams() {
    const res = await getStreams();
    setStreams(res?.data || []);
  }

  async function loadPayments() {
    if (!classes.length) return;
    setRefreshing(true);
    try {
      const result = await fetchPaymentsData({
        classId,
        sectionId,
        streamId,
        scope,
        paymentDate,
        classes,
        page: tablePage,
        limit: tableRowsPerPage,
      });
      setPayments(result.rows);
      setPaymentPagination(result.pagination);
      setHasLoadedPayments(true);
      setLastUpdatedAt(new Date().toISOString());
    } finally {
      setRefreshing(false);
    }
  }

  async function loadStudentsForCreate() {
    const selectedCreateClass = classes.find(
      (row) => String(row.id) === String(createForm.class_id)
    );
    const selectedCreateScope = resolveClassScope(selectedCreateClass?.class_scope);
    const effectiveCreateStreamId = selectedCreateScope === "hs" ? createForm.stream_id : "";

    if (selectedCreateScope === "hs" && !effectiveCreateStreamId) {
      setStudents([]);
      return;
    }

    try {
      const res = await getStudentsForPayment({
        class_id: createForm.class_id,
        section_id: createForm.section_id,
        stream_id: effectiveCreateStreamId || undefined,
      });
      const list = Array.isArray(res) ? res : (res?.data || []);
      setStudents(list);
      setCreateError("");
    } catch (err) {
      setStudents([]);
      setCreateError(err?.message || "Failed to load students for the selected class and section.");
    }
  }

  async function loadStudentFeesForCreate() {
    try {
      const res = await getStudentFeeOptions(createForm.student_id);
      setFeeOptions(res?.data || []);
      setCreateError("");
    } catch {
      setFeeOptions([]);
      setCreateError("Fee ledger is not available for this student. Check class fee structure.");
    }
  }

  const loadInitialPayments = useEffectEvent(() => {
    loadClasses();
    loadStreams();
  });

  const loadFilteredPayments = useEffectEvent(() => {
    loadPayments();
  });

  const refreshPaymentsEvent = useEffectEvent(() => {
    loadPayments();
  });

  const loadScopedStudents = useEffectEvent(() => {
    if (!createForm.class_id || !createForm.section_id) {
      setStudents([]);
      setStudentSearch("");
      return;
    }

    const selectedCreateClass = classes.find(
      (row) => String(row.id) === String(createForm.class_id)
    );
    const selectedCreateScope = resolveClassScope(selectedCreateClass?.class_scope);
    const effectiveCreateStreamId = selectedCreateScope === "hs" ? createForm.stream_id : "";
    if (selectedCreateScope === "hs" && !effectiveCreateStreamId) {
      setStudents([]);
      setStudentSearch("");
      return;
    }

    loadStudentsForCreate();
  });

  const loadSelectedStudentFees = useEffectEvent(() => {
    if (!createForm.student_id) {
      setFeeOptions([]);
      return;
    }

    loadStudentFeesForCreate();
  });

  const syncStudentSearchSelection = useEffectEvent(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return;

    const matchingStudent = students.find((student) =>
      String(student.name || "").toLowerCase().includes(query)
    );

    if (!matchingStudent) return;
    if (String(createForm.student_id) === String(matchingStudent.id)) return;

    setCreateForm((prev) => ({
      ...prev,
      student_id: String(matchingStudent.id),
      student_fee_id: "",
    }));
  });

  useEffect(() => {
    loadInitialPayments();
  }, []);

  useEffect(() => {
    loadFilteredPayments();
  }, [classId, sectionId, streamId, scope, paymentDate, classes, tablePage, tableRowsPerPage]);

  useEffect(() => {
    function handleWindowFocus() {
      refreshPaymentsEvent();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshPaymentsEvent();
      }
    }

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    loadScopedStudents();
  }, [createForm.class_id, createForm.section_id, createForm.stream_id, classes]);

  useEffect(() => {
    loadSelectedStudentFees();
  }, [createForm.student_id]);

  useEffect(() => {
    syncStudentSearchSelection();
  }, [studentSearch, students, createForm.student_id]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(PAYMENTS_TABLE_PAGE_KEY, String(tablePage));
    window.sessionStorage.setItem(PAYMENTS_TABLE_ROWS_KEY, String(tableRowsPerPage));
  }, [tablePage, tableRowsPerPage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(PAYMENTS_FILTER_SCOPE_KEY, String(scope || ""));
    window.sessionStorage.setItem(PAYMENTS_FILTER_CLASS_KEY, String(classId || ""));
    window.sessionStorage.setItem(PAYMENTS_FILTER_SECTION_KEY, String(sectionId || ""));
    window.sessionStorage.setItem(PAYMENTS_FILTER_STREAM_KEY, String(streamId || ""));
    window.sessionStorage.setItem(PAYMENTS_FILTER_DATE_KEY, String(paymentDate || ""));
  }, [scope, classId, sectionId, streamId, paymentDate]);

  useEffect(() => {
    if (!hasLoadedPayments) return;
    setTablePage((prev) => Math.min(prev, Math.max(1, Number(paymentPagination.totalPages) || 1)));
  }, [hasLoadedPayments, paymentPagination.totalPages]);

  async function handleCreatePayment(e) {
    e.preventDefault();
    setCreateError("");
    const selectedCreateClass = classes.find(
      (row) => String(row.id) === String(createForm.class_id)
    );
    const selectedCreateScope = resolveClassScope(selectedCreateClass?.class_scope);
    const effectiveCreateStreamId = selectedCreateScope === "hs" ? createForm.stream_id : "";

    if (selectedCreateScope === "hs" && !effectiveCreateStreamId) {
      setCreateError("Stream is required for higher secondary classes.");
      return;
    }
    if (!createForm.student_fee_id) {
      setCreateError("Select due fee item.");
      return;
    }
    if (!createForm.amount_paid || Number(createForm.amount_paid) <= 0) {
      setCreateError("Enter a valid payment amount.");
      return;
    }
    const selectedFee = feeOptions.find(
      (f) => String(f.id) === String(createForm.student_fee_id)
    );
    if (selectedFee && Number(createForm.amount_paid) > Number(selectedFee.remaining)) {
      setCreateError("Amount cannot exceed remaining fee.");
      return;
    }

    try {
      await createPayment({
        student_fee_id: createForm.student_fee_id,
        amount_paid: Number(createForm.amount_paid),
        remarks: createForm.remarks,
      });
    } catch (err) {
      const message = err?.message || "Failed to create payment.";
      setCreateError(message);
      showNotice("Create Failed", message, "error");
      return;
    }

    setCreateForm({
      class_id: "",
      section_id: "",
      stream_id: "",
      student_id: "",
      student_fee_id: "",
      amount_paid: "",
      remarks: "",
    });
    setFeeOptions([]);
    setStudents([]);
    setStudentSearch("");
    setOpenCreate(false);
    setCreateError("");
    showNotice("Payment Saved", "Payment recorded successfully.");
    await loadPayments();
  }

  async function handleUpdatePayment(e) {
    e.preventDefault();
    if (!editingPayment) return;
    setEditError("");

    try {
      await updatePayment(editingPayment.id, {
        amount_paid: Number(editingPayment.amount_paid),
        remarks: editingPayment.remarks,
      });
    } catch (err) {
      const message = err?.message || "Failed to update payment.";
      setEditError(message);
      showNotice("Update Failed", message, "error");
      return;
    }

    setEditingPayment(null);
    showNotice("Payment Updated", "Payment updated successfully.");
    await loadPayments();
  }

  async function handleDeletePayment() {
    if (!deletingPayment?.id) return;
    setEditError("");
    try {
      await deletePayment(deletingPayment.id);
    } catch (err) {
      const message = err?.message || "Failed to delete payment.";
      setEditError(message);
      showNotice("Delete Failed", message, "error");
      return;
    }
    setDeletingPayment(null);
    showNotice("Payment Deleted", "Payment deleted successfully.");
    await loadPayments();
  }

  function handleEditPayment(row) {
    setEditingPayment({
      ...row,
      amount_paid: row.amount_paid ?? "",
      remarks: row.remarks ?? "",
    });
  }

  async function downloadReceipt(paymentId) {
    const token = localStorage.getItem("accessToken");
    const response = await fetch(
      `${API_BASE_URL}/fees/receipt/${paymentId}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );

    if (!response.ok) {
      const message = "Failed to download receipt.";
      setEditError(message);
      showNotice("Download Failed", message, "error");
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${paymentId}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
    showNotice("Download Started", `Receipt ${paymentId} download started.`);
  }

  async function handleExportCsv() {
    try {
      const selectedFilterClass = classes.find((c) => String(c.id) === String(classId));
      const effectiveFilterStreamId =
        resolveClassScope(selectedFilterClass?.class_scope) === "hs" ? streamId : "";
      const blob = await exportPaymentsCsv({
        class_id: classId || undefined,
        section_id: sectionId || undefined,
        stream_id: effectiveFilterStreamId || undefined,
        scope: scope || undefined,
        payment_date: paymentDate || undefined,
      });
      const fileDate = paymentDate || new Date().toISOString().slice(0, 10);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payments-${fileDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      showNotice("Download Started", "Payments CSV download started.");
    } catch (err) {
      showNotice("Download Failed", err?.message || "Failed to export payments.", "error");
    }
  }

  function handleDownloadCsvFormat() {
    const csv = [
      "session,class,section,stream,admission_no,student_name,roll_number,fee_type,installment_name,amount_paid,remarks",
      "2025-2026,X,A,,ADM001,Student Name,12,installment,April,500,Monthly fee payment",
      "2025-2026,X,A,,ADM001,Student Name,12,admission,,1000,Admission fee payment",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payment-upload-format.csv";
    a.click();
    window.URL.revokeObjectURL(url);
    showNotice("Download Started", "Payment upload CSV format download started.");
  }

  async function handleBulkUploadPayments() {
    if (bulkUploading) return;

    setBulkMessage("");
    setBulkFailures([]);

    if (!bulkFile) {
      setBulkMessage("Select a CSV file first.");
      return;
    }

    setBulkUploading(true);
    try {
      const result = await bulkUploadPayments(bulkFile);
      const createdCount = Number(result?.createdCount || 0);
      const failedCount = Number(result?.failedCount || 0);
      const totalRows = Number(result?.totalRows || createdCount + failedCount);
      const failures = Array.isArray(result?.failures)
        ? result.failures
        : Array.isArray(result?.failed)
          ? result.failed
          : [];

      setBulkFile(null);

      if (failedCount > 0) {
        setBulkFailures(failures);
        setBulkMessage(`Uploaded ${createdCount}/${totalRows}. ${failedCount} row(s) failed.`);
        showNotice(
          "Bulk Upload Partial",
          `${createdCount} payment(s) uploaded, ${failedCount} failed. See row errors in the dialog.`,
          "error"
        );
        await loadPayments();
        return;
      }

      setBulkMessage("Bulk upload completed successfully.");
      setBulkOpen(false);
      showNotice("Bulk Upload Complete", "Payments uploaded successfully.");
      await loadPayments();
    } catch (err) {
      setBulkMessage(err?.message || "Bulk upload failed.");
      setBulkFailures([]);
      showNotice("Bulk Upload Failed", err?.message || "Bulk upload failed.", "error");
    } finally {
      setBulkUploading(false);
    }
  }

  const selectedClass = classes.find((c) => String(c.id) === String(classId));
  const selectedClassScope = resolveClassScope(selectedClass?.class_scope);
  const effectiveFilterStreamId = selectedClassScope === "hs" ? streamId : "";
  const sections = selectedClass?.sections || [];
  const activeFilterCount = [scope, classId, sectionId, effectiveFilterStreamId, paymentDate].filter(Boolean).length;

  const createSelectedClass = classes.find(
    (c) => String(c.id) === String(createForm.class_id)
  );
  const createSelectedClassScope = resolveClassScope(createSelectedClass?.class_scope);
  const effectiveCreateStreamId = createSelectedClassScope === "hs" ? createForm.stream_id : "";
  const createSections = createSelectedClass?.sections || [];
  const filteredStudents = students.filter((student) =>
    String(student.name || "")
      .toLowerCase()
      .includes(studentSearch.trim().toLowerCase())
  );
  const selectedFee = feeOptions.find(
    (f) => String(f.id) === String(createForm.student_fee_id)
  );

  return (
    <>
      <TopBar
        title="Payments"
        subTitle="Record and manage fee payments"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={loadPayments} disabled={refreshing}>
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-4">
                <PopoverHeader className="space-y-1">
                  <PopoverTitle>Filters</PopoverTitle>
                  <PopoverDescription>
                    Narrow the payments list by scope, class, stream, section, or date.
                  </PopoverDescription>
                </PopoverHeader>

                <Separator />

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="payments-filter-scope">Scope</Label>
                    <select
                      id="payments-filter-scope"
                      className="border rounded p-2"
                      value={scope}
                      onChange={(e) => {
                        setScope(e.target.value);
                        setTablePage(1);
                      }}
                    >
                      <option value="">All Scope</option>
                      <option value="school">School</option>
                      <option value="hs">Higher Secondary</option>
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="payments-filter-class">Class</Label>
                    <select
                      id="payments-filter-class"
                      className="border rounded p-2"
                      value={classId}
                      onChange={(e) => {
                        setClassId(e.target.value);
                        setSectionId("");
                        setStreamId("");
                        setTablePage(1);
                      }}
                    >
                      <option value="">All Classes</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="payments-filter-stream">Stream</Label>
                    <select
                      id="payments-filter-stream"
                      className="border rounded p-2"
                      value={effectiveFilterStreamId}
                      onChange={(e) => {
                        setStreamId(e.target.value);
                        setTablePage(1);
                      }}
                      disabled={!classId || selectedClassScope !== "hs"}
                    >
                      <option value="">
                        {selectedClassScope === "hs" ? "All Streams" : "Select an HS class first"}
                      </option>
                      {streams.map((stream) => (
                        <option key={stream.id} value={stream.id}>
                          {stream.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="payments-filter-section">Section</Label>
                    <select
                      id="payments-filter-section"
                      className="border rounded p-2"
                      value={sectionId}
                      onChange={(e) => {
                        setSectionId(e.target.value);
                        setTablePage(1);
                      }}
                      disabled={!classId}
                    >
                      <option value="">All Sections</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="payments-filter-date">Payment Date</Label>
                    <Input
                      id="payments-filter-date"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => {
                        setPaymentDate(e.target.value);
                        setTablePage(1);
                      }}
                    />
                  </div>
                </div>

                <Separator />

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setScope("");
                    setClassId("");
                    setSectionId("");
                    setStreamId("");
                    setPaymentDate("");
                    setTablePage(1);
                  }}
                >
                  Reset Filters
                </Button>
              </PopoverContent>
            </Popover>
            <Button variant="outline" onClick={handleExportCsv}>
              Download Payment Data
            </Button>
            <Button variant="outline" onClick={handleDownloadCsvFormat}>
              Download CSV Format
            </Button>
            <Dialog
              open={bulkOpen}
              onOpenChange={(nextOpen) => {
                setBulkOpen(nextOpen);
                if (!nextOpen) {
                  setBulkFile(null);
                  setBulkMessage("");
                  setBulkFailures([]);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline">Bulk Upload CSV</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bulk Upload Payments</DialogTitle>
                  <DialogDescription>
                    Upload payment rows using student and fee item details.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      setBulkFile(e.target.files?.[0] || null);
                      setBulkMessage("");
                      setBulkFailures([]);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    The downloaded CSV marks required and optional fields in the header. Use admission_no when available; otherwise use student_name with roll_number when names may repeat. Keep stream blank for School classes.
                  </p>
                  {bulkMessage && (
                    <p
                      className={`text-xs ${
                        bulkMessage.toLowerCase().includes("completed")
                          ? "text-emerald-700 dark:text-emerald-200"
                          : "text-red-700 dark:text-red-200"
                      }`}
                    >
                      {bulkMessage}
                    </p>
                  )}
                  {bulkFailures.length > 0 ? (
                    <div className="max-h-44 overflow-auto rounded-md border p-2 text-xs">
                      {bulkFailures.slice(0, 50).map((item, index) => (
                        <p key={`${item.rowNo || "row"}-${index}`} className="mb-1 last:mb-0">
                          Row {item.rowNo || "-"} ({item.admission_no || item.student_name || "Unknown"}): {item.message || item.error}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  <Button onClick={handleBulkUploadPayments} disabled={bulkUploading}>
                    {bulkUploading ? "Uploading..." : "Upload"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog
              open={openCreate}
              onOpenChange={(nextOpen) => {
                setOpenCreate(nextOpen);
                if (!nextOpen) {
                  setCreateForm({
                    class_id: "",
                    section_id: "",
                    stream_id: "",
                    student_id: "",
                    student_fee_id: "",
                    amount_paid: "",
                    remarks: "",
                  });
                  setStudents([]);
                  setFeeOptions([]);
                  setStudentSearch("");
                  setCreateError("");
                }
              }}
            >
              <DialogTrigger asChild>
                <Button>Record Payment</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <form onSubmit={handleCreatePayment} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>Record Fee Payment</DialogTitle>
                    <DialogDescription>
                      Select class, stream (for HS), student due item, and payment details.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-2">
                    <Label>Class *</Label>
                    <select
                      className="border rounded p-2"
                      value={createForm.class_id}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                            ...prev,
                            class_id: e.target.value,
                            section_id: "",
                            stream_id: "",
                            student_id: "",
                            student_fee_id: "",
                          }))
                      }
                    >
                      <option value="">Select Class</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {createSelectedClassScope === "hs" ? (
                    <div className="grid gap-2">
                      <Label>Stream *</Label>
                      <select
                        className="border rounded p-2"
                        value={effectiveCreateStreamId}
                        onChange={(e) => {
                          setCreateForm((prev) => ({
                            ...prev,
                            stream_id: e.target.value,
                            student_id: "",
                            student_fee_id: "",
                          }));
                          setStudentSearch("");
                        }}
                        disabled={!createForm.class_id}
                      >
                        <option value="">Select Stream</option>
                        {streams.map((stream) => (
                          <option key={stream.id} value={stream.id}>
                            {stream.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  <div className="grid gap-2">
                    <Label>Section *</Label>
                    <select
                      className="border rounded p-2"
                      value={createForm.section_id}
                      onChange={(e) => {
                        setCreateForm((prev) => ({
                          ...prev,
                          section_id: e.target.value,
                          student_id: "",
                          student_fee_id: "",
                        }));
                        setStudentSearch("");
                      }}
                      disabled={!createForm.class_id}
                    >
                      <option value="">Select Section</option>
                      {createSections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}{s.medium ? ` (${s.medium})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Student *</Label>
                    <Input
                      placeholder="Search student"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      disabled={
                        !createForm.section_id ||
                        (createSelectedClassScope === "hs" && !effectiveCreateStreamId)
                      }
                    />
                    <select
                      className="border rounded p-2"
                      value={createForm.student_id}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          student_id: e.target.value,
                          student_fee_id: "",
                        }))
                      }
                      disabled={
                        !createForm.section_id ||
                        (createSelectedClassScope === "hs" && !effectiveCreateStreamId)
                      }
                    >
                      <option value="">Select Student</option>
                      {filteredStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.stream_name ? ` (${s.stream_name})` : ""}
                        </option>
                      ))}
                    </select>
                    {createForm.section_id && filteredStudents.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        {createSelectedClassScope === "hs" && !effectiveCreateStreamId
                          ? "Select a stream to load higher secondary students."
                          : "No students match this search."}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label>Due Fee Item *</Label>
                    <select
                      className="border rounded p-2"
                      value={createForm.student_fee_id}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          student_fee_id: e.target.value,
                        }))
                      }
                      disabled={!createForm.student_id}
                    >
                      <option value="">Select Due Item</option>
                      {feeOptions.map((f) => (
                        <option key={f.id} value={f.id}>
                          {getFeeName(f)} - Remaining: {formatCurrency(f.remaining)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Amount Paid *</Label>
                    <Input
                      value={createForm.amount_paid}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          amount_paid: e.target.value,
                        }))
                      }
                      onWheel={preventWheelNumberChange}
                      type="number"
                      min="1"
                      max={selectedFee ? Number(selectedFee.remaining) : undefined}
                    />
                    {selectedFee && (
                      <p className="text-xs text-muted-foreground">
                        Due Amount: {selectedFee.amount} | Paid: {selectedFee.paid} | Remaining: {selectedFee.remaining}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label>Remarks</Label>
                    <Input
                      value={createForm.remarks}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          remarks: e.target.value,
                        }))
                      }
                    />
                  </div>
                  {createError && <p className="text-sm text-red-600">{createError}</p>}

                  <DialogFooter showCloseButton>
                    <Button type="submit">Save</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="pointer-events-none fixed top-6 right-6 z-50 w-full max-w-sm">
        <div
          className={`transition-all duration-500 ease-out ${
            notice
              ? "translate-x-0 scale-100 opacity-100"
              : "translate-x-12 scale-95 opacity-0"
          }`}
        >
          {notice && (
            <Alert
              variant={notice.variant === "error" ? "destructive" : "success"}
              className="pointer-events-auto overflow-hidden border shadow-xl"
            >
              <AlertTitle>{notice.title}</AlertTitle>
              <AlertDescription>{notice.message}</AlertDescription>
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-black/10">
                <div className="h-full w-full rounded-full bg-current/60 animate-pulse" />
              </div>
            </Alert>
          )}
        </div>
      </div>

      {lastUpdatedAt ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Last refreshed: {new Date(lastUpdatedAt).toLocaleString()}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        data={payments}
        rowsPerPageOptions={PAYMENTS_ROWS_PER_PAGE_OPTIONS}
        paginationMode="server"
        page={paymentPagination.page}
        totalPages={paymentPagination.totalPages}
        totalRows={paymentPagination.total}
        rowsPerPage={paymentPagination.limit}
        onPageChange={(nextPage) => {
          const parsed = Number(nextPage);
          setTablePage(Number.isInteger(parsed) && parsed > 0 ? parsed : 1);
        }}
        onRowsPerPageChange={(nextRows) => {
          const parsed = Number(nextRows);
          const safeRows = PAYMENTS_ROWS_PER_PAGE_OPTIONS.includes(parsed)
            ? parsed
            : PAYMENTS_ROWS_PER_PAGE_OPTIONS[0];
          setTableRowsPerPage(safeRows);
          setTablePage(1);
        }}
        tableClassName="min-w-[980px]"
        tableWrapperClassName="sidebar-primary-scrollbar overflow-x-auto"
        onEdit={handleEditPayment}
        onDelete={setDeletingPayment}
        onRowClick={(row) => navigate(`/students/${row.student_id}`)}
        renderActions={(row) => (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                downloadReceipt(row.id);
              }}
            >
              Receipt
            </Button>
          </>
        )}
      />

      <Dialog open={!!editingPayment} onOpenChange={() => setEditingPayment(null)}>
        <DialogContent>
          <form onSubmit={handleUpdatePayment} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit Payment</DialogTitle>
              <DialogDescription>
                Update the paid amount or remarks for this payment record.
              </DialogDescription>
            </DialogHeader>

            {editingPayment ? (
              <p className="text-xs text-muted-foreground">
                {editingPayment.student_name} - {editingPayment.class_name}
                {editingPayment.stream_name && editingPayment.stream_name !== "-" ? ` (${editingPayment.stream_name})` : ""}
                {" - "}
                {editingPayment.section_name}
              </p>
            ) : null}

            <div className="grid gap-2">
              <Label>Amount Paid *</Label>
              <Input
                type="number"
                min="1"
                value={editingPayment?.amount_paid || ""}
                onWheel={preventWheelNumberChange}
                onChange={(e) =>
                  setEditingPayment((prev) => ({
                    ...prev,
                    amount_paid: e.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Remarks</Label>
              <Input
                value={editingPayment?.remarks || ""}
                onChange={(e) =>
                  setEditingPayment((prev) => ({
                    ...prev,
                    remarks: e.target.value,
                  }))
                }
              />
            </div>
            {editError && <p className="text-sm text-red-600">{editError}</p>}

            <DialogFooter>
              <Button type="submit">Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingPayment}
        onOpenChange={(open) => {
          if (!open) setDeletingPayment(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingPayment
                ? `This will delete the payment record for ${deletingPayment.student_name} (${deletingPayment.class_name}${deletingPayment.stream_name && deletingPayment.stream_name !== "-" ? ` / ${deletingPayment.stream_name}` : ""} / ${deletingPayment.section_name}).`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeletePayment}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


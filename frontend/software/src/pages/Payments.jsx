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
import { getClassStructure } from "../api/academic.api";
import {
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
    header: "Date",
    accessor: "payment_date",
    cell: (row) => formatReadableDate(row.payment_date),
  },
  { header: "Student", accessor: "student_name" },
  { header: "Scope", accessor: "scope_label" },
  { header: "Class", accessor: "class_name" },
  { header: "Section", accessor: "section_name" },
  { header: "Medium", accessor: "medium" },
  { header: "Fee Type", accessor: "fee_type" },
  { header: "Amount Paid", accessor: "amount_paid" },
  { header: "Status", accessor: "display_status" },
];

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

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

function preventWheelNumberChange(event) {
  event.currentTarget.blur();
}

export default function Payments() {
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [feeOptions, setFeeOptions] = useState([]);
  const [payments, setPayments] = useState([]);

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [scope, setScope] = useState("");
  const [paymentDate, setPaymentDate] = useState("");

  const [openCreate, setOpenCreate] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [deletingPayment, setDeletingPayment] = useState(null);
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");
  const [notice, setNotice] = useState(null);
  const [studentSearch, setStudentSearch] = useState("");

  const [createForm, setCreateForm] = useState({
    class_id: "",
    section_id: "",
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
    setClasses(res?.data || []);
  }

  async function loadPayments() {
    const res = await getPayments({
      class_id: classId || undefined,
      section_id: sectionId || undefined,
      scope: scope || undefined,
      payment_date: paymentDate || undefined,
    });
    const rows = res?.data || [];
    setPayments(
      rows.map((row) => ({
        ...row,
        medium: row.medium || "-",
        payment_date: row.payment_date || row.created_at || "-",
        scope_label: formatScope(row.class_scope),
        display_status: formatStatus(row.fee_status || row.status),
      }))
    );
  }

  async function loadStudentsForCreate() {
    try {
      const res = await getStudentsForPayment({
        class_id: createForm.class_id,
        section_id: createForm.section_id,
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
  });

  const loadFilteredPayments = useEffectEvent(() => {
    loadPayments();
  });

  const loadScopedStudents = useEffectEvent(() => {
    if (!createForm.class_id || !createForm.section_id) {
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
  }, [classId, sectionId, scope, paymentDate]);

  useEffect(() => {
    loadScopedStudents();
  }, [createForm.class_id, createForm.section_id]);

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

  async function handleCreatePayment(e) {
    e.preventDefault();
    setCreateError("");
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
      const blob = await exportPaymentsCsv({
        class_id: classId || undefined,
        section_id: sectionId || undefined,
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

  const selectedClass = classes.find((c) => String(c.id) === String(classId));
  const sections = selectedClass?.sections || [];
  const activeFilterCount = [scope, classId, sectionId, paymentDate].filter(Boolean).length;

  const createSelectedClass = classes.find(
    (c) => String(c.id) === String(createForm.class_id)
  );
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
          <div className="flex gap-2">
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
                    Narrow the payments list by scope, class, section, or date.
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
                      onChange={(e) => setScope(e.target.value)}
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
                    <Label htmlFor="payments-filter-section">Section</Label>
                    <select
                      id="payments-filter-section"
                      className="border rounded p-2"
                      value={sectionId}
                      onChange={(e) => setSectionId(e.target.value)}
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
                      onChange={(e) => setPaymentDate(e.target.value)}
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
                    setPaymentDate("");
                  }}
                >
                  Reset Filters
                </Button>
              </PopoverContent>
            </Popover>
            <Button variant="outline" onClick={handleExportCsv}>
              Download CSV
            </Button>
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button>Record Payment</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <form onSubmit={handleCreatePayment} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>Record Fee Payment</DialogTitle>
                    <DialogDescription>
                      Select the student due item and enter the payment details.
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
                      disabled={!createForm.section_id}
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
                      disabled={!createForm.section_id}
                    >
                      <option value="">Select Student</option>
                      {filteredStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {createForm.section_id && filteredStudents.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No students match this search.
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
                          {(f.installment_name || f.fee_type)} - Remaining: {f.remaining}
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

      <DataTable
        columns={columns}
        data={payments}
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
                ? `This will delete the payment record for ${deletingPayment.student_name}.`
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

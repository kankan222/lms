import { useEffect, useEffectEvent, useState } from "react";
import TopBar from "../components/TopBar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bus, Download, IndianRupee, ReceiptText, Users } from "lucide-react";
import { getClassStructure, getSessions, getStreams } from "../api/academic.api";
import {
  createTransportAssignment,
  createTransportPayment,
  downloadTransportReceipt,
  getTransportAssignments,
  getTransportDues,
  getTransportPayments,
  getTransportSummary,
  searchTransportStudents,
} from "../api/fee.api";
import { formatReadableDate } from "../lib/dateTime";

const MONTHS = [
  ["1", "January"],
  ["2", "February"],
  ["3", "March"],
  ["4", "April"],
  ["5", "May"],
  ["6", "June"],
  ["7", "July"],
  ["8", "August"],
  ["9", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
];

const TABLE_ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

const statTones = {
  sky: {
    card: "border-sky-200/70 bg-sky-50/80 dark:border-sky-900/50 dark:bg-sky-950/20",
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    value: "text-sky-950 dark:text-sky-100",
  },
  emerald: {
    card: "border-emerald-200/70 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/20",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    value: "text-emerald-950 dark:text-emerald-100",
  },
  amber: {
    card: "border-amber-200/70 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/20",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    value: "text-amber-950 dark:text-amber-100",
  },
  rose: {
    card: "border-rose-200/70 bg-rose-50/80 dark:border-rose-900/50 dark:bg-rose-950/20",
    icon: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    value: "text-rose-950 dark:text-rose-100",
  },
};

const badgeClasses = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
  inactive: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300",
  pending: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
  partial: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
  unpaid: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300",
  student: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300",
  receipt: "border-punch-200 bg-punch-50 text-punch-700 dark:border-punch-900/60 dark:bg-punch-950/30 dark:text-punch-200",
};

function money(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
}

function monthLabel(month, year) {
  const found = MONTHS.find(([value]) => Number(value) === Number(month));
  return `${found?.[1] || month} ${year}`;
}

function formatScope(scope) {
  const value = String(scope || "").trim().toLowerCase();
  if (value === "hs") return "Higher Secondary";
  if (value === "school") return "School";
  return scope || "-";
}

function ColorBadge({ tone = "inactive", children }) {
  return (
    <Badge variant="outline" className={`rounded-full ${badgeClasses[tone] || badgeClasses.inactive}`}>
      {children}
    </Badge>
  );
}

function Notice({ notice }) {
  if (!notice) return null;
  return (
    <div className="pointer-events-none fixed top-6 right-6 z-50 w-full max-w-sm">
      <Alert
        variant={notice.variant === "error" ? "destructive" : "success"}
        className="pointer-events-auto border shadow-xl"
      >
        <AlertTitle>{notice.title}</AlertTitle>
        <AlertDescription>{notice.message}</AlertDescription>
      </Alert>
    </div>
  );
}

function StatCard({ title, value, icon, tone = "sky" }) {
  const styles = statTones[tone] || statTones.sky;
  return (
    <Card className={`border py-0 shadow-sm ${styles.card}`}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex size-10 items-center justify-center rounded-xl ${styles.icon}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className={`text-xl font-semibold ${styles.value}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function emptyFilters() {
  return {
    search: "",
    session_id: "",
    class_id: "",
    section_id: "",
    stream_id: "",
    medium: "",
  };
}

export default function TransportationFee() {
  const [summary, setSummary] = useState({});
  const [classes, setClasses] = useState([]);
  const [streams, setStreams] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [paymentStudents, setPaymentStudents] = useState([]);
  const [paymentDues, setPaymentDues] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [notice, setNotice] = useState(null);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignmentRowsPerPage, setAssignmentRowsPerPage] = useState(TABLE_ROWS_PER_PAGE_OPTIONS[0]);
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentRowsPerPage, setPaymentRowsPerPage] = useState(TABLE_ROWS_PER_PAGE_OPTIONS[0]);
  const [studentFilters, setStudentFilters] = useState(() => emptyFilters());
  const [paymentFilters, setPaymentFilters] = useState(() => emptyFilters());
  const [assignmentForm, setAssignmentForm] = useState({
    student_id: "",
    session_id: "",
    start_month: "4",
    start_year: String(new Date().getFullYear()),
    monthly_fee: "",
    remarks: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    student_id: "",
    due_id: "",
    amount_paid: "",
    remarks: "",
  });

  function showNotice(title, message, variant = "success") {
    setNotice({ title, message, variant });
  }

  async function loadAll() {
    const [
      summaryRes,
      sessionsRes,
      classesRes,
      streamsRes,
      assignmentsRes,
      paymentsRes,
    ] = await Promise.all([
      getTransportSummary(),
      getSessions(),
      getClassStructure(),
      getStreams(),
      getTransportAssignments(),
      getTransportPayments(),
    ]);
    setSummary(summaryRes?.data || {});
    setSessions(sessionsRes?.data || []);
    setClasses(classesRes?.data || []);
    setStreams(streamsRes?.data || []);
    setAssignments(assignmentsRes?.data || []);
    setPayments(paymentsRes?.data || []);
  }

  const loadInitialData = useEffectEvent(() => {
    loadAll().catch((err) => showNotice("Load Failed", err?.message || "Could not load transportation fees.", "error"));
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function handleStudentSearch() {
    const res = await searchTransportStudents(studentFilters);
    setStudents(res?.data || []);
  }

  async function loadPaymentDues(studentId, sessionId = "") {
    if (!studentId) {
      setPaymentDues([]);
      return;
    }
    const res = await getTransportDues({
      student_id: studentId,
      session_id: sessionId || undefined,
      status: "pending",
    });
    setPaymentDues(res?.data || []);
  }

  async function handleCreateAssignment(event) {
    event.preventDefault();
    try {
      await createTransportAssignment({
        ...assignmentForm,
        student_id: Number(assignmentForm.student_id),
        session_id: Number(assignmentForm.session_id),
        start_month: Number(assignmentForm.start_month),
        start_year: Number(assignmentForm.start_year),
        monthly_fee: Number(assignmentForm.monthly_fee),
      });
      setAssignmentOpen(false);
      setAssignmentForm({
        student_id: "",
        session_id: "",
        start_month: "4",
        start_year: String(new Date().getFullYear()),
        monthly_fee: "",
        remarks: "",
      });
      await loadAll();
      showNotice("Assignment Created", "Monthly transportation dues were generated.");
    } catch (err) {
      showNotice("Create Failed", err?.message || "Could not assign transportation.", "error");
    }
  }

  async function handleCreatePayment(event) {
    event.preventDefault();
    try {
      if (!paymentForm.student_id) throw new Error("Select student.");
      if (!paymentForm.due_id) throw new Error("Select due item.");
      const selectedDue = paymentDues.find((due) => String(due.id) === String(paymentForm.due_id));
      const amountPaid = Number(paymentForm.amount_paid);
      if (!Number.isFinite(amountPaid) || amountPaid <= 0) throw new Error("Enter a valid amount.");
      if (selectedDue && amountPaid > Number(selectedDue.remaining || 0)) {
        throw new Error("Amount cannot exceed remaining due.");
      }
      const res = await createTransportPayment({
        due_ids: [Number(paymentForm.due_id)],
        amount_paid: amountPaid,
        remarks: paymentForm.remarks,
      });
      setPaymentForm({ student_id: "", due_id: "", amount_paid: "", remarks: "" });
      setPaymentDues([]);
      setPaymentOpen(false);
      await loadAll();
      showNotice("Payment Recorded", `Receipt ${res?.data?.receipt_no || ""} created.`);
    } catch (err) {
      showNotice("Payment Failed", err?.message || "Could not record transportation payment.", "error");
    }
  }

  async function handleReceipt(paymentId) {
    try {
      const blob = await downloadTransportReceipt(paymentId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `transport-receipt-${paymentId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showNotice("Download Failed", err?.message || "Could not download receipt.", "error");
    }
  }

  const selectedPaymentDue = paymentDues.find((due) => String(due.id) === String(paymentForm.due_id));
  const selectClassName = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30";
  const activeSession = sessions.find((session) => session.is_active || String(session.status || "").toLowerCase() === "active") || sessions[0];
  const paymentSelectedClass = classes.find((item) => String(item.id) === String(paymentFilters.class_id));
  const paymentRequiresStream = String(paymentSelectedClass?.class_scope || "").toLowerCase() === "hs";
  const assignmentTotalPages = Math.max(1, Math.ceil(assignments.length / assignmentRowsPerPage));
  const paymentTotalPages = Math.max(1, Math.ceil(payments.length / paymentRowsPerPage));
  const paginatedAssignments = assignments.slice(
    (assignmentPage - 1) * assignmentRowsPerPage,
    assignmentPage * assignmentRowsPerPage
  );
  const paginatedPayments = payments.slice(
    (paymentPage - 1) * paymentRowsPerPage,
    paymentPage * paymentRowsPerPage
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPaymentStudents() {
      if (!paymentFilters.class_id || !paymentFilters.section_id || (paymentRequiresStream && !paymentFilters.stream_id)) {
        setPaymentStudents([]);
        setPaymentDues([]);
        setPaymentForm((prev) => ({ ...prev, student_id: "", due_id: "", amount_paid: "" }));
        return;
      }

      try {
        const res = await searchTransportStudents({
          search: paymentFilters.search,
          session_id: activeSession?.id || "",
          class_id: paymentFilters.class_id,
          section_id: paymentFilters.section_id,
          stream_id: paymentRequiresStream ? paymentFilters.stream_id : "",
        });
        if (!cancelled) setPaymentStudents(res?.data || []);
      } catch (err) {
        if (!cancelled) showNotice("Load Failed", err?.message || "Could not load students.", "error");
      }
    }

    loadPaymentStudents();
    return () => {
      cancelled = true;
    };
  }, [
    activeSession?.id,
    paymentFilters.class_id,
    paymentFilters.section_id,
    paymentFilters.stream_id,
    paymentFilters.search,
    paymentRequiresStream,
  ]);

  useEffect(() => {
    setAssignmentPage((prev) => Math.min(prev, assignmentTotalPages));
  }, [assignmentTotalPages]);

  useEffect(() => {
    setPaymentPage((prev) => Math.min(prev, paymentTotalPages));
  }, [paymentTotalPages]);

  return (
    <>
      <Notice notice={notice} />
      <TopBar
        title="Transportation Fee"
        subTitle="Manage student-specific transportation fees, monthly dues, and separate receipts."
        action={
          <div className="flex flex-wrap gap-2">
            <Dialog open={paymentOpen} onOpenChange={(open) => {
              setPaymentOpen(open);
              if (!open) {
                setPaymentForm({ student_id: "", due_id: "", amount_paid: "", remarks: "" });
                setPaymentDues([]);
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline"><IndianRupee className="size-4" /> Record Payment</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <form onSubmit={handleCreatePayment} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>Transportation Payment</DialogTitle>
                    <DialogDescription>Select class, section, student, due item, and payment details.</DialogDescription>
                  </DialogHeader>

                  <PaymentFilters
                    classes={classes}
                    streams={streams}
                    filters={paymentFilters}
                    setFilters={setPaymentFilters}
                    selectClassName={selectClassName}
                    onResetPayment={() => {
                      setPaymentForm((prev) => ({ ...prev, student_id: "", due_id: "", amount_paid: "" }));
                      setPaymentDues([]);
                    }}
                  />

                  <div className="grid gap-2">
                    <Label>Student</Label>
                    <select
                      className={selectClassName}
                      value={paymentForm.student_id}
                      onChange={async (event) => {
                        const studentId = event.target.value;
                        const student = paymentStudents.find((item) => String(item.id) === String(studentId));
                        setPaymentForm((prev) => ({
                          ...prev,
                          student_id: studentId,
                          due_id: "",
                          amount_paid: "",
                        }));
                        await loadPaymentDues(studentId, student?.session_id || activeSession?.id);
                      }}
                      disabled={!paymentStudents.length}
                      required
                    >
                      <option value="">Select Student</option>
                      {paymentStudents.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name}
                          {student.roll_number ? ` - Roll ${student.roll_number}` : ""}
                          {student.stream_name ? ` (${student.stream_name})` : ""}
                        </option>
                      ))}
                    </select>
                    {paymentFilters.class_id && paymentFilters.section_id && !paymentStudents.length ? (
                      <p className="text-xs text-muted-foreground">No students found for the selected filters.</p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label>Due Item</Label>
                    <select
                      className={selectClassName}
                      value={paymentForm.due_id}
                      onChange={(event) => {
                        const due = paymentDues.find((item) => String(item.id) === event.target.value);
                        setPaymentForm((prev) => ({
                          ...prev,
                          due_id: event.target.value,
                          amount_paid: due ? String(due.remaining || "") : "",
                        }));
                      }}
                      disabled={!paymentForm.student_id}
                      required
                    >
                      <option value="">Select Due Item</option>
                      {paymentDues.map((due) => (
                        <option key={due.id} value={due.id}>
                          {monthLabel(due.due_month, due.due_year)} - Remaining: {money(due.remaining)}
                        </option>
                      ))}
                    </select>
                    {paymentForm.student_id && !paymentDues.length ? (
                      <p className="text-xs text-muted-foreground">No pending transportation dues for this student.</p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label>Amount</Label>
                    <Input
                      inputMode="numeric"
                      value={paymentForm.amount_paid}
                      onChange={(event) =>
                        setPaymentForm((prev) => ({
                          ...prev,
                          amount_paid: event.target.value.replace(/[^\d.]/g, ""),
                        }))
                      }
                      disabled={!paymentForm.due_id}
                      required
                    />
                    {selectedPaymentDue ? (
                      <p className="text-xs text-muted-foreground">
                        Due Amount: {money(selectedPaymentDue.amount)} | Paid: {money(selectedPaymentDue.paid)} | Remaining: {money(selectedPaymentDue.remaining)}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label>Remarks</Label>
                    <Input value={paymentForm.remarks} onChange={(event) => setPaymentForm((prev) => ({ ...prev, remarks: event.target.value }))} />
                  </div>
                  <DialogFooter showCloseButton><Button type="submit">Save Payment</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}>
              <DialogTrigger asChild>
                <Button><Bus className="size-4" /> Assign Student</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <form onSubmit={handleCreateAssignment} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>Assign Transportation</DialogTitle>
                    <DialogDescription>
                      Filter students by class, section, medium, and stream, then set the monthly fee.
                    </DialogDescription>
                  </DialogHeader>

                  <StudentFilters
                    classes={classes}
                    streams={streams}
                    sessions={sessions}
                    filters={studentFilters}
                    setFilters={setStudentFilters}
                    selectClassName={selectClassName}
                  />

                  <Button type="button" variant="outline" onClick={handleStudentSearch}>
                    Load Students
                  </Button>

                  <div className="grid gap-2">
                    <Label>Student</Label>
                    <select
                      className={selectClassName}
                      value={assignmentForm.student_id}
                      onChange={(event) => {
                        const student = students.find((item) => String(item.id) === event.target.value);
                        setAssignmentForm((prev) => ({
                          ...prev,
                          student_id: event.target.value,
                          session_id: String(student?.session_id || studentFilters.session_id || prev.session_id),
                        }));
                      }}
                      required
                    >
                      <option value="">Select Student</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name} {student.admission_no ? `(${student.admission_no})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <AssignmentFields
                    form={assignmentForm}
                    setForm={setAssignmentForm}
                    sessions={sessions}
                    selectClassName={selectClassName}
                  />

                  <DialogFooter showCloseButton>
                    <Button type="submit">Assign</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="sky" icon={<Users className="size-5" />} title="Active Students" value={Number(summary.active_students || 0)} />
        <StatCard tone="emerald" icon={<IndianRupee className="size-5" />} title="Monthly Expected" value={money(summary.monthly_expected)} />
        <StatCard tone="amber" icon={<ReceiptText className="size-5" />} title="Pending Dues" value={money(summary.pending_amount)} />
        <StatCard tone="rose" icon={<Bus className="size-5" />} title="This Month Collection" value={money(summary.this_month_collection)} />
      </div>

      <Tabs defaultValue="assignments" className="mt-4">
        <TabsList variant="line" className="grid w-full grid-cols-2">
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Student Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-3 rounded-lg border border-border bg-muted/20 p-3 lg:grid-cols-6">
                <StudentFilters
                  classes={classes}
                  streams={streams}
                  sessions={sessions}
                  filters={studentFilters}
                  setFilters={setStudentFilters}
                  selectClassName={selectClassName}
                  compact
                />
                <Button variant="outline" onClick={handleStudentSearch}>Load</Button>
              </div>

              {students.length ? (
                <div className="mb-4 overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell>
                            <p className="font-medium">{student.name}</p>
                            <p className="text-xs text-muted-foreground">{student.admission_no || ""}</p>
                          </TableCell>
                          <TableCell>{student.class_name || "-"}</TableCell>
                          <TableCell>{student.section_name || "-"} {student.medium ? `(${student.medium})` : ""}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAssignmentForm((prev) => ({
                                  ...prev,
                                  student_id: String(student.id),
                                  session_id: String(student.session_id || studentFilters.session_id || ""),
                                }));
                                setAssignmentOpen(true);
                              }}
                            >
                              Assign
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}

              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Transport Type</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Monthly Fee</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAssignments.length ? paginatedAssignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell>
                          <p className="font-medium">{assignment.student_name}</p>
                          <p className="text-xs text-muted-foreground">{assignment.class_name || "-"} {assignment.section_name ? `- ${assignment.section_name}` : ""}</p>
                        </TableCell>
                        <TableCell><ColorBadge tone="student">Student Specific</ColorBadge></TableCell>
                        <TableCell><ColorBadge tone="partial">{monthLabel(assignment.start_month, assignment.start_year)}</ColorBadge></TableCell>
                        <TableCell><ColorBadge tone={assignment.status === "active" ? "active" : "inactive"}>{assignment.status}</ColorBadge></TableCell>
                        <TableCell className="text-right"><ColorBadge tone="paid">{money(assignment.monthly_fee)}</ColorBadge></TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          No transport assignments yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={assignmentPage}
                totalPages={assignmentTotalPages}
                totalRows={assignments.length}
                rowsPerPage={assignmentRowsPerPage}
                rowsPerPageOptions={TABLE_ROWS_PER_PAGE_OPTIONS}
                onPageChange={setAssignmentPage}
                onRowsPerPageChange={(value) => {
                  setAssignmentRowsPerPage(value);
                  setAssignmentPage(1);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Transportation Payments</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sl. No.</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Stream</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Medium</TableHead>
                      <TableHead>Fee Type</TableHead>
                      <TableHead className="text-right">Amount Paid</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPayments.length ? paginatedPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell><ColorBadge tone="receipt">{payment.receipt_serial || payment.receipt_no || `TR-${String(payment.id).padStart(6, "0")}`}</ColorBadge></TableCell>
                        <TableCell>{formatReadableDate(payment.created_at)}</TableCell>
                        <TableCell>
                          <p className="font-medium">{payment.student_name}</p>
                          <p className="text-xs text-muted-foreground">{payment.admission_no || ""}</p>
                        </TableCell>
                        <TableCell>{formatScope(payment.class_scope)}</TableCell>
                        <TableCell>{payment.class_name || "-"}</TableCell>
                        <TableCell>{payment.stream_name || "-"}</TableCell>
                        <TableCell>{payment.section_name || "-"}</TableCell>
                        <TableCell>{payment.medium || "-"}</TableCell>
                        <TableCell>
                          <p className="font-medium">Bus/Van Fee</p>
                          <p className="text-xs text-muted-foreground">{payment.covered_months || "-"}</p>
                        </TableCell>
                        <TableCell className="text-right"><ColorBadge tone="paid">{money(payment.amount_paid)}</ColorBadge></TableCell>
                        <TableCell><ColorBadge tone={payment.fee_status || "unpaid"}>{payment.fee_status || "unpaid"}</ColorBadge></TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => handleReceipt(payment.id)}>
                            <Download className="size-4" /> Receipt
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={12} className="py-8 text-center text-muted-foreground">
                          No transportation payments recorded yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={paymentPage}
                totalPages={paymentTotalPages}
                totalRows={payments.length}
                rowsPerPage={paymentRowsPerPage}
                rowsPerPageOptions={TABLE_ROWS_PER_PAGE_OPTIONS}
                onPageChange={setPaymentPage}
                onRowsPerPageChange={(value) => {
                  setPaymentRowsPerPage(value);
                  setPaymentPage(1);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function TablePagination({
  page,
  totalPages,
  totalRows,
  rowsPerPage,
  rowsPerPageOptions,
  onPageChange,
  onRowsPerPageChange,
}) {
  const safePage = Math.min(Math.max(Number(page) || 1, 1), Math.max(Number(totalPages) || 1, 1));
  const firstRow = totalRows ? (safePage - 1) * rowsPerPage + 1 : 0;
  const lastRow = Math.min(safePage * rowsPerPage, totalRows);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-x border-b border-border px-4 py-3 text-sm">
      <p className="text-muted-foreground">
        Showing {firstRow}-{lastRow} of {totalRows}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Rows per page</span>
          <select
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            value={rowsPerPage}
            onChange={(event) => onRowsPerPageChange(Number(event.target.value))}
          >
            {rowsPerPageOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <span className="text-muted-foreground">Page {safePage} of {totalPages}</span>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={safePage <= 1}
            onClick={() => onPageChange(Math.max(safePage - 1, 1))}
          >
            Prev
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(Math.min(safePage + 1, totalPages))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function PaymentFilters({ classes, streams, filters, setFilters, selectClassName, onResetPayment }) {
  const selectedClass = classes.find((item) => String(item.id) === String(filters.class_id));
  const sections = selectedClass?.sections || [];
  const showStream = String(selectedClass?.class_scope || "").toLowerCase() === "hs";

  function updateFilters(updater) {
    setFilters(updater);
    onResetPayment?.();
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="grid gap-2">
        <Label>Class</Label>
        <select
          className={selectClassName}
          value={filters.class_id}
          onChange={(event) =>
            updateFilters((prev) => ({
              ...prev,
              class_id: event.target.value,
              section_id: "",
              stream_id: "",
              search: "",
            }))
          }
        >
          <option value="">Select Class</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>

      <div className="grid gap-2">
        <Label>Section</Label>
        <select
          className={selectClassName}
          value={filters.section_id}
          onChange={(event) => updateFilters((prev) => ({ ...prev, section_id: event.target.value }))}
          disabled={!filters.class_id}
        >
          <option value="">Select Section</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name} {section.medium ? `(${section.medium})` : ""}
            </option>
          ))}
        </select>
      </div>

      {showStream ? (
        <div className="grid gap-2">
          <Label>Stream</Label>
          <select
            className={selectClassName}
            value={filters.stream_id}
            onChange={(event) => updateFilters((prev) => ({ ...prev, stream_id: event.target.value }))}
          >
            <option value="">Select Stream</option>
            {streams.map((stream) => <option key={stream.id} value={stream.id}>{stream.name}</option>)}
          </select>
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label>Search</Label>
        <Input
          value={filters.search}
          onChange={(event) => updateFilters((prev) => ({ ...prev, search: event.target.value }))}
          placeholder="Search by student name"
          disabled={!filters.class_id || !filters.section_id || (showStream && !filters.stream_id)}
        />
      </div>
    </div>
  );
}

function StudentFilters({
  classes,
  streams,
  sessions,
  filters,
  setFilters,
  selectClassName,
  compact = false,
}) {
  const selectedClass = classes.find((item) => String(item.id) === String(filters.class_id));
  const sections = selectedClass?.sections || [];
  const media = [...new Set(sections.map((section) => section.medium).filter(Boolean))];
  const showStream = String(selectedClass?.class_scope || "").toLowerCase() === "hs";

  return (
    <>
      <select
        className={selectClassName}
        value={filters.session_id}
        onChange={(event) => setFilters((prev) => ({ ...prev, session_id: event.target.value }))}
      >
        <option value="">{compact ? "Session" : "Select Session"}</option>
        {sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
      </select>
      <select
        className={selectClassName}
        value={filters.class_id}
        onChange={(event) => setFilters((prev) => ({ ...prev, class_id: event.target.value, section_id: "", stream_id: "", medium: "" }))}
      >
        <option value="">{compact ? "Class" : "Select Class"}</option>
        {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <select
        className={selectClassName}
        value={filters.section_id}
        onChange={(event) => {
          const section = sections.find((item) => String(item.id) === event.target.value);
          setFilters((prev) => ({ ...prev, section_id: event.target.value, medium: section?.medium || prev.medium }));
        }}
      >
        <option value="">{compact ? "Section" : "Select Section"}</option>
        {sections.map((section) => (
          <option key={section.id} value={section.id}>
            {section.name} {section.medium ? `(${section.medium})` : ""}
          </option>
        ))}
      </select>
      <select
        className={selectClassName}
        value={filters.medium}
        onChange={(event) => setFilters((prev) => ({ ...prev, medium: event.target.value }))}
      >
        <option value="">{compact ? "Medium" : "All Media"}</option>
        {media.map((medium) => <option key={medium} value={medium}>{medium}</option>)}
      </select>
      {showStream ? (
        <select
          className={selectClassName}
          value={filters.stream_id}
          onChange={(event) => setFilters((prev) => ({ ...prev, stream_id: event.target.value }))}
        >
          <option value="">{compact ? "Stream" : "Select Stream"}</option>
          {streams.map((stream) => <option key={stream.id} value={stream.id}>{stream.name}</option>)}
        </select>
      ) : null}
      <Input
        value={filters.search}
        onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
        placeholder="Search student"
      />
    </>
  );
}

function AssignmentFields({ form, setForm, sessions, selectClassName }) {
  return (
    <>
      <div className="grid gap-2">
        <Label>Academic Session</Label>
        <select
          className={selectClassName}
          value={form.session_id}
          onChange={(event) => setForm((prev) => ({ ...prev, session_id: event.target.value }))}
          required
        >
          <option value="">Select Session</option>
          {sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Start Month</Label>
          <select
            className={selectClassName}
            value={form.start_month}
            onChange={(event) => setForm((prev) => ({ ...prev, start_month: event.target.value }))}
          >
            {MONTHS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="grid gap-2">
          <Label>Start Year</Label>
          <Input
            inputMode="numeric"
            value={form.start_year}
            onChange={(event) => setForm((prev) => ({ ...prev, start_year: event.target.value.replace(/\D/g, "").slice(0, 4) }))}
            required
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Monthly Fee</Label>
        <Input
          inputMode="numeric"
          value={form.monthly_fee}
          onChange={(event) => setForm((prev) => ({ ...prev, monthly_fee: event.target.value.replace(/[^\d.]/g, "") }))}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label>Remarks</Label>
        <Input value={form.remarks} onChange={(event) => setForm((prev) => ({ ...prev, remarks: event.target.value }))} />
      </div>
    </>
  );
}

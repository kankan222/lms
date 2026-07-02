import { useEffect, useEffectEvent, useMemo, useState } from "react";
import TopBar from "../components/TopBar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [assignments, setAssignments] = useState([]);
  const [dues, setDues] = useState([]);
  const [payments, setPayments] = useState([]);
  const [notice, setNotice] = useState(null);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedDueIds, setSelectedDueIds] = useState([]);
  const [studentFilters, setStudentFilters] = useState(() => emptyFilters());
  const [assignmentForm, setAssignmentForm] = useState({
    student_id: "",
    session_id: "",
    start_month: "4",
    start_year: String(new Date().getFullYear()),
    monthly_fee: "",
    remarks: "",
  });
  const [paymentForm, setPaymentForm] = useState({ payment_method: "", remarks: "" });

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
      duesRes,
      paymentsRes,
    ] = await Promise.all([
      getTransportSummary(),
      getSessions(),
      getClassStructure(),
      getStreams(),
      getTransportAssignments(),
      getTransportDues({ status: "pending" }),
      getTransportPayments(),
    ]);
    setSummary(summaryRes?.data || {});
    setSessions(sessionsRes?.data || []);
    setClasses(classesRes?.data || []);
    setStreams(streamsRes?.data || []);
    setAssignments(assignmentsRes?.data || []);
    setDues(duesRes?.data || []);
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
      const res = await createTransportPayment({
        due_ids: selectedDueIds,
        payment_method: paymentForm.payment_method,
        remarks: paymentForm.remarks,
      });
      setSelectedDueIds([]);
      setPaymentForm({ payment_method: "", remarks: "" });
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

  const selectedDues = useMemo(
    () => dues.filter((due) => selectedDueIds.includes(Number(due.id))),
    [dues, selectedDueIds]
  );
  const selectedTotal = selectedDues.reduce((sum, due) => sum + Number(due.remaining || 0), 0);
  const selectedStudentIds = new Set(selectedDues.map((due) => Number(due.student_id)));
  const selectClassName = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30";

  return (
    <>
      <Notice notice={notice} />
      <TopBar
        title="Transportation Fee"
        subTitle="Manage student-specific transportation fees, monthly dues, and separate receipts."
        action={
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
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="sky" icon={<Users className="size-5" />} title="Active Students" value={Number(summary.active_students || 0)} />
        <StatCard tone="emerald" icon={<IndianRupee className="size-5" />} title="Monthly Expected" value={money(summary.monthly_expected)} />
        <StatCard tone="amber" icon={<ReceiptText className="size-5" />} title="Pending Dues" value={money(summary.pending_amount)} />
        <StatCard tone="rose" icon={<Bus className="size-5" />} title="This Month Collection" value={money(summary.this_month_collection)} />
      </div>

      <Tabs defaultValue="assignments" className="mt-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="dues">Dues</TabsTrigger>
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
                    {assignments.length ? assignments.map((assignment) => (
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dues" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">Pending Monthly Dues</CardTitle>
              <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
                <DialogTrigger asChild>
                  <Button disabled={!selectedDueIds.length || selectedStudentIds.size > 1}>Record Payment</Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCreatePayment} className="space-y-4">
                    <DialogHeader>
                      <DialogTitle>Transportation Payment</DialogTitle>
                      <DialogDescription>Record one payment for the selected months. Selected months must belong to one student.</DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                      <p className="font-medium">Selected Amount: {money(selectedTotal)}</p>
                      <p className="mt-1 text-muted-foreground">{selectedDues.map((due) => monthLabel(due.due_month, due.due_year)).join(", ")}</p>
                    </div>
                    <div className="grid gap-2">
                      <Label>Payment Method</Label>
                      <Input value={paymentForm.payment_method} onChange={(event) => setPaymentForm((prev) => ({ ...prev, payment_method: event.target.value }))} placeholder="Cash, UPI, Bank" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Remarks</Label>
                      <Input value={paymentForm.remarks} onChange={(event) => setPaymentForm((prev) => ({ ...prev, remarks: event.target.value }))} />
                    </div>
                    <DialogFooter showCloseButton><Button type="submit">Save Payment</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dues.length ? dues.map((due) => (
                      <TableRow key={due.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedDueIds.includes(Number(due.id))}
                            onCheckedChange={(checked) => {
                              setSelectedDueIds((prev) => checked ? [...prev, Number(due.id)] : prev.filter((dueId) => dueId !== Number(due.id)));
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{due.student_name}</p>
                          <p className="text-xs text-muted-foreground">{due.admission_no || ""}</p>
                        </TableCell>
                        <TableCell><ColorBadge tone="partial">{monthLabel(due.due_month, due.due_year)}</ColorBadge></TableCell>
                        <TableCell><ColorBadge tone="student">Student Specific</ColorBadge></TableCell>
                        <TableCell><ColorBadge tone={due.status}>{due.status}</ColorBadge></TableCell>
                        <TableCell className="text-right"><ColorBadge tone="pending">{money(due.remaining)}</ColorBadge></TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          No pending transportation dues.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
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
                      <TableHead>Receipt</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Months</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length ? payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell><ColorBadge tone="receipt">{payment.receipt_no || `TR-${String(payment.id).padStart(6, "0")}`}</ColorBadge></TableCell>
                        <TableCell>{payment.student_name}</TableCell>
                        <TableCell>{payment.covered_months ? <ColorBadge tone="partial">{payment.covered_months}</ColorBadge> : "-"}</TableCell>
                        <TableCell className="text-right"><ColorBadge tone="paid">{money(payment.amount_paid)}</ColorBadge></TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => handleReceipt(payment.id)}>
                            <Download className="size-4" /> Receipt
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          No transportation payments recorded yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
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

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import TopBar from "../../components/TopBar";
import { getStudent } from "../../api/students.api";
import { getStudentAttendanceSessions } from "../../api/attendance.api";
import {
  getMyPayments,
  getMyStudentFeeOptions,
  getStudentFeeOptions,
  getPayments
} from "../../api/fee.api";
import {
  getExams,
} from "../../api/exam.api";
import {
  downloadMyMarksheet,
  getAccessibleExams,
  getMyResults,
  downloadStudentMarksheet,
  getStudentReport,
} from "../../api/marks.api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { BookOpen, CalendarDays, CreditCard, IdCard, Phone, UserRound } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { usePermissions } from "../../hooks/usePermissions";
import { resolveServerImageUrl } from "../../lib/serverImage";
import { formatReadableDate } from "../../lib/dateTime";

function feeStatusColor(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "paid") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (value === "partial") return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  if (value === "pending") return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200";
  return "bg-muted text-muted-foreground";
}

function normalizeFeeStatus(value, fallback = "-") {
  const status = String(value || "").trim().toLowerCase();
  return status || fallback;
}

function formatClassScope(value) {
  const scope = String(value || "").trim().toLowerCase();
  if (scope === "hs") return "Higher Secondary";
  if (scope === "school") return "School";
  return value || "-";
}

function attendanceStatusColor(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "present") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (value === "absent") return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200";
  return "bg-muted text-muted-foreground";
}

function approvalStatusColor(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "approved") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (value === "pending") return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  if (value === "rejected") return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200";
  return "bg-muted text-muted-foreground";
}

const StudentDetails = () => {
  const { id } = useParams();
  const { hasRole } = usePermissions();
  const isParent = hasRole("parent");
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [feeItems, setFeeItems] = useState([]);
  const [payments, setPayments] = useState([]);
  const [financeError, setFinanceError] = useState("");

  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [attendanceFilters, setAttendanceFilters] = useState({
    status: "",
    approval_status: "",
    date_from: "",
    date_to: "",
  });

  const loadStudent = useEffectEvent(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getStudent(id);
      const payload = res?.data ?? res ?? null;
      setStudent(payload);
      if (payload?.id) {
        await loadFinance(payload.id);
      }
    } catch (err) {
      setError(err?.message || "Failed to load student details.");
    } finally {
      setLoading(false);
    }
  });

  const loadExams = useEffectEvent(async () => {
    try {
      const res = await (isParent ? getAccessibleExams() : getExams());
      const examList = res?.data || [];
      setExams(examList);
    } catch {
      setExams([]);
    }
  });

  const loadReport = useEffectEvent(async (examId, studentId) => {
    setReportLoading(true);
    setReportError("");
    setReport(null);
    try {
      const res = await (isParent
        ? getMyResults({ exam_id: examId, student_id: studentId })
        : getStudentReport(examId, studentId));
      setReport(res?.data || null);
    } catch (err) {
      setReportError(err?.message || "Report not available for this exam.");
    } finally {
      setReportLoading(false);
    }
  });

  const loadAttendance = useEffectEvent(async (studentId) => {
    setAttendanceLoading(true);
    setAttendanceError("");
    try {
      const res = await getStudentAttendanceSessions({
        student_id: studentId,
        status: attendanceFilters.status || undefined,
        approval_status: attendanceFilters.approval_status || undefined,
        date_from: attendanceFilters.date_from || undefined,
        date_to: attendanceFilters.date_to || undefined,
      });
      setAttendanceRows(res?.data || []);
    } catch (err) {
      setAttendanceRows([]);
      setAttendanceError(err?.message || "Failed to load attendance records.");
    } finally {
      setAttendanceLoading(false);
    }
  });

  useEffect(() => {
    loadStudent();
  }, [id]);

  useEffect(() => {
    loadExams();
  }, []);

  useEffect(() => {
    if (!student?.id || !selectedExamId) {
      setReport(null);
      return;
    }
    loadReport(selectedExamId, student.id);
  }, [selectedExamId, student?.id]);

  useEffect(() => {
    if (!student?.id) return;
    loadAttendance(student.id);
  }, [student?.id, attendanceFilters.status, attendanceFilters.approval_status, attendanceFilters.date_from, attendanceFilters.date_to]);

  async function loadFinance(studentId) {
    setFinanceError("");
    try {
      const [feeRes, paymentRes] = await Promise.all(
        isParent
          ? [
              getMyStudentFeeOptions(studentId),
              getMyPayments({ student_id: studentId })
            ]
          : [
              getStudentFeeOptions(studentId),
              getPayments({ student_id: studentId })
            ]
      );
      setFeeItems(feeRes?.data || []);
      setPayments(paymentRes?.data || []);
    } catch (err) {
      const message = String(err?.message || "");
      if (message.toLowerCase().includes("fee structure not found")) {
        setFeeItems([]);
        setPayments([]);
        setFinanceError("No fee structure is configured for this student's class and session yet.");
        return;
      }

      setFinanceError(err?.message || "Failed to load fees and payments.");
    }
  }


  async function handleDownloadMarksheet() {
    if (!selectedExamId || !student?.id) return;
    const blob = await (isParent
      ? downloadMyMarksheet({ exam_id: selectedExamId, student_id: student.id })
      : downloadStudentMarksheet(selectedExamId, student.id));
    if (!blob || blob.size === 0) {
      throw new Error("Downloaded file is empty");
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marksheet-exam-${selectedExamId}-student-${student.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 5000);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  const father = useMemo(
    () => student?.parents?.find((p) => p.relationship === "father"),
    [student]
  );
  const mother = useMemo(
    () => student?.parents?.find((p) => p.relationship === "mother"),
    [student]
  );

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-700 dark:text-red-200">{error}</div>;
  }

  if (!student) {
    return <div>Student not found.</div>;
  }

  return (
    <div>
      <TopBar title={isParent ? "Child Information" : "Student Information"} />

      <div className="w-full bg-card rounded-xl border shadow-sm p-6 flex gap-6 items-start">
        <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted shrink-0">
          {student.photo_url ? (
            <img
              src={resolveServerImageUrl(student.photo_url)}
              alt={student.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <UserRound size={28} />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{student.name}</h2>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <IdCard size={15} /> {student.admission_no || "No admission no."}
                </span>
                <span className="flex items-center gap-1">
                  <Phone size={15} /> {student.mobile || "-"}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarDays size={15} /> DOB {formatReadableDate(student.dob)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{student.gender || "-"}</Badge>
              <Badge variant="outline">
                {student.class || "-"} - {student.section || "-"}
              </Badge>
              <Badge variant="outline">{formatClassScope(student.class_scope || "school")}</Badge>
              {student.class_scope === "hs" && student.stream_name ? (
                <Badge variant="outline">{student.stream_name}</Badge>
              ) : null}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Roll No</p>
              <p className="font-medium">{student.roll_number || "-"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Session</p>
              <p className="font-medium">{student.session || "-"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Scope</p>
              <p className="font-medium">{formatClassScope(student.class_scope || "-")}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Stream</p>
              <p className="font-medium">{student.class_scope === "hs" ? student.stream_name || "-" : "-"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Admission Date</p>
              <p className="font-medium">{formatReadableDate(student.date_of_admission)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Student ID</p>
              <p className="font-medium">#{student.id}</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-5">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="parents">Parents</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="fees">Fees & Payments</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Class</p>
              <p className="text-base font-medium">{student.class || "-"}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Scope</p>
              <p className="text-base font-medium">{formatClassScope(student.class_scope || "-")}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Section</p>
              <p className="text-base font-medium">{student.section || "-"}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Stream</p>
              <p className="text-base font-medium">{student.class_scope === "hs" ? student.stream_name || "-" : "-"}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Mobile</p>
              <p className="text-base font-medium">{student.mobile || "-"}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Gender</p>
              <p className="text-base font-medium">{student.gender || "-"}</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="parents" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-4 space-y-1">
              <h3 className="font-medium">Father</h3>
              <p className="text-sm">Name: {father?.name || "-"}</p>
              <p className="text-sm">Phone: {father?.mobile || "-"}</p>
              <p className="text-sm">Email: {father?.email || "-"}</p>
              <p className="text-sm">Occupation: {father?.occupation || "-"}</p>
              <p className="text-sm">Qualification: {father?.qualification || "-"}</p>
            </div>

            <div className="rounded-lg border bg-card p-4 space-y-1">
              <h3 className="font-medium">Mother</h3>
              <p className="text-sm">Name: {mother?.name || "-"}</p>
              <p className="text-sm">Phone: {mother?.mobile || "-"}</p>
              <p className="text-sm">Email: {mother?.email || "-"}</p>
              <p className="text-sm">Occupation: {mother?.occupation || "-"}</p>
              <p className="text-sm">Qualification: {mother?.qualification || "-"}</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4 space-y-4">
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:flex-wrap">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Attendance Status</label>
                <select
                  value={attendanceFilters.status}
                  onChange={(e) =>
                    setAttendanceFilters((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="min-w-40 rounded-md border bg-background px-3 py-2"
                >
                  <option value="">All Statuses</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Approval Status</label>
                <select
                  value={attendanceFilters.approval_status}
                  onChange={(e) =>
                    setAttendanceFilters((prev) => ({ ...prev, approval_status: e.target.value }))
                  }
                  className="min-w-40 rounded-md border bg-background px-3 py-2"
                >
                  <option value="">All Reviews</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">From Date</label>
                <Input
                  type="date"
                  value={attendanceFilters.date_from}
                  onChange={(e) =>
                    setAttendanceFilters((prev) => ({ ...prev, date_from: e.target.value }))
                  }
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">To Date</label>
                <Input
                  type="date"
                  value={attendanceFilters.date_to}
                  onChange={(e) =>
                    setAttendanceFilters((prev) => ({ ...prev, date_to: e.target.value }))
                  }
                />
              </div>

              <Button
                variant="outline"
                onClick={() =>
                  setAttendanceFilters({
                    status: "",
                    approval_status: "",
                    date_from: "",
                    date_to: "",
                  })
                }
              >
                Reset Filters
              </Button>
            </div>

            {attendanceError && <p className="text-sm text-red-700 dark:text-red-200">{attendanceError}</p>}
            {attendanceLoading && (
              <p className="text-sm text-muted-foreground">Loading attendance...</p>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Marked By</TableHead>
                  <TableHead>Reviewed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatReadableDate(row.date)}</TableCell>
                    <TableCell>
                      <span className={`px-3 py-1 text-xs rounded-full font-medium capitalize ${attendanceStatusColor(row.student_status)}`}>
                        {row.student_status || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-3 py-1 text-xs rounded-full font-medium capitalize ${approvalStatusColor(row.approval_status)}`}>
                        {row.approval_status || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{row.session_name || "-"}</TableCell>
                    <TableCell>{row.class_name || "-"}</TableCell>
                    <TableCell>{row.section_name || "-"}</TableCell>
                    <TableCell>{row.submitted_by_username || "-"}</TableCell>
                    <TableCell>{row.reviewed_by_username || "-"}</TableCell>
                  </TableRow>
                ))}
                {!attendanceLoading && attendanceRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No attendance records found for this student.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="fees" className="mt-4 space-y-4">
          {financeError && <p className="text-sm text-red-700 dark:text-red-200">{financeError}</p>}

          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <CreditCard size={16} /> Pending/Active Fee Items
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fee Type</TableHead>
                  <TableHead>Installment</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feeItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="capitalize">{item.fee_type || "-"}</TableCell>
                    <TableCell>{item.installment_name || "-"}</TableCell>
                    <TableCell>{formatReadableDate(item.due_date)}</TableCell>
                    <TableCell>{formatCurrency(item.amount)}</TableCell>
                    <TableCell>{formatCurrency(item.paid)}</TableCell>
                    <TableCell>{formatCurrency(item.remaining)}</TableCell>
                    <TableCell>
                      <span className={`px-3 py-1 text-xs rounded-full font-medium capitalize ${feeStatusColor(item.status)}`}>
                        {normalizeFeeStatus(item.status)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {feeItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No pending fee items for this student.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <BookOpen size={16} /> Payment History
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Fee Type</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatReadableDate(p.created_at)}</TableCell>
                    <TableCell>{formatCurrency(p.amount_paid)}</TableCell>
                    <TableCell className="capitalize">{p.fee_type || "-"}</TableCell>
                    <TableCell>{p.class_name || "-"}</TableCell>
                    <TableCell>{p.section_name || "-"}</TableCell>
                    <TableCell>
                      <span className={`px-3 py-1 text-xs rounded-full font-medium capitalize ${feeStatusColor(p.fee_status || p.status)}`}>
                        {normalizeFeeStatus(p.fee_status || p.status)}
                      </span>
                    </TableCell>
                    <TableCell>{p.remarks || "-"}</TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No payment history found for this student.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-4">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="font-semibold">Exam Report / Marksheet</h3>
            <div className="flex flex-col md:flex-row gap-2">
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="md:max-w-sm w-full border rounded-md px-3 py-2 bg-background"
              >
                <option value="">Select Exam</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </select>
              <Button onClick={handleDownloadMarksheet} disabled={!report || !selectedExamId}>
                Download Marksheet
              </Button>
            </div>

            {reportLoading && <p className="text-sm text-muted-foreground">Loading report...</p>}
            {!selectedExamId && (
              <p className="text-sm text-muted-foreground">
                Select an exam to view this student&apos;s marksheet details.
              </p>
            )}
            {reportError && (
              <p className="text-sm text-muted-foreground">{reportError}</p>
            )}

            {report && (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground text-sm">Exam</p>
                    <p className="font-medium">{report.exam?.name}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground text-sm">Class</p>
                    <p className="font-medium">{report.exam?.class_name}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground text-sm">Section</p>
                    <p className="font-medium">{report.exam?.section_name}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground text-sm">Percentage</p>
                    <p className="font-medium">{report.summary?.percentage ?? 0}%</p>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Marks</TableHead>
                      <TableHead>Max Marks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report.subjects || []).map((row, idx) => (
                      <TableRow key={`${row.subject}-${idx}`}>
                        <TableCell>{row.subject}</TableCell>
                        <TableCell>{row.marks}</TableCell>
                        <TableCell>{row.max_marks}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentDetails;

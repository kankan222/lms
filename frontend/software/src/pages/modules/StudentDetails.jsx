import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import TopBar from "../../components/TopBar";
import { getStudent } from "../../api/students.api";
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

function feeStatusColor(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "paid") return "bg-green-100 text-green-700";
  if (value === "partial") return "bg-amber-100 text-amber-700";
  if (value === "pending") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
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
  const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1").replace(/\/api\/v1\/?$/, "");

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

  async function loadStudent() {
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
  }

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
      setFinanceError(err?.message || "Failed to load fees and payments.");
    }
  }

  async function loadExams() {
    try {
      const res = await (isParent ? getAccessibleExams() : getExams());
      const examList = res?.data || [];
      setExams(examList);
    } catch {
      setExams([]);
    }
  }

  async function loadReport(examId, studentId) {
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

  function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString();
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
    return <div className="text-sm text-red-600">{error}</div>;
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
              src={`${API_ORIGIN}${student.photo_url}`}
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
                  <CalendarDays size={15} /> DOB {formatDate(student.dob)}
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
              <p className="font-medium">{formatDate(student.date_of_admission)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Student ID</p>
              <p className="font-medium">#{student.id}</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-5">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="parents">Parents</TabsTrigger>
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

        <TabsContent value="fees" className="mt-4 space-y-4">
          {financeError && <p className="text-sm text-red-600">{financeError}</p>}

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
                    <TableCell>{formatDate(item.due_date)}</TableCell>
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
                    <TableCell>{formatDate(p.created_at)}</TableCell>
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
                      <TableHead>Pass Marks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report.subjects || []).map((row, idx) => (
                      <TableRow key={`${row.subject}-${idx}`}>
                        <TableCell>{row.subject}</TableCell>
                        <TableCell>{row.marks}</TableCell>
                        <TableCell>{row.max_marks}</TableCell>
                        <TableCell>{row.pass_marks}</TableCell>
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

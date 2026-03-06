import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { getClasses } from "../api/academic.api";
import { createPayment, getPendingPayments } from "../api/fee.api";
import { getStudents } from "../api/students.api";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";

export default function FeePayments() {
  const navigate = useNavigate();

  const [data, setData] = useState([]);
  const [classes, setClasses] = useState([]);

  const [classId, setClassId] = useState("");
  const [section, setSection] = useState("");

  const [page, setPage] = useState(1);

  const [open, setOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState(null);

  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState("");

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    loadPayments();
  }, [classId, section, page]);
  useEffect(() => {
    if (!classId || !section) return;
    loadStudents();
  }, [classId, section]);

  async function loadStudents() {
    const res = await getStudents({
      classId,
      section,
    });

    setStudents(res.data || []);
  }

  async function loadClasses() {
    const res = await getClasses();
    setClasses(res.data);
  }

  async function loadPayments() {
    const res = await getPendingPayments({
      classId,
      section,
      page,
    });

    setData(res || []);
  }

async function handlePayment() {

  if (!studentId) {
    alert("Select a student");
    return;
  }

  if (!amount) {
    alert("Enter amount");
    return;
  }

  await createPayment({
    student_id: studentId,
    amount_paid: amount,
    remarks
  });

  setAmount("");
  setRemarks("");
  setOpen(false);

  loadPayments();
}

  function downloadReceipt(paymentId) {
    window.open(`/api/v1/fees/receipt/${paymentId}`);
  }

  return (
    <>
      <TopBar
        title="Payments"
        subTitle="Find all payments here"
        action={
          <div className="flex ">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button onClick={() => setOpen(true)}>Record Payment</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Record Payment</SheetTitle>
                </SheetHeader>

                <div className="space-y-4 mt-4">
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="border rounded p-2 w-full"
                  >
                    <option value="">Select Class</option>

                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="border rounded p-2 w-full"
                  >
                    <option value="">Select Section</option>
                    <option>A</option>
                    <option>B</option>
                    <option>C</option>
                  </select>
                  <select
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="border rounded p-2 w-full"
                  >
                    <option value="">Select Student</option>

                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name}
                      </option>
                    ))}
                  </select>

                  <Input
                    placeholder="Amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />

                  <Input
                    placeholder="Remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>

                <SheetFooter className="mt-6">
                  <Button onClick={handlePayment}>Submit Payment</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        }
      />
      <div className="">
        <h1 className="text-xl font-semibold mb-4">Fee Payments</h1>

        <div className="flex gap-3 mb-4">
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="border rounded p-2"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="border rounded p-2"
          >
            <option value="">All Sections</option>
            <option>A</option>
            <option>B</option>
            <option>C</option>
          </select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id}>
                <TableCell
                  className="cursor-pointer text-blue-600"
                  onClick={() => navigate(`/students/${row.student_id}`)}
                >
                  {row.first_name} {row.last_name}
                </TableCell>

                <TableCell>
                  {row.class_name} {row.section}
                </TableCell>

                <TableCell>₹{row.amount_paid}</TableCell>

                <TableCell>
                  {row.status === "approved" ? (
                    <Badge>Approved</Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </TableCell>

                <TableCell>
                  {new Date(row.created_at).toLocaleDateString()}
                </TableCell>

                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadReceipt(row.id)}
                  >
                    Download
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex gap-2 mt-4">
          <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Prev
          </Button>

          <Button onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>
    </>
  );
}

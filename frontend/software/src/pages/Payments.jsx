import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import DataTable from "../components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getClassStructure } from "../api/academic.api";
import { getStudents } from "../api/students.api";
import {
  createPayment,
  deletePayment,
  getPayments,
  getStudentFeeOptions,
  updatePayment,
} from "../api/fee.api";

const columns = [
  { header: "Student", accessor: "student_name" },
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

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

export default function Payments() {
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [feeOptions, setFeeOptions] = useState([]);
  const [payments, setPayments] = useState([]);

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");

  const [openCreate, setOpenCreate] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");

  const [createForm, setCreateForm] = useState({
    class_id: "",
    section_id: "",
    student_id: "",
    student_fee_id: "",
    amount_paid: "",
    remarks: "",
  });

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    loadPayments();
  }, [classId, sectionId]);

  useEffect(() => {
    if (!createForm.class_id || !createForm.section_id) {
      setStudents([]);
      return;
    }

    loadStudentsForCreate();
  }, [createForm.class_id, createForm.section_id]);

  useEffect(() => {
    if (!createForm.student_id) {
      setFeeOptions([]);
      return;
    }

    loadStudentFeesForCreate();
  }, [createForm.student_id]);

  async function loadClasses() {
    const res = await getClassStructure();
    setClasses(res?.data || []);
  }

  async function loadPayments() {
    const res = await getPayments({
      class_id: classId || undefined,
      section_id: sectionId || undefined,
    });
    const rows = res?.data || [];
    setPayments(
      rows.map((row) => ({
        ...row,
        medium: row.medium || "-",
        display_status: formatStatus(row.fee_status || row.status),
      }))
    );
  }

  async function loadStudentsForCreate() {
    const res = await getStudents({
      class_id: createForm.class_id,
      section_id: createForm.section_id,
    });
    const list = Array.isArray(res) ? res : (res?.data || []);
    setStudents(list);
  }

  async function loadStudentFeesForCreate() {
    try {
      const res = await getStudentFeeOptions(createForm.student_id);
      setFeeOptions(res?.data || []);
      setCreateError("");
    } catch (err) {
      setFeeOptions([]);
      setCreateError("Fee ledger is not available for this student. Check class fee structure.");
    }
  }

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
      setCreateError(err?.message || "Failed to create payment.");
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
    setOpenCreate(false);
    setCreateError("");
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
      setEditError(err?.message || "Failed to update payment.");
      return;
    }

    setEditingPayment(null);
    await loadPayments();
  }

  async function handleDeletePayment(row) {
    if (!confirm("Delete this payment?")) return;
    try {
      await deletePayment(row.id);
    } catch (err) {
      setEditError(err?.message || "Failed to delete payment.");
      return;
    }
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
      setEditError("Failed to download receipt.");
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${paymentId}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  const selectedClass = classes.find((c) => String(c.id) === String(classId));
  const sections = selectedClass?.sections || [];

  const createSelectedClass = classes.find(
    (c) => String(c.id) === String(createForm.class_id)
  );
  const createSections = createSelectedClass?.sections || [];
  const selectedFee = feeOptions.find(
    (f) => String(f.id) === String(createForm.student_fee_id)
  );

  return (
    <>
      <TopBar
        title="Payments"
        subTitle="Record and manage fee payments"
        action={
          <Sheet open={openCreate} onOpenChange={setOpenCreate}>
            <SheetTrigger asChild>
              <Button>Record Payment</Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto">
              <form onSubmit={handleCreatePayment} className="space-y-4">
                <SheetHeader>
                  <SheetTitle>Record Fee Payment</SheetTitle>
                </SheetHeader>

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
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        section_id: e.target.value,
                        student_id: "",
                        student_fee_id: "",
                      }))
                    }
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
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
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

                <SheetFooter>
                  <Button type="submit">Save</Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      <div className="mb-4 flex gap-3">
        <select
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

        <select
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

      <DataTable
        columns={columns}
        data={payments}
        onEdit={handleEditPayment}
        onDelete={handleDeletePayment}
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

      <Sheet open={!!editingPayment} onOpenChange={() => setEditingPayment(null)}>
        <SheetContent>
          <form onSubmit={handleUpdatePayment} className="space-y-4">
            <SheetHeader>
              <SheetTitle>Edit Payment</SheetTitle>
            </SheetHeader>

            <div className="grid gap-2">
              <Label>Amount Paid *</Label>
              <Input
                type="number"
                min="1"
                value={editingPayment?.amount_paid || ""}
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

            <SheetFooter>
              <Button type="submit">Update</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

import { useState, useEffect } from "react";
import TopBar from "../components/TopBar";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Book } from "lucide-react";

import { getClasses, getSessions } from "../api/academic.api";
import {
  createFeeStructure,
  getAllFeeStructure,
  createInstallment,
  updateFeeStructure,
  deleteFeeStructure,
  updateInstallment,
  deleteInstallment,
} from "../api/fee.api";

export default function Fees() {
  const [fees, setFees] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [feeSheetOpen, setFeeSheetOpen] = useState(false);
  const [installmentSheetOpen, setInstallmentSheetOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [admissionFee, setAdmissionFee] = useState("");
  const [structureId, setStructureId] = useState("");
  const [installmentName, setInstallmentName] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [feeError, setFeeError] = useState("");
  const [installmentError, setInstallmentError] = useState("");

  useEffect(() => {
    loadClasses();
    loadSessions();
    loadFees();
  }, []);

  async function loadClasses() {
    const res = await getClasses();
    const normalized = (res?.data || []).map((c) => ({
      ...c,
      sections: c.sections ? c.sections.split(",") : [],
    }));
    setClasses(normalized);
  }

  async function loadSessions() {
    const res = await getSessions();
    setSessions(res?.data || []);
  }

  async function loadFees() {
    const res = await getAllFeeStructure();
    const rows = res?.data || res || [];
    setFees(rows);
  }

  async function handleCreateFee(e) {
    e.preventDefault();
    setFeeError("");

    if (!classId || !sessionId || !admissionFee) {
      setFeeError("Class, session and admission fee are required.");
      return;
    }

    try {
      await createFeeStructure({
        class_id: Number(classId),
        session_id: Number(sessionId),
        admission_fee: Number(admissionFee),
      });
      await loadFees();
      setFeeSheetOpen(false);
      setClassId("");
      setSessionId("");
      setAdmissionFee("");
    } catch (err) {
      setFeeError(err?.message || "Failed to create fee structure.");
    }
  }

  async function handleCreateInstallment(e) {
    e.preventDefault();
    setInstallmentError("");

    if (!structureId || !installmentName || !installmentAmount) {
      setInstallmentError("Fee structure, installment name and amount are required.");
      return;
    }

    try {
      await createInstallment({
        fee_structure_id: Number(structureId),
        installment_name: installmentName,
        amount: Number(installmentAmount),
        due_date: dueDate || null,
      });

      await loadFees();
      setStructureId("");
      setInstallmentName("");
      setInstallmentAmount("");
      setDueDate("");
      setInstallmentSheetOpen(false);
    } catch (err) {
      setInstallmentError(err?.message || "Failed to create installment.");
    }
  }

  async function handleEditFee(fee) {
    setFeeError("");
    const nextAdmissionFee = prompt("Enter admission fee", String(fee.admission_fee ?? ""));
    if (nextAdmissionFee === null) return;

    const amount = Number(nextAdmissionFee);
    if (!amount || amount <= 0) {
      setFeeError("Admission fee must be a valid amount.");
      return;
    }

    try {
      await updateFeeStructure(fee.id, {
        class_id: fee.class_id,
        session_id: fee.session_id,
        admission_fee: amount,
      });
      await loadFees();
    } catch (err) {
      setFeeError(err?.message || "Failed to update fee structure.");
    }
  }

  async function handleDeleteFee(fee) {
    setFeeError("");
    if (!confirm(`Delete fee structure for ${fee.class_name} (${fee.session_name})?`)) return;

    try {
      await deleteFeeStructure(fee.id);
      await loadFees();
    } catch (err) {
      setFeeError(err?.message || "Failed to delete fee structure.");
    }
  }

  async function handleEditInstallment(inst) {
    setInstallmentError("");
    const nextName = prompt("Installment name", String(inst.installment_name ?? ""));
    if (nextName === null) return;

    const nextAmountRaw = prompt("Amount", String(inst.amount ?? ""));
    if (nextAmountRaw === null) return;

    const nextDueDate = prompt(
      "Due date (YYYY-MM-DD, optional)",
      inst.due_date ? String(inst.due_date).split("T")[0] : ""
    );
    if (nextDueDate === null) return;

    const nextAmount = Number(nextAmountRaw);
    if (!nextName.trim() || !nextAmount || nextAmount <= 0) {
      setInstallmentError("Installment name and valid amount are required.");
      return;
    }

    try {
      await updateInstallment(inst.id, {
        installment_name: nextName.trim(),
        amount: nextAmount,
        due_date: nextDueDate.trim() || null,
      });
      await loadFees();
    } catch (err) {
      setInstallmentError(err?.message || "Failed to update installment.");
    }
  }

  async function handleDeleteInstallment(inst) {
    setInstallmentError("");
    if (!confirm(`Delete installment '${inst.installment_name}'?`)) return;

    try {
      await deleteInstallment(inst.id);
      await loadFees();
    } catch (err) {
      setInstallmentError(err?.message || "Failed to delete installment.");
    }
  }

  return (
    <>
      <TopBar
        title="Fees"
        subTitle="Find all fee details here"
        action={
          <div className="flex gap-2">
            <Sheet open={feeSheetOpen} onOpenChange={setFeeSheetOpen}>
              <SheetTrigger asChild>
                <Button>Add Fee</Button>
              </SheetTrigger>

              <SheetContent>
                <form onSubmit={handleCreateFee} className="px-4">
                  <SheetHeader>
                    <SheetTitle>Fee Structure</SheetTitle>
                    <SheetDescription>
                      Create a fee structure for the selected class and session.
                    </SheetDescription>
                  </SheetHeader>

                  <div className="grid gap-3 mt-4">
                    <div>
                      <Label>Admission Fee *</Label>
                      <Input required value={admissionFee} onChange={(e) => setAdmissionFee(e.target.value)} />
                    </div>

                    <div>
                      <Label>Class *</Label>
                      <select
                        value={classId}
                        onChange={(e) => setClassId(e.target.value)}
                        className="w-full border p-2 rounded"
                      >
                        <option value="">Select Class</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label>Session *</Label>
                      <select
                        value={sessionId}
                        onChange={(e) => setSessionId(e.target.value)}
                        className="w-full border p-2 rounded"
                      >
                        <option value="">Select Session</option>
                        {sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {feeError && <p className="text-sm text-red-600">{feeError}</p>}

                  <SheetFooter className="mt-6">
                    <Button type="submit">Save</Button>
                  </SheetFooter>
                </form>
              </SheetContent>
            </Sheet>

            <Sheet open={installmentSheetOpen} onOpenChange={setInstallmentSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary">Add Installment</Button>
              </SheetTrigger>

              <SheetContent>
                <form onSubmit={handleCreateInstallment} className="space-y-4">
                  <SheetHeader>
                    <SheetTitle>Add Installment</SheetTitle>
                    <SheetDescription>
                      Add installment details for the selected fee structure.
                    </SheetDescription>
                  </SheetHeader>

                  <div>
                    <Label>Fee Structure *</Label>
                    <select
                      value={structureId}
                      onChange={(e) => setStructureId(e.target.value)}
                      className="w-full border p-2 rounded"
                    >
                      <option value="">Select Structure</option>
                      {fees.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.class_name} - {f.session_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label>Installment Name *</Label>
                    <Input required value={installmentName} onChange={(e) => setInstallmentName(e.target.value)} />
                  </div>

                  <div>
                    <Label>Amount *</Label>
                    <Input required value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} />
                  </div>

                  <div>
                    <Label>Due Date</Label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                  {installmentError && <p className="text-sm text-red-600">{installmentError}</p>}

                  <SheetFooter>
                    <Button type="submit">Save</Button>
                  </SheetFooter>
                </form>
              </SheetContent>
            </Sheet>
          </div>
        }
      />

      {(feeError || installmentError) && (
        <div className="mt-3 text-sm text-red-600">{feeError || installmentError}</div>
      )}

      <div className="grid grid-cols-3 gap-3 mt-6">
        {fees.map((fee) => (
          <Accordion key={fee.id} type="single" collapsible className="border p-2 rounded">
            <AccordionItem value={String(fee.id)}>
              <AccordionTrigger>
                <div className="flex gap-2 w-full">
                  <Book />

                  <div>
                    <p className="font-bold">Admission Fee Rs {fee.admission_fee}</p>
                    <p className="text-sm">{fee.class_name}</p>
                    <p className="text-xs">{fee.session_name}</p>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent>
                <div className="mb-3 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => handleEditFee(fee)}>
                    Edit Fee
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteFee(fee)}>
                    Delete Fee
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Installment</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {fee.installments?.map((inst) => (
                      <TableRow key={inst.id}>
                        <TableCell>{inst.installment_name}</TableCell>

                        <TableCell>
                          {inst.due_date ? String(inst.due_date).split("T")[0] : "-"}
                        </TableCell>

                        <TableCell className="text-right">Rs {inst.amount}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="secondary" onClick={() => handleEditInstallment(inst)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteInstallment(inst)}>
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ))}
      </div>
    </>
  );
}

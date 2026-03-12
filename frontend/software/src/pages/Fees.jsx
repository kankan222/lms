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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [deletingFee, setDeletingFee] = useState(null);
  const [deletingInstallment, setDeletingInstallment] = useState(null);
  const [editingFee, setEditingFee] = useState(null);
  const [editingInstallment, setEditingInstallment] = useState(null);
  const [classId, setClassId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [admissionFee, setAdmissionFee] = useState("");
  const [structureId, setStructureId] = useState("");
  const [installmentName, setInstallmentName] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [feeError, setFeeError] = useState("");
  const [installmentError, setInstallmentError] = useState("");
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    loadClasses();
    loadSessions();
    loadFees();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  function showNotice(title, message, variant = "success") {
    setNotice({ title, message, variant });
  }

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
      showNotice("Fee Created", "Fee structure created successfully.");
    } catch (err) {
      showNotice("Create Failed", err?.message || "Failed to create fee structure.", "error");
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
      showNotice("Installment Created", "Installment created successfully.");
    } catch (err) {
      showNotice("Create Failed", err?.message || "Failed to create installment.", "error");
      setInstallmentError(err?.message || "Failed to create installment.");
    }
  }

  async function handleEditFee(e) {
    e.preventDefault();
    if (!editingFee) return;
    setFeeError("");

    const amount = Number(editingFee.admission_fee);
    if (!amount || amount <= 0) {
      setFeeError("Admission fee must be a valid amount.");
      return;
    }

    try {
      await updateFeeStructure(editingFee.id, {
        class_id: editingFee.class_id,
        session_id: editingFee.session_id,
        admission_fee: amount,
      });
      await loadFees();
      setEditingFee(null);
      showNotice("Fee Updated", "Fee structure updated successfully.");
    } catch (err) {
      showNotice("Update Failed", err?.message || "Failed to update fee structure.", "error");
      setFeeError(err?.message || "Failed to update fee structure.");
    }
  }

  async function handleDeleteFee(fee) {
    setFeeError("");

    try {
      await deleteFeeStructure(fee.id);
      await loadFees();
      setDeletingFee(null);
      showNotice("Fee Deleted", "Fee structure deleted successfully.");
    } catch (err) {
      showNotice("Delete Failed", err?.message || "Failed to delete fee structure.", "error");
      setFeeError(err?.message || "Failed to delete fee structure.");
    }
  }

  async function handleEditInstallment(e) {
    e.preventDefault();
    if (!editingInstallment) return;
    setInstallmentError("");

    const nextAmount = Number(editingInstallment.amount);
    if (!String(editingInstallment.installment_name || "").trim() || !nextAmount || nextAmount <= 0) {
      setInstallmentError("Installment name and valid amount are required.");
      return;
    }

    try {
      await updateInstallment(editingInstallment.id, {
        installment_name: editingInstallment.installment_name.trim(),
        amount: nextAmount,
        due_date: String(editingInstallment.due_date || "").trim() || null,
      });
      await loadFees();
      setEditingInstallment(null);
      showNotice("Installment Updated", "Installment updated successfully.");
    } catch (err) {
      showNotice("Update Failed", err?.message || "Failed to update installment.", "error");
      setInstallmentError(err?.message || "Failed to update installment.");
    }
  }

  async function handleDeleteInstallment(inst) {
    setInstallmentError("");

    try {
      await deleteInstallment(inst.id);
      await loadFees();
      setDeletingInstallment(null);
      showNotice("Installment Deleted", "Installment deleted successfully.");
    } catch (err) {
      showNotice("Delete Failed", err?.message || "Failed to delete installment.", "error");
      setInstallmentError(err?.message || "Failed to delete installment.");
    }
  }

  return (
    <>
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
            </Alert>
          )}
        </div>
      </div>

      <TopBar
        title="Fees"
        subTitle="Find all fee details here"
        action={
          <div className="flex gap-2">
            <Dialog open={feeSheetOpen} onOpenChange={setFeeSheetOpen}>
              <DialogTrigger asChild>
                <Button>Add Fee</Button>
              </DialogTrigger>

              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <form onSubmit={handleCreateFee} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>Fee Structure</DialogTitle>
                    <DialogDescription>
                      Create a fee structure for the selected class and session.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-3">
                    <div className="grid gap-3">
                      <Label>Admission Fee *</Label>
                      <Input required value={admissionFee} onChange={(e) => setAdmissionFee(e.target.value)} />
                    </div>

                    <div className="grid gap-3">
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

                    <div className="grid gap-3">
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

                  <DialogFooter showCloseButton>
                    <Button type="submit">Save</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={installmentSheetOpen} onOpenChange={setInstallmentSheetOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">Add Installment</Button>
              </DialogTrigger>

              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <form onSubmit={handleCreateInstallment} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>Add Installment</DialogTitle>
                    <DialogDescription>
                      Add installment details for the selected fee structure.
                    </DialogDescription>
                  </DialogHeader>

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

                  <DialogFooter showCloseButton>
                    <Button type="submit">Save</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
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
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setEditingFee({
                        ...fee,
                        admission_fee: String(fee.admission_fee ?? ""),
                      })
                    }
                  >
                    Edit Fee
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setDeletingFee(fee)}>
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
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setEditingInstallment({
                                  ...inst,
                                  installment_name: String(inst.installment_name ?? ""),
                                  amount: String(inst.amount ?? ""),
                                  due_date: inst.due_date ? String(inst.due_date).split("T")[0] : "",
                                })
                              }
                            >
                              Edit
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setDeletingInstallment(inst)}>
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

      <AlertDialog
        open={!!deletingFee}
        onOpenChange={(open) => {
          if (!open) setDeletingFee(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete fee structure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingFee
                ? `This will delete the fee structure for ${deletingFee.class_name} (${deletingFee.session_name}).`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => handleDeleteFee(deletingFee)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!editingFee}
        onOpenChange={(open) => {
          if (!open) setEditingFee(null);
        }}
      >
        <DialogContent>
          <form onSubmit={handleEditFee} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit Fee</DialogTitle>
              <DialogDescription>
                Update the admission fee for the selected class and session.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Label>Admission Fee *</Label>
              <Input
                type="number"
                min="1"
                value={editingFee?.admission_fee || ""}
                onChange={(e) =>
                  setEditingFee((prev) => ({
                    ...prev,
                    admission_fee: e.target.value,
                  }))
                }
              />
            </div>
            {feeError && <p className="text-sm text-red-600">{feeError}</p>}

            <DialogFooter showCloseButton>
              <Button type="submit">Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingInstallment}
        onOpenChange={(open) => {
          if (!open) setEditingInstallment(null);
        }}
      >
        <DialogContent>
          <form onSubmit={handleEditInstallment} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit Installment</DialogTitle>
              <DialogDescription>
                Update the installment details for the selected fee structure.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Label>Installment Name *</Label>
              <Input
                value={editingInstallment?.installment_name || ""}
                onChange={(e) =>
                  setEditingInstallment((prev) => ({
                    ...prev,
                    installment_name: e.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                min="1"
                value={editingInstallment?.amount || ""}
                onChange={(e) =>
                  setEditingInstallment((prev) => ({
                    ...prev,
                    amount: e.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={editingInstallment?.due_date || ""}
                onChange={(e) =>
                  setEditingInstallment((prev) => ({
                    ...prev,
                    due_date: e.target.value,
                  }))
                }
              />
            </div>
            {installmentError && <p className="text-sm text-red-600">{installmentError}</p>}

            <DialogFooter showCloseButton>
              <Button type="submit">Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingInstallment}
        onOpenChange={(open) => {
          if (!open) setDeletingInstallment(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete installment?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingInstallment
                ? `This will delete the installment '${deletingInstallment.installment_name}'.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => handleDeleteInstallment(deletingInstallment)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

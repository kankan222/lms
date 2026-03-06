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
} from "@/components/ui/sheet";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Book } from "lucide-react";

import { getClasses } from "../api/academic.api";
import {
  createFeeStructure,
  getAllFeeStructure,
  createInstallment,
} from "../api/fee.api";

export default function Fees() {
  const [fees, setFees] = useState([]);
  const [classes, setClasses] = useState([]);
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [admissionFee, setAdmissionFee] = useState("");
  const [structureId, setStructureId] = useState("");
  const [installmentName, setInstallmentName] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  //   const selectedClass = classes.find(c => String(c.id) === classId);

  useEffect(() => {
    loadClasses();
    loadFees();
  }, []);

  async function loadClasses() {
    const res = await getClasses();

    const normalized = res.data.map((c) => ({
      ...c,
      sections: c.sections ? c.sections.split(",") : [],
    }));

    setClasses(normalized);
  }

  async function handleCreateFee(e) {
    e.preventDefault();
    if (!classId || !sessionId || !admissionFee) {
      alert("Class, session and admission fee required");
      return;
    }
    await createFeeStructure({
      class_id: classId,
      session_id: sessionId,
      admission_fee: admissionFee,
    });
    await loadFees();
    setOpen(false);
  }
  async function loadFees() {
    const res = await getAllFeeStructure();
    //     if (!res.data) {
    //     setFees([]);
    //     return;
    //   }
    console.log(res);
    setFees(res.data || res);
  }
  async function handleCreateInstallment(e) {
    e.preventDefault();

    if (!structureId || !installmentName || !installmentAmount) {
      alert("All fields required");
      return;
    }

    await createInstallment({
      fee_structure_id: structureId,
      installment_name: installmentName,
      amount: installmentAmount,
      due_date: dueDate,
    });

    await loadFees();

    setStructureId("");
    setInstallmentName("");
    setInstallmentAmount("");
    setDueDate("");
  }
  return (
    <>
      <TopBar
        title="Fees"
        subTitle="Find all fee details here"
        action={
          <div className="flex gap-2">
            {/* CREATE FEE STRUCTURE */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button onClick={() => setOpen(true)}>Add Fee</Button>
              </SheetTrigger>

              <SheetContent>
                <form onSubmit={handleCreateFee} className="px-4">
                  <SheetHeader>
                    <SheetTitle>Fee Structure</SheetTitle>
                  </SheetHeader>

                  <div className="grid gap-3 mt-4">
                    <div>
                      <Label>Admission Fee</Label>
                      <Input
                        value={admissionFee}
                        onChange={(e) => setAdmissionFee(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label>Class</Label>

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
                      <Label>Session</Label>

                      <select
                        value={sessionId}
                        onChange={(e) => setSessionId(e.target.value)}
                        className="w-full border p-2 rounded"
                      >
                        <option value="">Select Session</option>
                        <option value="1">2025-2026</option>
                      </select>
                    </div>
                  </div>

                  <SheetFooter className="mt-6">
                    <Button type="submit">Save</Button>
                  </SheetFooter>
                </form>
              </SheetContent>
            </Sheet>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary">Add Installment</Button>
              </SheetTrigger>

              <SheetContent>
                <form onSubmit={handleCreateInstallment} className="space-y-4">
                  <SheetHeader>
                    <SheetTitle>Add Installment</SheetTitle>
                  </SheetHeader>

                  <div>
                    <Label>Fee Structure</Label>

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
                    <Label>Installment Name</Label>
                    <Input
                      value={installmentName}
                      onChange={(e) => setInstallmentName(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Amount</Label>
                    <Input
                      value={installmentAmount}
                      onChange={(e) => setInstallmentAmount(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>

                  <SheetFooter>
                    <Button type="submit">Save</Button>
                  </SheetFooter>
                </form>
              </SheetContent>
            </Sheet>
          </div>
        }
      />

      {/* FEES LIST */}

      <div className="grid grid-cols-3 gap-3 mt-6">
        {fees.map((fee) => (
          <Accordion
            key={fee.id}
            type="single"
            collapsible
            className="border p-2 rounded"
          >
            <AccordionItem value={String(fee.id)}>
              <AccordionTrigger>
                <div className="flex gap-2 w-full">
                  <Book />

                  <div>
                    <p className="font-bold">
                      Admission Fee ₹{fee.admission_fee}
                    </p>

                    <p className="text-sm">{fee.class_name}</p>

                    <p className="text-xs">{fee.session_name}</p>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Installment</TableHead>
                      <TableHead>Due Date</TableHead>
                     
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {fee.installments?.map((inst) => (
                      <TableRow key={inst.id}>
                        <TableCell>{inst.installment_name}</TableCell>

                        <TableCell> {new Date(inst.due_date).toISOString().split("T")[0]}</TableCell>


                        <TableCell className="text-right">
                          ₹{inst.amount}
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

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function PaymentForm({ studentId }) {

  const [fees, setFees] = useState([]);
  const [categories, setCategories] = useState([]);

  const [studentFeeId, setStudentFeeId] = useState(null);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(null);
  const [remarks, setRemarks] = useState("");

  useEffect(() => {

    fetch(`/api/v1/fees/ledger/${studentId}`)
      .then(r => r.json())
      .then(setFees);

    fetch("/api/v1/fees/categories")
      .then(r => r.json())
      .then(setCategories);

  }, [studentId]);

  async function submitPayment() {

    await fetch("/api/fees/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_fee_id: studentFeeId,
        amount_paid: amount,
        category_id: category,
        remarks
      })
    });

    alert("Payment submitted");

  }

  return (

    <Card>

      <CardHeader>
        <CardTitle>Submit Payment</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">

        <Select onValueChange={setStudentFeeId}>
          <SelectTrigger>
            <SelectValue placeholder="Select Installment" />
          </SelectTrigger>

          <SelectContent>
            {fees.map(f => (
              <SelectItem key={f.id} value={String(f.id)}>
                {f.fee_type} - Remaining {f.remaining}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <Select onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>

          <SelectContent>
            {categories.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />

        <Button onClick={submitPayment}>
          Submit Payment
        </Button>

      </CardContent>

    </Card>

  );
}

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function FeeLedger({ studentId }) {

  const [fees, setFees] = useState([]);

  useEffect(() => {
    fetch(`/api/v1/fees/ledger/${studentId}`)
      .then(r => r.json())
      .then(setFees);
  }, [studentId]);

  return (

    <Card>
      <CardHeader>
        <CardTitle>Fee Ledger</CardTitle>
      </CardHeader>

      <CardContent>

        <Table>

          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Remaining</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>

            {fees.map(f => (
              <TableRow key={f.id}>
                <TableCell>{f.fee_type}</TableCell>
                <TableCell>{f.amount}</TableCell>
                <TableCell>{f.paid}</TableCell>
                <TableCell>{f.remaining}</TableCell>
              </TableRow>
            ))}

          </TableBody>

        </Table>

      </CardContent>
    </Card>

  );
}
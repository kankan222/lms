import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { getWebsiteContactSubmissions } from "../../api/website.api";
import { formatReadableDateTime } from "../../lib/dateTime";

export default function ContactSubmissionsSection() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSubmissions() {
    setLoading(true);
    setError("");
    try {
      const res = await getWebsiteContactSubmissions();
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(err?.message || "Failed to load contact submissions.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubmissions();
  }, []);

  return (
    <section className="mt-8 rounded-xl border bg-card p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold">Contact Submissions</p>
          <p className="text-sm text-muted-foreground">
            Review contact requests submitted from the website contact form.
          </p>
        </div>
        <Button variant="outline" onClick={loadSubmissions}>Refresh</Button>
      </div>

      {loading ? <p>Loading contact submissions...</p> : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Load Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!loading && !error && !rows.length ? (
        <p className="text-sm text-muted-foreground">No contact submissions found.</p>
      ) : null}

      {!loading && !error && rows.length ? (
        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.16em] [&_th]:text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Contact Number</th>
                  <th className="px-4 py-3 text-left font-medium">Message</th>
                  <th className="px-4 py-3 text-left font-medium">Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3">{row.contact_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.message || "No message provided."}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatReadableDateTime(row.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

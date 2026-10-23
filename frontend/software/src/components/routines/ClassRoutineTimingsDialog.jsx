import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { applyClassRoutineTimings, getTimeSlotTemplate, previewClassRoutineTimings } from "../../api/routines.api";

const DAYS = ["Every day", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground dark:bg-input/30";
const timeRange = (start, end) => `${String(start || "").slice(0, 5)} – ${String(end || "").slice(0, 5)}`;

export default function ClassRoutineTimingsDialog({ target, templates, onClose, onApplied }) {
  const [scope, setScope] = useState(target.routine_id ? "routine" : "template");
  const [templateId, setTemplateId] = useState(String(target.time_slot_template_id || ""));
  const [slots, setSlots] = useState([]);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let active = true;
    if (!templateId) return;
    getTimeSlotTemplate(templateId).then((response) => {
      if (active) setSlots(response.data?.slots || []);
    }).catch((err) => {
      if (active) setError(err.message || "Could not load template timings");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [templateId]);

  function changeTemplate(value) {
    setTemplateId(value);
    setSlots([]);
    setPreview(null);
    setError("");
    setLoading(Boolean(value));
  }

  function payload() {
    return {
      routine_id: target.routine_id,
      source_template_id: target.source_template_id || target.time_slot_template_id,
      time_slot_template_id: Number(templateId), scope,
      slots: slots.map((slot) => ({ weekday: slot.weekday, period_number: slot.period_number, start_time: slot.start_time, end_time: slot.end_time })),
    };
  }

  async function previewTimings(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const response = await previewClassRoutineTimings(payload());
      setPreview(response.data);
      setPage(0);
    } catch (err) {
      setError(err.message || "Could not preview timing changes");
    } finally {
      setBusy(false);
    }
  }

  async function applyTimings() {
    setBusy(true);
    setError("");
    try {
      const response = await applyClassRoutineTimings({ ...payload(), preview_token: preview.preview_token });
      await onApplied(response.data);
    } catch (err) {
      setError(err.message || "Could not apply timing changes");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || loading;
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Change Routine Timings</DialogTitle>
          <DialogDescription>
            Update all saved periods together. Preview the changes and teacher conflicts before applying. Published routines stay published.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={previewTimings} className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
            {error ? <Alert variant="destructive"><AlertTitle>Timing update failed</AlertTitle><AlertDescription className="whitespace-pre-line">{error}</AlertDescription></Alert> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="routine-timing-scope">Apply to</Label>
                <select id="routine-timing-scope" className={selectClass} value={scope} disabled={disabled || !target.routine_id} onChange={(event) => { setScope(event.target.value); setPreview(null); }}>
                  {target.routine_id ? <option value="routine">This routine only</option> : null}
                  <option value="template" disabled={!target.time_slot_template_id}>All draft/published routines using the original template</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="routine-timing-template">Use timings from</Label>
                <select id="routine-timing-template" required className={selectClass} value={templateId} disabled={disabled} onChange={(event) => changeTemplate(event.target.value)}>
                  <option value="">Select time-slot template</option>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              </div>
            </div>
            {loading ? <p className="text-sm text-muted-foreground">Loading timings…</p> : null}
            {slots.length ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">You can adjust these times. Edited timings are saved as a separate template for the selected routines. Add or remove periods in Time Slots first.</p>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left"><tr><th className="p-2">Day / period</th><th className="p-2">Start</th><th className="p-2">End</th></tr></thead>
                    <tbody>{slots.map((slot, index) => (
                      <tr key={slot.id} className="border-t border-border">
                        <td className="p-2">{DAYS[Number(slot.weekday || 0)]} · {slot.label || `Period ${slot.period_number}`}</td>
                        {["start_time", "end_time"].map((field) => <td key={field} className="p-2"><Input type="time" step="1" required disabled={disabled} aria-label={`${DAYS[Number(slot.weekday || 0)]} period ${slot.period_number} ${field === "start_time" ? "start" : "end"}`} value={String(slot[field] || "").slice(0, 8)} onChange={(event) => { setSlots((current) => current.map((item, i) => i === index ? { ...item, [field]: event.target.value } : item)); setPreview(null); }} /></td>)}
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ) : null}
            {preview ? (
              <div className="space-y-3" aria-live="polite">
                <p className="text-sm font-semibold">{preview.routines.length} routine(s) · {preview.changed_count} saved entries with changed times</p>
                <ul className="space-y-1 text-xs text-muted-foreground">{preview.routines.map((routine) => <li key={routine.id}>{routine.label} · {routine.status}</li>)}</ul>
                {[...preview.errors, ...preview.conflicts].length ? (
                  <Alert variant="destructive"><AlertTitle>Resolve these issues before applying</AlertTitle><AlertDescription><ul className="list-disc space-y-1 pl-4">{[...preview.errors, ...preview.conflicts].map((message, index) => <li key={index}>{message}</li>)}</ul></AlertDescription></Alert>
                ) : !preview.can_apply ? <p className="text-sm text-muted-foreground">These routines already use the selected timings.</p> : <p className="text-sm text-muted-foreground">No teacher conflicts found. Subjects, teachers, and section targeting will be preserved.</p>}
                {preview.changes.length ? (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/40"><tr><th className="p-2">Routine / slot</th><th className="p-2">Previous time</th><th className="p-2">New time</th></tr></thead>
                      <tbody>{preview.changes.slice(page * 50, (page + 1) * 50).map((change) => <tr key={change.entry_id} className="border-t border-border"><td className="p-2"><div>{change.routine_label}</div><div className="text-muted-foreground">{change.weekday_label} · Period {change.period_number} · {change.title}</div></td><td className="whitespace-nowrap p-2">{timeRange(change.old_start_time, change.old_end_time)}</td><td className={`whitespace-nowrap p-2 ${change.changed ? "font-semibold" : "text-muted-foreground"}`}>{timeRange(change.start_time, change.end_time)}</td></tr>)}</tbody>
                    </table>
                  </div>
                ) : null}
                {preview.changes.length > 50 ? <div className="flex items-center justify-end gap-2 text-xs"><Button type="button" size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page + 1} of {Math.ceil(preview.changes.length / 50)}</span><Button type="button" size="sm" variant="outline" disabled={(page + 1) * 50 >= preview.changes.length} onClick={() => setPage(page + 1)}>Next</Button></div> : null}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="outline" disabled={disabled || !slots.length}>{busy ? "Checking…" : "Preview Changes"}</Button>
            <Button type="button" disabled={disabled || !preview?.can_apply} onClick={applyTimings}>{busy ? "Working…" : "Apply Changes"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

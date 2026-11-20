"use client";

// JJQR - AI (Nov 20, 2026) - PV-14: admin queue of patients' correction / deletion requests. A deletion can't be completed before its 7-year retention date (the server refuses).
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormAlert } from "@/components/ui/FormAlert";
import { friendlyError } from "@/lib/api/friendly-error";
import { formatClinicDate } from "@/lib/format";
import { queryAllDataRequests, resolveDataRequest, type DataRequestRow, type DataRequestStatus } from "@/lib/data/privacy";

export function DataRequestsPanel() {
  const [rows, setRows] = useState<DataRequestRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let off = false;
    queryAllDataRequests().then((r) => { if (!off) { setRows(r); setFailed(false); } }).catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
  }, [tick]);

  async function act(r: DataRequestRow, status: DataRequestStatus) {
    const note = status === "Rejected" ? window.prompt("Tell the patient why (shown to them):") ?? "" : undefined;
    if (status === "Rejected" && !note?.trim()) return;
    setBusy(r.id + status); setError("");
    try { await resolveDataRequest(r.id, status, note); setTick((t) => t + 1); }
    catch (e) { setError(friendlyError(e, "The request could not be updated. Try again.")); }
    setBusy("");
  }

  return (
    <section aria-labelledby="requests-h" className="space-y-md rounded-lg border border-outline-variant p-md">
      <h2 id="requests-h" className="text-headline-sm text-on-surface">Patient data requests</h2>
      <p className="text-label-md text-on-surface-variant">Correction and deletion requests from patients. Medical records are kept 7 years after the last visit, so a deletion stays Scheduled until then.</p>
      {error && <FormAlert>{error}</FormAlert>}
      {failed ? <FormAlert>The requests could not be loaded.</FormAlert>
        : rows === null ? <p className="text-body-md text-on-surface-variant" role="status">Loading…</p>
        : rows.length === 0 ? <p className="text-body-md text-on-surface-variant">No requests yet.</p>
        : (
          <ul className="divide-y divide-outline-variant">
            {rows.map((r) => (
              <li key={r.id} className="space-y-xs py-sm">
                <p className="text-body-md text-on-surface">
                  <span className="font-medium">{r.patient_name}</span> <span className="font-mono text-body-sm text-on-surface-variant">{r.patient_code}</span> · {r.kind} · <span>{r.status}</span>
                </p>
                <p className="text-label-md tabular-nums text-on-surface-variant">
                  Requested {formatClinicDate(r.requested_at)}{r.retain_until ? ` · cannot be deleted before ${formatClinicDate(r.retain_until)}` : ""}
                </p>
                <p className="whitespace-pre-line text-body-md text-on-surface">{r.details}</p>
                {r.resolution_note && <p className="text-label-md text-on-surface-variant">Note: {r.resolution_note}</p>}
                {(r.status === "Pending" || r.status === "Scheduled") && (
                  <div className="flex flex-wrap gap-sm">
                    {r.status === "Pending" && r.kind === "Deletion" && <Button variant="secondary" loading={busy === r.id + "Scheduled"} onClick={() => act(r, "Scheduled")}>Schedule</Button>}
                    <Button variant="secondary" loading={busy === r.id + "Completed"} onClick={() => act(r, "Completed")}>Mark done</Button>
                    <Button variant="ghost" loading={busy === r.id + "Rejected"} onClick={() => act(r, "Rejected")}>Reject…</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
// JJQR - END

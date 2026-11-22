"use client";

//JJQR - AI (Nov 22, 2026) - offline-mode plan step 4.5 (D4): the manual merge screen. Two records side by side; the admin picks which one to KEEP, reads what will happen, writes a note and confirms. Nothing merges by itself.
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormAlert } from "@/components/ui/FormAlert";
import { inputStyles } from "@/components/ui/fieldStyles";
import { ApiError } from "@/lib/api/client";
import { mergePatients, previewMerge, type MergePreview } from "@/lib/data/syncReview";
import { compareRows, countsText, fullName, mergeSummary, noteProblem, problemMessage } from "@/lib/sync-review";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** The two patients of the duplicate item (a = the one that arrived, b = the one already on file). */
  patientIds: [string, string] | null;
  onMerged: () => void;
}

export function MergePatientsModal({ isOpen, onClose, patientIds, onMerged }: Props) {
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [keepFirst, setKeepFirst] = useState(false); // false: keep the one already on file (the second id)
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !patientIds) return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) { setPreview(null); setError(null); setNote(""); setKeepFirst(false); setLoading(true); } });
    previewMerge(patientIds[1], patientIds[0])
      .then((p) => { if (!cancelled) setPreview(p); })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? problemMessage(e.body, "These patients could not be loaded.") : "These patients could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, patientIds]);

  // `left` is always the record already on file, `right` the one that arrived; the radio picks which is kept
  const left = preview?.keep ?? null;
  const right = preview?.merge ?? null;
  const keep = keepFirst ? right : left;
  const gone = keepFirst ? left : right;
  const rows = useMemo(() => (left && right ? compareRows(left as unknown as Record<string, unknown>, right as unknown as Record<string, unknown>) : []), [left, right]);
  const noteError = note.length > 0 ? noteProblem(note) : null;
  const blocked = preview?.both_have_accounts === true;

  async function confirm() {
    if (!keep || !gone) return;
    const problem = noteProblem(note);
    if (problem) { setError(problem); return; }
    setBusy(true); setError(null);
    try {
      await mergePatients(keep.patient_id, gone.patient_id, note);
      onMerged();
    } catch (e) {
      setError(e instanceof ApiError ? problemMessage(e.body, "The merge could not be completed. Nothing was changed.") : "The merge could not be completed. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title="Merge two patients"
      size="xl"
      footer={
        <div className="flex justify-end gap-sm">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={confirm} loading={busy} disabled={!preview || blocked || noteProblem(note) !== null}>Merge patients</Button>
        </div>
      }
    >
      <div className="space-y-md">
        {loading && <p className="text-body-md text-on-surface-variant" aria-live="polite">Loading both records…</p>}
        {error && <FormAlert tone="danger">{error}</FormAlert>}
        {blocked && <FormAlert tone="danger">Both patients have a patient-portal account, so they cannot be merged here.</FormAlert>}
        {preview && left && right && keep && gone && (
          <>
            <p className="text-body-md text-on-surface-variant">
              Choose the record to <strong className="text-on-surface">keep</strong>. Everything recorded for the other one moves to it. Rows that differ are highlighted.
            </p>
            <div className="overflow-x-auto rounded-lg border border-outline-variant">
              <table className="w-full min-w-[34rem] text-left text-body-md">
                <thead className="bg-surface-container-low">
                  <tr>
                    <th scope="col" className="px-md py-sm text-label-md text-on-surface-variant">Field</th>
                    {[{ card: left, isKeep: !keepFirst, set: () => setKeepFirst(false), tag: "Already on file" }, { card: right, isKeep: keepFirst, set: () => setKeepFirst(true), tag: "Arrived from a computer" }].map((c) => (
                      <th key={c.card.patient_id} scope="col" className="px-md py-sm align-top">
                        <label className="flex cursor-pointer items-start gap-sm">
                          <input type="radio" name="keep" checked={c.isKeep} onChange={c.set} className="mt-1" aria-label={`Keep ${fullName(c.card)}`} />
                          <span>
                            <span className="block text-label-md text-on-surface-variant">{c.tag}</span>
                            <span className="block text-body-md font-medium text-on-surface">{c.isKeep ? "KEEP this one" : "Merge into the other"}</span>
                          </span>
                        </label>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label} className={r.differs ? "bg-status-warning-surface/40" : ""}>
                      <th scope="row" className="px-md py-xs text-label-md font-normal text-on-surface-variant">{r.label}</th>
                      <td className="px-md py-xs text-on-surface">{r.a}</td>
                      <td className="px-md py-xs text-on-surface">{r.b}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className="px-md py-xs align-top text-label-md font-normal text-on-surface-variant">Records held</th>
                    <td className="px-md py-xs text-on-surface">{countsText(left.counts)}</td>
                    <td className="px-md py-xs text-on-surface">{countsText(right.counts)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="rounded-lg border border-status-warning-border bg-status-warning-surface p-md text-body-md text-on-surface" role="note">
              {mergeSummary(fullName(keep), keep.patient_code, fullName(gone), gone.patient_code, gone.counts)}
            </div>
            <label className="block space-y-xs">
              <span className="text-label-md text-on-surface-variant">Note (required, kept in the audit log)</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} className={inputStyles()} placeholder="Why these are the same person" />
              {noteError && <span className="text-label-md text-status-danger">{noteError}</span>}
            </label>
          </>
        )}
      </div>
    </Modal>
  );
}
//JJQR - END

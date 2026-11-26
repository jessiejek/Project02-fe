//JJQR - AI (2026-11-26) - GAV-12: on a merged-away (retired) chart: "This record was merged into MF-… (name)" + "Open kept chart". Admin also gets a light Unmerge
// (the record comes back; its visits stay on the kept patient and are moved back one by one with "Wrong patient?"). Renders nothing for a live patient.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { FormAlert } from "@/components/ui/FormAlert";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { ApiError } from "@/lib/api/client";
import { getMergedInto, unmergePatient } from "@/lib/data/mergePatient";
import { mergedBannerText, type MergedInto } from "@/lib/merge-patient";
import { noteProblem, problemMessage } from "@/lib/sync-review";

export function MergedIntoBanner({ patientId, mergedIntoId, chartHref, canUnmerge = false, onUnmerged }: {
  patientId: string;
  /** merged_into_patient_id from the patient row; nothing is fetched when it is empty */
  mergedIntoId: string | null | undefined;
  chartHref: (id: string) => string;
  canUnmerge?: boolean;
  onUnmerged?: () => void;
}) {
  const [info, setInfo] = useState<MergedInto | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!mergedIntoId) return;
    let cancelled = false;
    getMergedInto(patientId).then((m) => { if (!cancelled) setInfo(m); }).catch(() => { if (!cancelled) setInfo({ patient_id: patientId, patient_code: "", merged_into_patient_id: mergedIntoId }); });
    return () => { cancelled = true; };
  }, [patientId, mergedIntoId]);

  const text = mergedBannerText(info);
  if (!mergedIntoId || !text || !info?.merged_into_patient_id) return null;

  async function unmerge() {
    const p = noteProblem(note);
    if (p) { setError(p); return; }
    setBusy(true); setError("");
    try { await unmergePatient(patientId, note); setOpen(false); onUnmerged?.(); }
    catch (e) { setError(e instanceof ApiError ? problemMessage(e.body, "Could not unmerge. Nothing was changed.") : "Could not unmerge. Nothing was changed."); }
    finally { setBusy(false); }
  }

  return (
    <div role="alert" data-testid="merged-banner" className="flex flex-wrap items-center justify-between gap-sm rounded-[8px] border border-[#e2b44a] bg-[#fff7e0] p-md text-body-md text-[#5b4300]">
      <span className="flex items-start gap-sm"><Icon name="merge" className="mt-[2px] text-[18px]" aria-hidden />{text}</span>
      <span className="flex flex-wrap gap-sm">
        <Link href={chartHref(info.merged_into_patient_id)} className="inline-flex min-h-9 items-center rounded-[6px] bg-primary px-md text-label-md font-medium text-on-primary hover:opacity-90">
          Open {info.merged_into_patient_code ?? "kept"} chart
        </Link>
        {canUnmerge && <Button variant="secondary" className="min-h-9 px-sm py-xs text-label-md" onClick={() => { setNote(""); setError(""); setOpen(true); }}>Unmerge…</Button>}
      </span>
      {canUnmerge && (
        <Modal isOpen={open} onClose={() => { if (!busy) setOpen(false); }} title="Unmerge this record"
          footer={<>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={unmerge} loading={busy}>Unmerge</Button>
          </>}>
          <div className="space-y-sm text-body-md text-on-surface">
            <p>{info.patient_code} comes back as its own patient (searchable, editable). Its visits <strong>stay</strong> on {info.merged_into_patient_code}; move the wrong ones back one by one with &quot;Wrong patient?&quot;.</p>
            {error && <FormAlert>{error}</FormAlert>}
            <label htmlFor="um-note" className={labelStyles}>Why? (kept in the audit log)</label>
            <textarea id="um-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputStyles()} placeholder="e.g. Different people, merged by mistake" />
          </div>
        </Modal>
      )}
    </div>
  );
}
//JJQR - END

//JJQR - AI (2026-11-26) - GAV-12: owner (t118u): "the doctor noticed, oh, I remember you, I had a consult with you, so the doctor will click MERGE TO EXISTING ACCOUNT".
// Opened from "Merge to existing patient" (consultation header, right after "Wrong patient?") and "Merge…" (patient chart, next to Edit details).
// Search the EXISTING (older) record -> side-by-side compare (rows that differ highlighted; the picked record is KEPT, its details win, blanks are filled)
// -> note -> Confirm. An open visit today is a warning, never a stop. Both records with a portal account = refused. After: Done (the caller reloads).
"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormAlert } from "@/components/ui/FormAlert";
import { Icon } from "@/components/ui/Icon";
import { inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { ApiError } from "@/lib/api/client";
import { queryPatientsPaged, type PatientRow } from "@/lib/data/patients";
import { mergeIntoExisting, previewMergeToExisting } from "@/lib/data/mergePatient";
import { compareRows, countsText, fullName, problemMessage } from "@/lib/sync-review";
import { activeVisitWarning, mergeDoneText, mergeProblem, mergeToExistingSummary, type MergeResult, type MergeToExistingPreview } from "@/lib/merge-patient";

export interface MergePatientDialogProps {
  isOpen: boolean;
  /** The record being looked at (the newer duplicate). It merges INTO the patient picked here. */
  currentPatientId: string;
  currentLabel: string;
  onClose: () => void;
  onMerged: (r: MergeResult) => void;
}

export function MergePatientDialog(props: MergePatientDialogProps) {
  // mounted only while open: every opening starts clean
  return props.isOpen ? <MergePatientDialogBody {...props} /> : null;
}

function MergePatientDialogBody({ isOpen, currentPatientId, currentLabel, onClose, onMerged }: MergePatientDialogProps) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [target, setTarget] = useState<PatientRow | null>(null);
  const [preview, setPreview] = useState<MergeToExistingPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<MergeResult | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (target || term.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setSearching(true);
      queryPatientsPaged(null, { q: term, pageSize: 8 })
        .then((r) => { if (!cancelled) setResults((r.items ?? []).filter((p) => p.patient_id !== currentPatientId)); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, target, currentPatientId]);
  const shownResults = q.trim().length >= 2 ? results : [];

  function choose(p: PatientRow | null) {
    setTarget(p); setPreview(null); setError("");
    if (!p) return;
    setLoadingPreview(true);
    previewMergeToExisting(p.patient_id, currentPatientId)
      .then(setPreview)
      .catch((e) => setError(e instanceof ApiError && e.status === 403 ? "Only the doctor or an admin can merge patients." : e instanceof ApiError ? problemMessage(e.body, "These records could not be loaded.") : "These records could not be loaded."))
      .finally(() => setLoadingPreview(false));
  }

  const rows = useMemo(() => {
    if (!preview) return [];
    const base = compareRows(preview.keep as unknown as Record<string, unknown>, preview.merge as unknown as Record<string, unknown>);
    const more = compareRows(
      { patient_code: preview.keep.civil_status, first_name: preview.keep.blood_type, middle_name: preview.keep.philhealth_number, last_name: preview.keep.hmo_provider },
      { patient_code: preview.merge.civil_status, first_name: preview.merge.blood_type, middle_name: preview.merge.philhealth_number, last_name: preview.merge.hmo_provider },
    ).slice(0, 4).map((r, i) => ({ ...r, label: ["Civil status", "Blood type", "PhilHealth no.", "HMO"][i] }));
    return [...base, ...more];
  }, [preview]);
  const warning = preview ? activeVisitWarning(preview) : null;
  const problem = mergeProblem({ currentPatientId, targetId: target?.patient_id ?? null, note, bothHaveAccounts: preview?.both_have_accounts });
  const close = () => { if (!saving) onClose(); };

  async function confirm() {
    if (!preview || problem) { if (problem) setError(problem); return; }
    setSaving(true); setError("");
    try {
      setDone(await mergeIntoExisting(preview.keep.patient_id, preview.merge.patient_id, note));
    } catch (e) {
      setError(e instanceof ApiError ? problemMessage(e.body, "The merge could not be completed. Nothing was changed.") : "The merge could not be completed. Nothing was changed.");
    } finally {
      setSaving(false);
    }
  }

  if (done && preview) {
    return (
      <Modal isOpen={isOpen} onClose={() => onMerged(done)} title="Patients merged"
        footer={<Button onClick={() => onMerged(done)} data-testid="mp-done">Done</Button>}>
        <div role="status" className="space-y-sm text-body-md text-on-surface">
          <p className="flex items-start gap-sm"><Icon name="check_circle" className="mt-[2px] text-[18px] text-primary" aria-hidden />
            <span>{mergeDoneText(done, fullName(preview.keep), fullName(preview.merge))}</span></p>
          <p className="text-on-surface-variant">One chart now holds both records&apos; visits. {fullName(preview.merge)} is hidden from the lists; an old link shows where it went.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={close} title="Merge to existing patient" size="xl"
      footer={<>
        <Button variant="secondary" onClick={close} disabled={saving}>Cancel</Button>
        <Button onClick={confirm} loading={saving} disabled={!preview || problem !== null} data-testid="mp-confirm">{saving ? "Merging…" : "Confirm merge"}</Button>
      </>}>
      <div className="space-y-md">
        <div className="rounded-[8px] border border-outline-variant bg-surface-container-low p-md text-body-md text-on-surface">
          <p>You are looking at <strong>{currentLabel}</strong>.</p>
          <p className="mt-xs text-on-surface-variant">If this person was already registered before, pick that existing record. It is kept; everything recorded here moves to it.</p>
        </div>
        {error && <FormAlert>{error}</FormAlert>}

        <div className="space-y-sm">
          <label htmlFor="mp-search" className={labelStyles}>Existing patient: search by name or patient code</label>
          <input id="mp-search" value={q} onChange={(e) => { setQ(e.target.value); if (target) choose(null); }} placeholder="e.g. Rubi or MF-100123" className={inputStyles()} autoComplete="off" />
          {searching && <p role="status" className="text-body-sm text-on-surface-variant">Searching…</p>}
          {!target && shownResults.length > 0 && (
            <ul className="max-h-56 divide-y divide-outline-variant overflow-auto rounded-[8px] border border-outline-variant" aria-label="Matching patients">
              {shownResults.map((p) => (
                <li key={p.patient_id}>
                  <button type="button" onClick={() => choose(p)} className="flex w-full items-center justify-between gap-sm px-md py-sm text-left text-body-md hover:bg-surface-container">
                    <span><strong>{p.first_name} {p.last_name}</strong> · {p.patient_code}</span>
                    <span className="text-body-sm text-on-surface-variant">born {p.date_of_birth} · since {String(p.created_at).slice(0, 10)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!target && q.trim().length >= 2 && !searching && shownResults.length === 0 && <p className="text-body-sm text-on-surface-variant">No other patient matches. Try another spelling.</p>}
          {target && (
            <div className="flex flex-wrap items-center justify-between gap-sm rounded-[8px] border border-primary bg-primary/5 px-md py-sm text-body-md" data-testid="mp-target">
              <span>Keep <strong>{target.first_name} {target.last_name}</strong> · {target.patient_code} · born {target.date_of_birth}</span>
              <Button variant="secondary" className="min-h-9 px-sm py-xs text-label-md" onClick={() => { setQ(""); choose(null); }}>Change</Button>
            </div>
          )}
        </div>

        {loadingPreview && <p role="status" className="text-body-md text-on-surface-variant">Loading both records…</p>}
        {preview && (
          <>
            {preview.both_have_accounts && <FormAlert>Both patients have a patient-portal account, so they cannot be merged here.</FormAlert>}
            {warning && (
              <p role="alert" className="flex items-start gap-sm rounded-[8px] border border-[#e2b44a] bg-[#fff7e0] p-sm text-body-sm text-[#5b4300]">
                <Icon name="warning" className="mt-[1px] text-[16px]" aria-hidden />{warning}
              </p>
            )}
            <div className="overflow-x-auto rounded-lg border border-outline-variant" data-testid="mp-compare">
              <table className="w-full min-w-[34rem] text-left text-body-md">
                <thead className="bg-surface-container-low">
                  <tr>
                    <th scope="col" className="px-md py-sm text-label-md text-on-surface-variant">Field</th>
                    <th scope="col" className="px-md py-sm align-top"><span className="block text-label-md text-on-surface-variant">Existing record (picked)</span><span className="block font-medium text-primary">KEEP</span></th>
                    <th scope="col" className="px-md py-sm align-top"><span className="block text-label-md text-on-surface-variant">This record</span><span className="block font-medium text-on-surface">Merges into the kept one</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label} className={r.differs ? "bg-status-warning-surface/40" : ""}>
                      <th scope="row" className="px-md py-xs text-label-md font-normal text-on-surface-variant">{r.label}</th>
                      <td className="px-md py-xs text-on-surface">{r.a}</td>
                      <td className="px-md py-xs text-on-surface">{r.b}{r.differs && r.a === "—" ? <span className="ml-xs text-label-sm text-primary">fills the blank</span> : null}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className="px-md py-xs text-label-md font-normal text-on-surface-variant">Registered</th>
                    <td className="px-md py-xs text-on-surface">{String(preview.keep.created_at).slice(0, 10)}</td>
                    <td className="px-md py-xs text-on-surface">{String(preview.merge.created_at).slice(0, 10)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-md py-xs align-top text-label-md font-normal text-on-surface-variant">Records held</th>
                    <td className="px-md py-xs text-on-surface">{countsText(preview.keep.counts)}</td>
                    <td className="px-md py-xs text-on-surface">{countsText(preview.merge.counts)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="rounded-lg border border-status-warning-border bg-status-warning-surface p-md text-body-md text-on-surface" role="note" data-testid="mp-summary">
              {mergeToExistingSummary(preview)}
            </div>
            <div className="space-y-xs">
              <label htmlFor="mp-note" className={labelStyles}>Note (kept in the audit log)</label>
              <textarea id="mp-note" rows={2} maxLength={1000} value={note} onChange={(e) => { setNote(e.target.value); setError(""); }} placeholder="e.g. Same person; front desk registered him again on Nov 25" className={inputStyles()} />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
//JJQR - END

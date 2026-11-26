//JJQR - AI (2026-11-26) - GAV-11: owner: staff tagged a different person as an existing patient; the doctor marks it "different" and carries this visit
// over. Opened from "Wrong patient?" right after "Edit details" in the consultation header. New patient (details) or Existing patient (search), the
// allergies recorded in this visit (ticked = move, the default), a reason, Confirm. A same-day visit of the chosen person and a name+birthday match
// are warnings first ("Move anyway"). After the move: "Reprint slip" (no automatic reprint) and Done (the page reloads as the right patient).
"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { FormAlert } from "@/components/ui/FormAlert";
import { Icon } from "@/components/ui/Icon";
import { inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { cn } from "@/lib/cn";
import { todayManila } from "@/lib/clock";
import { ApiError } from "@/lib/api/client";
import { printHtml, escapeHtml } from "@/lib/print";
import { queryPatientsPaged, type PatientRow } from "@/lib/data/patients";
import { getReassignPreview, reassignVisit } from "@/lib/data/reassign";
import { ageOn, displayName, type PatientEditForm } from "@/lib/patient-edit";
import {
  EMPTY_NEW_PATIENT, defaultAllergyIds, movesSummary, reassignBody, slipHtml, warningFrom, wrongPatientProblem,
  type ReassignPreview, type ReassignResult, type ReassignWarning, type WrongPatientMode,
} from "@/lib/wrong-patient";

export interface WrongPatientDialogProps {
  isOpen: boolean;
  bookingId: string;
  onClose: () => void;
  /** After a successful move, when the doctor taps Done. */
  onMoved: (r: ReassignResult) => void;
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`);

export function WrongPatientDialog(props: WrongPatientDialogProps) {
  // mounted only while open, so every opening starts clean (new patient id, empty form, fresh preview)
  return props.isOpen ? <WrongPatientDialogBody {...props} /> : null;
}

function WrongPatientDialogBody({ isOpen, bookingId, onClose, onMoved }: WrongPatientDialogProps) {
  const [preview, setPreview] = useState<ReassignPreview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<WrongPatientMode>("new");
  const [form, setForm] = useState<PatientEditForm>(EMPTY_NEW_PATIENT);
  const [newPatientId] = useState(newId);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [target, setTarget] = useState<PatientRow | null>(null);
  const [targetSameDay, setTargetSameDay] = useState<string[] | null>(null);
  const [allergyIds, setAllergyIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState<ReassignWarning | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ result: ReassignResult; name: string } | null>(null);
  const today = todayManila();

  useEffect(() => {
    let cancelled = false;
    getReassignPreview(bookingId)
      .then((p) => { if (!cancelled) { setPreview(p); setAllergyIds(defaultAllergyIds(p.allergies)); } })
      .catch((e) => { if (!cancelled) setLoadError(e instanceof ApiError && e.status === 403 ? "Only the doctor of this visit or an admin can move it." : "This visit could not be loaded. Nothing has changed; close and try again."); });
    return () => { cancelled = true; };
  }, [bookingId]);

  // search as the doctor types (existing patient)
  useEffect(() => {
    const term = q.trim();
    if (mode !== "existing" || term.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setSearching(true);
      queryPatientsPaged(null, { q: term, pageSize: 8 })
        .then((r) => { if (!cancelled) setResults((r.items ?? []).filter((p) => p.patient_id !== preview?.patient.patient_id)); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, mode, preview?.patient.patient_id]);
  const shownResults = q.trim().length >= 2 ? results : [];

  // choosing a person who already has a visit that day warns right away (owner: allowed, but warn first)
  function chooseTarget(p: PatientRow | null) {
    setTarget(p); setTargetSameDay(null); setWarning(null);
    if (!p) return;
    getReassignPreview(bookingId, p.patient_id)
      .then((r) => setTargetSameDay(r.target?.has_visit_that_day ? r.target.visits_that_day.map((v) => v.queue_number ?? "").filter(Boolean) : []))
      .catch(() => setTargetSameDay(null));
  }

  const set = <K extends keyof PatientEditForm>(k: K, v: PatientEditForm[K]) => { setForm((f) => ({ ...f, [k]: v })); setWarning(null); setError(""); };
  const age = ageOn(form.dateOfBirth, today);
  const current = preview ? `${preview.patient.first_name} ${preview.patient.last_name}`.trim() : "";
  const summary = useMemo(() => (preview ? movesSummary(preview) : ""), [preview]);
  const close = () => { if (!saving) onClose(); };

  async function confirm(ack: { sameDay?: boolean; duplicate?: boolean } = {}) {
    if (!preview) return;
    const problem = wrongPatientProblem({ mode, form, targetId: target?.patient_id ?? null, currentPatientId: preview.patient.patient_id, reason }, today);
    if (problem) { setError(problem); return; }
    setSaving(true); setError("");
    try {
      const result = await reassignVisit(bookingId, reassignBody({
        mode, form, newPatientId, targetId: target?.patient_id ?? null, reason, allergyIds,
        // the same-day warning already shown under the chosen patient counts as "warned first"
        ackSameDay: ack.sameDay ?? (targetSameDay?.length ?? 0) > 0,
        ackDuplicate: ack.duplicate,
      }));
      setWarning(null);
      setDone({ result, name: mode === "new" ? displayName(form) : `${target?.first_name ?? ""} ${target?.last_name ?? ""}`.trim() });
    } catch (e) {
      const w = e instanceof ApiError ? warningFrom(e.status, e.body) : null;
      if (w) setWarning(w);
      else setError(e instanceof Error && e.message && !/^API \d+$/.test(e.message) ? e.message : "The visit could not be moved. Nothing has changed; try again.");
    } finally {
      setSaving(false);
    }
  }

  function pickMatch(m: { patient_id: string; patient_code: string; first_name: string; last_name: string; date_of_birth: string }) {
    setMode("existing");
    chooseTarget({ patient_id: m.patient_id, patient_code: m.patient_code, first_name: m.first_name, last_name: m.last_name, date_of_birth: m.date_of_birth } as PatientRow);
  }

  function reprint() {
    if (!done || !preview) return;
    printHtml(`Queue ${done.result.queue_number ?? preview.queue_number ?? ""}`, slipHtml({
      queueNumber: done.result.queue_number ?? preview.queue_number ?? "—", patientName: done.name, patientCode: done.result.patient_code, date: preview.appointment_date,
    }, escapeHtml));
  }

  const textField = (k: keyof PatientEditForm, label: string, opts: { type?: string; max?: number } = {}) => (
    <div className="space-y-xs">
      <label htmlFor={`wp-${k}`} className={labelStyles}>{label}</label>
      <input id={`wp-${k}`} type={opts.type ?? "text"} maxLength={opts.max} value={String(form[k])} onChange={(e) => set(k, e.target.value as never)} className={inputStyles()} />
    </div>
  );

  if (done) {
    return (
      <Modal isOpen={isOpen} onClose={() => onMoved(done.result)} title="Visit moved"
        footer={<>
          <Button variant="secondary" onClick={reprint}><Icon name="print" className="text-[14px]" aria-hidden />Reprint slip</Button>
          <Button onClick={() => onMoved(done.result)}>Done</Button>
        </>}>
        <div role="status" className="space-y-sm text-body-md text-on-surface">
          <p className="flex items-start gap-sm"><Icon name="check_circle" className="mt-[2px] text-[18px] text-primary" aria-hidden />
            <span>This visit{done.result.queue_number ? ` (${done.result.queue_number})` : ""} is now under <strong>{done.name}</strong> ({done.result.patient_code}).</span></p>
          <p className="text-on-surface-variant">{current} ({preview?.patient.patient_code}) keeps their own details and their other visits.{(done.result.allergies_moved ?? 0) > 0 ? ` ${done.result.allergies_moved} allerg${done.result.allergies_moved === 1 ? "y" : "ies"} moved too.` : ""}</p>
          <p className="text-on-surface-variant">The slip already printed still has the old name. Tap Reprint slip if the patient needs a new one.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={close} title="Wrong patient?" size="lg"
      footer={<>
        <Button variant="secondary" onClick={close} disabled={saving}>Cancel</Button>
        <Button onClick={() => confirm()} loading={saving} disabled={!preview || Boolean(warning)} data-testid="wp-confirm">{saving ? "Moving…" : "Confirm move"}</Button>
      </>}>
      {loadError ? <FormAlert>{loadError}</FormAlert> : !preview ? (
        <p role="status" className="text-body-md text-on-surface-variant">Loading this visit…</p>
      ) : (
        <div className="space-y-md">
          <div className="rounded-[8px] border border-outline-variant bg-surface-container-low p-md text-body-md text-on-surface">
            <p>This visit{preview.queue_number ? <> (<strong>{preview.queue_number}</strong>, {preview.appointment_date})</> : ` (${preview.appointment_date})`} is under <strong>{current}</strong> ({preview.patient.patient_code}).</p>
            <p className="mt-xs text-on-surface-variant">If this is a different person, move this visit to the right patient. {current}&apos;s details and other visits stay as they are.</p>
            <p className="mt-xs text-body-sm text-on-surface-variant" data-testid="wp-summary">{summary}{preview.consultation_status === "Completed" || preview.payment_status === "Paid" ? " The visit is finished/paid: its fee and receipt stay as printed." : ""}</p>
          </div>

          {error && <FormAlert>{error}</FormAlert>}
          {warning && (
            <div role="alert" className="space-y-sm rounded-[8px] border border-[#e2b44a] bg-[#fff7e0] p-md text-body-md text-[#5b4300]">
              <p className="flex items-start gap-sm"><Icon name="warning" className="mt-[2px] text-[18px]" aria-hidden /><span>{warning.message}{warning.kind === "same_day" && warning.queueNumbers.length ? ` (${warning.queueNumbers.join(", ")})` : ""}</span></p>
              {warning.kind === "duplicate" && warning.matches.map((m) => (
                <div key={m.patient_id} className="flex flex-wrap items-center justify-between gap-sm rounded-[6px] bg-white/70 px-sm py-xs">
                  <span>{m.first_name} {m.last_name} · {m.patient_code} · born {m.date_of_birth}</span>
                  <Button variant="secondary" className="min-h-9 px-sm py-xs text-label-md" onClick={() => pickMatch(m)}>Use this patient</Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-sm">
                <Button variant="secondary" className="min-h-9 px-sm py-xs text-label-md" onClick={() => setWarning(null)} disabled={saving}>Go back</Button>
                <Button className="min-h-9 px-sm py-xs text-label-md" onClick={() => confirm(warning.kind === "same_day" ? { sameDay: true } : { duplicate: true })} loading={saving}>
                  {warning.kind === "same_day" ? "Move anyway" : "Create new patient anyway"}
                </Button>
              </div>
            </div>
          )}

          <fieldset>
            <legend className={labelStyles}>Who is this person?</legend>
            <div className="mt-xs grid grid-cols-2 gap-sm" role="radiogroup">
              {(["new", "existing"] as const).map((m) => (
                <label key={m} className={cn("flex min-h-11 cursor-pointer items-center gap-sm rounded-[8px] border px-md text-body-md", mode === m ? "border-primary bg-primary/5 font-medium text-primary" : "border-outline-variant text-on-surface")}>
                  <input type="radio" name="wp-mode" value={m} checked={mode === m} onChange={() => { setMode(m); setWarning(null); setError(""); }} />
                  {m === "new" ? "New patient" : "Existing patient"}
                </label>
              ))}
            </div>
          </fieldset>

          {mode === "new" ? (
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
              {textField("firstName", "First name", { max: 100 })}
              {textField("middleName", "Middle name", { max: 100 })}
              {textField("lastName", "Last name", { max: 100 })}
              <div className="space-y-xs">
                <label htmlFor="wp-sex" className={labelStyles}>Sex</label>
                <select id="wp-sex" value={form.sex} onChange={(e) => set("sex", e.target.value as "Male" | "Female")} className={inputStyles()}>
                  <option value="Male">Male</option><option value="Female">Female</option>
                </select>
              </div>
              <div className="space-y-xs">
                <label htmlFor="wp-dateOfBirth" className={labelStyles}>Birthday</label>
                <DatePicker id="wp-dateOfBirth" value={form.dateOfBirth} maxDate={today} onChange={(v) => set("dateOfBirth", v)} />
              </div>
              <div className="space-y-xs">
                <span className={labelStyles}>Age</span>
                <p data-testid="wp-age" className="flex min-h-11 items-center text-body-md text-on-surface">{age != null ? `${age} years` : "—"}</p>
              </div>
              {textField("contactNumber", "Contact number", { type: "tel", max: 20 })}
              {textField("address", "Address", { max: 300 })}
              <p className="text-body-sm text-on-surface-variant sm:col-span-2">Other details can be added later with Edit details.</p>
            </div>
          ) : (
            <div className="space-y-sm">
              <label htmlFor="wp-search" className={labelStyles}>Search by name or patient code</label>
              <input id="wp-search" value={q} onChange={(e) => { setQ(e.target.value); chooseTarget(null); }} placeholder="e.g. Rubi or MF-100123" className={inputStyles()} autoComplete="off" />
              {searching && <p role="status" className="text-body-sm text-on-surface-variant">Searching…</p>}
              {!target && shownResults.length > 0 && (
                <ul className="max-h-56 divide-y divide-outline-variant overflow-auto rounded-[8px] border border-outline-variant" aria-label="Matching patients">
                  {shownResults.map((p) => (
                    <li key={p.patient_id}>
                      <button type="button" onClick={() => chooseTarget(p)} className="flex w-full items-center justify-between gap-sm px-md py-sm text-left text-body-md hover:bg-surface-container">
                        <span><strong>{p.first_name} {p.last_name}</strong> · {p.patient_code}</span>
                        <span className="text-body-sm text-on-surface-variant">born {p.date_of_birth}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!target && q.trim().length >= 2 && !searching && shownResults.length === 0 && <p className="text-body-sm text-on-surface-variant">No other patient matches. Try another spelling, or choose New patient.</p>}
              {target && (
                <div className="flex flex-wrap items-center justify-between gap-sm rounded-[8px] border border-primary bg-primary/5 px-md py-sm text-body-md" data-testid="wp-target">
                  <span>Move to <strong>{target.first_name} {target.last_name}</strong> · {target.patient_code} · born {target.date_of_birth}</span>
                  <Button variant="secondary" className="min-h-9 px-sm py-xs text-label-md" onClick={() => chooseTarget(null)}>Change</Button>
                </div>
              )}
              {target && targetSameDay && targetSameDay.length > 0 && !warning && (
                <p role="alert" className="flex items-start gap-sm rounded-[8px] border border-[#e2b44a] bg-[#fff7e0] p-sm text-body-sm text-[#5b4300]">
                  <Icon name="warning" className="mt-[1px] text-[16px]" aria-hidden />
                  {target.first_name} already has a visit on {preview.appointment_date} ({targetSameDay.join(", ")}). Confirm only if this visit is really theirs too.
                </p>
              )}
            </div>
          )}

          {preview.allergies.length > 0 && (
            <fieldset className="space-y-xs">
              <legend className={labelStyles}>Allergies to move with this visit</legend>
              {preview.allergies.map((a) => (
                <label key={a.id} className="flex min-h-9 items-center gap-sm text-body-md text-on-surface">
                  <input type="checkbox" checked={allergyIds.includes(a.id)} onChange={(e) => setAllergyIds((ids) => (e.target.checked ? [...ids, a.id] : ids.filter((x) => x !== a.id)))} />
                  <span>{a.is_nkda ? "No known drug allergies (NKDA)" : a.allergen}{a.reaction ? ` (${a.reaction})` : ""}</span>
                  {a.added_during_visit
                    ? <span className="rounded-full bg-primary/10 px-sm text-label-sm text-primary">added during this visit</span>
                    : <span className="text-label-sm text-on-surface-variant">on file before</span>}
                </label>
              ))}
              <p className="text-body-sm text-on-surface-variant">Ticked allergies move to the right patient; unticked ones stay with {current}.</p>
            </fieldset>
          )}

          <div className="space-y-xs">
            <label htmlFor="wp-reason" className={labelStyles}>Why? (kept in the audit log)</label>
            <textarea id="wp-reason" rows={2} maxLength={500} value={reason} onChange={(e) => { setReason(e.target.value); setError(""); }} placeholder="e.g. Different person with a similar name; front desk picked the wrong record" className={inputStyles()} />
          </div>
        </div>
      )}
    </Modal>
  );
}
//JJQR - END

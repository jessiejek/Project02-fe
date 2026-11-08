"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { todayManila } from "@/lib/clock";
import type { PatientAllergyRow } from "@/lib/data/patients";
import { aogFromLmp, eddFromLmp } from "@/lib/clinical/ob";

//JJQR - AI (Oct 31, 2026)
export function patientIdentifierLine(input: {
  patientCode: string;
  patientSex: string;
  patientDob: string;
}): string {
  const parts: string[] = [];
  if (input.patientCode) parts.push(input.patientCode);
  if (input.patientSex) parts.push(input.patientSex);
  if (input.patientDob) {
    const [ty, tm, td] = todayManila().split("-").map(Number);
    const [by, bm, bd] = input.patientDob.split("-").map(Number);
    let age: number | null = null;
    if (by) {
      age = ty - by;
      if (tm < bm || (tm === bm && td < bd)) age--;
    }
    parts.push(`${input.patientDob}${age != null ? ` (${age}y)` : ""}`);
  }
  return parts.join(" · ");
}

export function formatAllergenDisplay(allergen: string): string {
  const t = allergen.trim();
  if (!t || /^R4/i.test(t)) return "Unnamed allergen (review)";
  if (t.length > 20 && !/\s/.test(t) && /^[a-zA-Z0-9]+$/.test(t)) return "Unnamed allergen (review)";
  return t;
}

export function hasJunkAllergens(allergies: PatientAllergyRow[]): boolean {
  return allergies
    .filter((a) => !a.is_nkda)
    .some((a) => formatAllergenDisplay(a.allergen) === "Unnamed allergen (review)");
}

export function allergiesNeedPrescriptionReview(nkda: boolean, allergies: PatientAllergyRow[]): boolean {
  if (nkda) return false;
  const active = allergies.filter((a) => !a.is_nkda);
  if (active.length === 0) return true;
  return hasJunkAllergens(allergies);
}

function allergyBannerText(allergies: PatientAllergyRow[], nkda: boolean): { text: string; amber: boolean } {
  if (nkda) return { text: "NKDA", amber: false };
  const active = allergies.filter((a) => !a.is_nkda);
  if (active.length === 0) return { text: "No allergies recorded", amber: true };
  return {
    text: active
      .map((a) => formatAllergenDisplay(a.allergen) + (a.reaction ? ` (${a.reaction})` : ""))
      .join("; "),
    amber: hasJunkAllergens(allergies),
  };
}

function compactMetaLine(patientSex: string, ageYears: number | null | undefined, patientCode: string): string {
  const parts: string[] = [];
  if (patientSex) parts.push(patientSex);
  if (ageYears != null) parts.push(`${ageYears}y`);
  else if (patientCode) parts.push(patientCode);
  return parts.join(" · ");
}

export interface ConsultPatientBannerProps {
  patientName: string;
  patientCode: string;
  patientSex: string;
  patientDob: string;
  paymentStatus: string;
  allergies: PatientAllergyRow[];
  nkda: boolean;
  mode: "complete" | "view" | "amend";
  readOnly?: boolean;
  onToggleNkda?: (next: boolean) => void;
  onAddAllergy?: (allergen: string) => void;
  onRemoveAllergy?: (index: number) => void;
  className?: string;
  //JJQR - AI (Oct 31, 2026)
  isPregnant?: boolean;
  lmpDate?: string | null;
  gravida?: number | null;
  para?: number | null;
  rhFactor?: string | null;
  guardianName?: string | null;
  guardianRelationship?: string | null;
  ageYears?: number | null;
  /** When set, replaces the default inner `max-w-doctor-record` (e.g. completed view column). */
  contentClassName?: string;
  //JJQR - END
}

export function ConsultPatientBanner({
  patientName,
  patientCode,
  patientSex,
  patientDob,
  paymentStatus,
  allergies,
  nkda,
  readOnly,
  onToggleNkda,
  onAddAllergy,
  onRemoveAllergy,
  className,
  isPregnant,
  lmpDate,
  gravida,
  para,
  rhFactor,
  guardianName,
  guardianRelationship,
  ageYears,
  contentClassName,
}: ConsultPatientBannerProps) {
  const [allergyEditorOpen, setAllergyEditorOpen] = useState(false);
  const idLine = patientIdentifierLine({ patientCode, patientSex, patientDob });
  const showObStrip = !!(isPregnant || lmpDate);
  const obAog = lmpDate ? aogFromLmp(lmpDate) : null;
  const obEdd = lmpDate ? eddFromLmp(lmpDate) : null;
  const showGuardian = ageYears != null && ageYears < 18 && !!guardianName?.trim();
  const allergyInfo = allergyBannerText(allergies, nkda);
  const activeAllergenCount = allergies.filter((a) => !a.is_nkda).length;
  const allergyChipStrong = !nkda && activeAllergenCount > 0 && !allergyInfo.amber;
  const canEditAllergies = !readOnly && !!(onToggleNkda || onAddAllergy);
  const metaCompact = compactMetaLine(patientSex, ageYears, patientCode);
  const guardianShort =
    showGuardian && guardianName
      ? `Guardian: ${guardianName}${guardianRelationship ? ` (${guardianRelationship})` : ""}`
      : null;

  const allergyChipClassName = cn(
    "inline-flex min-h-11 max-w-full items-center gap-sm rounded-lg border px-md py-xs text-left text-label-md",
    allergyChipStrong
      ? "border-status-danger-border bg-status-danger-surface text-status-danger"
      : allergyInfo.amber
        ? "border-status-warning-border bg-status-warning-surface text-status-warning"
        : "border-outline-variant bg-surface-container-low text-on-surface",
  );

  return (
    <>
      <div
        className={cn(
          //JJQR - AI (Oct 31, 2026) — stick below AppShell Topbar (h-16 / top-16)
          "sticky top-16 z-20 border-b border-outline-variant bg-surface px-md py-xs shadow-sm",
          className,
        )}
      >
        {/* JJQR - AI (Oct 31, 2026) — compact sticky identity at all breakpoints */}
        <div
          className={cn(
            "mx-auto flex min-h-14 max-w-doctor-record flex-wrap items-center gap-x-lg gap-y-sm py-sm",
            contentClassName,
          )}
        >
          <p className="min-w-[12rem] flex-1 text-body-md text-on-surface">
            <span className="break-words font-semibold">{patientName || "—"}</span>
            {metaCompact ? <span className="text-on-surface-variant"> · {metaCompact}</span> : null}
          </p>
          <div className="flex min-w-0 flex-wrap items-center gap-sm">
            {isPregnant && obAog && (
              <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-xs py-[2px] text-label-sm leading-normal text-primary">
                Preg {obAog.weeks}w
              </span>
            )}
            {!isPregnant && showObStrip && obAog && (
              <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-xs py-[2px] text-label-sm leading-normal text-primary">
                LMP {obAog.weeks}w
              </span>
            )}
            {(gravida != null || para != null) && (
              <span className="shrink-0 rounded-full border border-outline-variant bg-surface-container-low px-xs py-[2px] text-label-sm leading-normal text-on-surface-variant">
                G{gravida ?? "?"}/P{para ?? "?"}
              </span>
            )}
            {guardianShort && (
              <span className="max-w-full rounded-full border border-outline-variant bg-surface-container-low px-xs py-[2px] text-label-sm leading-normal text-on-surface-variant">
                {guardianShort}
              </span>
            )}
            {canEditAllergies ? (
              <button
                type="button"
                className={allergyChipClassName}
                aria-expanded={allergyEditorOpen}
                aria-controls="consult-allergy-editor-panel"
                onClick={() => setAllergyEditorOpen((open) => !open)}
              >
                <Icon name="warning" className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0 break-words">Allergies: {allergyInfo.text}</span>
              </button>
            ) : (
              <span className={allergyChipClassName}>
                <Icon name="warning" className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0 break-words">Allergies: {allergyInfo.text}</span>
              </span>
            )}
            <span className="text-label-sm text-on-surface-variant">Payment: {paymentStatus || "Not recorded"}</span>
          </div>
        </div>
        {/* JJQR - END */}
      </div>
      {showObStrip && (
        <div className="hidden border-b border-outline-variant/60 bg-surface px-md py-sm lg:block">
          <p className="mx-auto max-w-doctor-record text-label-sm text-primary">
            OB: {isPregnant ? "Pregnant" : "LMP recorded"}
            {obAog ? ` · AOG ${obAog.label}` : ""}
            {obEdd ? ` · EDD ${obEdd}` : ""}
            {(gravida != null || para != null) && ` · G${gravida ?? "?"}/P${para ?? "?"}`}
            {rhFactor ? ` · Rh ${rhFactor}` : ""}
            {idLine ? <span className="text-on-surface-variant"> · {idLine}</span> : null}
          </p>
        </div>
      )}
      {canEditAllergies && allergyEditorOpen && (
        <div
          id="consult-allergy-editor-panel"
          className="border-b border-outline-variant bg-surface px-md py-sm shadow-sm"
        >
          <AllergyEditor
            allergies={allergies}
            nkda={nkda}
            onToggleNkda={onToggleNkda}
            onAddAllergy={onAddAllergy}
            onRemoveAllergy={onRemoveAllergy}
            showClose
            onClose={() => setAllergyEditorOpen(false)}
            collapseAfterAction
          />
        </div>
      )}
    </>
  );
}

function AllergyEditor({
  allergies,
  nkda,
  onToggleNkda,
  onAddAllergy,
  onRemoveAllergy,
  showClose,
  onClose,
  collapseAfterAction,
}: {
  allergies: PatientAllergyRow[];
  nkda: boolean;
  onToggleNkda?: (next: boolean) => void;
  onAddAllergy?: (allergen: string) => void;
  onRemoveAllergy?: (index: number) => void;
  showClose?: boolean;
  onClose?: () => void;
  collapseAfterAction?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [nkdaConfirmOpen, setNkdaConfirmOpen] = useState(false);
  const trimmedDraft = draft.trim();
  const canAdd = trimmedDraft.length > 0;
  const activeAllergies = allergies.filter((a) => !a.is_nkda);

  const maybeCollapse = () => {
    if (collapseAfterAction) onClose?.();
  };

  const submitDraft = () => {
    if (!canAdd) return;
    onAddAllergy?.(trimmedDraft);
    setDraft("");
    maybeCollapse();
  };

  return (
    <>
      {/* JJQR - AI (Oct 31, 2026) — NKDA full row on narrow viewports */}
      <div
        className={cn(
          "mx-auto flex max-w-doctor-record flex-col gap-sm",
          showClose ? "" : "mt-sm border-t border-outline-variant/50 pt-sm",
        )}
      >
        {showClose && onClose && (
          <div className="flex justify-end">
            <button
              type="button"
              className="min-h-[44px] rounded-lg px-md text-label-md font-medium text-primary"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        )}
        <label className="flex min-h-[44px] w-full cursor-pointer items-center gap-sm text-label-md sm:w-auto">
          <input
            type="checkbox"
            checked={nkda}
            onChange={(e) => {
              const next = e.target.checked;
              if (!next) {
                onToggleNkda?.(false);
                maybeCollapse();
                return;
              }
              if (activeAllergies.length > 0) {
                setNkdaConfirmOpen(true);
                return;
              }
              setDraft("");
              onToggleNkda?.(true);
              maybeCollapse();
            }}
            className="h-4 w-4"
          />
          NKDA
        </label>
        {onAddAllergy && (
          <div className="flex w-full min-w-0 flex-col gap-sm sm:flex-row sm:items-center">
            <label htmlFor="consult-allergy-draft" className="shrink-0 text-label-md font-medium text-on-surface">
              Allergies
            </label>
            <input
              id="consult-allergy-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitDraft();
                }
              }}
              placeholder="Add allergy (e.g. Penicillin)"
              aria-label="Allergies"
              className="min-h-[44px] min-w-[12rem] w-full flex-1 rounded-lg border border-outline-variant px-md py-sm text-body-md"
            />
            <button
              type="button"
              disabled={!canAdd}
              className="min-h-[44px] shrink-0 rounded-lg border border-primary px-md text-label-md text-primary disabled:cursor-not-allowed disabled:opacity-40"
              onClick={submitDraft}
            >
              Add allergy
            </button>
          </div>
        )}
        {!nkda &&
          activeAllergies.map((a, i) => (
            <span
              key={`${a.allergen}-${i}`}
              className="inline-flex items-center gap-xs rounded-full bg-surface-container-high px-sm py-xs text-label-sm"
              title={a.allergen !== formatAllergenDisplay(a.allergen) ? a.allergen : a.updated_at ? `Updated ${new Date(a.updated_at).toLocaleString()}` : undefined}
            >
              {formatAllergenDisplay(a.allergen)}
              <button
                type="button"
                aria-label={`Remove ${formatAllergenDisplay(a.allergen)}`}
                onClick={() => {
                  onRemoveAllergy?.(i);
                  maybeCollapse();
                }}
                className="text-on-surface-variant"
              >
                ×
              </button>
            </span>
          ))}
      </div>
      <Modal
        isOpen={nkdaConfirmOpen}
        onClose={() => setNkdaConfirmOpen(false)}
        title="Mark NKDA?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNkdaConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setNkdaConfirmOpen(false);
                setDraft("");
                onToggleNkda?.(true);
                maybeCollapse();
              }}
            >
              Clear allergies &amp; mark NKDA
            </Button>
          </>
        }
      >
        <p className="text-body-md text-on-surface-variant">Clear recorded allergies and mark NKDA?</p>
      </Modal>
    </>
  );
}
//JJQR - END

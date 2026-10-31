"use client";

import { useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { todayManila } from "@/lib/clock";
import type { PatientAllergyRow } from "@/lib/data/patients";

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

function allergyBannerText(allergies: PatientAllergyRow[], nkda: boolean): { text: string; amber: boolean } {
  if (nkda) return { text: "NKDA", amber: false };
  const active = allergies.filter((a) => !a.is_nkda);
  if (active.length === 0) return { text: "No allergies recorded", amber: true };
  return {
    text: active.map((a) => a.allergen + (a.reaction ? ` (${a.reaction})` : "")).join("; "),
    amber: false,
  };
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
}

export function ConsultPatientBanner({
  patientName,
  patientCode,
  patientSex,
  patientDob,
  paymentStatus,
  allergies,
  nkda,
  mode,
  readOnly,
  onToggleNkda,
  onAddAllergy,
  onRemoveAllergy,
  className,
}: ConsultPatientBannerProps) {
  const idLine = patientIdentifierLine({ patientCode, patientSex, patientDob });
  const allergyInfo = allergyBannerText(allergies, nkda);
  const initials = patientName
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn(
        "sticky top-0 z-20 border-b border-outline-variant bg-surface px-md py-sm shadow-sm",
        className,
      )}
    >
      <div className="mx-auto flex max-w-[64rem] flex-col gap-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-sm">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-label-md font-medium text-primary"
            aria-hidden
          >
            {initials || "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-title-md text-on-surface">{patientName || "—"}</p>
            {idLine && <p className="text-label-sm text-on-surface-variant">{idLine}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-sm">
          <StatusPill status={paymentStatus === "Paid" ? "Paid" : "Unpaid"} />
          <div
            className={cn(
              "flex min-h-[44px] max-w-full flex-wrap items-center gap-xs rounded-lg border px-sm py-xs text-label-sm",
              allergyInfo.amber ? "border-amber-400 bg-amber-50 text-amber-900" : "border-outline-variant bg-surface-container-low",
            )}
          >
            <Icon name="warning" className="shrink-0 text-[16px]" aria-hidden />
            <span className="font-medium">Allergies:</span>
            <span className="min-w-0 break-words">{allergyInfo.text}</span>
          </div>
        </div>
      </div>
      {!readOnly && (onToggleNkda || onAddAllergy) && (
        <AllergyEditor
          allergies={allergies}
          nkda={nkda}
          onToggleNkda={onToggleNkda}
          onAddAllergy={onAddAllergy}
          onRemoveAllergy={onRemoveAllergy}
        />
      )}
    </div>
  );
}

function AllergyEditor({
  allergies,
  nkda,
  onToggleNkda,
  onAddAllergy,
  onRemoveAllergy,
}: {
  allergies: PatientAllergyRow[];
  nkda: boolean;
  onToggleNkda?: (next: boolean) => void;
  onAddAllergy?: (allergen: string) => void;
  onRemoveAllergy?: (index: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const trimmedDraft = draft.trim();
  const canAdd = trimmedDraft.length > 0;

  const submitDraft = () => {
    if (!canAdd) return;
    onAddAllergy?.(trimmedDraft);
    setDraft("");
  };

  return (
    <div className="mx-auto mt-sm flex max-w-[64rem] flex-wrap items-center gap-sm border-t border-outline-variant/50 pt-sm">
      <label className="flex min-h-[44px] cursor-pointer items-center gap-sm text-label-md">
        <input
          type="checkbox"
          checked={nkda}
          onChange={(e) => {
            const next = e.target.checked;
            if (next) setDraft("");
            onToggleNkda?.(next);
          }}
          className="h-4 w-4"
        />
        NKDA
      </label>
      {!nkda && (
        <>
          {/* JJQR - AI (Oct 31, 2026) — allergy input min-width / wrap layout */}
          <div className="flex w-full min-w-[12rem] flex-1 flex-col gap-sm sm:flex-row sm:items-center">
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
              Add
            </button>
          </div>
          {/* JJQR - END */}
          {allergies
            .filter((a) => !a.is_nkda)
            .map((a, i) => (
              <span key={`${a.allergen}-${i}`} className="inline-flex items-center gap-xs rounded-full bg-surface-container-high px-sm py-xs text-label-sm" title={a.updated_at ? `Updated ${new Date(a.updated_at).toLocaleString()}` : undefined}>
                {a.allergen}
                <button type="button" aria-label={`Remove ${a.allergen}`} onClick={() => onRemoveAllergy?.(i)} className="text-on-surface-variant">
                  ×
                </button>
              </span>
            ))}
        </>
      )}
    </div>
  );
}
//JJQR - END

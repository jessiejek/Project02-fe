"use client";
//JJQR - AI (2026-11-26) - GAV-10: owner wants the doctor to edit ALL patient details, also while consulting. One dialog, opened from the
// "Edit details" button beside the name in the consultation header and on the patient chart's left card. Same save path as the admin
// "Edit patient details" dialog (updatePatient = fetch-merge-put on PUT /api/patients/{id}); fields = everything that PUT copies.
// Saving never navigates: the caller gets the saved row and refreshes its header (consultation notes stay as they are).

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { FormAlert } from "@/components/ui/FormAlert";
import { inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { todayManila } from "@/lib/clock";
import { queryPatientById, updatePatient, type PatientRow } from "@/lib/data/patients";
import {
  BLOOD_TYPE_OPTIONS,
  CIVIL_STATUS_OPTIONS,
  ageOn,
  formFromPatient,
  patchFromForm,
  patientEditProblem,
  type PatientEditForm,
} from "@/lib/patient-edit";

export interface EditPatientDetailsDialogProps {
  isOpen: boolean;
  patientId: string;
  onClose: () => void;
  /** Called with the row as the server saved it; the dialog has already closed. */
  onSaved: (row: PatientRow) => void;
}

export function EditPatientDetailsDialog({ isOpen, patientId, onClose, onSaved }: EditPatientDetailsDialogProps) {
  const [form, setForm] = useState<PatientEditForm | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [badField, setBadField] = useState<keyof PatientEditForm | null>(null);
  const [saving, setSaving] = useState(false);

  // fresh copy every time it opens, so it never saves over a change made elsewhere since the page loaded
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setForm(null); setLoadError(""); setSaveError(""); setBadField(null);
    queryPatientById(null, patientId).then((row) => {
      if (cancelled) return;
      if (!row) { setLoadError("The patient's details could not be loaded. Nothing has changed; close and try again."); return; }
      setForm(formFromPatient(row));
    });
    return () => { cancelled = true; };
  }, [isOpen, patientId]);

  const today = todayManila();
  const age = form ? ageOn(form.dateOfBirth, today) : null;
  const set = <K extends keyof PatientEditForm>(k: K, v: PatientEditForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const id = (k: keyof PatientEditForm) => `doc-edit-patient-${k}`;
  const close = () => { if (!saving) onClose(); };

  async function save() {
    if (!form) return;
    const problem = patientEditProblem(form, today);
    if (problem) { setSaveError(problem.message); setBadField(problem.field); return; }
    setSaving(true); setSaveError(""); setBadField(null);
    try {
      await updatePatient(null, patientId, patchFromForm(form));
      const saved = await queryPatientById(null, patientId);
      setSaving(false);
      onClose();
      if (saved) onSaved(saved);
    } catch (e) {
      setSaving(false);
      setSaveError(e instanceof Error && e.message && !/^API \d+$/.test(e.message) ? e.message : "Could not save the patient's details. Your changes are still here; try again.");
    }
  }

  const text = (k: keyof PatientEditForm, label: string, opts: { type?: string; wide?: boolean; max?: number } = {}) => (
    <div className={opts.wide ? "space-y-xs sm:col-span-2" : "space-y-xs"}>
      <label htmlFor={id(k)} className={labelStyles}>{label}</label>
      <input
        id={id(k)}
        type={opts.type ?? "text"}
        maxLength={opts.max}
        value={form ? String(form[k]) : ""}
        aria-invalid={badField === k || undefined}
        onChange={(e) => set(k, e.target.value as never)}
        className={inputStyles()}
      />
    </div>
  );
  const select = (k: keyof PatientEditForm, label: string, options: readonly string[]) => {
    const v = form ? String(form[k]) : "";
    return (
      <div className="space-y-xs">
        <label htmlFor={id(k)} className={labelStyles}>{label}</label>
        <select id={id(k)} value={v} onChange={(e) => set(k, e.target.value as never)} className={inputStyles()}>
          <option value="">Not set</option>
          {/* keep a value typed elsewhere (e.g. registration) even if it is not in the list */}
          {v && !options.includes(v) && <option value={v}>{v}</option>}
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  };
  const section = (title: string) => (
    <p className="pt-sm text-[12px] font-semibold uppercase tracking-[0.04em] text-on-surface-variant sm:col-span-2">{title}</p>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Edit patient details"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={!form}>{saving ? "Saving…" : "Save changes"}</Button>
        </>
      }
    >
      {loadError ? (
        <FormAlert>{loadError}</FormAlert>
      ) : !form ? (
        <p role="status" className="text-body-md text-on-surface-variant">Loading patient details…</p>
      ) : (
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          {saveError && <FormAlert className="sm:col-span-2">{saveError}</FormAlert>}
          {section("Name and birthday")}
          {text("firstName", "First name", { max: 100 })}
          {text("middleName", "Middle name", { max: 100 })}
          {text("lastName", "Last name", { max: 100 })}
          <div className="space-y-xs">
            <label htmlFor={id("sex")} className={labelStyles}>Sex</label>
            <select id={id("sex")} value={form.sex} onChange={(e) => set("sex", e.target.value as "Male" | "Female")} className={inputStyles()}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div className="space-y-xs">
            <label htmlFor={id("dateOfBirth")} className={labelStyles}>Birthday</label>
            <DatePicker id={id("dateOfBirth")} value={form.dateOfBirth} maxDate={today} aria-invalid={badField === "dateOfBirth" || undefined} onChange={(v) => set("dateOfBirth", v)} />
          </div>
          <div className="space-y-xs">
            <span className={labelStyles}>Age</span>
            <p data-testid="doc-edit-patient-age" className="flex min-h-11 items-center text-body-md text-on-surface">{age != null ? `${age} years` : "—"}</p>
          </div>
          {select("civilStatus", "Civil status", CIVIL_STATUS_OPTIONS)}
          {select("bloodType", "Blood type", BLOOD_TYPE_OPTIONS)}
          {section("Contact and address")}
          {text("contactNumber", "Contact number", { type: "tel", max: 20 })}
          {text("address", "Address", { max: 300 })}
          {text("city", "City", { max: 100 })}
          {text("zipCode", "Zip code", { max: 20 })}
          {section("IDs and HMO")}
          {text("philhealthNumber", "PhilHealth number", { max: 30 })}
          {text("hmoProvider", "HMO provider", { max: 100 })}
          {text("hmoCardNumber", "HMO card number", { max: 50 })}
          {section("Emergency contact")}
          {text("emergencyContactName", "Name", { max: 150 })}
          {text("emergencyContactNumber", "Contact number", { type: "tel", max: 20 })}
          {text("emergencyContactRelationship", "Relationship", { max: 100 })}
        </div>
      )}
    </Modal>
  );
}
//JJQR - END

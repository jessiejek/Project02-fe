"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormAlert } from "@/components/ui/FormAlert";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { inputStyles, labelStyles, hintStyles } from "@/components/ui/fieldStyles";
import { formatClinicDateTime } from "@/lib/format";
import { DatePicker } from "@/components/ui/DatePicker";
import { useSession } from "@/components/providers/SessionProvider";
import { queryPatientById, updatePatient } from "@/lib/data/patients";
import { changePassword } from "@/lib/auth/account";
import type { Patient } from "@/data/types";

const TABS = [
  { id: "info", label: "Details" },
  { id: "password", label: "Password" },
  { id: "consent", label: "Privacy" },
];

// Stitch screen_21_profile — 3 tabs per Patient.md §13. Previously fully
// decorative (confirmed by direct read, Implementation-Phases/04-patients.md
// §4d): every field used `defaultValue=` only, and Save had no `onClick` at
// all. Scoped to the session's own patient_id — a patient should only ever
// be able to update their own row, app-side defense in depth ahead of
// Phase 11's RLS.
export default function PatientProfilePage() {
  const { session } = useSession();
  const patientId = session?.patientId;
  const [tab, setTab] = useState("info");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!patientId) return;
    const id = patientId;
    async function load() {
      const supabase = null as never;
      let data;
      try {
        data = await queryPatientById(supabase, id);
        setLoadError(false);
      } catch {
        setLoadError(true);
        return;
      }
      if (data) {
        setPatient({
          id: data.patient_id,
          patientCode: data.patient_code,
          firstName: data.first_name,
          middleName: data.middle_name ?? undefined,
          lastName: data.last_name,
          dateOfBirth: data.date_of_birth,
          sex: data.sex,
          civilStatus: data.civil_status ?? "",
          address: data.address ?? "",
          city: data.city ?? "",
          zipCode: data.zip_code ?? "",
          contactNumber: data.contact_number ?? "",
          email: data.email,
          emergencyContactName: data.emergency_contact_name ?? undefined,
          emergencyContactNumber: data.emergency_contact_number ?? undefined,
          emergencyContactRelationship: data.emergency_contact_relationship ?? undefined,
          bloodType: data.blood_type ?? undefined,
          philHealthNumber: data.philhealth_number ?? undefined,
          hmoProvider: data.hmo_provider ?? undefined,
          hmoCardNumber: data.hmo_card_number ?? undefined,
          isEmailVerified: data.is_email_verified,
          consentedAt: data.consented_at ?? undefined,
          consentVersion: data.consent_version,
        });
      }
    }
    load();
  }, [patientId, retryKey]);

  return (
    <AppShell role="patient">
      <div className="mx-auto max-w-[44rem] space-y-lg">
        <PageHeader
          title="Your profile"
          description={patient ? <>Patient code <span className="font-mono text-body-sm text-on-surface">{patient.patientCode}</span></> : "Your details, password and privacy choice."}
        />
        {!patient ? (
          loadError ? (
            <ErrorState title="Your profile didn’t load" message="Check your connection, then try again." onRetry={() => setRetryKey((k) => k + 1)} />
          ) : (
            <div aria-busy="true"><SkeletonCard lines={6} /></div>
          )
        ) : (
          <Card>
            <Tabs tabs={TABS} activeId={tab} onChange={setTab} className="mb-lg" />
            {tab === "info" && <ProfileInfoTab key={patient.id} patient={patient} />}
            {tab === "password" && <ChangePasswordTab />}
            {tab === "consent" && (
              <div className="space-y-md">
                {patient.consentedAt ? (
                  <FormAlert tone="success">
                    You agreed to the privacy policy (version <span className="tabular-nums">{patient.consentVersion}</span>) on {formatClinicDateTime(patient.consentedAt)}.
                  </FormAlert>
                ) : (
                  <FormAlert tone="warning">You haven&apos;t agreed to the current privacy policy yet.</FormAlert>
                )}
                <Link href="/patient/privacy-consent" className={buttonStyles(patient.consentedAt ? "secondary" : "primary")}>
                  {patient.consentedAt ? "Read the policy" : "Review and agree"}
                </Link>
              </div>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function ProfileInfoTab({ patient }: { patient: Patient }) {
  const [form, setForm] = useState(patient);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ firstName?: string; lastName?: string; contactNumber?: string }>({});
  const [saveError, setSaveError] = useState("");

  function set<K extends keyof Patient>(key: K, value: Patient[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  //JJQR - AI (Oct 31, 2026)
  function validateProfile(): boolean {
    const errors: typeof fieldErrors = {};
    if (!form.firstName.trim()) errors.firstName = "First name is required.";
    if (!form.lastName.trim()) errors.lastName = "Last name is required.";
    const contact = form.contactNumber.trim();
    if (contact) {
      const digits = contact.replace(/\D/g, "");
      if (digits.length < 10) errors.contactNumber = "Enter a valid phone number (at least 10 digits).";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function reloadFromApi() {
    const supabase = null as never;
    const data = await queryPatientById(supabase, patient.id);
    if (!data) return;
    setForm({
      id: data.patient_id,
      patientCode: data.patient_code,
      firstName: data.first_name,
      middleName: data.middle_name ?? undefined,
      lastName: data.last_name,
      dateOfBirth: data.date_of_birth,
      sex: data.sex,
      civilStatus: data.civil_status ?? "",
      address: data.address ?? "",
      city: data.city ?? "",
      zipCode: data.zip_code ?? "",
      contactNumber: data.contact_number ?? "",
      email: data.email,
      emergencyContactName: data.emergency_contact_name ?? undefined,
      emergencyContactNumber: data.emergency_contact_number ?? undefined,
      emergencyContactRelationship: data.emergency_contact_relationship ?? undefined,
      bloodType: data.blood_type ?? undefined,
      philHealthNumber: data.philhealth_number ?? undefined,
      hmoProvider: data.hmo_provider ?? undefined,
      hmoCardNumber: data.hmo_card_number ?? undefined,
      isEmailVerified: data.is_email_verified,
      consentedAt: data.consented_at ?? undefined,
      consentVersion: data.consent_version,
    });
  }

  async function handleSave() {
    setSaveError("");
    if (!validateProfile()) return;
    setSaving(true);
    const supabase = null as never;
    try {
      await updatePatient(supabase, patient.id, {
        first_name: form.firstName.trim(),
        middle_name: form.middleName || null,
        last_name: form.lastName.trim(),
        date_of_birth: form.dateOfBirth,
        sex: form.sex,
        civil_status: form.civilStatus || null,
        address: form.address || null,
        city: form.city || null,
        zip_code: form.zipCode || null,
        contact_number: form.contactNumber.trim() || null,
        emergency_contact_name: form.emergencyContactName || null,
        emergency_contact_number: form.emergencyContactNumber || null,
        emergency_contact_relationship: form.emergencyContactRelationship || null,
        blood_type: form.bloodType || null,
        philhealth_number: form.philHealthNumber || null,
        hmo_provider: form.hmoProvider || null,
        hmo_card_number: form.hmoCardNumber || null,
      });
      await reloadFromApi();
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }
  //JJQR - END

  const legend = "mb-sm text-headline-sm text-on-surface";

  return (
    <form className="space-y-xl" onSubmit={(e) => { e.preventDefault(); handleSave(); }} noValidate>
      {savedAt && <FormAlert tone="success">Profile saved at {savedAt}.</FormAlert>}
      {saveError && <FormAlert>{saveError}</FormAlert>}
      <fieldset className="min-w-0 space-y-md">
        <legend className={legend}>About you</legend>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
          <Field label="First name" autoComplete="given-name" value={form.firstName} onChange={(v) => set("firstName", v)} error={fieldErrors.firstName} />
          <Field label="Middle name" autoComplete="additional-name" value={form.middleName ?? ""} onChange={(v) => set("middleName", v)} />
          <Field label="Last name" autoComplete="family-name" value={form.lastName} onChange={(v) => set("lastName", v)} error={fieldErrors.lastName} />
        </div>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="space-y-xs">
            <label className={labelStyles}>Date of birth</label>
            <DatePicker value={form.dateOfBirth} onChange={(v) => set("dateOfBirth", v)} />
          </div>
          <div className="space-y-xs">
            <label htmlFor="field-sex" className={labelStyles}>Sex</label>
            <select id="field-sex" value={form.sex} onChange={(e) => set("sex", e.target.value as "Male" | "Female")} className={inputStyles()}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <Field label="Civil status" value={form.civilStatus} onChange={(v) => set("civilStatus", v)} />
          <Field label="Blood type" value={form.bloodType ?? ""} onChange={(v) => set("bloodType", v)} />
        </div>
      </fieldset>

      <fieldset className="min-w-0 space-y-md">
        <legend className={legend}>Contact</legend>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <Field label="Contact number" type="tel" autoComplete="tel" value={form.contactNumber} onChange={(v) => set("contactNumber", v)} error={fieldErrors.contactNumber} />
          <div className="space-y-xs">
            <label htmlFor="field-email" className={labelStyles}>Email</label>
            <input id="field-email" readOnly value={form.email} className={inputStyles("bg-surface-container-low text-on-surface-variant")} />
            <p className={hintStyles}>Ask the front desk to change your email.</p>
          </div>
        </div>
        <Field label="Address" autoComplete="street-address" value={form.address} onChange={(v) => set("address", v)} />
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <Field label="City" autoComplete="address-level2" value={form.city} onChange={(v) => set("city", v)} />
          <Field label="ZIP code" autoComplete="postal-code" value={form.zipCode} onChange={(v) => set("zipCode", v)} mono />
        </div>
      </fieldset>

      <fieldset className="min-w-0 space-y-md">
        <legend className={legend}>Emergency contact</legend>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
          <Field label="Name" value={form.emergencyContactName ?? ""} onChange={(v) => set("emergencyContactName", v)} />
          <Field label="Relationship" value={form.emergencyContactRelationship ?? ""} onChange={(v) => set("emergencyContactRelationship", v)} />
          <Field label="Phone" type="tel" value={form.emergencyContactNumber ?? ""} onChange={(v) => set("emergencyContactNumber", v)} />
        </div>
      </fieldset>

      <fieldset className="min-w-0 space-y-md">
        <legend className={legend}>Insurance</legend>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
          <Field label="HMO provider" value={form.hmoProvider ?? ""} onChange={(v) => set("hmoProvider", v)} />
          <Field label="HMO card number" value={form.hmoCardNumber ?? ""} onChange={(v) => set("hmoCardNumber", v)} mono />
          <Field label="PhilHealth number" value={form.philHealthNumber ?? ""} onChange={(v) => set("philHealthNumber", v)} mono />
        </div>
      </fieldset>

      <div className="flex justify-end border-t border-outline-variant pt-md">
        <Button type="submit" loading={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function ChangePasswordTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const canUpdate = currentPassword.trim() !== "" && newPassword.length >= 6 && newPassword === confirmPassword;

  async function handleUpdate() {
    if (!canUpdate) return;
    setError("");
    setUpdating(true);
    try {
      await changePassword(currentPassword, newPassword);
    } catch (e) {
      setUpdating(false);
      setError(e instanceof Error ? e.message : "Could not update the password.");
      return;
    }
    setUpdating(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSavedAt(new Date().toLocaleTimeString());
  }

  const mismatch = confirmPassword !== "" && newPassword !== confirmPassword;

  return (
    <form className="max-w-auth space-y-md" onSubmit={(e) => { e.preventDefault(); handleUpdate(); }} noValidate>
      {savedAt && <FormAlert tone="success">Password updated. Use it the next time you sign in.</FormAlert>}
      {error && <FormAlert>{error}</FormAlert>}
      <Field label="Current password" type="password" autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword} />
      <Field label="New password" type="password" autoComplete="new-password" value={newPassword} onChange={setNewPassword} hint="At least 6 characters." />
      <Field label="Confirm new password" type="password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} error={mismatch ? "Passwords don’t match yet." : undefined} />
      <Button type="submit" disabled={!canUpdate} loading={updating}>
        {updating ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}

//JJQR - AI (Oct 31, 2026)
function fieldIdFromLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `field-${slug}` : "field-input";
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  error,
  hint,
  autoComplete,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  error?: string;
  hint?: string;
  autoComplete?: string;
  mono?: boolean;
}) {
  const inputId = fieldIdFromLabel(label);
  const noteId = `${inputId}-note`;
  return (
    <div className="space-y-xs">
      <label htmlFor={inputId} className={labelStyles}>
        {label}
      </label>
      <input
        id={inputId}
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? noteId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={inputStyles(mono ? "font-mono" : type === "tel" ? "tabular-nums" : undefined)}
      />
      {error ? <p id={noteId} className="text-label-md text-status-danger">{error}</p> : hint ? <p id={noteId} className={hintStyles}>{hint}</p> : null}
    </div>
  );
}
//JJQR - END

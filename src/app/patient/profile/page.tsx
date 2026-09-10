"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { DatePicker } from "@/components/ui/DatePicker";
import { useSession } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import { queryPatientById, updatePatient } from "@/lib/data/patients";
import { changePassword } from "@/lib/auth/account";
import type { Patient } from "@/data/types";

const TABS = [
  { id: "info", label: "Profile Info" },
  { id: "password", label: "Change Password" },
  { id: "consent", label: "Privacy Consent" },
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

  useEffect(() => {
    if (!patientId) return;
    const id = patientId;
    async function load() {
      const supabase = createClient();
      const data = await queryPatientById(supabase, id);
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
  }, [patientId]);

  if (!patient) {
    return (
      <AppShell role="patient">
        <p className="text-body-md text-on-surface-variant">Loading your profile…</p>
      </AppShell>
    );
  }

  return (
    <AppShell role="patient">
      <Card className="mx-auto max-w-[40rem]">
        <Tabs tabs={TABS} activeId={tab} onChange={setTab} className="mb-lg" />
        {tab === "info" && <ProfileInfoTab key={patient.id} patient={patient} />}
        {tab === "password" && <ChangePasswordTab />}
        {tab === "consent" && (
          <div className="space-y-md text-body-md text-on-surface-variant">
            {patient.consentedAt ? (
              <p>You accepted the privacy policy (version {patient.consentVersion}).</p>
            ) : (
              <p>You have not yet accepted the current privacy policy. Visit Privacy Consent to review it.</p>
            )}
          </div>
        )}
      </Card>
    </AppShell>
  );
}

function ProfileInfoTab({ patient }: { patient: Patient }) {
  const [form, setForm] = useState(patient);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function set<K extends keyof Patient>(key: K, value: Patient[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    await updatePatient(supabase, patient.id, {
      first_name: form.firstName,
      middle_name: form.middleName || null,
      last_name: form.lastName,
      date_of_birth: form.dateOfBirth,
      sex: form.sex,
      civil_status: form.civilStatus || null,
      address: form.address || null,
      city: form.city || null,
      zip_code: form.zipCode || null,
      contact_number: form.contactNumber || null,
      emergency_contact_name: form.emergencyContactName || null,
      emergency_contact_number: form.emergencyContactNumber || null,
      emergency_contact_relationship: form.emergencyContactRelationship || null,
      blood_type: form.bloodType || null,
      philhealth_number: form.philHealthNumber || null,
      hmo_provider: form.hmoProvider || null,
      hmo_card_number: form.hmoCardNumber || null,
    });
    setSaving(false);
    setSavedAt(new Date().toLocaleTimeString());
  }

  return (
    <div className="space-y-md">
      {savedAt && <Toast key={savedAt} variant="success" message={`Profile saved at ${savedAt}.`} />}
      <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
        <Field label="First Name" value={form.firstName} onChange={(v) => set("firstName", v)} />
        <Field label="Middle Name" value={form.middleName ?? ""} onChange={(v) => set("middleName", v)} />
        <Field label="Last Name" value={form.lastName} onChange={(v) => set("lastName", v)} />
      </div>
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <div className="space-y-xs">
          <label className="text-label-md text-on-surface-variant">Date of Birth</label>
          <DatePicker value={form.dateOfBirth} onChange={(v) => set("dateOfBirth", v)} />
        </div>
        <div className="space-y-xs">
          <label className="text-label-md text-on-surface-variant">Sex</label>
          <select
            value={form.sex}
            onChange={(e) => set("sex", e.target.value as "Male" | "Female")}
            className="w-full rounded-lg border border-outline-variant px-md py-sm text-body-md"
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <Field label="Civil Status" value={form.civilStatus} onChange={(v) => set("civilStatus", v)} />
        <Field label="Blood Type" value={form.bloodType ?? ""} onChange={(v) => set("bloodType", v)} />
      </div>
      <Field label="Contact Number" value={form.contactNumber} onChange={(v) => set("contactNumber", v)} />
      <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
        <Field label="Address" value={form.address} onChange={(v) => set("address", v)} />
        <Field label="City" value={form.city} onChange={(v) => set("city", v)} />
        <Field label="Zip Code" value={form.zipCode} onChange={(v) => set("zipCode", v)} />
      </div>
      <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
        <Field label="Emergency Contact Name" value={form.emergencyContactName ?? ""} onChange={(v) => set("emergencyContactName", v)} />
        <Field label="Relationship" value={form.emergencyContactRelationship ?? ""} onChange={(v) => set("emergencyContactRelationship", v)} />
        <Field label="Emergency Contact Number" value={form.emergencyContactNumber ?? ""} onChange={(v) => set("emergencyContactNumber", v)} />
      </div>
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <Field label="HMO Provider" value={form.hmoProvider ?? ""} onChange={(v) => set("hmoProvider", v)} />
        <Field label="HMO Card #" value={form.hmoCardNumber ?? ""} onChange={(v) => set("hmoCardNumber", v)} />
      </div>
      <Field label="PhilHealth #" value={form.philHealthNumber ?? ""} onChange={(v) => set("philHealthNumber", v)} />
      <div className="space-y-xs">
        <label className="text-label-md text-on-surface-variant">Email</label>
        <input
          readOnly
          value={form.email}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-body-md text-on-surface-variant"
        />
        <p className="text-label-sm text-on-surface-variant">Contact staff to update your email.</p>
      </div>
      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
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

  return (
    <div className="space-y-md">
      {savedAt && <Toast key={savedAt} variant="success" message="Password updated." />}
      {error && <p className="rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{error}</p>}
      <Field label="Current Password" type="password" value={currentPassword} onChange={setCurrentPassword} />
      <Field label="New Password" type="password" value={newPassword} onChange={setNewPassword} />
      <Field label="Confirm Password" type="password" value={confirmPassword} onChange={setConfirmPassword} />
      <Button onClick={handleUpdate} disabled={!canUpdate || updating}>
        {updating ? "Updating…" : "Update Password"}
      </Button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-xs">
      <label className="text-label-md text-on-surface-variant">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-outline-variant px-md py-sm text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

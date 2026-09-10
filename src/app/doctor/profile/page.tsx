"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AppShell } from "@/components/shell/AppShell";
import { Icon } from "@/components/ui/Icon";
import { Toast } from "@/components/ui/Toast";
import { useSession } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import { queryDoctorById, updateDoctor } from "@/lib/data/doctors";
import { updateStaffAccount } from "@/lib/data/staff";
import { changePassword } from "@/lib/auth/account";

interface DoctorProfile {
  fullName: string;
  email: string;
  specialization: string;
  bio: string;
  consultationFee: string;
  licenseNumber: string;
  ptrNumber: string;
  s2Number: string;
}

// Stitch doctor_profile_settings. Previously hardcoded `mockDoctors[0]` —
// not even tied to the actual signed-in doctor — and every field was
// `defaultValue=`-only with no Save handler at all (confirmed by direct
// read, Implementation-Phases/05-doctors-staff.md §4). No schedule editing
// here (that's doctor/schedule/page.tsx, Phase 3c) and no services
// reassignment (admin-only, via DoctorForm.tsx).
export default function DoctorProfilePage() {
  const { session } = useSession();
  const doctorId = session?.staffId;
  const [profile, setProfile] = useState<DoctorProfile | null>(null);

  useEffect(() => {
    if (!doctorId) return;
    const id = doctorId;
    async function load() {
      const supabase = createClient();
      const data = await queryDoctorById(supabase, id);
      if (data) {
        const staff = data.staff_accounts;
        setProfile({
          fullName: staff?.full_name ?? "",
          email: staff?.email ?? "",
          specialization: data.specialization,
          bio: data.bio ?? "",
          consultationFee: String(data.consultation_fee),
          licenseNumber: data.license_number ?? "",
          ptrNumber: data.ptr_number ?? "",
          s2Number: data.s2_number ?? "",
        });
      }
    }
    load();
  }, [doctorId]);

  if (!profile || !doctorId) {
    return (
      <AppShell role="doctor">
        <p className="text-body-md text-on-surface-variant">Loading your profile…</p>
      </AppShell>
    );
  }

  return (
    <AppShell role="doctor">
      <ProfileCard key={doctorId} doctorId={doctorId} initial={profile} />
    </AppShell>
  );
}

function ProfileCard({ doctorId, initial }: { doctorId: string; initial: DoctorProfile }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function set<K extends keyof DoctorProfile>(key: K, value: DoctorProfile[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    await Promise.all([
      updateDoctor(supabase, doctorId, {
        specialization: form.specialization,
        bio: form.bio || null,
        consultation_fee: Number(form.consultationFee) || 0,
        license_number: form.licenseNumber || null,
        ptr_number: form.ptrNumber || null,
        s2_number: form.s2Number || null,
      }),
      updateStaffAccount(supabase, doctorId, { full_name: form.fullName }),
    ]);
    setSaving(false);
    setSavedAt(new Date().toLocaleTimeString());
  }

  return (
    <Card className="mx-auto max-w-[40rem] space-y-lg">
      {savedAt && <Toast key={savedAt} variant="success" message={`Profile saved at ${savedAt}.`} />}
      <div className="flex items-center gap-lg">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-container-high">
          <Icon name="person" className="text-[32px] text-on-surface-variant" />
        </div>
        <Button variant="secondary" disabled title="Real photo upload needs Supabase Storage — not wired yet.">
          Change Photo
        </Button>
      </div>

      <div className="space-y-md">
        <div className="space-y-xs">
          <label className="text-label-md text-on-surface-variant">Full Name</label>
          <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" />
        </div>
        <div className="space-y-xs">
          <label className="text-label-md text-on-surface-variant">Specialization</label>
          <input value={form.specialization} onChange={(e) => set("specialization", e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" />
        </div>
        <div className="space-y-xs">
          <label className="text-label-md text-on-surface-variant">Bio</label>
          <textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={3} className="w-full rounded-lg border border-outline-variant p-md" />
        </div>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="space-y-xs">
            <label className="text-label-md text-on-surface-variant">Consultation Fee</label>
            <input value={form.consultationFee} onChange={(e) => set("consultationFee", e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" />
          </div>
          <div className="space-y-xs">
            <label className="text-label-md text-on-surface-variant">License #</label>
            <input value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" />
          </div>
          <div className="space-y-xs">
            <label className="text-label-md text-on-surface-variant">PTR #</label>
            <input value={form.ptrNumber} onChange={(e) => set("ptrNumber", e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" />
          </div>
          <div className="space-y-xs">
            <label className="text-label-md text-on-surface-variant">S2 #</label>
            <input value={form.s2Number} onChange={(e) => set("s2Number", e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="space-y-sm border-t border-outline-variant pt-lg">
        <p className="text-body-md text-on-surface-variant">Schedule settings summary</p>
        <Link href="/doctor/schedule" className="text-label-md text-primary hover:underline">
          Go to Schedule
        </Link>
      </div>

      <ChangePasswordSection />
    </Card>
  );
}

function ChangePasswordSection() {
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
    <div className="space-y-md border-t border-outline-variant pt-lg">
      <h3 className="text-headline-sm text-on-surface">Change Password</h3>
      {savedAt && <Toast key={savedAt} variant="success" message="Password updated." />}
      {error && <p className="rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{error}</p>}
      <input
        placeholder="Current Password"
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        className="w-full rounded-lg border border-outline-variant px-md py-sm"
      />
      <input
        placeholder="New Password"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="w-full rounded-lg border border-outline-variant px-md py-sm"
      />
      <input
        placeholder="Confirm Password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="w-full rounded-lg border border-outline-variant px-md py-sm"
      />
      <Button onClick={handleUpdate} disabled={!canUpdate || updating}>
        {updating ? "Updating…" : "Update Password"}
      </Button>
    </div>
  );
}

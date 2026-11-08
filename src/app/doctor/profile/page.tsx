"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DoctorPageHeader } from "@/components/doctor/DoctorPageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { AppShell } from "@/components/shell/AppShell";
import { Toast } from "@/components/ui/Toast";
import { useSession } from "@/components/providers/SessionProvider";
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
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!doctorId) return;
    const id = doctorId;
    let cancelled = false;
    async function load() {
      try {
      const supabase = null as never;
      const data = await queryDoctorById(supabase, id);
      if (cancelled) return;
      if (!data) throw new Error("Profile unavailable");
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
      } catch { if (!cancelled) setLoadError(true); }
    }
    load();
    return () => { cancelled = true; };
  }, [doctorId, attempt]);

  if (loadError) return <AppShell role="doctor"><ErrorState title="Profile unavailable" message="Your profile could not be loaded. Please try again." onRetry={() => { setLoadError(false); setAttempt(a => a + 1); }} /></AppShell>;

  if (!profile || !doctorId) {
    return (
      <AppShell role="doctor">
        <SkeletonCard lines={6} />
      </AppShell>
    );
  }

  return (
    <AppShell role="doctor">
      <div className="mx-auto max-w-4xl space-y-xl"><DoctorPageHeader title="Your profile" description="Manage your professional identity and the details used on prescriptions." /><ProfileCard key={doctorId} doctorId={doctorId} initial={profile} /></div>
    </AppShell>
  );
}

function ProfileCard({ doctorId, initial }: { doctorId: string; initial: DoctorProfile }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function set<K extends keyof DoctorProfile>(key: K, value: DoctorProfile[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.fullName.trim() || !Number.isFinite(Number(form.consultationFee)) || Number(form.consultationFee) < 0) { setSaveError("Enter your full name and a valid non-negative consultation fee."); return; }
    setSaving(true);
    setSaveError("");
    try {
    const supabase = null as never;
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
    setSavedAt(new Date().toLocaleTimeString("en-PH", { timeZone: "Asia/Manila" }));
    } catch { setSaveError("Some profile changes could not be saved. Please review your details and try again."); }
    finally { setSaving(false); }
  }

  return (
    <Card className="space-y-xl">
      {savedAt && <Toast key={savedAt} variant="success" message={`Profile saved at ${savedAt}.`} />}
      <div className="space-y-sm border-b border-outline-variant pb-lg"><h2 className="text-headline-md font-semibold text-on-surface">Professional details</h2><p className="text-body-md text-on-surface-variant">{form.email}</p></div>
      {saveError && <Toast variant="error" key={saveError} message={saveError} />}

      <div className="space-y-md">
        <div className="space-y-xs">
          <label htmlFor="profile-fullName" className="text-label-md font-medium text-on-surface">Full Name</label>
          <input id="profile-fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" />
        </div>
        <div className="space-y-xs">
          <label htmlFor="profile-specialization" className="text-label-md font-medium text-on-surface">Specialization</label>
          <input id="profile-specialization" value={form.specialization} onChange={(e) => set("specialization", e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" />
        </div>
        <div className="space-y-xs">
          <label htmlFor="profile-bio" className="text-label-md font-medium text-on-surface">Bio</label>
          <textarea id="profile-bio" value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={3} className="w-full rounded-lg border border-outline-variant p-md" />
        </div>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="space-y-xs">
            <label htmlFor="profile-consultationFee" className="text-label-md font-medium text-on-surface">Consultation Fee</label>
            <input id="profile-consultationFee" value={form.consultationFee} onChange={(e) => set("consultationFee", e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" />
          </div>
          <div className="space-y-xs">
            <label htmlFor="profile-licenseNumber" className="text-label-md font-medium text-on-surface">License #</label>
            <input id="profile-licenseNumber" value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" />
          </div>
          <div className="space-y-xs">
            <label htmlFor="profile-ptrNumber" className="text-label-md font-medium text-on-surface">PTR #</label>
            <input id="profile-ptrNumber" value={form.ptrNumber} onChange={(e) => set("ptrNumber", e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" />
          </div>
          <div className="space-y-xs">
            <label htmlFor="profile-s2Number" className="text-label-md font-medium text-on-surface">S2 #</label>
            <input id="profile-s2Number" value={form.s2Number} onChange={(e) => set("s2Number", e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" />
          </div>
        </div>
        <Button onClick={handleSave} loading={saving}>
          {saving ? "Saving profile…" : "Save profile"}
        </Button>
      </div>

      <div className="space-y-sm border-t border-outline-variant pt-lg">
        <p className="text-body-md text-on-surface-variant">Clinic availability</p>
        <Link href="/doctor/schedule" className="text-label-md text-primary hover:underline">
          Manage availability
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
      <label className="block space-y-xs"><span className="text-label-md font-medium text-on-surface">Current Password</span><input
        aria-label="Current Password"
        placeholder="Current Password"
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        className="w-full rounded-lg border border-outline-variant px-md py-sm"
      /></label>
      <label className="block space-y-xs"><span className="text-label-md font-medium text-on-surface">New Password</span><input
        aria-label="New Password"
        placeholder="New Password"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="w-full rounded-lg border border-outline-variant px-md py-sm"
      /></label>
      <label className="block space-y-xs"><span className="text-label-md font-medium text-on-surface">Confirm Password</span><input
        aria-label="Confirm Password"
        placeholder="Confirm Password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="w-full rounded-lg border border-outline-variant px-md py-sm"
      /></label>
      <Button onClick={handleUpdate} disabled={!canUpdate} loading={updating}>
        {updating ? "Updating…" : "Update Password"}
      </Button>
    </div>
  );
}

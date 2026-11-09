"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormAlert } from "@/components/ui/FormAlert";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { inputStyles, labelStyles, hintStyles } from "@/components/ui/fieldStyles";
import { formatClinicDateTime } from "@/lib/format";
import { useSession } from "@/components/providers/SessionProvider";
import { updateStaffAccount, queryStaffById } from "@/lib/data/staff";
import { changePassword } from "@/lib/auth/account";

interface StaffProfile {
  fullName: string;
  contactNumber: string;
  email: string;
}

// Stitch staff_profile.
export default function StaffProfilePage() {
  const { session, loading } = useSession();
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!session?.staffId) return;
    const staffId = session.staffId;

    async function load() {
      const supabase = null as never;
      try {
        const data = await queryStaffById(supabase, staffId);
        setLoadError(false);
        if (data) {
          setProfile({
            fullName: data.full_name,
            contactNumber: data.contact_number ?? "",
            email: data.email,
          });
        }
      } catch {
        setLoadError(true);
      }
    }

    load();
  }, [session?.staffId, reloadKey]);

  return (
    <AppShell role="staff">
      <div className="mx-auto max-w-[36rem] space-y-lg">
        <PageHeader title="Your profile" description="Your name and number as the clinic sees them, and your sign-in password." />
        {loadError && !profile ? (
          <ErrorState title="Your profile didn’t load" message="Check the connection to the clinic server, then try again." onRetry={() => setReloadKey((k) => k + 1)} />
        ) : loading || !session?.staffId || !profile ? (
          <div className="space-y-lg" aria-busy="true"><SkeletonCard lines={4} /><SkeletonCard lines={3} /></div>
        ) : (
          <>
            <ProfileCard key={session.staffId} staffId={session.staffId} initial={profile} />
            <ChangePasswordSection />
          </>
        )}
      </div>
    </AppShell>
  );
}

function ProfileCard({ staffId, initial }: { staffId: string; initial: StaffProfile }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const dirty = form.fullName !== initial.fullName || form.contactNumber !== initial.contactNumber;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) {
      setError("Enter your full name.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = null as never;
    try {
      await updateStaffAccount(supabase, staffId, {
        full_name: form.fullName,
        contact_number: form.contactNumber || null,
      });
      setSavedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Your profile wasn’t saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSave} className="space-y-md" noValidate>
        <h2 className="text-headline-sm text-on-surface">Details</h2>
        {savedAt && <FormAlert tone="success">Saved {formatClinicDateTime(savedAt)}.</FormAlert>}
        {error && <FormAlert>{error}</FormAlert>}
        <div className="space-y-xs">
          <label htmlFor="fullName" className={labelStyles}>Full name</label>
          <input id="fullName" autoComplete="name" value={form.fullName} onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))} className={inputStyles()} />
        </div>
        <div className="space-y-xs">
          <label htmlFor="contactNumber" className={labelStyles}>Contact number</label>
          <input id="contactNumber" type="tel" autoComplete="tel" inputMode="tel" value={form.contactNumber} onChange={(e) => setForm((prev) => ({ ...prev, contactNumber: e.target.value }))} className={inputStyles("tabular-nums")} />
        </div>
        <div className="space-y-xs">
          <label htmlFor="email" className={labelStyles}>Email</label>
          <input id="email" readOnly value={form.email} className={inputStyles("bg-surface-container-low text-on-surface-variant")} />
          <p className={hintStyles}>Ask an admin to change the email you sign in with.</p>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!dirty && !saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const mismatch = confirmPassword !== "" && newPassword !== confirmPassword;
  const canUpdate = currentPassword.trim() !== "" && newPassword.length >= 6 && newPassword === confirmPassword;

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!canUpdate) return;
    setError("");
    setSaved(false);
    setUpdating(true);
    try {
      await changePassword(currentPassword, newPassword);
    } catch (err) {
      setUpdating(false);
      setError(err instanceof Error ? err.message : "Could not update the password.");
      return;
    }
    setUpdating(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSaved(true);
  }

  return (
    <Card>
      <form onSubmit={handleUpdate} className="space-y-md" noValidate>
        <h2 className="text-headline-sm text-on-surface">Change password</h2>
        {saved && <FormAlert tone="success">Password updated. Use it the next time you sign in.</FormAlert>}
        {error && <FormAlert>{error}</FormAlert>}
        <div className="space-y-xs">
          <label htmlFor="currentPassword" className={labelStyles}>Current password</label>
          <input id="currentPassword" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputStyles()} />
        </div>
        <div className="space-y-xs">
          <label htmlFor="newPassword" className={labelStyles}>New password</label>
          <input id="newPassword" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} aria-describedby="newPasswordHint" className={inputStyles()} />
          <p id="newPasswordHint" className={hintStyles}>At least 6 characters.</p>
        </div>
        <div className="space-y-xs">
          <label htmlFor="confirmPassword" className={labelStyles}>Confirm new password</label>
          <input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} aria-invalid={mismatch || undefined} aria-describedby={mismatch ? "confirmPasswordHint" : undefined} className={inputStyles()} />
          {mismatch && <p id="confirmPasswordHint" className="text-label-md text-status-danger">Passwords don’t match yet.</p>}
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" loading={updating} disabled={!canUpdate}>
            {updating ? "Updating…" : "Update password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

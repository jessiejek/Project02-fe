"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AppShell } from "@/components/shell/AppShell";
import { Icon } from "@/components/ui/Icon";
import { Toast } from "@/components/ui/Toast";
import { useSession } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import { updateStaffAccount } from "@/lib/data/staff";

interface StaffProfile {
  fullName: string;
  contactNumber: string;
  email: string;
}

// Stitch staff_profile.
export default function StaffProfilePage() {
  const { session, loading } = useSession();
  const [profile, setProfile] = useState<StaffProfile | null>(null);

  useEffect(() => {
    if (!session?.staffId) return;
    const staffId = session.staffId;

    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("staff_accounts")
        .select("full_name, contact_number, email")
        .eq("staff_id", staffId)
        .single();

      if (data) {
        setProfile({
          fullName: data.full_name,
          contactNumber: data.contact_number ?? "",
          email: data.email,
        });
      }
    }

    load();
  }, [session?.staffId]);

  if (loading || !session?.staffId || !profile) {
    return (
      <AppShell role="staff">
        <p className="text-body-md text-on-surface-variant">Loading your profile...</p>
      </AppShell>
    );
  }

  return (
    <AppShell role="staff">
      <ProfileCard key={session.staffId} staffId={session.staffId} initial={profile} />
    </AppShell>
  );
}

function ProfileCard({ staffId, initial }: { staffId: string; initial: StaffProfile }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    await updateStaffAccount(supabase, staffId, {
      full_name: form.fullName,
      contact_number: form.contactNumber || null,
    });
    setSaving(false);
    setSavedAt(new Date().toLocaleTimeString());
  }

  return (
    <Card className="mx-auto max-w-[36rem] space-y-lg">
      {savedAt && <Toast key={savedAt} variant="success" message={`Profile saved at ${savedAt}.`} />}
      <div className="flex items-center gap-lg">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-container-high">
          <Icon name="person" className="text-[32px] text-on-surface-variant" />
        </div>
        <div>
          <Button variant="secondary" disabled title="Real photo upload needs Supabase Storage — not wired yet.">
            Change Photo
          </Button>
          <p className="mt-xs text-label-sm text-on-surface-variant">jpeg/png/gif/webp, max 5MB</p>
        </div>
      </div>

      <div className="space-y-md">
        <div className="space-y-xs">
          <label className="text-label-md text-on-surface-variant">Full Name</label>
          <input
            value={form.fullName}
            onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
            className="w-full rounded-lg border border-outline-variant px-md py-sm"
          />
        </div>
        <div className="space-y-xs">
          <label className="text-label-md text-on-surface-variant">Contact Number</label>
          <input
            value={form.contactNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, contactNumber: e.target.value }))}
            className="w-full rounded-lg border border-outline-variant px-md py-sm"
          />
        </div>
        <div className="space-y-xs">
          <label className="text-label-md text-on-surface-variant">Email</label>
          <input
            readOnly
            value={form.email}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-on-surface-variant"
          />
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <ChangePasswordSection email={form.email} />
    </Card>
  );
}

function ChangePasswordSection({ email }: { email: string }) {
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
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (verifyError) {
      setUpdating(false);
      setError("Current password is incorrect.");
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setUpdating(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
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
        {updating ? "Updating..." : "Update Password"}
      </Button>
    </div>
  );
}

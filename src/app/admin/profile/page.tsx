"use client";
// JJQR - AI (Nov 22, 2026) - owner: the Admin could not change their password. "My account": change password + change email (same server calls as every other role).
import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormAlert } from "@/components/ui/FormAlert";
import { inputStyles, labelStyles, hintStyles } from "@/components/ui/fieldStyles";
import { PASSWORD_MIN_LENGTH, PASSWORD_HINT } from "@/lib/password-rules";
import { changePassword } from "@/lib/auth/account";
import { ChangeEmailCard } from "@/components/profile/ChangeEmailCard";

function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const mismatch = confirm !== "" && next !== confirm;
  const can = current.trim() !== "" && next.length >= PASSWORD_MIN_LENGTH && next === confirm;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!can) return;
    setSaving(true); setError(""); setDone(false);
    try { await changePassword(current, next); setCurrent(""); setNext(""); setConfirm(""); setDone(true); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not update the password."); }
    finally { setSaving(false); }
  }
  const type = show ? "text" : "password";
  return (
    <Card>
      <form onSubmit={submit} className="space-y-md" noValidate>
        <h2 className="text-headline-sm text-on-surface">Change password</h2>
        {done && <FormAlert tone="success">Password updated. Use it the next time you sign in.</FormAlert>}
        {error && <FormAlert>{error}</FormAlert>}
        <div className="space-y-xs"><label htmlFor="adminCurrent" className={labelStyles}>Current password</label>
          <input id="adminCurrent" type={type} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputStyles()} /></div>
        <div className="space-y-xs"><label htmlFor="adminNew" className={labelStyles}>New password</label>
          <input id="adminNew" type={type} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputStyles()} />
          <p className={hintStyles}>{PASSWORD_HINT}</p></div>
        <div className="space-y-xs"><label htmlFor="adminConfirm" className={labelStyles}>Confirm new password</label>
          <input id="adminConfirm" type={type} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputStyles()} />
          {mismatch && <p className="text-label-md text-status-danger">Passwords don’t match yet.</p>}</div>
        <label className="flex items-center gap-sm text-body-sm text-on-surface-variant"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords</label>
        <div className="flex justify-end"><Button type="submit" variant="secondary" loading={saving} disabled={!can}>{saving ? "Updating…" : "Update password"}</Button></div>
      </form>
    </Card>
  );
}

export default function AdminProfilePage() {
  return (
    <AppShell role="admin">
      <div className="mx-auto max-w-[36rem] space-y-lg">
        <PageHeader title="My account" description="Change your sign-in password and email." />
        <ChangePasswordCard />
        <ChangeEmailCard />
      </div>
    </AppShell>
  );
}
// JJQR - END

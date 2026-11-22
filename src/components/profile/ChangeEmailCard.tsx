"use client";
// JJQR - AI (Nov 22, 2026) - owner: every profile (patient, staff, doctor, admin) can change its own sign-in email. The current password is required; the server checks the address and that nobody else uses it.
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormAlert } from "@/components/ui/FormAlert";
import { inputStyles, labelStyles, hintStyles } from "@/components/ui/fieldStyles";
import { changeEmail } from "@/lib/auth/account";

export function ChangeEmailCard({ currentEmail, onChanged }: { currentEmail?: string; onChanged?: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [shown, setShown] = useState(currentEmail ?? "");

  const canSave = email.includes("@") && password.trim() !== "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true); setError(""); setDone("");
    try {
      const saved = await changeEmail(password, email.trim());
      setShown(saved); setEmail(""); setPassword(""); setDone("Email changed. Use the new email the next time you sign in.");
      onChanged?.(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the email.");
    } finally { setSaving(false); }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-md" noValidate>
        <h2 className="text-headline-sm text-on-surface">Change email</h2>
        {shown && <p className={hintStyles}>Signed in as <span className="text-on-surface">{shown}</span></p>}
        {done && <FormAlert tone="success">{done}</FormAlert>}
        {error && <FormAlert>{error}</FormAlert>}
        <div className="space-y-xs">
          <label htmlFor="newEmail" className={labelStyles}>New email</label>
          <input id="newEmail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputStyles()} />
        </div>
        <div className="space-y-xs">
          <label htmlFor="emailCurrentPassword" className={labelStyles}>Current password</label>
          <input id="emailCurrentPassword" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputStyles()} />
          <p className={hintStyles}>Needed to confirm it is you.</p>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" loading={saving} disabled={!canSave}>{saving ? "Changing…" : "Change email"}</Button>
        </div>
      </form>
    </Card>
  );
}
// JJQR - END

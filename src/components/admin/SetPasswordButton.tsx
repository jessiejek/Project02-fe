"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormAlert } from "@/components/ui/FormAlert";
import { hintStyles, inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { setStaffPassword } from "@/app/actions/setStaffPassword";

/** Admin support: set a temporary password for a Staff or Doctor member. They choose their own at next sign-in. */
export function SetPasswordButton({ staffId, name, className }: { staffId: string; name: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function close() {
    setOpen(false);
    setPw("");
    setAgain("");
    setError("");
    setDone(false);
  }

  async function save() {
    setError("");
    if (!pw) return setError("Type a new password.");
    if (pw !== again) return setError("The two passwords do not match.");
    setSaving(true);
    const r = await setStaffPassword(staffId, pw).catch(() => ({ success: false as const, error: "The password could not be set. Try again." }));
    setSaving(false);
    if (!r.success) return setError(r.error);
    setPw("");
    setAgain("");
    setDone(true);
  }

  return (
    <>
      <Button type="button" variant="secondary" className={className} onClick={() => setOpen(true)}>Set password</Button>
      <Modal
        isOpen={open}
        onClose={close}
        title="Set password"
        footer={
          done ? (
            <Button type="button" onClick={close}>Done</Button>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={close} disabled={saving}>Cancel</Button>
              <Button type="button" onClick={save} loading={saving}>Set password</Button>
            </>
          )
        }
      >
        {done ? (
          <p className="text-body-md text-on-surface">{name} can sign in with the new password and will then choose their own.</p>
        ) : (
          <form className="space-y-md" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <p className={hintStyles}>Set a temporary password for {name}. Tell them in person. They are asked to choose their own at next sign-in, and any computer they are signed in on is signed out.</p>
            {error && <FormAlert>{error}</FormAlert>}
            <div className="space-y-xs">
              <label htmlFor="sp-new" className={labelStyles}>New password (12 or more characters)</label>
              <input id="sp-new" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputStyles()} />
            </div>
            <div className="space-y-xs">
              <label htmlFor="sp-again" className={labelStyles}>Confirm password</label>
              <input id="sp-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={inputStyles()} />
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { FormAlert } from "@/components/ui/FormAlert";
import { AuthShell } from "@/components/auth/AuthShell";
import { inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { requestPasswordReset } from "@/lib/auth/account";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSentTo("");
    setSubmitting(true);
    const target = email.trim();
    await requestPasswordReset(target);
    setSubmitting(false);
    setSentTo(target);
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Enter the email on your account and we'll send a link to choose a new password."
      footer={<Link href="/login" className="font-medium text-primary hover:underline">Back to log in</Link>}
    >
      <form className="space-y-md" onSubmit={handleSubmit}>
        {/* Deliberately identical for every address: never reveals whether an account exists. */}
        {sentTo && (
          <FormAlert tone="success">
            If an account exists for <span className="break-all font-medium">{sentTo}</span>, a reset link has been sent. Check your inbox and spam folder.
          </FormAlert>
        )}
        <div className="space-y-xs">
          <label htmlFor="email" className={labelStyles}>Email</label>
          <input id="email" type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} className={inputStyles()} />
        </div>
        <Button type="submit" className="w-full" loading={submitting}>
          {submitting ? "Sending link…" : sentTo ? "Send another link" : "Send reset link"}
        </Button>
      </form>
    </AuthShell>
  );
}

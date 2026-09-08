"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    const supabase = createClient();
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    setSubmitting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSuccess("If an account exists for that email, a reset link has been sent.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-container-low p-lg">
      <div className="w-full max-w-[26rem] rounded-xl border border-outline-variant bg-surface-container-lowest p-xl shadow-sm">
        <div className="mb-lg text-center">
          <h1 className="text-headline-md text-primary">Forgot password</h1>
          <p className="mt-xs text-body-md text-on-surface-variant">Enter your account email to receive a reset link.</p>
        </div>
        <form className="space-y-md" onSubmit={handleSubmit}>
          {error && <p className="rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{error}</p>}
          {success && <p className="rounded-lg bg-green-50 px-md py-sm text-body-sm text-green-800">{success}</p>}
          <div className="space-y-xs">
            <label htmlFor="email" className="text-label-md text-on-surface-variant">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-outline-variant px-md py-md text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Sending..." : "Send reset link"}
          </Button>
        </form>
        <Link href="/login" className="mt-lg inline-block text-label-md text-primary hover:underline">
          Back to login
        </Link>
      </div>
    </div>
  );
}

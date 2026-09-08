"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const ROLE_TO_SEGMENT: Record<string, string> = {
  Patient: "patient",
  Staff: "staff",
  Doctor: "doctor",
  Admin: "admin",
};

// Stitch screen_1_login — shared entry point before any portal.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.user) {
      setError("Incorrect email or password.");
      setSubmitting(false);
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    const segment = profile ? ROLE_TO_SEGMENT[profile.role] : undefined;
    if (!segment) {
      setError("This account has no role assigned. Contact an administrator.");
      setSubmitting(false);
      return;
    }
    router.push(`/${segment}/dashboard`);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-container-low p-lg">
      <div className="w-full max-w-[26rem] rounded-xl border border-outline-variant bg-surface-container-lowest p-xl shadow-sm">
        <div className="mb-lg text-center">
          <h1 className="text-headline-md text-primary">Dr. Grace Gavino Medical Clinic</h1>
          <p className="mt-xs text-body-md text-on-surface-variant">Log in</p>
        </div>
        <form className="space-y-md" onSubmit={handleSubmit}>
          {error && <p className="rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{error}</p>}
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
          <div className="space-y-xs">
            <label htmlFor="password" className="text-label-md text-on-surface-variant">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-outline-variant px-md py-md text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Link href="/forgot-password" className="inline-block text-label-sm text-on-surface-variant hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Logging in…" : "Log in"}
          </Button>
        </form>
        <div className="my-lg flex items-center gap-md text-label-sm text-on-surface-variant">
          <div className="h-px flex-1 bg-outline-variant" />
          New here?
          <div className="h-px flex-1 bg-outline-variant" />
        </div>
        <Link href="/booking" className="block">
          <Button type="button" variant="secondary" className="w-full">
            Create an account
          </Button>
        </Link>
      </div>
    </div>
  );
}

"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/Button";
import { FormAlert } from "@/components/ui/FormAlert";
import { AuthShell } from "@/components/auth/AuthShell";
import { inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { safeNext } from "@/lib/auth/next";

const ROLE_TO_SEGMENT: Record<string, string> = {
  Patient: "patient",
  Staff: "staff",
  Doctor: "doctor",
  Admin: "admin",
};

// Shared entry point before any portal.
function LoginPageForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const segment = await loginDotnet(email, password).catch(() => ({ error: "We couldn't reach the clinic server. Check your connection and try again." }));

    if (typeof segment !== "string") {
      setError(segment.error);
      setSubmitting(false);
      return;
    }
    router.push(segment === "patient" && next ? next : `/${segment}/dashboard`);
    router.refresh();
  }

  async function loginDotnet(email: string, password: string): Promise<string | { error: string }> {
    const res = await fetch("/api/session/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = (await res.json().catch(() => ({}))) as { role?: string; error?: string };
    if (!res.ok || !body.role) return { error: body.error ?? "Incorrect email or password." };
    const segment = ROLE_TO_SEGMENT[body.role];
    return segment ?? { error: "This account has no role assigned. Contact an administrator." };
  }

  return (
    <AuthShell
      title="Log in to your account"
      description="Patients, doctors, staff and administrators all sign in here."
      footer={<>New patient?{" "}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-medium text-primary hover:underline">
          Create an account
        </Link></>}
    >
      <form className="space-y-md" onSubmit={handleSubmit}>
        {error && <FormAlert>{error}</FormAlert>}
        <div className="space-y-xs">
          <label htmlFor="email" className={labelStyles}>Email</label>
          <input id="email" type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} className={inputStyles()} />
        </div>
        <div className="space-y-xs">
          <div className="flex items-baseline justify-between gap-md">
            <label htmlFor="password" className={labelStyles}>Password</label>
            <Link href="/forgot-password" className="text-label-md text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)} className={inputStyles("pr-12")} />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-on-surface-variant hover:text-on-surface"
            >
              <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="h-4 w-4" />
            </button>
          </div>
        </div>
        <Button type="submit" className="w-full" loading={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageForm />
    </Suspense>
  );
}

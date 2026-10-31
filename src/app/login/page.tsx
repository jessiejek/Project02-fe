"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/Button";
import { VersionFooter } from "@/components/shell/VersionFooter";
import { safeNext } from "@/lib/auth/next";

const ROLE_TO_SEGMENT: Record<string, string> = {
  Patient: "patient",
  Staff: "staff",
  Doctor: "doctor",
  Admin: "admin",
};

// Stitch screen_1_login — shared entry point before any portal.
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

    const segment = await loginDotnet(email, password);

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
    <div className="flex min-h-screen flex-col bg-surface-container-low">
      <div className="flex flex-1 items-center justify-center p-lg">
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
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant px-md py-md pr-12 text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center px-md text-on-surface-variant hover:text-on-surface"
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="h-4 w-4" />
                </button>
              </div>
              <Link href="/forgot-password" className="inline-block text-label-sm text-on-surface-variant hover:underline">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" loading={submitting}>
              {submitting ? "Logging in…" : "Log in"}
            </Button>
            <p className="text-center text-label-sm text-on-surface-variant">
              New patient?{" "}
              <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="text-primary hover:underline">
                Create an account
              </Link>
            </p>
          </form>
        </div>
      </div>
      <VersionFooter />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageForm />
    </Suspense>
  );
}

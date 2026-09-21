"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { VersionFooter } from "@/components/shell/VersionFooter";
import { safeNext } from "@/lib/auth/next";
import { todayManila } from "@/lib/clock";

// Public self-registration — creates a Patient-role account directly (no staff
// intake needed) and logs the patient straight into their portal.
function RegisterPageForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState<"" | "Male" | "Female">("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/session/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        middleName: middleName || undefined,
        lastName,
        dateOfBirth,
        sex,
        contactNumber: contactNumber || undefined,
        email,
        password,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { role?: string; error?: string };
    if (!res.ok || !body.role) {
      setError(body.error ?? "Could not create your account.");
      setSubmitting(false);
      return;
    }

    router.push(next ?? "/patient/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-container-low">
      <div className="flex flex-1 items-center justify-center p-lg">
        <div className="w-full max-w-[26rem] rounded-xl border border-outline-variant bg-surface-container-lowest p-xl shadow-sm">
          <div className="mb-lg text-center">
            <h1 className="text-headline-md text-primary">Dr. Grace Gavino Medical Clinic</h1>
            <p className="mt-xs text-body-md text-on-surface-variant">Create your patient account</p>
          </div>
          <form className="space-y-md" onSubmit={handleSubmit}>
            {error && <p className="rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{error}</p>}
            <div className="grid grid-cols-2 gap-sm">
              <div className="space-y-xs">
                <label htmlFor="firstName" className="text-label-md text-on-surface-variant">
                  First name
                </label>
                <input
                  id="firstName"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant px-md py-md text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-xs">
                <label htmlFor="lastName" className="text-label-md text-on-surface-variant">
                  Last name
                </label>
                <input
                  id="lastName"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant px-md py-md text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="space-y-xs">
              <label htmlFor="middleName" className="text-label-md text-on-surface-variant">
                Middle name (optional)
              </label>
              <input
                id="middleName"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                className="w-full rounded-lg border border-outline-variant px-md py-md text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-sm">
              <div className="space-y-xs">
                <label htmlFor="dateOfBirth" className="text-label-md text-on-surface-variant">
                  Date of birth
                </label>
                <input
                  id="dateOfBirth"
                  type="date"
                  required
                  max={todayManila()}
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant px-md py-md text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-xs">
                <label htmlFor="sex" className="text-label-md text-on-surface-variant">
                  Sex
                </label>
                <select
                  id="sex"
                  required
                  value={sex}
                  onChange={(e) => setSex(e.target.value as "" | "Male" | "Female")}
                  className="w-full rounded-lg border border-outline-variant bg-transparent px-md py-md text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="" disabled>Select…</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>
            <div className="space-y-xs">
              <label htmlFor="contactNumber" className="text-label-md text-on-surface-variant">
                Contact number (optional)
              </label>
              <input
                id="contactNumber"
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className="w-full rounded-lg border border-outline-variant px-md py-md text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-outline-variant px-md py-md text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-xs">
              <label htmlFor="confirmPassword" className="text-label-md text-on-surface-variant">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-outline-variant px-md py-md text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <Button type="submit" className="w-full" loading={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </Button>
            <p className="text-center text-label-sm text-on-surface-variant">
              Already have an account?{" "}
              <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="text-primary hover:underline">
                Log in
              </Link>
            </p>
          </form>
        </div>
      </div>
      <VersionFooter />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterPageForm />
    </Suspense>
  );
}

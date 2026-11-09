"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { FormAlert } from "@/components/ui/FormAlert";
import { AuthShell } from "@/components/auth/AuthShell";
import { hintStyles, inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { safeNext } from "@/lib/auth/next";
import { todayManila } from "@/lib/clock";

const legendStyles = "text-headline-sm text-on-surface";

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
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    let res: Response;
    try {
      res = await fetch("/api/session/register", {
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
    } catch {
      setError("We couldn't reach the clinic server. Check your connection and try again.");
      setSubmitting(false);
      return;
    }
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
    <AuthShell
      wide
      title="Create your patient account"
      description="Use your own details as they appear on your ID. You can book a visit right after."
      footer={<>Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-primary hover:underline">
          Log in
        </Link></>}
    >
      <form className="space-y-xl" onSubmit={handleSubmit}>
        {error && <FormAlert>{error}</FormAlert>}

        <fieldset className="min-w-0 space-y-md">
          <legend className={legendStyles}>About you</legend>
          <div className="grid gap-md sm:grid-cols-2">
            <div className="space-y-xs">
              <label htmlFor="firstName" className={labelStyles}>First name</label>
              <input id="firstName" autoComplete="given-name" required value={firstName}
                onChange={(e) => setFirstName(e.target.value)} className={inputStyles()} />
            </div>
            <div className="space-y-xs">
              <label htmlFor="lastName" className={labelStyles}>Last name</label>
              <input id="lastName" autoComplete="family-name" required value={lastName}
                onChange={(e) => setLastName(e.target.value)} className={inputStyles()} />
            </div>
          </div>
          <div className="space-y-xs">
            <label htmlFor="middleName" className={labelStyles}>
              Middle name <span className="font-normal text-on-surface-variant">(optional)</span>
            </label>
            <input id="middleName" autoComplete="additional-name" value={middleName}
              onChange={(e) => setMiddleName(e.target.value)} className={inputStyles()} />
          </div>
          <div className="grid gap-md sm:grid-cols-2">
            <div className="space-y-xs">
              <label htmlFor="dateOfBirth" className={labelStyles}>Date of birth</label>
              <input id="dateOfBirth" type="date" autoComplete="bday" required max={todayManila()} value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)} className={inputStyles()} />
            </div>
            <div className="space-y-xs">
              <label htmlFor="sex" className={labelStyles}>Sex</label>
              <select id="sex" required value={sex}
                onChange={(e) => setSex(e.target.value as "" | "Male" | "Female")} className={inputStyles()}>
                <option value="" disabled>Select…</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>
          <div className="space-y-xs">
            <label htmlFor="contactNumber" className={labelStyles}>
              Contact number <span className="font-normal text-on-surface-variant">(optional)</span>
            </label>
            <input id="contactNumber" type="tel" autoComplete="tel" value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)} className={inputStyles()} />
          </div>
        </fieldset>

        <fieldset className="min-w-0 space-y-md">
          <legend className={legendStyles}>Sign-in details</legend>
          <div className="space-y-xs">
            <label htmlFor="email" className={labelStyles}>Email</label>
            <input id="email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} className={inputStyles()} />
          </div>
          <div className="grid gap-md sm:grid-cols-2">
            <div className="space-y-xs">
              <label htmlFor="password" className={labelStyles}>Password</label>
              <input id="password" type="password" autoComplete="new-password" required minLength={6} value={password}
                aria-describedby="password-hint" onChange={(e) => setPassword(e.target.value)} className={inputStyles()} />
              <p id="password-hint" className={hintStyles}>At least 6 characters.</p>
            </div>
            <div className="space-y-xs">
              <label htmlFor="confirmPassword" className={labelStyles}>Confirm password</label>
              <input id="confirmPassword" type="password" autoComplete="new-password" required minLength={6} value={confirmPassword}
                aria-invalid={mismatch || undefined} aria-describedby={mismatch ? "confirm-hint" : undefined}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputStyles(mismatch ? "border-status-danger focus:border-status-danger focus:ring-status-danger/20" : undefined)} />
              {mismatch && <p id="confirm-hint" className="text-label-md text-status-danger">Doesn&apos;t match the password yet.</p>}
            </div>
          </div>
        </fieldset>

        <Button type="submit" className="w-full" loading={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterPageForm />
    </Suspense>
  );
}

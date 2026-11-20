"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/components/providers/SessionProvider";
import { decideConsent } from "@/lib/data/privacy"; // JJQR - AI (Nov 20, 2026) - PV-12 // JJQR - END
import { queryClinicSettings, type ClinicSettingsRow } from "@/lib/data/admin";
import { friendlyError } from "@/lib/api/friendly-error";
import { formatClinicDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormAlert } from "@/components/ui/FormAlert";
import { SkeletonCard } from "@/components/ui/Skeleton";

// Stitch screen_3_privacy_consent. Per Patient.md §2 + RA 10173 (PV-12): nothing is pre-ticked, "Decline" is as easy as "Agree"
// (one click, same size and weight, no tick needed), the notice shows its version and date, and every decision is recorded.
// JJQR - AI (Nov 20, 2026) - PV-12
const DEFAULT_SUMMARY =
  "Dr. Grace Gavino Medical Clinic collects and processes your personal and medical information solely for the purpose of providing clinical care, scheduling appointments, and maintaining accurate medical records. Your data will not be shared with third parties without your explicit consent, except where required by law.";

export default function PrivacyConsentPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState<"" | "accept" | "decline">("");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<ClinicSettingsRow | null>(null);

  useEffect(() => {
    let off = false;
    queryClinicSettings().then((s) => { if (!off) setSettings(s); });
    return () => { off = true; };
  }, []);

  async function decide(decision: "Accepted" | "Declined") {
    if (!session?.patientId) return;
    setError("");
    setBusy(decision === "Accepted" ? "accept" : "decline");
    try {
      await decideConsent(session.patientId, decision);
    } catch (e) {
      setBusy("");
      setError(friendlyError(e, "We couldn't save your choice. Please try again."));
      return;
    }
    setBusy("");
    router.push("/patient/dashboard");
    router.refresh();
  }

  const text = settings?.privacy_policy_text?.trim() || DEFAULT_SUMMARY;

  return (
    <AppShell role="patient">
      <div className="mx-auto max-w-[40rem] space-y-lg">
        <PageHeader title="How the clinic uses your information" description="Please read this and make your choice. You can change it at any time in Profile → Privacy." />
        {loading || !session?.patientId ? (
          <SkeletonCard lines={4} />
        ) : (
          <Card>
            <form className="space-y-lg" onSubmit={(e) => { e.preventDefault(); if (accepted) decide("Accepted"); }}>
              <p className="text-label-md text-on-surface-variant">
                Privacy notice version <span className="tabular-nums">{settings?.consent_version ?? "—"}</span>
                {settings?.updated_at ? <> · updated {formatClinicDate(settings.updated_at)}</> : null}
              </p>
              <div className="max-w-copy space-y-sm whitespace-pre-line text-body-md text-on-surface">
                <p>{text}</p>
                <p>
                  <a href="/api/public/privacy-notice" target="_blank" className="underline" rel="noopener">Read the full Privacy Notice</a>{" · "}
                  <a href="/api/public/privacy-notice?lang=fil" target="_blank" className="underline" lang="fil" rel="noopener">Basahin sa Filipino</a>
                </p>
              </div>
              {error && <FormAlert>{error}</FormAlert>}
              <label className="flex min-h-11 cursor-pointer items-start gap-md rounded-lg border border-outline-variant p-md text-body-md text-on-surface has-[:checked]:border-primary has-[:checked]:bg-surface-container-low">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                />
                I have read this and agree to the clinic&apos;s privacy policy.
              </label>
              <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                <Button type="submit" variant="secondary" disabled={!accepted || busy !== ""} loading={busy === "accept"} className="w-full">
                  {busy === "accept" ? "Saving…" : "Agree and continue"}
                </Button>
                <Button type="button" variant="secondary" disabled={busy !== ""} loading={busy === "decline"} onClick={() => decide("Declined")} className="w-full">
                  Decline
                </Button>
              </div>
              <p className="text-label-md text-on-surface-variant">Declining is fine. We will remember your choice and you can change it later.</p>
            </form>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
// JJQR - END

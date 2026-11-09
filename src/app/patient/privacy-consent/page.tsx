"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/components/providers/SessionProvider";
import { updatePatientConsent } from "@/lib/data/patients";
import { queryClinicSettings } from "@/lib/data/admin";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormAlert } from "@/components/ui/FormAlert";
import { SkeletonCard } from "@/components/ui/Skeleton";

// Stitch screen_3_privacy_consent. Per Patient.md §2: checkbox required,
// then persist consented_at + consent_version for the logged-in patient.
export default function PrivacyConsentPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!accepted || !session?.patientId) return;
    setError("");
    setSubmitting(true);
    const supabase = null as never;
    try {
      const settings = await queryClinicSettings(supabase);
      const consentVersion = settings?.consent_version ?? 1;
      await updatePatientConsent(supabase, session.patientId, consentVersion);
    } catch (e) {
      setSubmitting(false);
      setError(e instanceof Error ? e.message : "Could not save consent.");
      return;
    }
    setSubmitting(false);
    router.push("/patient/dashboard");
    router.refresh();
  }

  return (
    <AppShell role="patient">
      <div className="mx-auto max-w-[40rem] space-y-lg">
        <PageHeader title="How the clinic uses your information" description="Please read this and confirm before you use the patient portal." />
        {loading || !session?.patientId ? (
          <SkeletonCard lines={4} />
        ) : (
          <Card>
            <form className="space-y-lg" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
              <div className="max-w-copy space-y-sm text-body-md text-on-surface">
                <p>
                  Dr. Grace Gavino Medical Clinic collects and processes your personal and medical
                  information solely for the purpose of providing clinical care, scheduling appointments,
                  and maintaining accurate medical records. Your data will not be shared with third
                  parties without your explicit consent, except where required by law.
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
              <Button type="submit" disabled={!accepted} loading={submitting} className="w-full">
                {submitting ? "Saving…" : "Agree and continue"}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import { updatePatientConsent } from "@/lib/data/patients";

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
    const supabase = createClient();
    const { data: settings } = await supabase.from("clinic_settings").select("consent_version").eq("id", 1).maybeSingle();
    const consentVersion = settings?.consent_version ?? 1;
    try {
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

  if (loading || !session?.patientId) {
    return (
      <AppShell role="patient">
        <p className="text-body-md text-on-surface-variant">Loading consent form...</p>
      </AppShell>
    );
  }

  return (
    <AppShell role="patient">
      <Card className="mx-auto max-w-[40rem]">
        <h2 className="mb-md text-headline-md text-on-surface">Privacy Consent</h2>
        <div className="mb-lg max-h-64 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-low p-md text-body-md text-on-surface-variant">
          <p>
            Dr. Grace Gavino Medical Clinic collects and processes your personal and medical
            information solely for the purpose of providing clinical care, scheduling appointments,
            and maintaining accurate medical records. Your data will not be shared with third
            parties without your explicit consent, except where required by law.
          </p>
        </div>
        {error && <p className="mb-md rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{error}</p>}
        <label className="mb-lg flex items-center gap-sm text-body-md text-on-surface">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary/20"
          />
          I accept the privacy policy
        </label>
        <Button disabled={!accepted || submitting} className="w-full" onClick={handleSubmit}>
          {submitting ? "Saving..." : "Submit"}
        </Button>
      </Card>
    </AppShell>
  );
}

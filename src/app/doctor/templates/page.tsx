"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
//JJQR - AI (Nov 19, 2026) - new 6-tab workspace replaces the old single-page panel (DoctorTemplatesPanel.tsx is kept in the repo, unused)
import { TemplatesWorkspace } from "@/components/doctor/templates/TemplatesWorkspace";

export default function DoctorTemplatesPage() {
  return (
    <AppShell role="doctor">
      <div className="mx-auto max-w-5xl space-y-lg">
        <div>
          <h1 className="text-headline-lg text-on-surface">Consultation templates</h1>
          <p className="mt-xs text-body-md text-on-surface-variant">
            SOAP phrases, diagnoses, prescriptions, and certificates you reuse during consultations.
          </p>
        </div>
        <Suspense fallback={<p className="text-body-md text-on-surface-variant" role="status">Loading your templates…</p>}>
          <TemplatesWorkspace />
        </Suspense>
      </div>
    </AppShell>
  );
}
//JJQR - END

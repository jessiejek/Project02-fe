"use client";

import { AppShell } from "@/components/shell/AppShell";
import { DoctorTemplatesPanel } from "@/components/doctor/DoctorTemplatesPanel";

//JJQR - AI (Oct 31, 2026)
export default function DoctorTemplatesPage() {
  return (
    <AppShell role="doctor">
      {/* JJQR - AI (Oct 31, 2026) */}
      <div className="mx-auto max-w-5xl space-y-lg">
        <div>
          <h1 className="text-headline-lg text-on-surface">Consultation templates</h1>
          <p className="mt-xs text-body-md text-on-surface-variant">
            SOAP phrases, diagnoses, prescriptions, and certificates you reuse during consultations.
          </p>
        </div>
        <DoctorTemplatesPanel />
      </div>
      {/* JJQR - END */}
    </AppShell>
  );
}
//JJQR - END

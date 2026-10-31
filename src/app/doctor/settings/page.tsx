"use client";

import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { DoctorTemplatesPanel } from "@/components/doctor/DoctorTemplatesPanel";

//JJQR - AI (Oct 31, 2026)
export default function DoctorSettingsPage() {
  return (
    <AppShell role="doctor">
      <div className="mx-auto max-w-[46rem] space-y-lg">
        <div>
          <h1 className="text-headline-lg text-on-surface">Settings</h1>
          <p className="mt-xs text-body-md text-on-surface-variant">
            Account preferences and reusable consultation text.
          </p>
          <p className="mt-sm text-label-md">
            <Link href="/doctor/templates" className="text-primary hover:underline">
              Manage templates
            </Link>
          </p>
        </div>
        <DoctorTemplatesPanel />
      </div>
    </AppShell>
  );
}
//JJQR - END

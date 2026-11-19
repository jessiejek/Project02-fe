"use client";
//JJQR - AI (Nov 19, 2026) - NEW: /doctor/performance — the doctor's own practice numbers (Collected is the headline, Billed beside it; gross only).
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { PerformanceDashboard } from "@/components/doctor/performance/PerformanceDashboard";

function PerformanceContent() {
  const params = useSearchParams();
  return <PerformanceDashboard initialPeriod={params.get("period")} />;
}

export default function DoctorPerformancePage() {
  return (
    <AppShell role="doctor">
      <Suspense fallback={<SkeletonCard lines={5} />}>
        <PerformanceContent />
      </Suspense>
    </AppShell>
  );
}
//JJQR - END

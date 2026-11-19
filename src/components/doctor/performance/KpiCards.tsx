"use client";
//JJQR - AI (Nov 19, 2026) - NEW: KPI cards for the doctor Performance page. Collected is the headline, Billed sits beside it.
// A dip is a quiet grey chip — never red — so the page stays encouraging.
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { PerformancePeriodName, PerformanceStats } from "@/lib/data/doctor-performance";
import { describeChange, PREVIOUS_LABEL, pesoLabel, PERIOD_PHRASE, type Change } from "@/lib/doctor/performance";

const TONE: Record<Change["tone"], string> = {
  positive: "bg-status-success-surface text-status-success",
  soft: "bg-status-neutral-surface text-status-neutral",
  neutral: "bg-status-neutral-surface text-status-neutral",
};

export function ChangeChip({ change, testId }: { change: Change; testId?: string }) {
  return (
    <span data-testid={testId} data-direction={change.direction} data-tone={change.tone} className={cn("inline-flex max-w-full items-center rounded-full px-sm py-xs text-label-sm font-medium", TONE[change.tone])}>
      {change.text}
    </span>
  );
}

export function CollectedHero({ current, previous, period }: { current: PerformanceStats; previous: PerformanceStats; period: PerformancePeriodName }) {
  const prev = PREVIOUS_LABEL[period];
  const extras = [
    current.waived > 0 ? `${pesoLabel(current.waived)} waived` : null,
    current.refunded > 0 ? `${pesoLabel(current.refunded)} refunded (not counted)` : null,
  ].filter(Boolean);
  return (
    <Card className="col-span-2 !p-lg sm:!p-xl" data-testid="kpi-money">
      <div className="flex flex-wrap items-start justify-between gap-lg">
        <div className="min-w-0">
          <div className="mb-sm flex items-center gap-sm text-on-surface-variant">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon name="payments" /></span>
            <p className="text-body-md font-medium">Collected {PERIOD_PHRASE[period]}</p>
          </div>
          <p data-testid="kpi-collected" className="text-headline-lg font-semibold tabular-nums text-on-surface sm:text-display-sm">{pesoLabel(current.collected)}</p>
          <div className="mt-sm"><ChangeChip testId="kpi-collected-change" change={describeChange(current.collected, previous.collected, prev)} /></div>
        </div>
        <div className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-low px-md py-sm">
          <p className="text-label-md text-on-surface-variant">Billed</p>
          <p data-testid="kpi-billed" className="text-headline-md font-semibold tabular-nums text-on-surface">{pesoLabel(current.billed)}</p>
          <div className="mt-xs"><ChangeChip testId="kpi-billed-change" change={describeChange(current.billed, previous.billed, prev)} /></div>
        </div>
      </div>
      <p className="mt-md text-label-sm text-on-surface-variant">
        Your own gross figures{extras.length > 0 ? ` · ${extras.join(" · ")}` : ""}
      </p>
    </Card>
  );
}

export function PatientsCard({ current, previous, period }: { current: PerformanceStats; previous: PerformanceStats; period: PerformancePeriodName }) {
  const detail = current.patients_seen > 0
    ? `${current.new_visits} new · ${current.follow_up_visits} follow-up${current.no_shows > 0 ? ` · ${current.no_shows} no-show${current.no_shows === 1 ? "" : "s"}` : ""}`
    : "Completed visits appear here";
  return (
    <Card data-testid="kpi-patients-card">
      <div className="mb-md flex items-center gap-sm text-on-surface-variant">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon name="group" /></span>
        <p className="text-body-md font-medium">Patients seen</p>
      </div>
      <p data-testid="kpi-patients" className="text-headline-lg tabular-nums text-on-surface">{current.patients_seen}</p>
      <div className="mt-sm"><ChangeChip testId="kpi-patients-change" change={describeChange(current.patients_seen, previous.patients_seen, PREVIOUS_LABEL[period])} /></div>
      <p className="mt-sm text-label-sm text-on-surface-variant">{detail}</p>
    </Card>
  );
}

export function UnpaidCard({ count, total }: { count: number; total: number }) {
  return (
    <Link href="#unpaid" className="block" data-testid="kpi-unpaid-card">
      <Card hoverable>
        <div className="mb-md flex items-center gap-sm text-on-surface-variant">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-warning-surface text-status-warning"><Icon name="receipt_long" /></span>
          <p className="text-body-md font-medium">Still to collect</p>
        </div>
        <p data-testid="kpi-unpaid" className="text-headline-lg tabular-nums text-on-surface">{pesoLabel(total)}</p>
        <p className="mt-sm text-label-sm text-on-surface-variant">
          {count === 0 ? "All settled — nothing outstanding" : `${count} completed visit${count === 1 ? "" : "s"} unpaid`}
        </p>
      </Card>
    </Link>
  );
}
//JJQR - END

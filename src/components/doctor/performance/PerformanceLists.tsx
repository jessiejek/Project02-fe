"use client";
//JJQR - AI (Nov 19, 2026) - NEW: top diagnoses, unpaid visits, follow-ups due, and the "Also" strip for the doctor Performance page.
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { formatClinicDateShort } from "@/lib/format";
import type { DoctorPerformance, PerformanceStats } from "@/lib/data/doctor-performance";
import { alsoItems, diagnosisBars, pesoLabel } from "@/lib/doctor/performance";

export function TopDiagnoses({ items }: { items: DoctorPerformance["top_diagnoses"] }) {
  const rows = diagnosisBars(items);
  return (
    <Card className="!p-lg" data-testid="perf-top-diagnoses">
      <h2 className="text-headline-sm text-on-surface">Most common diagnoses</h2>
      <p className="mb-md text-label-sm text-on-surface-variant">From your charts in this period</p>
      {rows.length === 0 ? (
        <p data-testid="top-diagnoses-empty" className="text-body-md text-on-surface-variant">Diagnoses will show up here once you add them to your charts.</p>
      ) : (
        <ol className="space-y-md">
          {rows.map((r) => (
            <li key={`${r.code ?? "x"}-${r.label}`} data-testid="top-diagnosis">
              <div className="flex items-baseline justify-between gap-sm text-body-sm">
                <span className="min-w-0 truncate text-on-surface">{r.label}{r.code ? <span className="ml-xs text-label-sm text-on-surface-variant">{r.code}</span> : null}</span>
                <span className="shrink-0 tabular-nums font-medium text-on-surface">{r.count}</span>
              </div>
              <div className="mt-xs h-2 overflow-hidden rounded-full bg-surface-container-high" aria-hidden="true">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${r.pct}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function UnpaidList({ unpaid }: { unpaid: DoctorPerformance["unpaid"] }) {
  const more = unpaid.count - unpaid.items.length;
  return (
    <Card id="unpaid" className="!p-lg" data-testid="perf-unpaid">
      <div className="mb-md flex items-baseline justify-between gap-sm">
        <h2 className="text-headline-sm text-on-surface">Visits still to be paid</h2>
        {unpaid.count > 0 && <span className="text-label-md tabular-nums text-on-surface-variant">{pesoLabel(unpaid.total)} in total</span>}
      </div>
      {unpaid.items.length === 0 ? (
        <p data-testid="unpaid-empty" className="flex items-center gap-sm text-body-md text-on-surface-variant"><Icon name="check_circle" className="text-status-success" />Everything is settled — nothing outstanding.</p>
      ) : (
        <ul className="space-y-xs">
          {unpaid.items.map((u) => (
            <li key={u.booking_id}>
              <Link href={`/doctor/appointments/${u.booking_id}`} data-testid="unpaid-item" className="flex min-h-11 items-center justify-between gap-md rounded-lg border border-outline-variant px-md py-sm hover:bg-surface-container-low">
                <span className="min-w-0">
                  <span className="block truncate text-body-sm font-medium text-on-surface">{u.patient_name || "Patient"}</span>
                  <span className="block text-label-sm text-on-surface-variant">{formatClinicDateShort(u.appointment_date)}</span>
                </span>
                <span className="shrink-0 tabular-nums text-body-sm text-on-surface">{pesoLabel(u.amount_due)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {more > 0 && <p className="mt-sm text-label-sm text-on-surface-variant">and {more} more — the front desk can see the full list.</p>}
    </Card>
  );
}

export function FollowUpList({ followUps }: { followUps: DoctorPerformance["follow_ups_due"] }) {
  const more = followUps.count - followUps.items.length;
  return (
    <Card className="!p-lg" data-testid="perf-followups">
      <div className="mb-md flex items-baseline justify-between gap-sm">
        <h2 className="text-headline-sm text-on-surface">Follow-ups due</h2>
        {followUps.count > 0 && <span className="text-label-md tabular-nums text-on-surface-variant">{followUps.count}</span>}
      </div>
      {followUps.items.length === 0 ? (
        <p data-testid="followups-empty" className="flex items-center gap-sm text-body-md text-on-surface-variant"><Icon name="check_circle" className="text-status-success" />No follow-ups waiting on you.</p>
      ) : (
        <ul className="space-y-xs">
          {followUps.items.map((f) => (
            <li key={f.follow_up_id}>
              <Link href={`/doctor/patients/${f.patient_id}`} data-testid="followup-item" className="flex min-h-11 items-center justify-between gap-md rounded-lg border border-outline-variant px-md py-sm hover:bg-surface-container-low">
                <span className="min-w-0">
                  <span className="block truncate text-body-sm font-medium text-on-surface">{f.patient_name || "Patient"}</span>
                  <span className="block truncate text-label-sm text-on-surface-variant">{f.reason?.trim() || "Follow-up visit"}</span>
                </span>
                <span className="shrink-0 text-label-md text-on-surface-variant">{formatClinicDateShort(f.follow_up_date)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {more > 0 && <p className="mt-sm text-label-sm text-on-surface-variant">and {more} more.</p>}
    </Card>
  );
}

export function AlsoStrip({ stats }: { stats: PerformanceStats }) {
  return (
    <section aria-label="Also in this period" data-testid="perf-also" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-md">
      <p className="mb-sm text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">Also</p>
      <ul className="grid grid-cols-2 gap-md sm:grid-cols-3 lg:grid-cols-6">
        {alsoItems(stats).map((i) => (
          <li key={i.key} data-testid={`also-${i.key}`} className="flex items-center gap-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon name={i.icon} /></span>
            <span className="min-w-0">
              <span className="block text-headline-sm font-semibold tabular-nums text-on-surface">{i.value}</span>
              <span className="block text-label-sm text-on-surface-variant">{i.label}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
//JJQR - END

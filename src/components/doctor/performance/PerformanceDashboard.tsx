"use client";
//JJQR - AI (Nov 19, 2026) - NEW: the doctor's Performance page body — greeting, period toggle, KPI cards, 14-day chart, top diagnoses, unpaid + follow-ups, "Also" strip. Loading / error (Retry) / empty states included.
import { useEffect, useState } from "react";
import Link from "next/link";
import { DoctorPageHeader } from "@/components/doctor/DoctorPageHeader";
import { SkeletonCard, Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/components/providers/SessionProvider";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { useClinicHubEvent } from "@/lib/realtime/clinicHub";
import { fetchDoctorPerformance, type DoctorPerformance, type PerformancePeriodName } from "@/lib/data/doctor-performance";
import { emptyMessage, greeting, headline, isEmptyPeriod, isPeriod } from "@/lib/doctor/performance";
import { formatClinicDateShort } from "@/lib/format";
import { PeriodToggle } from "./PeriodToggle";
import { CollectedHero, PatientsCard, UnpaidCard } from "./KpiCards";
import { PerformanceChart } from "./PerformanceChart";
import { AlsoStrip, FollowUpList, TopDiagnoses, UnpaidList } from "./PerformanceLists";

/** What the last request produced, tagged with the period + retry count it was for (so "loading" is derived, not set). */
interface Result {
  key: string;
  data?: DoctorPerformance;
  failed?: boolean;
  fetchedAt?: number;
}

const POLL_MS = 60_000;

export function PerformanceDashboard({ initialPeriod }: { initialPeriod?: string | null }) {
  const { session } = useSession();
  const [period, setPeriod] = useState<PerformancePeriodName>(isPeriod(initialPeriod) ? initialPeriod : "today");
  const [attempt, setAttempt] = useState(0); // bumped by Retry (shows the loading state again)
  const [tick, setTick] = useState(0); // bumped by live events / the poll (refreshes silently)
  const [result, setResult] = useState<Result | null>(null);
  const key = `${period}:${attempt}`;

  useEffect(() => {
    if (!session?.staffId) return;
    const controller = new AbortController();
    fetchDoctorPerformance(period, { signal: controller.signal }).then(
      (data) => setResult({ key, data, fetchedAt: Date.now(), failed: false }),
      () => {
        if (controller.signal.aborted) return;
        // A silent refresh that fails keeps what is on screen; only a first load / Retry shows the error.
        setResult((prev) => (prev?.key === key && prev.data ? prev : { key, failed: true }));
      },
    );
    return () => controller.abort();
  }, [period, key, tick, session?.staffId]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), POLL_MS);
    return () => clearInterval(t);
  }, []);
  const refresh = () => setTick((n) => n + 1);
  useClinicHubEvent("PaymentUpdated", refresh);
  useClinicHubEvent("QueueUpdated", refresh);

  if (session && !session.staffId) {
    return (
      <div className="space-y-sm" data-testid="perf-no-profile">
        <p className="text-headline-sm text-on-surface">No doctor profile linked</p>
        <p className="text-body-md text-on-surface-variant">This login has no staff profile on the server, so your performance cannot load. Ask your clinic administrator to link your account to a doctor profile.</p>
      </div>
    );
  }

  const current = result && result.key === key ? result : null;
  const showError = !!current?.failed;
  const data = current?.data ?? (result?.data && !showError ? result.data : undefined); // keep the last numbers on screen (dimmed) while the next period loads
  const stale = !!data && !current?.data;

  return (
    <div className="min-w-0 space-y-lg overflow-x-hidden" data-testid="perf-page">
      <DoctorPageHeader
        title={data && result?.fetchedAt ? greeting(result.fetchedAt, session?.displayName) : "Your performance"}
        description={
          <span data-testid="perf-headline">
            {data ? headline(period, data.current, data.previous) : "Gathering your numbers…"}
          </span>
        }
        actions={
          <Link href="/doctor/dashboard" className={buttonStyles("secondary")}>
            <Icon name="dashboard" className="h-4 w-4" />Back to Today
          </Link>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-md">
        <PeriodToggle value={period} onChange={setPeriod} />
        {data && (
          <p data-testid="perf-range" className="text-label-md text-on-surface-variant">
            {data.period.from === data.period.to
              ? formatClinicDateShort(data.period.from)
              : `${formatClinicDateShort(data.period.from)} – ${formatClinicDateShort(data.period.to)}`}
            {" · "}your own patients, gross figures
          </p>
        )}
      </div>

      {showError ? (
        <div data-testid="perf-error">
          <ErrorState
            title="We couldn't load your numbers"
            message="Something went wrong on our side — nothing is lost. Please try again in a moment."
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </div>
      ) : !data ? (
        <div data-testid="perf-loading" role="status" aria-label="Loading your performance" className="space-y-lg">
          <div className="grid grid-cols-2 gap-lg lg:grid-cols-4">
            <Skeleton className="col-span-2 h-44" />
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
          <SkeletonCard lines={6} />
        </div>
      ) : (
        <div aria-busy={stale} className={stale ? "space-y-lg opacity-60 transition-opacity" : "space-y-lg transition-opacity"}>
          {isEmptyPeriod(data.current) && (
            <div data-testid="perf-empty" className="flex items-start gap-md rounded-xl border border-primary/20 bg-primary/5 p-md">
              <Icon name="info" className="mt-xs text-primary" />
              <p className="text-body-md text-on-surface">{emptyMessage(period)}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-lg lg:grid-cols-4">
            <CollectedHero current={data.current} previous={data.previous} period={period} />
            <PatientsCard current={data.current} previous={data.previous} period={period} />
            <UnpaidCard count={data.unpaid.count} total={data.unpaid.total} />
          </div>

          <div className="grid grid-cols-1 gap-lg lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2"><PerformanceChart series={data.series} /></div>
            <div className="min-w-0"><TopDiagnoses items={data.top_diagnoses} /></div>
          </div>

          <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
            <UnpaidList unpaid={data.unpaid} />
            <FollowUpList followUps={data.follow_ups_due} />
          </div>

          <AlsoStrip stats={data.current} />
        </div>
      )}
    </div>
  );
}
//JJQR - END

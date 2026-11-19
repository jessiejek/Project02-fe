"use client";
//JJQR - AI (Nov 19, 2026) - NEW: hand-drawn SVG bar chart of the last 14 days (no chart library). Tap/hover a bar for that day's numbers.
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { PerformanceDay } from "@/lib/data/doctor-performance";
import { buildChart, chartSummary, dayLabel, pesoCompact, pesoLabel, type ChartMetric } from "@/lib/doctor/performance";

const METRICS: { id: ChartMetric; label: string }[] = [
  { id: "collected", label: "Collected" },
  { id: "patients_seen", label: "Patients" },
];

export function PerformanceChart({ series }: { series: PerformanceDay[] }) {
  const [metric, setMetric] = useState<ChartMetric>("collected");
  const [picked, setPicked] = useState<string | null>(null);
  // The series always ends on today (clinic time), so no clock is read here.
  const today = series.length > 0 ? series[series.length - 1].date : "";
  const chart = buildChart(series, metric, today);
  const activeDate = picked ?? today;
  const active = series.find((d) => d.date === activeDate) ?? null;
  const empty = series.every((d) => d.collected === 0 && d.patients_seen === 0);

  return (
    <Card className="!p-lg" data-testid="perf-chart">
      <div className="mb-md flex flex-wrap items-center justify-between gap-sm">
        <div>
          <h2 className="text-headline-sm text-on-surface">Last 14 days</h2>
          <p className="text-label-sm text-on-surface-variant">Completed visits, by clinic day</p>
        </div>
        <div role="group" aria-label="Chart metric" className="inline-flex rounded-lg border border-outline-variant bg-surface-container-low p-xs">
          {METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={metric === m.id}
              data-testid={`chart-metric-${m.id}`}
              onClick={() => setMetric(m.id)}
              className={cn("min-h-9 rounded-md px-md text-label-md font-medium", metric === m.id ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high")}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <EmptyState icon="monitoring" message="Your daily chart will fill in as you complete visits." />
      ) : (
        <>
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            role="img"
            aria-label={chartSummary(series, metric)}
            className="h-auto w-full"
            data-testid="perf-chart-svg"
          >
            {chart.ticks.map((t) => (
              <g key={t.value}>
                <line x1={48} x2={chart.width - 8} y1={t.y} y2={t.y} className="stroke-outline-variant" strokeWidth={1} strokeDasharray={t.value === 0 ? undefined : "3 4"} />
                <text x={42} y={t.y + 4} textAnchor="end" className="fill-on-surface-variant" fontSize={11}>
                  {metric === "collected" ? pesoCompact(t.value) : String(t.value)}
                </text>
              </g>
            ))}
            {chart.bars.map((b, i) => {
              const isActive = b.date === activeDate;
              const showLabel = i % 2 === (chart.bars.length - 1) % 2; // every other label so 14 fit on a narrow screen
              return (
                <g
                  key={b.date}
                  data-testid="chart-bar"
                  data-date={b.date}
                  data-value={b.value}
                  // mouse: hover previews a day; touch/pen: a tap picks it and it stays picked (a touch "leave" fires right after the tap)
                  onPointerEnter={(e) => { if (e.pointerType === "mouse") setPicked(b.date); }}
                  onPointerLeave={(e) => { if (e.pointerType === "mouse") setPicked(null); }}
                  onClick={() => setPicked(b.date)}
                  className="cursor-pointer"
                >
                  {/* a wide invisible target so a fingertip can hit even a short bar */}
                  <rect x={b.x - 4} y={12} width={b.width + 8} height={chart.baseline - 12} fill="transparent" />
                  {b.height > 0 && (
                    <rect x={b.x} y={b.y} width={b.width} height={b.height} rx={4} className={cn(b.isToday || isActive ? "fill-primary" : "fill-primary/35")} />
                  )}
                  {showLabel && (
                    <text x={b.x + b.width / 2} y={chart.baseline + 18} textAnchor="middle" fontSize={10.5} className={cn(b.isToday ? "fill-primary font-semibold" : "fill-on-surface-variant")}>
                      {b.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <p data-testid="chart-readout" aria-live="polite" className="mt-sm min-h-6 text-body-sm text-on-surface-variant">
            {active
              ? <><span className="font-medium text-on-surface">{dayLabel(active.date)}{active.date === today ? " (today)" : ""}</span> · {active.patients_seen} patient{active.patients_seen === 1 ? "" : "s"} · {pesoLabel(active.collected)} collected</>
              : null}
          </p>
          <table className="sr-only">
            <caption>Daily numbers for the last {series.length} days</caption>
            <thead><tr><th>Day</th><th>Patients seen</th><th>Collected</th></tr></thead>
            <tbody>
              {series.map((d) => <tr key={d.date}><td>{dayLabel(d.date)}</td><td>{d.patients_seen}</td><td>{pesoLabel(d.collected)}</td></tr>)}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}
//JJQR - END

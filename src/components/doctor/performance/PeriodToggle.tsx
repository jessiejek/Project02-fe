"use client";
//JJQR - AI (Nov 19, 2026) - NEW: Today / This week / This month toggle for the doctor Performance page.
import { cn } from "@/lib/cn";
import type { PerformancePeriodName } from "@/lib/data/doctor-performance";
import { PERIOD_OPTIONS } from "@/lib/doctor/performance";

export function PeriodToggle({ value, onChange }: { value: PerformancePeriodName; onChange: (p: PerformancePeriodName) => void }) {
  return (
    <div role="group" aria-label="Time period" data-testid="period-toggle" className="inline-flex rounded-xl border border-outline-variant bg-surface-container-low p-xs">
      {PERIOD_OPTIONS.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            data-testid={`period-${o.id}`}
            onClick={() => onChange(o.id)}
            className={cn(
              "min-h-11 rounded-lg px-md text-body-md font-medium transition-colors",
              active ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
//JJQR - END

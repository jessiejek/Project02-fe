import { cn } from "@/lib/cn";

export interface BookingTimelineProps {
  steps: string[];
  currentIndex: number;
}

/**
 * Shared status-timeline row (checkmarked circles connected by lines),
 * extracted during the Phase G dedup pass — was duplicated independently in
 * patient/bookings/[id] and admin/bookings/[id]. Staff's booking detail
 * doesn't use a timeline at all (its status set doesn't map to one), so it
 * isn't a candidate for this component.
 */
export function BookingTimeline({ steps, currentIndex }: BookingTimelineProps) {
  if (currentIndex < 0) return null;

  return (
    <div className="flex items-center gap-xs">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-xs">
          {i > 0 && <div className={cn("h-px w-6", i <= currentIndex ? "bg-primary" : "bg-outline-variant")} />}
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-[10px]",
              i <= currentIndex ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant",
            )}
          >
            {i <= currentIndex ? "✓" : i + 1}
          </span>
        </div>
      ))}
    </div>
  );
}

import { Icon } from "@/components/ui/Icon";
import { statusLabel } from "@/components/ui/StatusPill";
import { cn } from "@/lib/cn";

export interface BookingTimelineProps {
  steps: string[];
  currentIndex: number;
}

/**
 * Shared status-timeline row (checkmarked circles connected by lines, each
 * with its step name), used by patient/bookings/[id] and admin/bookings/[id].
 * Staff's booking detail doesn't use a timeline (its status set doesn't map
 * to one). Renders nothing for statuses that sit outside the happy path.
 */
export function BookingTimeline({ steps, currentIndex }: BookingTimelineProps) {
  if (currentIndex < 0) return null;

  return (
    <ol className="flex w-full items-start" aria-label="Booking progress">
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <li key={step} className="flex min-w-0 flex-1 flex-col items-center gap-xs text-center"
            aria-label={`${statusLabel(step)}${current ? ": current step" : done ? ": complete" : ""}`} aria-current={current ? "step" : undefined}>
            <div className="flex w-full items-center">
              <div className={cn("h-px flex-1", i === 0 ? "bg-transparent" : i <= currentIndex ? "bg-primary" : "bg-outline-variant")} />
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-label-sm tabular-nums transition-colors",
                  i <= currentIndex ? "bg-primary text-on-primary" : "border border-outline-variant bg-surface-container-lowest text-on-surface-variant",
                  current && "ring-4 ring-primary/15",
                )}
              >
                {done || (current && i === steps.length - 1) ? <Icon name="check" className="h-3 w-3" /> : i + 1}
              </span>
              <div className={cn("h-px flex-1", i === steps.length - 1 ? "bg-transparent" : i < currentIndex ? "bg-primary" : "bg-outline-variant")} />
            </div>
            <span className={cn("px-xs text-label-md", current ? "font-semibold text-on-surface" : "text-on-surface-variant")}>{statusLabel(step)}</span>
          </li>
        );
      })}
    </ol>
  );
}

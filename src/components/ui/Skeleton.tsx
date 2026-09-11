import { cn } from "@/lib/cn";

/**
 * Loading placeholders — shaped like the content they stand in for, so a
 * fetch never reads as "blank/broken," it reads as "working." Respects
 * prefers-reduced-motion (globals.css turns the pulse into a static tint).
 */

/** One rectangular block — the primitive everything else composes from. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-container-high", className)} />;
}

/** A handful of lines of decreasing width, standing in for a paragraph/label group. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-sm", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** A table's worth of rows, N columns wide — for any list/table page's loading state. */
export function SkeletonTable({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-sm" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-md rounded-lg border border-outline-variant p-md">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={cn("h-4", c === 0 ? "w-1/4" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A card-shaped block — for a detail page's header/body while it loads. */
export function SkeletonCard({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-md rounded-xl border border-outline-variant p-lg" role="status" aria-label="Loading">
      <Skeleton className="h-6 w-1/3" />
      <SkeletonText lines={lines} />
    </div>
  );
}

/** A row of dashboard-style summary tiles. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-md sm:grid-cols-4" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-sm rounded-xl border border-outline-variant p-lg">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-7 w-1/3" />
        </div>
      ))}
    </div>
  );
}

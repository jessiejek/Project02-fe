/** Instant feedback while a route segment loads (RSC flight / first compile). */
export function RouteLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="mx-auto max-w-[40rem] space-y-lg p-lg" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="h-4 w-40 animate-pulse rounded bg-surface-container-high" />
      <div className="space-y-md rounded-xl border border-outline-variant p-lg">
        <div className="h-7 w-56 animate-pulse rounded bg-surface-container-high" />
        <div className="h-4 w-72 animate-pulse rounded bg-surface-container-high" />
        <div className="h-4 w-48 animate-pulse rounded bg-surface-container-high" />
      </div>
      <div className="h-11 w-full animate-pulse rounded-lg bg-surface-container-high" />
    </div>
  );
}

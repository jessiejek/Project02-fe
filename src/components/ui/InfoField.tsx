import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Label/value pair for detail screens. Empty values read as "—", identifiers may opt into mono. */
export function InfoField({ label, value, mono = false, className }: {
  label: string; value: ReactNode; mono?: boolean; className?: string;
}) {
  const empty = value === null || value === undefined || (typeof value === "string" && !value.trim());
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-label-md text-on-surface-variant">{label}</dt>
      <dd className={cn("mt-0.5 break-words text-body-md text-on-surface", mono && !empty && "font-mono text-body-sm", empty && "text-on-surface-variant")}>
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

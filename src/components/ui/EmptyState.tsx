import { type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

export interface EmptyStateProps {
  icon: string;
  message: string;
  action?: ReactNode;
}

/** Icon + short message + optional CTA — per Stitch-00 Sheet 2 (e.g. "No documents yet"). */
export function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-md rounded-xl border border-dashed border-outline-variant p-xl text-center">
      <Icon name={icon} className="text-[40px] text-on-surface-variant/50" />
      <p className="text-body-md text-on-surface-variant">{message}</p>
      {action}
    </div>
  );
}

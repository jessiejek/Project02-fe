import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

type Tone = "danger" | "success" | "info" | "warning";
const TONES: Record<Tone, { box: string; icon: string }> = {
  danger: { box: "border-status-danger-border bg-status-danger-surface text-status-danger", icon: "error" },
  success: { box: "border-status-success-border bg-status-success-surface text-status-success", icon: "check_circle" },
  info: { box: "border-status-info-border bg-status-info-surface text-status-info", icon: "info" },
  warning: { box: "border-status-warning-border bg-status-warning-surface text-status-warning", icon: "warning" },
};

/** Inline form feedback that uses the semantic status tokens and is announced to screen readers. */
export function FormAlert({ tone = "danger", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const t = TONES[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"}
      className={cn("animate-surface-in flex items-start gap-sm rounded-lg border px-md py-sm text-body-md", t.box, className)}>
      <Icon name={t.icon} className="mt-0.5 shrink-0 text-[16px]" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

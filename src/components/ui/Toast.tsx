"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

export type ToastVariant = "info" | "warning" | "success" | "error";

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  info: "bg-status-info-surface border-status-info-border text-status-info",
  warning: "bg-status-warning-surface border-status-warning-border text-status-warning",
  success: "bg-status-success-surface border-status-success-border text-status-success",
  error: "bg-status-danger-surface border-status-danger-border text-status-danger",
};

const VARIANT_ICON: Record<ToastVariant, string> = {
  info: "info",
  warning: "warning",
  success: "check_circle",
  error: "error",
};

export interface ToastProps {
  variant: ToastVariant;
  message: string;
  actionLabel?: string;
  actionLoading?: boolean;
  onAction?: () => void;
  /** Prefer over onAction for in-app navigation — enables prefetch. */
  actionHref?: string;
  dismissible?: boolean;
}

/** Dismissible alert banner (info/warning/success/error) — per Stitch-00 Sheet 2. */
export function Toast({ variant, message, actionLabel, onAction, actionHref, actionLoading = false, dismissible = true }: ToastProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  //JJQR Nov 20, 2026 - one card: icon | message (flex-1, min-w-0, wraps) | Undo | X, all inside the background
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "animate-toast-in flex w-full items-center gap-md rounded-lg border px-md py-sm shadow-md",
        VARIANT_CLASSES[variant],
      )}
    >
      <span className="flex shrink-0 items-center"><Icon name={VARIANT_ICON[variant]} /></span>
      <p className="min-w-0 flex-1 break-words text-body-md line-clamp-2" title={message}>
        {message}
        {actionLabel && actionHref && (
          <Link href={actionHref} className="ml-xs font-bold underline">
            {actionLabel}
          </Link>
        )}
      </p>
      {actionLabel && !actionHref && (
        <button type="button" onClick={onAction} disabled={actionLoading} aria-busy={actionLoading || undefined} className="shrink-0 whitespace-nowrap rounded-md px-sm py-xs font-bold underline hover:bg-black/10 disabled:cursor-wait">
          {actionLoading ? "Sending…" : actionLabel}
        </button>
      )}
      {dismissible && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-xs transition-all hover:bg-black/10"
        >
          <Icon name="close" />
        </button>
      )}
    </div>
  );
  //JJQR - END
}

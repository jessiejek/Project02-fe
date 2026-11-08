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
  onAction?: () => void;
  /** Prefer over onAction for in-app navigation — enables prefetch. */
  actionHref?: string;
  dismissible?: boolean;
}

/** Dismissible alert banner (info/warning/success/error) — per Stitch-00 Sheet 2. */
export function Toast({ variant, message, actionLabel, onAction, actionHref, dismissible = true }: ToastProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      role="status"
      className={cn(
        "animate-toast-in flex items-center justify-between gap-md rounded-lg border px-md py-sm shadow-sm",
        VARIANT_CLASSES[variant],
      )}
    >
      <div className="flex items-center gap-md">
        <Icon name={VARIANT_ICON[variant]} />
        <p className="text-body-md">
          {message}
          {actionLabel && actionHref && (
            <Link href={actionHref} className="ml-xs font-bold underline">
              {actionLabel}
            </Link>
          )}
          {actionLabel && !actionHref && (
            <button type="button" onClick={onAction} className="ml-xs font-bold underline">
              {actionLabel}
            </button>
          )}
        </p>
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="rounded-full p-xs transition-all hover:bg-black/10"
        >
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}

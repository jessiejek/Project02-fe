"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

export type ToastVariant = "info" | "warning" | "success" | "error";

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  info: "bg-blue-50 border-blue-200 text-blue-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  success: "bg-green-50 border-green-200 text-green-800",
  error: "bg-red-50 border-red-200 text-red-800",
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
      className={cn(
        "flex items-center justify-between gap-md rounded-lg border px-md py-sm shadow-sm",
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

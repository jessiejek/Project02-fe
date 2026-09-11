"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /**
   * The action behind this click is in flight. Disables the button, swaps the
   * cursor to a spinner (not the "not-allowed" slash — this isn't blocked, it's
   * working), and shows a small spin icon so a click always gets an immediate,
   * honest reaction instead of looking like nothing happened.
   */
  loading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-container shadow-sm",
  secondary:
    "bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container-high",
  ghost: "bg-transparent text-on-surface-variant hover:bg-surface-container-low",
  danger: "bg-error text-on-error hover:opacity-90 shadow-sm",
};

/**
 * Single Button implementation for the whole app (per React-Conversion-Guide.md
 * §5) — primary/secondary/ghost/danger, replaces every per-screen button
 * markup from the Stitch export.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className, disabled, loading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          // §1 (apple-design): feedback on the press itself, instant and snappy.
          "inline-flex items-center justify-center gap-sm rounded-lg px-lg py-md text-label-md font-medium",
          "transition-[transform,background-color,color,box-shadow] duration-150 ease-[var(--ease-out-quart)]",
          "active:scale-[0.97] motion-reduce:active:scale-100",
          "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-none disabled:active:scale-100",
          loading && "!cursor-wait",
          VARIANT_CLASSES[variant],
          className,
        )}
        {...props}
      >
        {loading && (
          <svg
            className="h-4 w-4 animate-spin motion-reduce:hidden"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
          </svg>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
